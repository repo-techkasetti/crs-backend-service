import { Request, Response } from "express"
import crypto from "crypto"
import { prisma } from "../../lib/prisma"

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    // ✅ 1. Prevent duplicate processing
    const existing = await prisma.payment.findUnique({
      where: { razorpayPaymentId: razorpay_payment_id }
    });

    if (existing) {
      console.log("⚠️ Duplicate payment ignored:", razorpay_payment_id);
      return res.json({ success: true, message: "Already processed" });
    }

    // ✅ 2. Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET!)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        message: "Invalid payment signature"
      });
    }

    // ✅ 3. Find payment by orderId (correct mapping)
    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: razorpay_order_id }
    });

    if (!payment) {
      return res.status(404).json({
        message: "Payment record not found"
      });
    }

    // ✅ 4. Update SINGLE row (not updateMany)
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "SUCCESS"
      }
    });

    // ✅ 5. Confirm appointment
    await prisma.appointment.update({
      where: { id: payment.appointmentId },
      data: { status: "BOOKED" }
    });

    res.json({
      success: true,
      message: "Booking confirmed"
    });

  } catch (error) {
    console.error("Payment verify error:", error);

    res.status(500).json({
      message: "Payment verification failed"
    });
  }
};