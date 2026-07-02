import { prisma } from "../lib/prisma"
import { createB2CCase, ServiceMappingValidation, transitionCase, validateB2CServiceMapping } from "./onboardingClient"
import { createOrUpdateConfirmedReconciliation } from "./b2cReconciliation"
import { createRadiologyOrderOutboxEvent } from "./radiologyOutbox"

export type RadiologyBookingContext = {
  centerId: string
  modalityId: string
  testConfigId: string
  tenantId: string
  hospitalId: string
  modalityCode: string
  scanType: string
  price: number
  durationMinutes: number
  mapping: ServiceMappingValidation
}

export function serviceCodeFromModality(code: string): string {
  const normalized = String(code || "").trim().toUpperCase()
  if (normalized === "X-RAY" || normalized === "XRAY") return "XRAY"
  return normalized
}

export async function resolveRadiologyBookingContext(
  centerId: string,
  modalityId: string,
  testConfigId: string
): Promise<RadiologyBookingContext> {
  const [center, test] = await Promise.all([
    prisma.center.findUnique({
      where: { id: centerId },
      include: { vendor: true }
    }),
    prisma.modalityTestConfig.findUnique({
      where: { id: testConfigId },
      include: { modality: true }
    })
  ])

  if (!center || !center.isActive || center.isDeleted) {
    throw new Error("Center not found or inactive")
  }
  if (!test || test.isDeleted || test.modalityId !== modalityId) {
    throw new Error("Test config not found")
  }

  const tenantId = center.vendorId
  const hospitalId = center.vendorId
  const mapping = await validateB2CServiceMapping({
    tenantId,
    hospitalId,
    centerId,
    modality: test.modality.code,
    scanType: test.testKeyword,
    testConfigId
  })

  return {
    centerId,
    modalityId,
    testConfigId,
    tenantId,
    hospitalId,
    modalityCode: test.modality.code,
    scanType: test.testKeyword,
    price: test.price,
    durationMinutes: test.durationMinutes,
    mapping
  }
}

export async function findUsableEntitlement(userId: string, serviceCode: string) {
  const activeSub = await prisma.userSubscription.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" }
  })
  if (!activeSub) return null

  return prisma.entitlement.findUnique({
    where: {
      subscriptionId_serviceCode: {
        subscriptionId: activeSub.id,
        serviceCode
      }
    }
  }).then((entitlement) => entitlement && entitlement.remaining > 0 ? entitlement : null)
}

export async function decrementEntitlement(entitlementId: string | null | undefined): Promise<void> {
  if (!entitlementId) return
  await prisma.entitlement.update({
    where: { id: entitlementId },
    data: { remaining: { decrement: 1 } }
  })
}

export async function createCaseForAppointment(params: {
  context: RadiologyBookingContext
  patientId: string
  appointmentId: string
  paymentOrderId: string
}) {
  const caseRow = await createB2CCase({
    tenantId: params.context.tenantId,
    hospitalId: params.context.hospitalId,
    serviceMappingId: params.context.mapping.service_mapping_id,
    patientId: params.patientId,
    appointmentId: params.appointmentId,
    paymentOrderId: params.paymentOrderId
  })

  await prisma.appointment.update({
    where: { id: params.appointmentId },
    data: {
      caseId: caseRow.case_id,
      tenantId: params.context.tenantId,
      hospitalId: params.context.hospitalId,
      serviceMappingId: params.context.mapping.service_mapping_id,
      odooProductId: params.context.mapping.workflow?.odoo_product_id ?? null
    }
  })

  return caseRow
}

export async function confirmCaseAndPublish(params: {
  caseId: string
  tenantId: string
  appointmentId: string
  paymentOrderId: string | null
  coveredBySubscription: boolean
  amountPaid: number
  eventType?: string
}): Promise<void> {
  await transitionCase({
    caseId: params.caseId,
    tenantId: params.tenantId,
    newStatus: "BOOKING_CONFIRMED",
    eventType: "B2C_PAYMENT_CONFIRMED",
    sourceService: "crs-b2c-service",
    metadata: {
      appointment_id: params.appointmentId,
      payment_order_id: params.paymentOrderId,
      covered_by_subscription: params.coveredBySubscription
    }
  })

  await transitionCase({
    caseId: params.caseId,
    tenantId: params.tenantId,
    newStatus: "BAHMNI_ORDER_PENDING",
    eventType: "B2C_BAHMNI_ORDER_REQUESTED",
    sourceService: "crs-b2c-service",
    metadata: {
      appointment_id: params.appointmentId,
      payment_order_id: params.paymentOrderId
    }
  })

  const outboxEvent = await createRadiologyOrderOutboxEvent(params.appointmentId, {
    eventType: params.eventType || "BOOKING_CONFIRMED",
    coveredBySubscription: params.coveredBySubscription,
    amountPaid: params.amountPaid,
    paymentOrderId: params.paymentOrderId
  })

  await createOrUpdateConfirmedReconciliation({
    caseId: params.caseId,
    tenantId: params.tenantId,
    appointmentId: params.appointmentId,
    paymentOrderId: params.paymentOrderId,
    outboxEventId: outboxEvent.id,
    outboxStatus: outboxEvent.status
  })
}
