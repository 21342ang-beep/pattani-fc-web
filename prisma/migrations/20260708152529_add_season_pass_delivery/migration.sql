-- CreateEnum
CREATE TYPE "SeasonPassDeliveryMethod" AS ENUM ('SHIPPING', 'PICKUP');

-- AlterTable
ALTER TABLE "SeasonPassOrder" ADD COLUMN     "deliveryMethod" "SeasonPassDeliveryMethod" NOT NULL DEFAULT 'PICKUP',
ADD COLUMN     "pickupLocation" TEXT,
ADD COLUMN     "shipAddress" TEXT,
ADD COLUMN     "shipCity" TEXT,
ADD COLUMN     "shipNote" TEXT,
ADD COLUMN     "shipPostalCode" TEXT,
ADD COLUMN     "shipProvince" TEXT,
ADD COLUMN     "shippingFeeBaht" INTEGER NOT NULL DEFAULT 0;
