import { Request, Response } from "express"
import { prisma } from "../../lib/prisma"

export const getPatientList = async (req: Request, res: Response) => {

  const userId = req.userId!

  const user = await prisma.userAccount.findUnique({
    where: { id: userId }
  })

  if (!user?.primaryFamilyId) {
    return res.json({ patients: [] })
  }

  const patients = await prisma.patient.findMany({
    where: {
      familyId: user.primaryFamilyId
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      relation: true,
      gender: true,
      upiId: true
    }
  })

  res.json({ patients })
}