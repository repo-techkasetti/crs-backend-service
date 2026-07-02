import Razorpay from "razorpay"
import { prisma } from "../lib/prisma"
import { Request, Response } from "express"
import { allocateMachineOperator } from "../services/slotAllocator"
import {
  confirmCaseAndPublish,
  createCaseForAppointment,
  decrementEntitlement,
  findUsableEntitlement,
  resolveRadiologyBookingContext,
  serviceCodeFromModality
} from "../services/b2cCaseCycle"

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY!,
  key_secret: process.env.RAZORPAY_SECRET!
})

export const createBooking = async (req: Request, res: Response) => {
  try {

    const {
      centerId,
      modalityId,
      testConfigId,
      date,
      slot,
      patientId
    } = req.body

    const context = await resolveRadiologyBookingContext(centerId, modalityId, testConfigId)
    const price = context.price

    // Fetch patient
    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    })

    if (!patient) {
      return res.status(404).json({
        message: "Patient not found"
      })
    }

    if (!patient.createdByUserId) {
      return res.status(400).json({
        message: "Patient not linked to a user"
      })
    }

    // -----------------------------
    // Calculate slot start and end
    // -----------------------------

    const startTime = slot.includes("T")
      ? new Date(slot)
      : new Date(`${date}T${slot}:00`)

    if (Number.isNaN(startTime.getTime())) {
      return res.status(400).json({
        message: "Invalid slot timestamp"
      })
    }

    const endTime = new Date(
      startTime.getTime() + context.durationMinutes * 60000
    )

    // -----------------------------
    // Allocate machine + operator
    // -----------------------------

    const allocation = await allocateMachineOperator(
      centerId,
      modalityId,
      startTime,
      endTime
    )

    if (!allocation) {
      return res.status(400).json({
        message: "No machine/operator available for this slot"
      })
    }

    // -----------------------------
    // Create appointment (HOLD)
    // -----------------------------

    const appointment = await prisma.appointment.create({
      data: {
        userId: patient.createdByUserId,
        familyId: patient.familyId,
        centerId,
        modalityId,
        testConfigId,
        patientId,
        tenantId: context.tenantId,
        hospitalId: context.hospitalId,
        serviceMappingId: context.mapping.service_mapping_id,
        odooProductId: context.mapping.workflow?.odoo_product_id ?? null,

        machineId: allocation.machineId,
        operatorId: allocation.operatorId,

        appointmentDate: new Date(date),
        startTime: startTime,
        endTime: endTime,

        status: "HOLD",
        holdExpiresAt: new Date(Date.now() + 5 * 60 * 1000)
      }
    })

    const entitlement = await findUsableEntitlement(
      patient.createdByUserId,
      serviceCodeFromModality(context.modalityCode)
    )

    if (entitlement) {
      const caseRow = await createCaseForAppointment({
        context,
        patientId,
        appointmentId: appointment.id,
        paymentOrderId: "SUBSCRIPTION_COVERED"
      }).catch(async (error: unknown) => {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: "CANCELLED" }
        })
        throw error
      })

      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: "BOOKED" }
      })

      await prisma.payment.create({
        data: {
          appointmentId: appointment.id,
          caseId: caseRow.case_id,
          razorpayOrderId: "SUBSCRIPTION_COVERED",
          amount: 0,
          status: "SUCCESS"
        }
      })

      await confirmCaseAndPublish({
        caseId: caseRow.case_id,
        tenantId: context.tenantId,
        appointmentId: appointment.id,
        paymentOrderId: "SUBSCRIPTION_COVERED",
        coveredBySubscription: true,
        amountPaid: 0,
        eventType: "SUBSCRIPTION_BOOKING_CONFIRMED"
      })

      await decrementEntitlement(entitlement.id)

      return res.json({
        appointmentId: appointment.id,
        caseId: caseRow.case_id,
        orderId: "SUBSCRIPTION_COVERED",
        amount: 0,
        coveredBySubscription: true
      })
    }

    // -----------------------------
    // Create Razorpay order
    // -----------------------------

    const order = await razorpay.orders.create({
      amount: price * 100,
      currency: "INR",
      receipt: appointment.id
    })

    const caseRow = await createCaseForAppointment({
      context,
      patientId,
      appointmentId: appointment.id,
      paymentOrderId: order.id
    }).catch(async (error: unknown) => {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: "CANCELLED" }
      })
      throw error
    })

    // -----------------------------
    // Save payment record
    // -----------------------------

    await prisma.payment.create({
      data: {
        appointmentId: appointment.id,
        caseId: caseRow.case_id,
        razorpayOrderId: order.id,
        amount: price,
        status: "CREATED"
      }
    })

    // -----------------------------
    // Response
    // -----------------------------

    res.json({
      appointmentId: appointment.id,
      caseId: caseRow.case_id,
      orderId: order.id,
      amount: price
    })

  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: "Booking creation failed"
    })
  }
}
