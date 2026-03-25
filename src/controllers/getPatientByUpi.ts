import { Request, Response } from "express"
import { prisma } from "../lib/prisma"

interface Params {
  upi_id: string
}

export const getPatientByUpi = async (
  req: Request<Params>,
  res: Response
) => {

  const { upi_id } = req.params

  const patient = await prisma.upiPatient.findUnique({
    where: { upi_id }
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