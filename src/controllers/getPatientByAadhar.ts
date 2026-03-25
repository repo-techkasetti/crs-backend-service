import { Request, Response } from "express"
import { prisma } from "../lib/prisma"

interface Params {
  aadhaar: string
}

export const getPatientByAadhar = async (
  req: Request<Params>,
  res: Response
) => {

  const { aadhaar } = req.params

  const patient = await prisma.upiPatient.findUnique({
    where: { aadhaar_no: aadhaar }
  })

  if (!patient) {
    return res.json({
      status: "not_found",
      message: "Patient not found"
    })
  }

  res.json({
    status: "found",
    data: patient
  })
}