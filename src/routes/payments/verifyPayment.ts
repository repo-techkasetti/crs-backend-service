import { Request, Response } from "express"
import crypto from "crypto"
import { prisma } from "../../lib/prisma"
import { confirmCaseAndPublish, decrementEntitlement } from "../../services/b2cCaseCycle"

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body

    const existing = await prisma.payment.findUnique({
      where: { razorpayPaymentId: razorpay_payment_id }
    })

    if (existing) {
      console.log("Duplicate payment ignored:", razorpay_payment_id)
      return res.json({ success: true, message: "Already processed" })
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET!)
      .update(body)
      .digest("hex")

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        message: "Invalid payment signature"
      })
    }

    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: razorpay_order_id },
      include: {
        appointment: true
      }
    })

    if (!payment) {
      return res.status(404).json({
        message: "Payment record not found"
      })
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "SUCCESS"
      }
    })

    if (payment.orderId) {
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId: payment.orderId }
      })
      const appointmentIds = orderItems
        .map((item) => item.appointmentId)
        .filter(Boolean) as string[]

      await prisma.$transaction([
        prisma.order.update({
          where: { id: payment.orderId },
          data: {
            status: "PAID",
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature
          }
        }),
        prisma.orderItem.updateMany({
          where: { orderId: payment.orderId },
          data: { status: "BOOKED" }
        }),
        prisma.appointment.updateMany({
          where: { id: { in: appointmentIds } },
          data: { status: "BOOKED" }
        })
      ])

      try {
        for (const item of orderItems) {
          if (!item.appointmentId || !item.caseId || !item.tenantId) {
            throw new Error(`Order item ${item.id} is missing appointment/case linkage`)
          }
          await confirmCaseAndPublish({
            caseId: item.caseId,
            tenantId: item.tenantId,
            appointmentId: item.appointmentId,
            paymentOrderId: payment.razorpayOrderId,
            coveredBySubscription: item.coveredBySubscription,
            amountPaid: item.amount,
            eventType: "CART_BOOKING_CONFIRMED"
          })
          if (item.coveredBySubscription) {
            await decrementEntitlement(item.entitlementId)
          }
        }
      } catch (transitionError) {
        console.error("Cart case lifecycle/outbox error after payment success:", transitionError)
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "SUCCESS_MANUAL_REVIEW" }
        })
        return res.status(202).json({
          success: true,
          message: "Cart payment confirmed. Case lifecycle/outbox needs manual review.",
          orderId: payment.orderId
        })
      }

      return res.json({
        success: true,
        message: "Cart booking confirmed",
        orderId: payment.orderId,
        appointmentIds
      })
    }

    if (!payment.appointmentId || !payment.appointment) {
      return res.status(409).json({
        success: false,
        message: "Payment is not linked to an appointment or order"
      })
    }

    await prisma.appointment.update({
      where: { id: payment.appointmentId },
      data: { status: "BOOKED" }
    })

    if (!payment.caseId && !payment.appointment.caseId) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCESS_MANUAL_REVIEW" }
      })
      return res.status(409).json({
        success: false,
        message: "Booking confirmed, but case_id is missing. Manual review required."
      })
    }

    const caseId = payment.caseId || payment.appointment.caseId!
    const tenantId = payment.appointment.tenantId || payment.appointment.centerId

    try {
      await confirmCaseAndPublish({
        caseId,
        tenantId,
        appointmentId: payment.appointmentId,
        paymentOrderId: razorpay_order_id,
        coveredBySubscription: false,
        amountPaid: payment.amount,
        eventType: "BOOKING_CONFIRMED"
      })
    } catch (transitionError) {
      console.error("Case lifecycle/outbox error after payment success:", transitionError)
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCESS_MANUAL_REVIEW" }
      })
      return res.status(202).json({
        success: true,
        message: "Booking confirmed. Case lifecycle/outbox needs manual review.",
        caseId
      })
    }

    res.json({
      success: true,
      message: "Booking confirmed",
      caseId
    })
  } catch (error) {
    console.error("Payment verify error:", error)

    res.status(500).json({
      message: "Payment verification failed"
    })
  }
}
