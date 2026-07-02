DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CartStatus') THEN
    CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKED_OUT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderStatus') THEN
    CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'FAILED', 'EXPIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderItemStatus') THEN
    CREATE TYPE "OrderItemStatus" AS ENUM ('HOLD', 'BOOKED', 'FAILED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PENDING', 'CANCELLED', 'EXPIRED');
  END IF;
END $$;

ALTER TABLE "UserAccount" ADD COLUMN IF NOT EXISTS "kbAccountId" TEXT;
ALTER TABLE "Payment" ALTER COLUMN "appointmentId" DROP NOT NULL;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
CREATE INDEX IF NOT EXISTS "Payment_orderId_idx" ON "Payment"("orderId");

CREATE TABLE IF NOT EXISTS "Cart" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CartItem" (
  "id" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "patientId" TEXT,
  "centerId" TEXT,
  "modalityId" TEXT,
  "testConfigId" TEXT,
  "appointmentDate" DATE,
  "slotTime" TEXT,
  "unitPrice" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Order" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "cartId" TEXT,
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "totalAmount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "razorpayOrderId" TEXT,
  "razorpayPaymentId" TEXT,
  "razorpaySignature" TEXT,
  "holdExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "cartItemId" TEXT,
  "patientId" TEXT,
  "centerId" TEXT NOT NULL,
  "modalityId" TEXT,
  "testConfigId" TEXT,
  "appointmentDate" DATE,
  "slotTime" TEXT,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" "OrderItemStatus" NOT NULL DEFAULT 'HOLD',
  "appointmentId" TEXT,
  "caseId" TEXT,
  "tenantId" TEXT,
  "hospitalId" TEXT,
  "serviceMappingId" TEXT,
  "odooProductId" TEXT,
  "coveredBySubscription" BOOLEAN NOT NULL DEFAULT false,
  "entitlementId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SubscriptionPlan" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "monthlyPrice" INTEGER NOT NULL,
  "kbPlanName" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "odooProductId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlanItem" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "serviceCode" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "kbSubscriptionId" TEXT,
  "kbBundleId" TEXT,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "razorpayOrderId" TEXT,
  "razorpayPaymentId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "renewsAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Entitlement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "serviceCode" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "remaining" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Cart_userId_status_idx" ON "Cart"("userId", "status");
CREATE INDEX IF NOT EXISTS "CartItem_cartId_idx" ON "CartItem"("cartId");
CREATE INDEX IF NOT EXISTS "CartItem_patientId_idx" ON "CartItem"("patientId");
CREATE INDEX IF NOT EXISTS "Order_userId_status_idx" ON "Order"("userId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_razorpayOrderId_key" ON "Order"("razorpayOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_razorpayPaymentId_key" ON "Order"("razorpayPaymentId");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_status_idx" ON "OrderItem"("orderId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "OrderItem_appointmentId_key" ON "OrderItem"("appointmentId");
CREATE INDEX IF NOT EXISTS "OrderItem_caseId_idx" ON "OrderItem"("caseId");
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPlan_kbPlanName_key" ON "SubscriptionPlan"("kbPlanName");
CREATE UNIQUE INDEX IF NOT EXISTS "PlanItem_planId_serviceCode_key" ON "PlanItem"("planId", "serviceCode");
CREATE INDEX IF NOT EXISTS "UserSubscription_userId_status_idx" ON "UserSubscription"("userId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "Entitlement_subscriptionId_serviceCode_key" ON "Entitlement"("subscriptionId", "serviceCode");
CREATE INDEX IF NOT EXISTS "Entitlement_userId_idx" ON "Entitlement"("userId");
