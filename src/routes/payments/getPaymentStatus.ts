import { Request, Response } from "express"
import { prisma } from "../../lib/prisma"

export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const rawPaymentId = req.params.paymentId
    const paymentId = Array.isArray(rawPaymentId)
      ? rawPaymentId[0]
      : rawPaymentId

    if (!paymentId) {
      return res.status(400).json({
        message: "paymentId is required"
      })
    }

    const payment = await prisma.payment.findUnique({
      where: { razorpayPaymentId: paymentId },
      select: {
        appointmentId: true,
        status: true
      }
    })

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found"
      })
    }

    return res.json({
      appointment_id: payment.appointmentId,
      status: payment.status
    })
  } catch (error) {
    console.error("Get payment status error:", error)

    return res.status(500).json({
      message: "Failed to fetch payment status"
    })
  }
}
