ALTER TABLE "XenditPayment" ALTER COLUMN "bookingId" DROP NOT NULL;

ALTER TABLE "XenditPayment" ADD COLUMN "seasonPassOrderId" TEXT;

CREATE INDEX "XenditPayment_seasonPassOrderId_status_idx"
  ON "XenditPayment"("seasonPassOrderId", "status");

ALTER TABLE "XenditPayment"
  ADD CONSTRAINT "XenditPayment_seasonPassOrderId_fkey"
  FOREIGN KEY ("seasonPassOrderId") REFERENCES "SeasonPassOrder"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
