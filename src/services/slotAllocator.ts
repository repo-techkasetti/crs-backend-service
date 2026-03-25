import { prisma } from "../lib/prisma"

export const allocateMachineOperator = async (
  centerId: string,
  modalityId: string,
  startTime: Date,
  endTime: Date
) => {

  const dayOfWeek = startTime.getDay()

  const machines = await prisma.machine.findMany({
    where: {
      centerId,
      modalityId,
      isActive: true,
      isDeleted: false
    },
    include: {
      availabilityRules: true
    }
  })

  const operators = await prisma.operator.findMany({
    where: {
      centerId,
      modalityId,
      isActive: true,
      isDeleted: false
    }
  })

  for (const machine of machines) {

    const rule = machine.availabilityRules.find(
      r => r.dayOfWeek === dayOfWeek
    )

    if (!rule) continue

    const start = new Date(startTime)
    const end = new Date(endTime)

    const ruleStart = new Date(startTime)
    const ruleEnd = new Date(startTime)

    const [sh, sm] = rule.startTime.split(":")
    const [eh, em] = rule.endTime.split(":")

    ruleStart.setHours(Number(sh), Number(sm), 0)
    ruleEnd.setHours(Number(eh), Number(em), 0)

    if (start < ruleStart || end > ruleEnd) continue

    const machineClash = await prisma.appointment.findFirst({
      where: {
        machineId: machine.id,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        status: {
          notIn: ["CANCELLED", "EXPIRED"]
        }
      }
    })

    if (machineClash) continue

    for (const operator of operators) {

      const leave = await prisma.operatorLeave.findFirst({
        where: {
          operatorId: operator.id,
          startDateTime: { lt: endTime },
          endDateTime: { gt: startTime }
        }
      })

      if (leave) continue

      const operatorClash = await prisma.appointment.findFirst({
        where: {
          operatorId: operator.id,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
          status: {
            notIn: ["CANCELLED", "EXPIRED"]
          }
        }
      })

      if (operatorClash) continue

      return {
        machineId: machine.id,
        operatorId: operator.id
      }
    }
  }

  return null
}