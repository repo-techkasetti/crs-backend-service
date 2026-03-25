import { prisma } from "../lib/prisma"
import { AppointmentStatus } from "../../generated/prisma/client"

type Input = {
  centerId: string
  modalityId?: string
  testKeyword?: string
  durationMinutes?: number
  date?: string
  startDate?: string
  endDate?: string
}

type Output = {
  totalAvailableSlots: number
  firstAvailableDate: string | null
  earliestAvailableTime: string | null
}

export async function getAvailabilitySummary(
  input: Input
): Promise<Output> {
  const now = new Date()

  // ---------------------------------------
  // 1️⃣ Resolve Duration
  // ---------------------------------------
  let finalDuration = input.durationMinutes ?? 30

  if (!input.durationMinutes && input.testKeyword && input.modalityId) {
    const config = await prisma.modalityTestConfig.findFirst({
      where: {
        modalityId: input.modalityId,
        testKeyword: input.testKeyword
      }
    })

    if (config) {
      finalDuration = config.durationMinutes
    }
  }

  // ---------------------------------------
  // 2️⃣ Resolve Date Range (Future Proof)
  // ---------------------------------------
  let startDate: Date
  let endDate: Date

  if (input.date) {
    startDate = new Date(input.date)
    endDate = new Date(input.date)
  } else {
    startDate = input.startDate
      ? new Date(input.startDate)
      : new Date()

    endDate = input.endDate
      ? new Date(input.endDate)
      : new Date(startDate)
  }

  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(23, 59, 59, 999)

  // ---------------------------------------
  // 3️⃣ Fetch Machines
  // ---------------------------------------
  const machines = await prisma.machine.findMany({
    where: {
      centerId: input.centerId,
      ...(input.modalityId && { modalityId: input.modalityId })
    },
    include: {
      availabilityRules: true
    }
  })

  if (machines.length === 0) {
    return {
      totalAvailableSlots: 0,
      firstAvailableDate: null,
      earliestAvailableTime: null
    }
  }

  const machineIds = machines.map(m => m.id)

  // ---------------------------------------
  // 4️⃣ Fetch Blocking Appointments
  // ---------------------------------------
  const appointments = await prisma.appointment.findMany({
    where: {
      machineId: { in: machineIds },
      status: {
        in: [
          AppointmentStatus.BOOKED,
          AppointmentStatus.BLOCKED,
          AppointmentStatus.HOLD
        ]
      },
      startTime: { lte: endDate },
      endTime: { gte: startDate }
    }
  })

  const validAppointments = appointments.filter(a => {
    if (a.status === AppointmentStatus.HOLD) {
      return a.holdExpiresAt && a.holdExpiresAt > now
    }
    return true
  })

  // ---------------------------------------
  // 5️⃣ Slot Generation
  // ---------------------------------------
  let totalAvailableSlots = 0
  let firstAvailableDate: string | null = null
  let earliestAvailableTime: Date | null = null

  const current = new Date(startDate)

  while (current <= endDate) {
    const dayOfWeek = current.getDay()

    for (const machine of machines) {
      const rules = machine.availabilityRules.filter(
        r => r.dayOfWeek === dayOfWeek
      )

      for (const rule of rules) {
        const [startHour, startMinute] = rule.startTime.split(":").map(Number)
        const [endHour, endMinute] = rule.endTime.split(":").map(Number)

        let slotStart = new Date(current)
        slotStart.setHours(startHour, startMinute, 0, 0)

        const slotEndBoundary = new Date(current)
        slotEndBoundary.setHours(endHour, endMinute, 0, 0)

        while (true) {
          const slotEnd = new Date(
            slotStart.getTime() + finalDuration * 60000
          )

          if (slotEnd > slotEndBoundary) break
          if (slotStart < now) {
            slotStart = new Date(
              slotStart.getTime() + finalDuration * 60000
            )
            continue
          }

          const overlaps = validAppointments.some(a =>
            a.machineId === machine.id &&
            slotStart < a.endTime &&
            slotEnd > a.startTime
          )

          if (!overlaps) {
            totalAvailableSlots++

            if (!firstAvailableDate) {
              firstAvailableDate =
                slotStart.toISOString().split("T")[0]
            }

            if (!earliestAvailableTime) {
              earliestAvailableTime = new Date(slotStart)
            }
          }

          slotStart = new Date(
            slotStart.getTime() + finalDuration * 60000
          )
        }
      }
    }

    current.setDate(current.getDate() + 1)
  }

  return {
    totalAvailableSlots,
    firstAvailableDate,
    earliestAvailableTime: earliestAvailableTime
      ? earliestAvailableTime.toISOString()
      : null
  }
}