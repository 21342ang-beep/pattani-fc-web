-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('MATCHES', 'BOOKINGS', 'SEASON_PASSES', 'CUSTOMERS', 'WEBSITE', 'REPORTS', 'FINANCE', 'GATE_CHECK');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "permissions" "Permission"[] DEFAULT ARRAY[]::"Permission"[];
