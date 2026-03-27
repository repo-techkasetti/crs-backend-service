import { Request, Response } from "express"
import { prisma } from "../../lib/prisma"

export const getAppointment = async (req: Request, res: Response) => {
  try {
    const rawAppointmentId = req.params.appointmentId
    const appointmentId = Array.isArray(rawAppointmentId)
      ? rawAppointmentId[0]
      : rawAppointmentId

    if (!appointmentId) {
      return res.status(400).json({
        message: "appointmentId is required"
      })
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        centerId: true,
        patientId: true,
        modalityId: true,
        testConfigId: true,
        startTime: true,
      }
    })

    if (!appointment) {
      return res.status(404).json({
        message: "Appointment not found"
      })
    }

    const [patient, modality, testConfig, payment] = await Promise.all([
      prisma.patient.findUnique({
        where: { id: appointment.patientId },
        select: {
          firstName: true,
          lastName: true,
          gender: true,
          dateOfBirth: true,
          upiId: true
        }
      }),
      prisma.modality.findUnique({
        where: { id: appointment.modalityId },
        select: {
          code: true
        }
      }),
      prisma.modalityTestConfig.findUnique({
        where: { id: appointment.testConfigId },
        select: {
          testKeyword: true
        }
      }),
      prisma.payment.findFirst({
        where: { appointmentId },
        orderBy: {
          createdAt: "desc"
        },
        select: {
          razorpayOrderId: true
        }
      })
    ])

    if (!patient || !modality || !testConfig) {
      return res.status(404).json({
        message: "Appointment details are incomplete"
      })
    }

    const patientName = [
      patient.firstName,
      patient.lastName
    ]
      .filter(Boolean)
      .join(" ")

    return res.json({
      tenant_id: appointment.centerId,
      payment_order_id: payment?.razorpayOrderId ?? null,
      unification_id: patient.upiId ?? null,
      patient_id: appointment.patientId,
      patient_name: patientName,
      gender: patient.gender,
      birthdate: patient.dateOfBirth
        ? patient.dateOfBirth.toISOString().slice(0, 10)
        : null,
      modality: modality.code,
      study_description: testConfig.testKeyword,
      care_setting: "Outpatient",
      timestamp: appointment.startTime.toISOString()
    })
  } catch (error) {
    console.error("Get appointment error:", error)

    return res.status(500).json({
      message: "Failed to fetch appointment"
    })
  }
}
