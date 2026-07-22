import { prisma } from "../lib/prisma"
import { getCase, transitionCase, updateCase, writeCaseEvent } from "./onboardingClient"
import { assertTenantMatches } from "../middleware/tenantContext"

export const MANUAL_REVIEW_RETRY_THRESHOLD = 3

export function normalizeOutboxStatus(status?: string | null): "PENDING" | "SENT" | "FAILED" {
  if (status === "SENT") return "SENT"
  if (status === "FAILED") return "FAILED"
  return "PENDING"
}

export function failureResolutionForRetry(retryCount: number): "RETRY_REQUIRED" | "MANUAL_REVIEW_REQUIRED" {
  return retryCount >= MANUAL_REVIEW_RETRY_THRESHOLD ? "MANUAL_REVIEW_REQUIRED" : "RETRY_REQUIRED"
}

export function requireBahmniCreatedPayload(payload: {
  bahmni_patient_uuid?: string | null
  bahmni_order_uuid?: string | null
}) {
  if (!payload.bahmni_patient_uuid || !payload.bahmni_order_uuid) {
    throw new Error("bahmni_patient_uuid and bahmni_order_uuid are required")
  }
}

export async function createOrUpdateConfirmedReconciliation(params: {
  caseId: string
  tenantId: string
  appointmentId: string
  paymentOrderId: string | null
  outboxEventId: string | null
  outboxStatus: string | null
}) {
  if (!params.caseId) {
    throw new Error("case_id is mandatory for B2C reconciliation")
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: params.appointmentId },
    include: { center: { include: { vendor: true } } }
  })
  if (!appointment) {
    throw new Error("Appointment not found while creating B2C reconciliation")
  }

  return prisma.b2COrderReconciliation.upsert({
    where: { caseId: params.caseId },
    create: {
      caseId: params.caseId,
      tenantId: params.tenantId,
      hospitalId: appointment.hospitalId || appointment.center.vendorId,
      appointmentId: params.appointmentId,
      paymentOrderId: params.paymentOrderId,
      paymentStatus: "SUCCESS",
      outboxEventId: params.outboxEventId,
      outboxStatus: normalizeOutboxStatus(params.outboxStatus),
      bahmniOrderStatus: "PENDING",
      resolutionStatus: "OPEN"
    },
    update: {
      tenantId: params.tenantId,
      hospitalId: appointment.hospitalId || appointment.center.vendorId,
      appointmentId: params.appointmentId,
      paymentOrderId: params.paymentOrderId,
      paymentStatus: "SUCCESS",
      outboxEventId: params.outboxEventId,
      outboxStatus: normalizeOutboxStatus(params.outboxStatus),
      bahmniOrderStatus: "PENDING",
      resolutionStatus: "OPEN",
      lastErrorCode: null,
      lastErrorMessage: null,
      resolvedBy: null,
      resolvedAt: null
    }
  })
}

export async function refreshReconciliationOutboxStatus(caseId: string) {
  const reconciliation = await prisma.b2COrderReconciliation.findUnique({ where: { caseId } })
  if (!reconciliation?.outboxEventId) return reconciliation

  const outbox = await prisma.outboxEvent.findUnique({ where: { id: reconciliation.outboxEventId } })
  if (!outbox) return reconciliation

  const outboxStatus = normalizeOutboxStatus(outbox.status)
  if (outboxStatus === reconciliation.outboxStatus) return reconciliation

  return prisma.b2COrderReconciliation.update({
    where: { caseId },
    data: { outboxStatus }
  })
}

export async function markBahmniOrderCreated(caseId: string, payload: {
  bahmni_patient_uuid?: string | null
  bahmni_order_uuid?: string | null
  bahmni_visit_uuid?: string | null
  actor_id?: string | null
}, expectedTenantId?: string) {
  requireBahmniCreatedPayload(payload)
  const caseRow = await getCase(caseId)
  const reconciliation = await prisma.b2COrderReconciliation.findUnique({ where: { caseId } })
  if (!reconciliation) {
    throw new Error("B2C reconciliation row not found for case_id")
  }
  if (expectedTenantId !== undefined) {
    assertTenantMatches(reconciliation.tenantId, expectedTenantId)
  }

  await updateCase(caseId, {
    bahmni_patient_uuid: payload.bahmni_patient_uuid,
    bahmni_patient_id: payload.bahmni_patient_uuid,
    bahmni_order_uuid: payload.bahmni_order_uuid,
    bahmni_order_id: payload.bahmni_order_uuid
  })

  if (caseRow.status !== "BAHMNI_ORDER_CREATED") {
    await transitionCase({
      caseId,
      tenantId: caseRow.tenant_id,
      newStatus: "BAHMNI_ORDER_CREATED",
      eventType: "B2C_BAHMNI_ORDER_CREATED",
      sourceService: "sidecar",
      metadata: {
        bahmni_patient_uuid: payload.bahmni_patient_uuid,
        bahmni_order_uuid: payload.bahmni_order_uuid,
        bahmni_visit_uuid: payload.bahmni_visit_uuid || null
      }
    })
  }

  return prisma.b2COrderReconciliation.update({
    where: { caseId },
    data: {
      bahmniPatientUuid: payload.bahmni_patient_uuid!,
      bahmniOrderUuid: payload.bahmni_order_uuid!,
      bahmniVisitUuid: payload.bahmni_visit_uuid || null,
      bahmniOrderStatus: "CREATED",
      resolutionStatus: "RESOLVED",
      resolvedBy: payload.actor_id || "sidecar",
      resolvedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null
    }
  })
}

