import { Request, Response } from "express"
import { prisma } from "../../lib/prisma"

type Params = {
  upiId: string
}

export const getPatientByUpiInMobile = async (
  req: Request<Params>,
  res: Response
) => {
  try {
    const userId = req.userId!
    const { upiId } = req.params

    // extra safety (optional but good)
    if (!upiId) {
      return res.status(400).json({ message: "upiId is required" })
    }

    const user = await prisma.userAccount.findUnique({
      where: { id: userId }
    })

    if (!user?.primaryFamilyId) {
      return res.status(404).json({ message: "Family not found" })
    }

    const patient = await prisma.patient.findFirst({
      where: {
        familyId: user.primaryFamilyId,
        upiId: upiId   // ✅ now TS knows it's a string
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

    // if (!patient) {
    //   return res.status(404).json({ message: "Patient not found" })
    // }
    if (!patient) {
      return res.json({
        status: "not_found",
        message: "Patient not found with the provided UPI ID"
      })
    }

    // return res.json({ patient })
    res.json({
      status: "found",
      data: patient
    })    

  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: "Internal server error" })
  }
}