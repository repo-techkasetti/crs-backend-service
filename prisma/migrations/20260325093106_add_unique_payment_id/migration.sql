/*
  Warnings:

  - A unique constraint covering the columns `[razorpayPaymentId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");
