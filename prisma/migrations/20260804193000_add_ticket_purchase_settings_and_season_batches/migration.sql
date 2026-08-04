CREATE TABLE "TicketPurchaseSetting" (
    "id" INTEGER NOT NULL,
    "matchMaxQuantity" INTEGER NOT NULL,
    "seasonPassMaxQuantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TicketPurchaseSetting_pkey" PRIMARY KEY ("id")
);

INSERT INTO "TicketPurchaseSetting" (
    "id", "matchMaxQuantity", "seasonPassMaxQuantity", "updatedAt"
) VALUES (1, 10, 5, CURRENT_TIMESTAMP);

CREATE TABLE "SeasonPassPurchase" (
    "id" TEXT NOT NULL,
    "purchaseCode" TEXT NOT NULL,
    "customerId" TEXT,
    "customerEmail" TEXT,
    "quantity" INTEGER NOT NULL,
    "subtotalBaht" INTEGER NOT NULL,
    "shippingFeeBaht" INTEGER NOT NULL DEFAULT 0,
    "totalBaht" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "status" "SeasonPassOrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SeasonPassPurchase_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SeasonPassOrder" ADD COLUMN "purchaseId" TEXT;
ALTER TABLE "XenditPayment" ADD COLUMN "seasonPassPurchaseId" TEXT;
ALTER TABLE "BeamPayment" ADD COLUMN "seasonPassPurchaseId" TEXT;

CREATE UNIQUE INDEX "SeasonPassPurchase_purchaseCode_key" ON "SeasonPassPurchase"("purchaseCode");
CREATE INDEX "SeasonPassPurchase_customerId_idx" ON "SeasonPassPurchase"("customerId");
CREATE INDEX "SeasonPassPurchase_customerEmail_idx" ON "SeasonPassPurchase"("customerEmail");
CREATE INDEX "SeasonPassPurchase_status_idx" ON "SeasonPassPurchase"("status");
CREATE INDEX "SeasonPassOrder_purchaseId_idx" ON "SeasonPassOrder"("purchaseId");
CREATE INDEX "XenditPayment_seasonPassPurchaseId_status_idx" ON "XenditPayment"("seasonPassPurchaseId", "status");
CREATE INDEX "BeamPayment_seasonPassPurchaseId_status_idx" ON "BeamPayment"("seasonPassPurchaseId", "status");

ALTER TABLE "SeasonPassOrder"
ADD CONSTRAINT "SeasonPassOrder_purchaseId_fkey"
FOREIGN KEY ("purchaseId") REFERENCES "SeasonPassPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "XenditPayment"
ADD CONSTRAINT "XenditPayment_seasonPassPurchaseId_fkey"
FOREIGN KEY ("seasonPassPurchaseId") REFERENCES "SeasonPassPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BeamPayment"
ADD CONSTRAINT "BeamPayment_seasonPassPurchaseId_fkey"
FOREIGN KEY ("seasonPassPurchaseId") REFERENCES "SeasonPassPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
