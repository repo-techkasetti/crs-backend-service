import test from "node:test"
import assert from "node:assert/strict"
import {
  getKafkaMessageKey,
  isRelayCandidate,
  publishRelayEvent,
  RelayEvent,
  RelayPublisher,
  RelayStore
} from "../services/outboxRelay"

function event(overrides: Partial<RelayEvent> = {}): RelayEvent {
  return {
    id: "event-1",
    topic: "b2c.radiology.orders",
    eventType: "BOOKING_CONFIRMED",
    aggregateId: "appointment-1",
    caseId: "CASE-1",
    retryCount: 0,
    payload: {
      case_id: "CASE-1",
      tenant_id: "tenant-1",
      appointment_id: "appointment-1"
    },
    ...overrides
  }
}

function store() {
  const calls: Array<Record<string, unknown>> = []
  const relayStore: RelayStore = {
    async markSent(id: string) {
      calls.push({ method: "markSent", id })
    },
    async markFailed(id: string, retryCount: number, errorMessage: string, terminal: boolean) {
      calls.push({ method: "markFailed", id, retryCount, errorMessage, terminal })
    }
  }
  return { relayStore, calls }
}

test("PENDING event becomes SENT after publish", async () => {
  const { relayStore, calls } = store()
  const published: Array<Record<string, unknown>> = []
  const publisher: RelayPublisher = {
    async publish(topic, key, payload) {
      published.push({ topic, key, payload })
    }
  }

  const result = await publishRelayEvent(event(), publisher, relayStore)

  assert.equal(result, "SENT")
  assert.equal(published[0].key, "CASE-1")
  assert.deepEqual(calls[0], { method: "markSent", id: "event-1" })
})

test("event is FAILED after max retries", async () => {
  const { relayStore, calls } = store()
  const publisher: RelayPublisher = {
    async publish() {
      throw new Error("Kafka unavailable")
    }
  }

  const result = await publishRelayEvent(event({ retryCount: 4 }), publisher, relayStore)

  assert.equal(result, "FAILED")
  assert.equal(calls[0].method, "markFailed")
  assert.equal(calls[0].retryCount, 5)
  assert.equal(calls[0].terminal, true)
})

test("missing case_id fails for BOOKING_CONFIRMED", async () => {
  const { relayStore, calls } = store()
  let publishCalled = false
  const publisher: RelayPublisher = {
    async publish() {
      publishCalled = true
    }
  }

  const result = await publishRelayEvent(
    event({
      caseId: null,
      payload: {
        tenant_id: "tenant-1",
        appointment_id: "appointment-1"
      }
    }),
    publisher,
    relayStore
  )

  assert.equal(result, "FAILED")
  assert.equal(publishCalled, false)
  assert.equal(calls[0].method, "markFailed")
  assert.match(String(calls[0].errorMessage), /case_id is mandatory/)
})

test("Kafka key uses case_id when available", () => {
  assert.equal(getKafkaMessageKey(event({ caseId: "CASE-XYZ" })), "CASE-XYZ")
  assert.equal(
    getKafkaMessageKey(event({ caseId: null, payload: { case_id: "CASE-FROM-PAYLOAD" } })),
    "CASE-FROM-PAYLOAD"
  )
})

test("Kafka key falls back to aggregateId when case_id is absent", () => {
  assert.equal(getKafkaMessageKey(event({ caseId: null, payload: {} })), "appointment-1")
})

test("SENT events are not relay candidates", () => {
  assert.equal(isRelayCandidate({ topic: "b2c.radiology.orders", status: "SENT" }), false)
  assert.equal(isRelayCandidate({ topic: "b2c.radiology.orders", status: "PENDING" }), true)
})
