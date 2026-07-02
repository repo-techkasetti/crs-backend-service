import { Request, Response } from "express"
import { prisma } from "../../lib/prisma"

export const verifyOtp = async (req: Request, res: Response) => {
  const { phone, otp, email, name } = req.body

  if (!phone) {
    return res.status(400).json({
      message: "Phone required"
    })
  }

  if (otp !== "123456") {
    return res.status(400).json({
      message: "Invalid OTP"
    })
  }

  let user = await prisma.userAccount.findUnique({
    where: { phone }
  })

  let isNewUser = false

  if (!user) {

    isNewUser = true

    user = await prisma.userAccount.create({
      data: {
        phone,
        email: email || null,
        name: name || null
      }
    })

    const family = await prisma.family.create({
      data: {
        createdBy: user.id,
        name: "My Family"
      }
    })

    await prisma.userAccount.update({
      where: { id: user.id },
      data: {
        primaryFamilyId: family.id
      }
    })
  } else if (email || name) {
    user = await prisma.userAccount.update({
      where: { id: user.id },
      data: {
        email: email || user.email,
        name: name || user.name
      }
    })
  }

  res.json({
    userId: user.id,
    phone: user.phone,
    email: user.email,
    name: user.name,
    isNewUser
  })
}
