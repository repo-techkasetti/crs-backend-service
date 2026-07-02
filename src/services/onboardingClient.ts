const ONBOARDING_API_BASE_URL =
  process.env.ONBOARDING_API_BASE_URL || "http://billing-service:8004"

const ACTOR_HEADERS = {
  "Content-Type": "application/json",
  "X-Actor-Role": "SCANSURE_ADMIN",
  "X-Actor-User-Id": "crs-b2c-service"
}

export type ServiceMappingValidation = {
  tenant_id: string
  hospital_id: string
  service_mapping_id: string
  valid?: boolean
  allowed?: boolean
  reasons?: string[]
  workflow_type?: string
  workflow?: {
    odoo_product_id?: string | null
    modality?: string | null
    modality_type?: string | null
    scan_type?: string | null
    ai_required?: boolean
    radiologist_required?: boolean
    tat_minutes?: number | null
    billing_ready?: boolean
  } | null
}

export type CaseRegistryRow = {
  case_id: string
  tenant_id: string
  hospital_id?: string | null
  service_mapping_id?: string | null
  status?: string | null
}

async function postJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${ONBOARDING_API_BASE_URL}${path}`, {
    method: "POST",
    headers: ACTOR_HEADERS,
    body: JSON.stringify(payload)
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = body?.detail || body?.message || `Onboarding API failed: ${response.status}`
    throw new Error(String(message))
  }
  return body as T
}

export async function validateB2CServiceMapping(payload: {
  tenantId: string
  hospitalId: string
  centerId: string
  modality: string
  scanType: string
  testConfigId: string
}): Promise<ServiceMappingValidation> {
  const validation = await postJson<ServiceMappingValidation>("/api/service-mapping/validate", {
    tenant_id: payload.tenantId,
    hospital_id: payload.hospitalId,
    case_source: "B2C",
    center_id: payload.centerId,
    modality: payload.modality,
    scan_type: payload.scanType,
    test_config_id: payload.testConfigId
  })

  if (!(validation.allowed ?? validation.valid)) {
    throw new Error(`B2C service mapping rejected: ${(validation.reasons || []).join("; ")}`)
  }
  if (!validation.service_mapping_id) {
    throw new Error("B2C service mapping validation did not return service_mapping_id")
  }
  if (validation.workflow && validation.workflow.billing_ready === false) {
    throw new Error("B2C service mapping rejected: active B2C price is missing")
  }
  return validation
}

export async function createB2CCase(payload: {
  tenantId: string
  hospitalId: string
  serviceMappingId: string
  patientId: string
  appointmentId: string
  paymentOrderId: string
}): Promise<CaseRegistryRow> {
  return postJson<CaseRegistryRow>("/api/cases", {
    tenant_id: payload.tenantId,
    hospital_id: payload.hospitalId,
    service_mapping_id: payload.serviceMappingId,
    source_channel: "B2C",
    case_source: "B2C_BOOKING",
    integration_mode: "MANUAL_UPLOAD",
    patient_id: payload.patientId,
    appointment_id: payload.appointmentId,
    payment_order_id: payload.paymentOrderId,
    status: "CASE_CREATED"
  })
}

export async function transitionCase(payload: {
  caseId: string
  tenantId: string
  newStatus: string
  eventType: string
  sourceService: string
  metadata?: Record<string, unknown>
}): Promise<unknown> {
  return postJson(`/api/cases/${payload.caseId}/transition`, {
    tenant_id: payload.tenantId,
    new_status: payload.newStatus,
    event_type: payload.eventType,
    actor_type: "SYSTEM",
    actor_id: "crs-b2c-service",
    source_service: payload.sourceService,
    metadata: payload.metadata || {}
  })
}

export async function writeCaseEvent(payload: {
  caseId: string
  tenantId: string
  eventType: string
  actorType?: string
  actorId?: string | null
  sourceService: string
  reasonCode?: string | null
  metadata?: Record<string, unknown>
}): Promise<unknown> {
  return postJson(`/api/cases/${payload.caseId}/events`, {
    tenant_id: payload.tenantId,
    event_type: payload.eventType,
    actor_type: payload.actorType || "SYSTEM",
    actor_id: payload.actorId || "crs-b2c-service",
    source_service: payload.sourceService,
    reason_code: payload.reasonCode || null,
    metadata: payload.metadata || {}
  })
}

export async function getCase(caseId: string): Promise<CaseRegistryRow> {
  const response = await fetch(`${ONBOARDING_API_BASE_URL}/api/cases/${caseId}`, {
    method: "GET",
    headers: ACTOR_HEADERS
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(body?.detail || body?.message || `Case lookup failed: ${response.status}`))
  }
  return body as CaseRegistryRow
}

export async function updateCase(caseId: string, payload: Record<string, unknown>): Promise<CaseRegistryRow> {
  const response = await fetch(`${ONBOARDING_API_BASE_URL}/api/cases/${caseId}`, {
    method: "PATCH",
    headers: ACTOR_HEADERS,
    body: JSON.stringify(payload)
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(body?.detail || body?.message || `Case update failed: ${response.status}`))
  }
  return body as CaseRegistryRow
}
