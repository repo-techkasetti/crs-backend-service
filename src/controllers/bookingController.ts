import Razorpay from "razorpay"
import { prisma } from "../lib/prisma"
import { Request, Response } from "express"
import { allocateMachineOperator } from "../services/slotAllocator"

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

    // Fetch test configuration
    const test = await prisma.modalityTestConfig.findUnique({
      where: { id: testConfigId }
    })

    if (!test) {
      return res.status(404).json({
        message: "Test config not found"
      })
    }

    const price = test.price

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

    const startTime = new Date(`${date}T${slot}:00`)

    const endTime = new Date(
      startTime.getTime() + test.durationMinutes * 60000
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

        machineId: allocation.machineId,
        operatorId: allocation.operatorId,

        appointmentDate: new Date(date),
        startTime: startTime,
        endTime: endTime,

        status: "HOLD",
        holdExpiresAt: new Date(Date.now() + 5 * 60 * 1000)
      }
    })

    // -----------------------------
    // Create Razorpay order
    // -----------------------------

    const order = await razorpay.orders.create({
      amount: price * 100,
      currency: "INR",
      receipt: appointment.id
    })

    // -----------------------------
    // Save payment record
    // -----------------------------

    await prisma.payment.create({
      data: {
        appointmentId: appointment.id,
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