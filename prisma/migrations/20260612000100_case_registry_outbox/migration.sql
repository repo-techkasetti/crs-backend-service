-- Link CRS bookings/payments to the ScanSure master case registry.
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "caseId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "hospitalId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "serviceMappingId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "odooProductId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "caseId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_caseId_key" ON "Appointment"("caseId");
CREATE INDEX IF NOT EXISTS "Appointment_tenantId_idx" ON "Appointment"("tenantId");
CREATE INDEX IF NOT EXISTS "Appointment_serviceMappingId_idx" ON "Appointment"("serviceMappingId");
CREATE INDEX IF NOT EXISTS "Payment_caseId_idx" ON "Payment"("caseId");

-- Outbox stores the exact payload that the relay publishes to Kafka.
CREATE TABLE IF NOT EXISTS "OutboxEvent" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "caseId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OutboxEvent_topic_status_createdAt_idx" ON "OutboxEvent"("topic", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "OutboxEvent_caseId_idx" ON "OutboxEvent"("caseId");