export async function markBahmniOrderFailed(caseId: string, payload: {
  error_code?: string | null
  error_message?: string | null
  actor_id?: string | null
}, expectedTenantId?: string) {
  const caseRow = await getCase(caseId)
  const reconciliation = await prisma.b2COrderReconciliation.findUnique({ where: { caseId } })
  if (!reconciliation) {
    throw new Error("B2C reconciliation row not found for case_id")
  }
  if (expectedTenantId !== undefined) {
    assertTenantMatches(reconciliation.tenantId, expectedTenantId)
  }

  const retryCount = reconciliation.retryCount + 1
  const resolutionStatus = failureResolutionForRetry(retryCount)
  const updated = await prisma.b2COrderReconciliation.update({
    where: { caseId },
    data: {
      bahmniOrderStatus: "FAILED",
      retryCount,
      lastErrorCode: payload.error_code || null,
      lastErrorMessage: payload.error_message || "Bahmni order creation failed",
      resolutionStatus
    }
  })

  await writeCaseEvent({
    caseId,
    tenantId: caseRow.tenant_id,
    eventType: "B2C_BAHMNI_ORDER_FAILED",
    actorType: "SYSTEM",
    actorId: payload.actor_id || "sidecar",
    sourceService: "sidecar",
    reasonCode: payload.error_code || "BAHMNI_ORDER_FAILED",
    metadata: {
      retry_count: retryCount,
      resolution_status: resolutionStatus,
      error_message: payload.error_message || null
    }
  })

  return updated
}

export async function markReconciliationManualReview(caseId: string, actorId?: string | null) {
  const caseRow = await getCase(caseId)
  const updated = await prisma.b2COrderReconciliation.update({
    where: { caseId },
    data: { resolutionStatus: "MANUAL_REVIEW_REQUIRED" }
  })
  await writeCaseEvent({
    caseId,
    tenantId: caseRow.tenant_id,
    eventType: "B2C_RECONCILIATION_MANUAL_REVIEW",
    actorType: "ADMIN",
    actorId: actorId || "scansure-admin",
    sourceService: "crs-admin",
    reasonCode: "MANUAL_REVIEW_REQUIRED",
    metadata: { resolution_status: "MANUAL_REVIEW_REQUIRED" }
  })
  return updated
}

export async function markReconciliationRefundRequired(caseId: string, actorId?: string | null) {
  const caseRow = await getCase(caseId)
  const updated = await prisma.b2COrderReconciliation.update({
    where: { caseId },
    data: {
      paymentStatus: "SUCCESS",
      resolutionStatus: "REFUND_REQUIRED"
    }
  })
  await writeCaseEvent({
    caseId,
    tenantId: caseRow.tenant_id,
    eventType: "B2C_RECONCILIATION_REFUND_REQUIRED",
    actorType: "ADMIN",
    actorId: actorId || "scansure-admin",
    sourceService: "crs-admin",
    reasonCode: "REFUND_REQUIRED",
    metadata: { resolution_status: "REFUND_REQUIRED" }
  })
  return updated
}

export async function resolveReconciliation(caseId: string, actorId?: string | null) {
  const caseRow = await getCase(caseId)
  const updated = await prisma.b2COrderReconciliation.update({
    where: { caseId },
    data: {
      resolutionStatus: "RESOLVED",
      resolvedBy: actorId || "scansure-admin",
      resolvedAt: new Date()
    }
  })
  await writeCaseEvent({
    caseId,
    tenantId: caseRow.tenant_id,
    eventType: "B2C_RECONCILIATION_RESOLVED",
    actorType: "ADMIN",
    actorId: actorId || "scansure-admin",
    sourceService: "crs-admin",
    reasonCode: "RESOLVED",
    metadata: { resolution_status: "RESOLVED" }
  })
  return updated
}

async function decorateRow(row: Awaited<ReturnType<typeof prisma.b2COrderReconciliation.findMany>>[number]) {
  const [appointment, caseRow] = await Promise.all([
    prisma.appointment.findUnique({
      where: { id: row.appointmentId },
      include: {
        patient: true,
        testConfig: true,
        modality: true,
        center: { include: { vendor: true } }
      }
    }),
    getCase(row.caseId).catch(() => null)
  ])

  const patientName = appointment?.patient
    ? [appointment.patient.firstName, appointment.patient.lastName].filter(Boolean).join(" ")
    : null

  return {
    ...row,
    patientName,
    scanType: appointment?.testConfig.testKeyword || null,
    modality: appointment?.modality.code || null,
    hospitalName: appointment?.center.vendor.name || row.hospitalId,
    caseStatus: caseRow?.status || null
  }
}

export async function listReconciliations(filters: {
  tenantId?: string
  resolutionStatus?: string
  limit?: number
}) {
  const rows = await prisma.b2COrderReconciliation.findMany({
    where: {
      tenantId: filters.tenantId || undefined,
      resolutionStatus: filters.resolutionStatus as never || undefined
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(filters.limit || 100, 250)
  })

  const refreshed = await Promise.all(rows.map((row) => refreshReconciliationOutboxStatus(row.caseId)))
  return Promise.all(refreshed.filter(Boolean).map((row) => decorateRow(row!)))
}

export async function getReconciliationDetail(caseId: string, expectedTenantId?: string) {
  await refreshReconciliationOutboxStatus(caseId)
  const row = await prisma.b2COrderReconciliation.findUnique({ where: { caseId } })
  if (!row) return null
  if (expectedTenantId !== undefined) {
    assertTenantMatches(row.tenantId, expectedTenantId)
  }
  return decorateRow(row)
}
