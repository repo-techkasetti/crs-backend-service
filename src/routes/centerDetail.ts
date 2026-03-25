import express from "express"
import { getCenterDetail } from "../services/centerDetail"

const router = express.Router()

//
router.get("/:centerId", async (req, res) => {
  try {
    const { centerId } = req.params

    const result = await getCenterDetail(centerId)
    //
    // const result = await getCenterDetail(centerId)
    
    if (!result) {
      return res.status(404).json({
        message: "Center not found"
      })
    }
    //
    res.json(result)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Something went wrong" })
  }
})
//

export default router