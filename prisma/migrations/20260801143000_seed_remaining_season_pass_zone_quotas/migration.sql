-- แพ็กเกจ 2,000 บาท: A 0001-0200, B 0201-0400, F 0401-1000
-- แพ็กเกจ 1,500 บาท: C 0001-0200, E 0201-0400, G 0401-0600, J 0601-0800
-- ถ้ามีการตั้งค่าสปอนเซอร์ไว้แล้ว ให้รักษาค่านั้นและปรับเฉพาะจำนวนที่นั่งรวมของโซน
INSERT INTO "SeasonPassZoneQuota"
  ("id", "seasonLabel", "tierId", "seatZone", "totalSeats", "sponsorReserved", "updatedAt")
VALUES
  ('spzq-2026-premium-a', '2026/27', 'premium', 'PRIMIUM-A', 200, 0, CURRENT_TIMESTAMP),
  ('spzq-2026-premium-b', '2026/27', 'premium', 'PRIMIUM-B', 200, 0, CURRENT_TIMESTAMP),
  ('spzq-2026-premium-f', '2026/27', 'premium', 'PRIMIUM-F', 600, 0, CURRENT_TIMESTAMP),
  ('spzq-2026-gold-c', '2026/27', 'gold', 'GOLD-C', 200, 0, CURRENT_TIMESTAMP),
  ('spzq-2026-gold-e', '2026/27', 'gold', 'GOLD-E', 200, 0, CURRENT_TIMESTAMP),
  ('spzq-2026-gold-g', '2026/27', 'gold', 'GOLD-G', 200, 0, CURRENT_TIMESTAMP),
  ('spzq-2026-gold-j', '2026/27', 'gold', 'GOLD-J', 200, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("seasonLabel", "tierId", "seatZone")
DO UPDATE SET
  "totalSeats" = EXCLUDED."totalSeats",
  "updatedAt" = CURRENT_TIMESTAMP;
