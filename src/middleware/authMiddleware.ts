import { Request, Response, NextFunction } from "express"

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {

  const userId = req.headers["userid"]

  if (!userId) {
    return res.status(401).json({
      message: "User not authenticated"
    })
  }

  req.userId = userId as string

  next()
}