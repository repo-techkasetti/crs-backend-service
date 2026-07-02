import express, { Request, Response } from "express"
import Razorpay from "razorpay"
import { prisma } from "../lib/prisma"
import { authMiddleware } from "../middleware/authMiddleware"
import { allocateMachineOperator } from "../services/slotAllocator"
import {
  confirmCaseAndPublish,
  createCaseForAppointment,
  decrementEntitlement,
  findUsableEntitlement,
  resolveRadiologyBookingContext,
  serviceCodeFromModality
} from "../services/b2cCaseCycle"

const router = express.Router()

type PreparedCartBooking = {
  item: Awaited<ReturnType<typeof prisma.cartItem.findMany>>[number]
  patient: NonNullable<Awaited<ReturnType<typeof prisma.patient.findUnique>>>
  context: Awaited<ReturnType<typeof resolveRadiologyBookingContext>>
  startTime: Date
  endTime: Date
  allocation: NonNullable<Awaited<ReturnType<typeof allocateMachineOperator>>>
  covered: boolean
  entitlementId: string | null
  amount: number
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY!,
  key_secret: process.env.RAZORPAY_SECRET!
})

function parseDateOnly(value?: string | null) {
  if (!value) return null
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10)
}

async function getOrCreateActiveCart(userId: string) {
  const existing = await prisma.cart.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" }
  })
  if (existing) return existing
  return prisma.cart.create({
    data: { userId, status: "ACTIVE" }
  })
}

async function serializeCart(cartId: string) {
  const [cart, items] = await Promise.all([
    prisma.cart.findUnique({ where: { id: cartId } }),
    prisma.cartItem.findMany({ where: { cartId }, orderBy: { createdAt: "asc" } })
  ])

  return {
    ...cart,
    items,
    summary: {
      itemCount: items.length,
      totalAmount: items.reduce((sum, item) => sum + (item.unitPrice || 0), 0),
      currency: items[0]?.currency || "INR"
    }
  }
}

router.use(authMiddleware)

router.get("/", async (req: Request, res: Response) => {
  try {
    const cart = await getOrCreateActiveCart(req.userId!)
    return res.json({ cart: await serializeCart(cart.id) })
  } catch (error) {
    console.error("Get cart error:", error)
    return res.status(500).json({ message: "Failed to load cart" })
  }
})

router.post("/items", async (req: Request, res: Response) => {
  try {
    const { patientId, centerId, modalityId, testConfigId, appointmentDate, slotTime, notes } = req.body ?? {}
    if (!patientId || !centerId || !modalityId || !testConfigId || !appointmentDate || !slotTime) {
      return res.status(400).json({
        message: "patientId, centerId, modalityId, testConfigId, appointmentDate and slotTime are required"
      })
    }

    const test = await prisma.modalityTestConfig.findFirst({
      where: { id: testConfigId, modalityId, isDeleted: false }
    })
    if (!test) {
      return res.status(404).json({ message: "Test config not found" })
    }

    const cart = await getOrCreateActiveCart(req.userId!)
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        patientId,
        centerId,
        modalityId,
        testConfigId,
        appointmentDate: parseDateOnly(appointmentDate),
        slotTime,
        unitPrice: test.price,
        notes: notes ?? null
      }
    })

    return res.status(201).json({ cart: await serializeCart(cart.id) })
  } catch (error) {
    console.error("Add cart item error:", error)
    return res.status(500).json({ message: "Failed to add item to cart" })
  }
})

router.delete("/items/:itemId", async (req: Request, res: Response) => {
  try {
    const itemId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId
    const cart = await getOrCreateActiveCart(req.userId!)
    await prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } })
    return res.json({ cart: await serializeCart(cart.id) })
  } catch (error) {
    console.error("Delete cart item error:", error)
    return res.status(500).json({ message: "Failed to remove item from cart" })
  }
})

