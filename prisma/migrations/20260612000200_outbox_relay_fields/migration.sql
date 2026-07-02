-- Relay bookkeeping for reliable Kafka publishing.
ALTER TABLE "OutboxEvent" ADD COLUMN IF NOT EXISTS "eventType" TEXT NOT NULL DEFAULT 'BOOKING_CONFIRMED';
ALTER TABLE "OutboxEvent" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OutboxEvent" ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3);
ALTER TABLE "OutboxEvent" ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);

UPDATE "OutboxEvent"
SET "retryCount" = "attempts"
WHERE "retryCount" = 0 AND "attempts" > 0;
