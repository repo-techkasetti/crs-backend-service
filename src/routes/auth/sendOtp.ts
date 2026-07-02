import { Request, Response } from "express"

export const sendOtp = async (req: Request, res: Response) => {
  console.log(`OTP request received at ${new Date().toISOString()}`)
  const { phone, email, name } = req.body

  if (!phone) {
    return res.status(400).json({
      message: "Phone required"
    })
  }

  if (email && typeof email !== "string") {
    return res.status(400).json({
      message: "Email must be a string"
    })
  }

  if (name && typeof name !== "string") {
    return res.status(400).json({
      message: "Name must be a string"
    })
  }

  // mock OTP
  const otp = "123456"

  console.log(`OTP for ${phone}: ${otp}${email ? ` | email=${email}` : ""}${name ? ` | name=${name}` : ""}`)

  res.json({
    message: "OTP sent",
    otp // remove in production
  })
}
