import { Request, Response } from "express"

export const sendOtp = async (req: Request, res: Response) => {
  console.log(`OTP request received at ${new Date().toISOString()}`)
  const { phone } = req.body

  if (!phone) {
    return res.status(400).json({
      message: "Phone required"
    })
  }

  // mock OTP
  const otp = "123456"

  console.log(`OTP for ${phone}: ${otp}`)

  res.json({
    message: "OTP sent",
    otp // remove in production
  })
}