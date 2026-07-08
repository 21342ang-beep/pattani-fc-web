-- CreateEnum
CREATE TYPE "SeasonPassOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "SeasonPassOrder" (
    "id" TEXT NOT NULL,
    "passCode" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "seasonLabel" TEXT NOT NULL,
    "priceBaht" INTEGER NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "status" "SeasonPassOrderStatus" NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonPassOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeasonPassOrder_passCode_key" ON "SeasonPassOrder"("passCode");

-- CreateIndex
CREATE INDEX "SeasonPassOrder_status_idx" ON "SeasonPassOrder"("status");

-- CreateIndex
CREATE INDEX "SeasonPassOrder_customerPhone_idx" ON "SeasonPassOrder"("customerPhone");

-- CreateIndex
CREATE INDEX "SeasonPassOrder_customerEmail_idx" ON "SeasonPassOrder"("customerEmail");

-- CreateIndex
CREATE INDEX "SeasonPassOrder_customerId_idx" ON "SeasonPassOrder"("customerId");
