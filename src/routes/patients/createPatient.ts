import { Request, Response } from "express"
import { prisma } from "../../lib/prisma"

export const createPatient = async (req: Request, res: Response) => {

  const userId = req.userId!

  const {
    firstName,
    lastName,
    upi_id,
    phone,
    relation,
    gender,
    dob
  } = req.body
  console.log("Received patient data:", JSON.stringify(req.body))
  const user = await prisma.userAccount.findUnique({
    where: { id: userId }
  })

  if (!user?.primaryFamilyId) {
    return res.status(400).json({
      message: "Family not found"
    })
  }

  const patient = await prisma.patient.create({
    data: {
      firstName,
      lastName,
      upiId: upi_id,
      phone,
      relation,
      gender,
      familyId: user.primaryFamilyId,
      createdByUserId: userId,
      dateOfBirth: dob
        ? new Date(dob)
        : null
    }
  })

  res.json(patient)
}