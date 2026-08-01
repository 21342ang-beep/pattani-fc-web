CREATE TABLE "SeasonPassZoneQuota" (
    "id" TEXT NOT NULL,
    "seasonLabel" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "seatZone" TEXT NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "sponsorReserved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonPassZoneQuota_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeasonPassZoneQuota_seasonLabel_tierId_seatZone_key"
ON "SeasonPassZoneQuota"("seasonLabel", "tierId", "seatZone");

CREATE INDEX "SeasonPassZoneQuota_seasonLabel_tierId_idx"
ON "SeasonPassZoneQuota"("seasonLabel", "tierId");

-- แพ็กเกจ VIP ADVANCED 2,500 บาท: A ขาย 158 (193 - สปอนเซอร์ 35), B ขาย 193
INSERT INTO "SeasonPassZoneQuota"
  ("id", "seasonLabel", "tierId", "seatZone", "totalSeats", "sponsorReserved", "updatedAt")
VALUES
  ('spzq-2026-vip-a', '2026/27', 'vip-advanced', 'VIP-A', 193, 35, CURRENT_TIMESTAMP),
  ('spzq-2026-vip-b', '2026/27', 'vip-advanced', 'VIP-B', 193, 0, CURRENT_TIMESTAMP);
