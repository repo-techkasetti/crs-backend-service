import { prisma } from "../lib/prisma"

type RadiologyOutboxOptions = {
  eventType?: string
  coveredBySubscription?: boolean
  amountPaid?: number
  paymentOrderId?: string | null
}

export async function createRadiologyOrderOutboxEvent(
  appointmentId: string,
  options: RadiologyOutboxOptions = {}
): Promise<{ id: string; status: string }> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      center: { include: { vendor: true } },
      modality: true,
      testConfig: true,
      patient: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  })

  if (!appointment) {
    throw new Error("Appointment not found while creating radiology outbox event")
  }
  if (!appointment.caseId) {
    throw new Error("case_id is mandatory for B2C radiology outbox events")
  }

  const payment = appointment.payments[0]
  const patientName = [appointment.patient.firstName, appointment.patient.lastName]
    .filter(Boolean)
    .join(" ")

  const payload = {
    case_id: appointment.caseId,
    tenant_id: appointment.tenantId || appointment.center.vendorId,
    hospital_id: appointment.hospitalId || appointment.center.vendorId,
    center_id: appointment.centerId,
    service_mapping_id: appointment.serviceMappingId,
    odoo_product_id: appointment.odooProductId,
    appointment_id: appointment.id,
    payment_order_id: options.paymentOrderId ?? payment?.razorpayOrderId ?? null,
    unification_id: appointment.patient.upiId ?? null,
    patient_id: appointment.patientId,
    patient_name: patientName,
    gender: appointment.patient.gender,
    birthdate: appointment.patient.dateOfBirth
      ? appointment.patient.dateOfBirth.toISOString().slice(0, 10)
      : null,
    modality: appointment.modality.code,
    study_description: appointment.testConfig.testKeyword,
    care_setting: "Outpatient",
    covered_by_subscription: options.coveredBySubscription ?? false,
    amount_paid: options.amountPaid ?? payment?.amount ?? 0,
    timestamp: new Date().toISOString()
  }

  return prisma.outboxEvent.create({
    data: {
      topic: "b2c.radiology.orders",
      eventType: options.eventType || "BOOKING_CONFIRMED",
      aggregateType: "B2C_APPOINTMENT",
      aggregateId: appointment.id,
      caseId: appointment.caseId,
      payload
    }
  })
}