router.post("/checkout", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const cart = await prisma.cart.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" }
    })
    if (!cart) return res.status(400).json({ message: "Cart is empty" })

    const items = await prisma.cartItem.findMany({
      where: { cartId: cart.id },
      orderBy: { createdAt: "asc" }
    })
    if (items.length === 0) return res.status(400).json({ message: "Cart is empty" })

    const entitlementUseCount = new Map<string, number>()
    const prepared: PreparedCartBooking[] = []

    for (const item of items) {
      if (!item.patientId || !item.centerId || !item.modalityId || !item.testConfigId || !item.appointmentDate || !item.slotTime) {
        return res.status(400).json({ message: `Cart item ${item.id} is incomplete` })
      }

      const patient = await prisma.patient.findUnique({ where: { id: item.patientId } })
      if (!patient || patient.createdByUserId !== userId) {
        return res.status(400).json({ message: `Cart item ${item.id} has invalid patient` })
      }

      const context = await resolveRadiologyBookingContext(item.centerId, item.modalityId, item.testConfigId)
      const startTime = new Date(`${formatDateOnly(item.appointmentDate)}T${item.slotTime}:00`)
      const endTime = new Date(startTime.getTime() + context.durationMinutes * 60000)
      const allocation = await allocateMachineOperator(item.centerId, item.modalityId, startTime, endTime)
      if (!allocation) {
        return res.status(400).json({ message: `No machine/operator available for cart item ${item.id}` })
      }

      const serviceCode = serviceCodeFromModality(context.modalityCode)
      const entitlement = await findUsableEntitlement(userId, serviceCode)
      const used = entitlement ? entitlementUseCount.get(entitlement.id) || 0 : 0
      const covered = Boolean(entitlement && entitlement.remaining > used)
      if (entitlement && covered) {
        entitlementUseCount.set(entitlement.id, used + 1)
      }

      prepared.push({
        item,
        patient,
        context,
        startTime,
        endTime,
        allocation,
        covered,
        entitlementId: covered ? entitlement?.id ?? null : null,
        amount: covered ? 0 : context.price
      })
    }

    const holdExpiresAt = new Date(Date.now() + 5 * 60 * 1000)
    const totalAmount = prepared.reduce((sum, row) => sum + row.amount, 0)

    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          cartId: cart.id,
          totalAmount,
          currency: "INR",
          status: totalAmount === 0 ? "PAID" : "PENDING_PAYMENT",
          holdExpiresAt
        }
      })

      const rows = []
      for (const row of prepared) {
        const appointment = await tx.appointment.create({
          data: {
            userId,
            familyId: row.patient.familyId,
            centerId: row.item.centerId!,
            modalityId: row.item.modalityId!,
            testConfigId: row.item.testConfigId!,
            patientId: row.item.patientId!,
            tenantId: row.context.tenantId,
            hospitalId: row.context.hospitalId,
            serviceMappingId: row.context.mapping.service_mapping_id,
            odooProductId: row.context.mapping.workflow?.odoo_product_id ?? null,
            machineId: row.allocation.machineId,
            operatorId: row.allocation.operatorId,
            appointmentDate: row.item.appointmentDate!,
            startTime: row.startTime,
            endTime: row.endTime,
            status: "HOLD",
            holdExpiresAt
          }
        })

        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            cartItemId: row.item.id,
            patientId: row.item.patientId,
            centerId: row.item.centerId!,
            modalityId: row.item.modalityId,
            testConfigId: row.item.testConfigId,
            appointmentDate: row.item.appointmentDate,
            slotTime: row.item.slotTime,
            amount: row.amount,
            currency: row.item.currency,
            status: "HOLD",
            appointmentId: appointment.id,
            tenantId: row.context.tenantId,
            hospitalId: row.context.hospitalId,
            serviceMappingId: row.context.mapping.service_mapping_id,
            odooProductId: row.context.mapping.workflow?.odoo_product_id ?? null,
            coveredBySubscription: row.covered,
            entitlementId: row.entitlementId
          }
        })
        rows.push({ ...row, appointment, orderItem })
      }

      await tx.cart.update({
        where: { id: cart.id },
        data: { status: "CHECKED_OUT" }
      })

      return { order, rows }
    })

    const paymentOrderId = totalAmount === 0
      ? `SUBSCRIPTION_COVERED:${created.order.id}`
      : (await razorpay.orders.create({
          amount: totalAmount * 100,
          currency: "INR",
          receipt: created.order.id
        })).id

    try {
      if (totalAmount > 0) {
        await prisma.order.update({
          where: { id: created.order.id },
          data: { razorpayOrderId: paymentOrderId }
        })
      }

      for (const row of created.rows) {
        const caseRow = await createCaseForAppointment({
          context: row.context,
          patientId: row.item.patientId!,
          appointmentId: row.appointment.id,
          paymentOrderId
        })
        await prisma.orderItem.update({
          where: { id: row.orderItem.id },
          data: { caseId: caseRow.case_id }
        })

        if (totalAmount === 0) {
          await prisma.appointment.update({
            where: { id: row.appointment.id },
            data: { status: "BOOKED" }
          })
          await prisma.orderItem.update({
            where: { id: row.orderItem.id },
            data: { status: "BOOKED" }
          })
          await confirmCaseAndPublish({
            caseId: caseRow.case_id,
            tenantId: row.context.tenantId,
            appointmentId: row.appointment.id,
            paymentOrderId,
            coveredBySubscription: true,
            amountPaid: 0,
            eventType: "SUBSCRIPTION_BOOKING_CONFIRMED"
          })
          await decrementEntitlement(row.entitlementId)
        }
      }

      await prisma.payment.create({
        data: {
          orderId: created.order.id,
          razorpayOrderId: paymentOrderId,
          amount: totalAmount,
          status: totalAmount === 0 ? "SUCCESS" : "CREATED"
        }
      })
    } catch (error) {
      console.error("Cart case creation/confirmation error:", error)
      await prisma.$transaction([
        prisma.order.update({
          where: { id: created.order.id },
          data: { status: "FAILED" }
        }),
        prisma.orderItem.updateMany({
          where: { orderId: created.order.id },
          data: { status: "FAILED" }
        }),
        prisma.appointment.updateMany({
          where: { id: { in: created.rows.map((row) => row.appointment.id) } },
          data: { status: "CANCELLED" }
        })
      ])
      return res.status(500).json({ message: "Unable to create cases for cart checkout" })
    }

    return res.json({
      orderId: created.order.id,
      orderRazorpayId: totalAmount > 0 ? paymentOrderId : null,
      amount: totalAmount,
      coveredBySubscription: totalAmount === 0,
      appointmentIds: created.rows.map((row) => row.appointment.id),
      caseIds: await prisma.orderItem.findMany({
        where: { orderId: created.order.id },
        select: { caseId: true, appointmentId: true }
      })
    })
  } catch (error) {
    console.error("Cart checkout error:", error)
    return res.status(500).json({ message: "Failed to checkout cart" })
  }
})

export default router
