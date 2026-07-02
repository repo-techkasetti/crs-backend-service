import express, { Request, Response } from "express"
import {
  getReconciliationDetail,
  listReconciliations,
  markBahmniOrderCreated,
  markBahmniOrderFailed,
  markReconciliationManualReview,
  markReconciliationRefundRequired,
  resolveReconciliation
} from "../services/b2cReconciliation"

const router = express.Router()

function actorId(req: Request) {
  return String(req.headers["x-actor-user-id"] || req.body?.actor_id || "scansure-admin")
}

function handleError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed"
  const lower = message.toLowerCase()
  if (lower.includes("not found") || lower.includes("case lookup failed")) {
    return res.status(404).json({ message })
  }
  if (lower.includes("required") || lower.includes("mandatory")) {
    return res.status(400).json({ message })
  }
  console.error("B2C reconciliation API error:", error)
  return res.status(500).json({ message })
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const rows = await listReconciliations({
      tenantId: req.query.tenant_id ? String(req.query.tenant_id) : undefined,
      resolutionStatus: req.query.resolution_status ? String(req.query.resolution_status) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined
    })
    return res.json(rows)
  } catch (error) {
    return handleError(res, error)
  }
})

router.get("/:case_id", async (req: Request, res: Response) => {
  try {
    const caseId = String(req.params.case_id)
    const row = await getReconciliationDetail(caseId)
    if (!row) return res.status(404).json({ message: "B2C reconciliation row not found for case_id" })
    return res.json(row)
  } catch (error) {
    return handleError(res, error)
  }
})

router.post("/:case_id/bahmni-order-created", async (req: Request, res: Response) => {
  try {
    const row = await markBahmniOrderCreated(String(req.params.case_id), {
      bahmni_patient_uuid: req.body?.bahmni_patient_uuid,
      bahmni_order_uuid: req.body?.bahmni_order_uuid,
      bahmni_visit_uuid: req.body?.bahmni_visit_uuid,
      actor_id: actorId(req)
    })
    return res.json(row)
  } catch (error) {
    return handleError(res, error)
  }
})

router.post("/:case_id/bahmni-order-failed", async (req: Request, res: Response) => {
  try {
    const row = await markBahmniOrderFailed(String(req.params.case_id), {
      error_code: req.body?.error_code,
      error_message: req.body?.error_message,
      actor_id: actorId(req)
    })
    return res.json(row)
  } catch (error) {
    return handleError(res, error)
  }
})

router.post("/:case_id/mark-manual-review", async (req: Request, res: Response) => {
  try {
    const row = await markReconciliationManualReview(String(req.params.case_id), actorId(req))
    return res.json(row)
  } catch (error) {
    return handleError(res, error)
  }
})

router.post("/:case_id/mark-refund-required", async (req: Request, res: Response) => {
  try {
    const row = await markReconciliationRefundRequired(String(req.params.case_id), actorId(req))
    return res.json(row)
  } catch (error) {
    return handleError(res, error)
  }
})

router.post("/:case_id/resolve", async (req: Request, res: Response) => {
  try {
    const row = await resolveReconciliation(String(req.params.case_id), actorId(req))
    return res.json(row)
  } catch (error) {
    return handleError(res, error)
  }
})

export default router
