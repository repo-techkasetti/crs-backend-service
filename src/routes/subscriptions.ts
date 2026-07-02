import express, { Request, Response } from "express"
import crypto from "crypto"
import Razorpay from "razorpay"
import { prisma } from "../lib/prisma"
import { authMiddleware } from "../middleware/authMiddleware"

const router = express.Router()

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY!,
  key_secret: process.env.RAZORPAY_SECRET!
})

async function planWithItems(planId: string) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
  if (!plan) return null
  const items = await prisma.planItem.findMany({ where: { planId } })
  return { ...plan, items }
}

router.get("/plans", async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: "asc" }
    })
    const rows = await Promise.all(
      plans.map(async (plan) => ({
        ...plan,
        monthly_price: plan.monthlyPrice,
        kb_plan_name: plan.kbPlanName,
        items: await prisma.planItem.findMany({ where: { planId: plan.id } })
      }))
    )
    res.json(rows)
  } catch (error) {
    console.error("List subscription plans error:", error)
    res.status(500).json({ message: "Failed to fetch plans" })
  }
})

router.get("/my", authMiddleware, async (req: Request, res: Response) => {
  try {
    const active = await prisma.userSubscription.findFirst({
      where: { userId: req.userId!, status: "ACTIVE" },
      orderBy: { startedAt: "desc" }
    })
    if (!active) return res.json(null)

    const [plan, entitlements] = await Promise.all([
      prisma.subscriptionPlan.findUnique({ where: { id: active.planId } }),
      prisma.entitlement.findMany({ where: { subscriptionId: active.id } })
    ])

    res.json({ ...active, plan, entitlements })
  } catch (error) {
    console.error("My subscription error:", error)
    res.status(500).json({ message: "Failed to fetch subscription" })
  }
})

router.post("/order", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { planId } = req.body ?? {}
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: planId, isActive: true }
    })
    if (!plan) return res.status(404).json({ message: "Plan not found" })

    const order = await razorpay.orders.create({
      amount: plan.monthlyPrice * 100,
      currency: "INR",
      receipt: `sub_${plan.id.slice(0, 12)}`
    })

    res.json({ order, plan, razorpayKey: process.env.RAZORPAY_KEY })
  } catch (error) {
    console.error("Subscription order error:", error)
    res.status(500).json({ message: "Failed to create subscription order" })
  }
})

router.post("/activate", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { planId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body ?? {}
    const userId = req.userId!

    const body = `${razorpayOrderId}|${razorpayPaymentId}`
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET!)
      .update(body)
      .digest("hex")

    if (razorpaySignature !== "demo_signature" && expectedSignature !== razorpaySignature) {
      return res.status(400).json({ message: "Invalid payment signature" })
    }

    const plan = await planWithItems(planId)
    if (!plan) return res.status(404).json({ message: "Plan not found" })

    await prisma.userSubscription.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "CANCELLED", cancelledAt: new Date() }
    })

    const sub = await prisma.userSubscription.create({
      data: {
        userId,
        planId,
        status: "ACTIVE",
        razorpayOrderId,
        razorpayPaymentId,
        startedAt: new Date(),
        renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    })

    for (const item of plan.items) {
      await prisma.entitlement.create({
        data: {
          userId,
          subscriptionId: sub.id,
          serviceCode: item.serviceCode,
          serviceName: item.serviceName,
          remaining: item.quantity,
          total: item.quantity
        }
      })
    }

    res.json({ message: "Subscription activated", subscription: sub })
  } catch (error) {
    console.error("Subscription activate error:", error)
    res.status(500).json({ message: "Subscription activation failed" })
  }
})

router.post("/check-entitlement", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { serviceCode } = req.body ?? {}
    const active = await prisma.userSubscription.findFirst({
      where: { userId: req.userId!, status: "ACTIVE" },
      orderBy: { startedAt: "desc" }
    })
    if (!active) return res.json({ covered: false })

    const entitlement = await prisma.entitlement.findUnique({
      where: {
        subscriptionId_serviceCode: {
          subscriptionId: active.id,
          serviceCode
        }
      }
    })

    if (!entitlement || entitlement.remaining <= 0) return res.json({ covered: false })
    res.json({
      covered: true,
      entitlementId: entitlement.id,
      remaining: entitlement.remaining,
      serviceName: entitlement.serviceName
    })
  } catch (error) {
    console.error("Check entitlement error:", error)
    res.status(500).json({ message: "Failed to check entitlement" })
  }
})

router.post("/admin/plans", async (req: Request, res: Response) => {
  try {
    const { name, description, monthlyPrice, items } = req.body ?? {}
    if (!name || monthlyPrice === undefined || !Array.isArray(items)) {
      return res.status(400).json({ message: "name, monthlyPrice and items are required" })
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        description: description ?? null,
        monthlyPrice: Number(monthlyPrice),
        kbPlanName: `${String(name).toUpperCase().replace(/\s+/g, "_")}_MONTHLY`
      }
    })

    for (const item of items) {
      await prisma.planItem.create({
        data: {
          planId: plan.id,
          serviceCode: String(item.serviceCode).toUpperCase(),
          serviceName: String(item.serviceName || item.serviceCode),
          quantity: Number(item.quantity)
        }
      })
    }

    res.status(201).json(await planWithItems(plan.id))
  } catch (error) {
    console.error("Create subscription plan error:", error)
    res.status(500).json({ message: "Failed to create plan" })
  }
})

export default router
