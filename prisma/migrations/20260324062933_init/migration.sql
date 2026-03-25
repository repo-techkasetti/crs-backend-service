-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('HOLD', 'BOOKED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'EXPIRED', 'BLOCKED');

-- CreateTable
CREATE TABLE "UpiPatient" (
    "upi_id" TEXT NOT NULL,
    "aadhaar_no" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "gender" TEXT,
    "dob" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpiPatient_pkey" PRIMARY KEY ("upi_id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorAdmin" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Center" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Center_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchAdmin" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modality" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Modality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterModality" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "modalityId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CenterModality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "modalityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operator" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "modalityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorLeave" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorLeave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotMinutes" INTEGER NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModalityTestConfig" (
    "id" TEXT NOT NULL,
    "modalityId" TEXT NOT NULL,
    "testKeyword" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ModalityTestConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAccount" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "primaryFamilyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "upiId" TEXT,
    "relation" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "phone" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "modalityId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "testConfigId" TEXT NOT NULL,
    "appointmentDate" DATE NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL,
    "holdExpiresAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "patientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UpiPatient_aadhaar_no_key" ON "UpiPatient"("aadhaar_no");

-- CreateIndex
CREATE UNIQUE INDEX "VendorAdmin_email_key" ON "VendorAdmin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BranchAdmin_centerId_key" ON "BranchAdmin"("centerId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchAdmin_email_key" ON "BranchAdmin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Modality_code_key" ON "Modality"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CenterModality_centerId_modalityId_key" ON "CenterModality"("centerId", "modalityId");

-- CreateIndex
CREATE INDEX "Machine_centerId_modalityId_idx" ON "Machine"("centerId", "modalityId");

-- CreateIndex
CREATE INDEX "Operator_centerId_modalityId_idx" ON "Operator"("centerId", "modalityId");

-- CreateIndex
CREATE INDEX "OperatorLeave_operatorId_startDateTime_endDateTime_idx" ON "OperatorLeave"("operatorId", "startDateTime", "endDateTime");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityRule_machineId_dayOfWeek_key" ON "AvailabilityRule"("machineId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "ModalityTestConfig_modalityId_testKeyword_key" ON "ModalityTestConfig"("modalityId", "testKeyword");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_phone_key" ON "UserAccount"("phone");

-- CreateIndex
CREATE INDEX "Patient_familyId_relation_idx" ON "Patient"("familyId", "relation");

-- CreateIndex
CREATE INDEX "Appointment_centerId_modalityId_appointmentDate_idx" ON "Appointment"("centerId", "modalityId", "appointmentDate");

-- CreateIndex
CREATE INDEX "Appointment_machineId_startTime_idx" ON "Appointment"("machineId", "startTime");

-- CreateIndex
CREATE INDEX "Appointment_operatorId_startTime_idx" ON "Appointment"("operatorId", "startTime");

-- CreateIndex
CREATE INDEX "Appointment_holdExpiresAt_idx" ON "Appointment"("holdExpiresAt");

-- CreateIndex
CREATE INDEX "Appointment_userId_idx" ON "Appointment"("userId");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "Appointment_familyId_idx" ON "Appointment"("familyId");

-- AddForeignKey
ALTER TABLE "VendorAdmin" ADD CONSTRAINT "VendorAdmin_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Center" ADD CONSTRAINT "Center_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchAdmin" ADD CONSTRAINT "BranchAdmin_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterModality" ADD CONSTRAINT "CenterModality_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterModality" ADD CONSTRAINT "CenterModality_modalityId_fkey" FOREIGN KEY ("modalityId") REFERENCES "Modality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_modalityId_fkey" FOREIGN KEY ("modalityId") REFERENCES "Modality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operator" ADD CONSTRAINT "Operator_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operator" ADD CONSTRAINT "Operator_modalityId_fkey" FOREIGN KEY ("modalityId") REFERENCES "Modality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorLeave" ADD CONSTRAINT "OperatorLeave_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModalityTestConfig" ADD CONSTRAINT "ModalityTestConfig_modalityId_fkey" FOREIGN KEY ("modalityId") REFERENCES "Modality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_modalityId_fkey" FOREIGN KEY ("modalityId") REFERENCES "Modality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_testConfigId_fkey" FOREIGN KEY ("testConfigId") REFERENCES "ModalityTestConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
