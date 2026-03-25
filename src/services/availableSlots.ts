import { prisma } from "../lib/prisma.js"
import { AppointmentStatus } from "../../generated/prisma/client.js"

type BookingSlotsInput = {
  centerId: string
  modalityId: string
  testConfigId: string
  startDate?: string
  days?: number
}

type BookingSlotsOutput = {
  dates: {
    date: string
    totalSlots: number
    slots: string[]
  }[]
}

export async function getBookingAvailableSlots(
  input: BookingSlotsInput
): Promise<BookingSlotsOutput> {
  const now = new Date()

  //---------------------------------------
  // 1️⃣ Fetch Test Config (Duration Source)
  //---------------------------------------
  const testConfig = await prisma.modalityTestConfig.findFirst({
    where: {
      id: input.testConfigId,
      modalityId: input.modalityId,
      isDeleted: false
    }
  })

  if (!testConfig) {
    return { dates: [] }
  }

  const finalDuration = testConfig.durationMinutes

  //---------------------------------------
  // 2️⃣ Date Range (FIXED - LOCAL DATE PARSING)
  //---------------------------------------
  let startDate: Date

  if (input.startDate) {
    const [year, month, day] = input.startDate.split("-").map(Number)
    startDate = new Date(year, month - 1, day) // LOCAL date
  } else {
    startDate = new Date()
  }

  startDate.setHours(0, 0, 0, 0)

  const days = input.days ?? 3

  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + days - 1)
  endDate.setHours(23, 59, 59, 999)

  //---------------------------------------
  // 3️⃣ Fetch Active Machines
  //---------------------------------------
  const machines = await prisma.machine.findMany({
    where: {
      centerId: input.centerId,
      modalityId: input.modalityId,
      isActive: true,
      isDeleted: false
    },
    include: {
      availabilityRules: true
    }
  })

  if (!machines.length) {
    return { dates: [] }
  }

  const machineIds = machines.map(m => m.id)

  //---------------------------------------
  // 4️⃣ Fetch Blocking Appointments
  //---------------------------------------
  const appointments = await prisma.appointment.findMany({
    where: {
      machineId: { in: machineIds },
      isDeleted: false,
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

  //---------------------------------------
  // 5️⃣ Generate Slots Per Day
  //---------------------------------------
  const result: BookingSlotsOutput["dates"] = []
  const current = new Date(startDate)

  while (current <= endDate) {
    const dayOfWeek = current.getDay()

    // ✅ FIXED: Use local date format
    const dateKey = current.toLocaleDateString("en-CA")

    const daySlots: string[] = []

    for (const machine of machines) {
      const rules = machine.availabilityRules.filter(
        r => r.dayOfWeek === dayOfWeek
      )

      for (const rule of rules) {
        const [startHour, startMinute] = rule.startTime.split(":").map(Number)
        const [endHour, endMinute] = rule.endTime.split(":").map(Number)

        let slotStart = new Date(current)
        slotStart.setHours(startHour, startMinute, 0, 0)

        const slotBoundary = new Date(current)
        slotBoundary.setHours(endHour, endMinute, 0, 0)

        while (true) {
          const slotEnd = new Date(
            slotStart.getTime() + finalDuration * 60000
          )

          if (slotEnd > slotBoundary) break

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
            // ✅ FIXED: Use local time formatting
            daySlots.push(
              slotStart.toTimeString().slice(0, 5)
            )
          }

          slotStart = new Date(
            slotStart.getTime() + finalDuration * 60000
          )
        }
      }
    }

    const uniqueSortedSlots = [...new Set(daySlots)].sort()

    if (uniqueSortedSlots.length > 0) {
      result.push({
        date: dateKey,
        totalSlots: uniqueSortedSlots.length,
        slots: uniqueSortedSlots
      })
    }

    current.setDate(current.getDate() + 1)
  }

  return { dates: result }
}