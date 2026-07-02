import { Kafka, Producer } from "kafkajs"
import { prisma } from "../lib/prisma"

const DEFAULT_TOPIC = "b2c.radiology.orders"
const DEFAULT_BATCH_SIZE = 10
const DEFAULT_POLL_MS = 5000
const MAX_RETRIES = 5

export type RelayEvent = {
  id: string
  topic: string
  eventType: string
  aggregateId: string
  caseId: string | null
  payload: unknown
  retryCount: number
}

export type RelayPublisher = {
  publish(topic: string, key: string, payload: unknown): Promise<void>
}

export type RelayStore = {
  markSent(id: string): Promise<void>
  markFailed(id: string, retryCount: number, errorMessage: string, terminal: boolean): Promise<void>
}

function payloadAsRecord(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>
  }
  return {}
}

export function getKafkaMessageKey(event: Pick<RelayEvent, "aggregateId" | "caseId" | "payload">): string {
  const payload = payloadAsRecord(event.payload)
  const caseId = event.caseId || (typeof payload.case_id === "string" ? payload.case_id : null)
  return caseId || event.aggregateId
}

export function isRelayCandidate(event: { topic: string; status: string }): boolean {
  return event.topic === DEFAULT_TOPIC && event.status === "PENDING"
}

export function validateRelayEvent(event: RelayEvent): string | null {
  const payload = payloadAsRecord(event.payload)
  const eventType = event.eventType || (typeof payload.event_type === "string" ? payload.event_type : "")
  const caseId = event.caseId || (typeof payload.case_id === "string" ? payload.case_id : null)
  const tenantId = typeof payload.tenant_id === "string" ? payload.tenant_id : null
  const appointmentId = typeof payload.appointment_id === "string" ? payload.appointment_id : null

  if (eventType === "BOOKING_CONFIRMED" && !caseId) {
    return "case_id is mandatory for BOOKING_CONFIRMED events"
  }
  if (!tenantId) {
    return "tenant_id is mandatory"
  }
  if (!appointmentId && !event.aggregateId) {
    return "appointment_id or aggregateId is mandatory"
  }
  return null
}

export async function publishRelayEvent(
  event: RelayEvent,
  publisher: RelayPublisher,
  store: RelayStore
): Promise<"SENT" | "PENDING" | "FAILED"> {
  const validationError = validateRelayEvent(event)
  if (validationError) {
    await store.markFailed(event.id, MAX_RETRIES, validationError, true)
    console.error(`[outbox-relay] event marked FAILED ${event.id}: ${validationError}`)
    return "FAILED"
  }

  const key = getKafkaMessageKey(event)
  try {
    await publisher.publish(event.topic || DEFAULT_TOPIC, key, event.payload)
    await store.markSent(event.id)
    console.log(`[outbox-relay] Kafka publish success event=${event.id} key=${key}`)
    return "SENT"
  } catch (error) {
    const retryCount = event.retryCount + 1
    const terminal = retryCount >= MAX_RETRIES
    const message = error instanceof Error ? error.message : String(error)
    await store.markFailed(event.id, retryCount, message, terminal)
    console.error(`[outbox-relay] Kafka publish failure event=${event.id}: ${message}`)
    if (terminal) {
      console.error(`[outbox-relay] event marked FAILED ${event.id}`)
    }
    return terminal ? "FAILED" : "PENDING"
  }
}

class KafkaRelayPublisher implements RelayPublisher {
  constructor(private readonly producer: Producer) {}

  async publish(topic: string, key: string, payload: unknown): Promise<void> {
    await this.producer.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(payload)
        }
      ]
    })
  }
}

const prismaRelayStore: RelayStore = {
  async markSent(id: string): Promise<void> {
    await prisma.outboxEvent.update({
      where: { id },
      data: {
        status: "SENT",
        processedAt: new Date(),
        publishedAt: new Date(),
        lastAttemptAt: new Date(),
        lastError: null
      }
    })
  },

  async markFailed(id: string, retryCount: number, errorMessage: string, terminal: boolean): Promise<void> {
    await prisma.outboxEvent.update({
      where: { id },
      data: {
        status: terminal ? "FAILED" : "PENDING",
        retryCount,
        attempts: retryCount,
        lastAttemptAt: new Date(),
        lastError: errorMessage
      }
    })
  }
}

export async function claimPendingEvents(batchSize = DEFAULT_BATCH_SIZE): Promise<RelayEvent[]> {
  return prisma.$queryRaw<RelayEvent[]>`
    UPDATE "OutboxEvent"
    SET "status" = 'PROCESSING',
        "lastAttemptAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "id" IN (
      SELECT "id"
      FROM "OutboxEvent"
      WHERE "topic" = ${DEFAULT_TOPIC}
        AND "status" = 'PENDING'
      ORDER BY "createdAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "topic", "eventType", "aggregateId", "caseId", "payload", "retryCount"
  `
}

export async function processOutboxBatch(publisher: RelayPublisher, batchSize = DEFAULT_BATCH_SIZE): Promise<number> {
  const events = await claimPendingEvents(batchSize)
  for (const event of events) {
    console.log(`[outbox-relay] event picked ${event.id}`)
    await publishRelayEvent(event, publisher, prismaRelayStore)
  }
  return events.length
}

export async function getOutboxStats(): Promise<Record<string, number>> {
  const rows = await prisma.outboxEvent.groupBy({
    by: ["status"],
    _count: { _all: true }
  })
  return Object.fromEntries(rows.map((row) => [row.status, row._count._all]))
}

export async function startOutboxRelay(): Promise<void> {
  const brokers = (process.env.KAFKA_BROKERS || "localhost:9092")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean)

  const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || "crs-outbox-relay",
    brokers
  })
  const producer = kafka.producer()
  await producer.connect()
  const publisher = new KafkaRelayPublisher(producer)

  console.log(`[outbox-relay] relay started brokers=${brokers.join(",")} pollMs=${DEFAULT_POLL_MS}`)

  const runOnce = async () => {
    try {
      await processOutboxBatch(publisher)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[outbox-relay] batch error: ${message}`)
    }
  }

  await runOnce()
  setInterval(runOnce, Number(process.env.OUTBOX_RELAY_POLL_MS || DEFAULT_POLL_MS))
}
