import { Request, Response } from "express"
import { prisma } from "../lib/prisma"

export const registerPatient = async (
  req: Request,
  res: Response
) => {

  const { aadhaar_no, firstName, lastName, phone, gender, dob } = req.body

  if (!aadhaar_no) {
    return res.status(400).json({
      status: "error",
      message: "aadhaar_no required"
    })
  }

  try {

    const patient = await prisma.upiPatient.create({
      data: {
        aadhaar_no,
        firstName,
        lastName,
        phone,
        gender,
        dob: dob ? new Date(dob) : null
      }
    })

    res.json({
      status: "created",
      data: patient
    })

  } catch (err: any) {

    if (err.code === "P2002") {
      return res.status(409).json({
        status: "error",
        message: "Patient already exists"
      })
    }

    res.status(500).json({
      status: "error",
      message: "Server error"
    })

  }
}