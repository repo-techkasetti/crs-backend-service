DO $$
BEGIN
  CREATE TYPE "ReconciliationPaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ReconciliationOutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "BahmniOrderStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'CREATED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ReconciliationResolutionStatus" AS ENUM ('OPEN', 'RETRY_REQUIRED', 'MANUAL_REVIEW_REQUIRED', 'REFUND_REQUIRED', 'RESOLVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "B2COrderReconciliation" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "hospitalId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "paymentOrderId" TEXT,
  "paymentStatus" "ReconciliationPaymentStatus" NOT NULL,
  "outboxEventId" TEXT,
  "outboxStatus" "ReconciliationOutboxStatus" NOT NULL,
  "bahmniPatientUuid" TEXT,
  "bahmniOrderUuid" TEXT,
  "bahmniVisitUuid" TEXT,
  "bahmniOrderStatus" "BahmniOrderStatus" NOT NULL,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "resolutionStatus" "ReconciliationResolutionStatus" NOT NULL,
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "B2COrderReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "B2COrderReconciliation_caseId_key" ON "B2COrderReconciliation"("caseId");
CREATE INDEX IF NOT EXISTS "B2COrderReconciliation_tenantId_resolutionStatus_idx" ON "B2COrderReconciliation"("tenantId", "resolutionStatus");
CREATE INDEX IF NOT EXISTS "B2COrderReconciliation_hospitalId_idx" ON "B2COrderReconciliation"("hospitalId");
CREATE INDEX IF NOT EXISTS "B2COrderReconciliation_appointmentId_idx" ON "B2COrderReconciliation"("appointmentId");
CREATE INDEX IF NOT EXISTS "B2COrderReconciliation_outboxStatus_idx" ON "B2COrderReconciliation"("outboxStatus");
CREATE INDEX IF NOT EXISTS "B2COrderReconciliation_bahmniOrderStatus_idx" ON "B2COrderReconciliation"("bahmniOrderStatus");
CREATE INDEX IF NOT EXISTS "B2COrderReconciliation_createdAt_idx" ON "B2COrderReconciliation"("createdAt");
