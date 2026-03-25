import express from "express"
import { getBookingAvailableSlots } from "../services/availableSlots"

const router = express.Router()

//
router.post("/availability", async (req, res) => {
  try {
    const { centerId, modalityId, testConfigId } = req.body ?? {}

    if (!centerId || !modalityId || !testConfigId) {
      return res.status(400).json({
        message: "centerId, modalityId and testConfigId are required",
      })
    }

    const result = await getBookingAvailableSlots(req.body)
    res.json(result)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Something went wrong" })
  }
})
//

export default router