import test from "node:test"
import assert from "node:assert/strict"
import {
  failureResolutionForRetry,
  normalizeOutboxStatus,
  requireBahmniCreatedPayload
} from "../services/b2cReconciliation"

test("outbox status is normalized for reconciliation tracking", () => {
  assert.equal(normalizeOutboxStatus("SENT"), "SENT")
  assert.equal(normalizeOutboxStatus("FAILED"), "FAILED")
  assert.equal(normalizeOutboxStatus("PENDING"), "PENDING")
  assert.equal(normalizeOutboxStatus("PROCESSING"), "PENDING")
  assert.equal(normalizeOutboxStatus(null), "PENDING")
})

test("Bahmni created callback requires patient and order UUIDs", () => {
  assert.doesNotThrow(() => {
    requireBahmniCreatedPayload({
      bahmni_patient_uuid: "patient-uuid",
      bahmni_order_uuid: "order-uuid"
    })
  })
  assert.throws(() => requireBahmniCreatedPayload({ bahmni_patient_uuid: "patient-uuid" }), /required/)
  assert.throws(() => requireBahmniCreatedPayload({ bahmni_order_uuid: "order-uuid" }), /required/)
})

test("Bahmni failed callback escalates to manual review after retry threshold", () => {
  assert.equal(failureResolutionForRetry(1), "RETRY_REQUIRED")
  assert.equal(failureResolutionForRetry(2), "RETRY_REQUIRED")
  assert.equal(failureResolutionForRetry(3), "MANUAL_REVIEW_REQUIRED")
})
