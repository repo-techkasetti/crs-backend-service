import { Request, Response } from "express"
import { prisma } from "../../lib/prisma"

export const verifyOtp = async (req: Request, res: Response) => {

  const { phone, otp } = req.body

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
        phone
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
  }

  res.json({
    userId: user.id,
    phone: user.phone,
    isNewUser
  })
}