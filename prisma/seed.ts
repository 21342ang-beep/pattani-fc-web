import { PrismaClient, Permission } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// permissions ทั้งหมด — ยัดใส่ SUPER_ADMIN ตอน seed แม้ว่า role SUPER_ADMIN
// จะ bypass permission check อยู่แล้ว (เก็บให้ข้อมูลสอดคล้อง)
const ALL_PERMISSIONS: Permission[] = [
  "MATCHES",
  "BOOKINGS",
  "SEASON_PASSES",
  "CUSTOMERS",
  "WEBSITE",
  "REPORTS",
  "FINANCE",
  "GATE_CHECK",
];

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ตั้งค่า SEED_ADMIN_EMAIL และ SEED_ADMIN_PASSWORD ใน .env.local ก่อน");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { permissions: ALL_PERMISSIONS },
    create: {
      email: email.toLowerCase(),
      passwordHash,
      name: "Administrator",
      role: "SUPER_ADMIN",
      permissions: ALL_PERMISSIONS,
    },
  });
  console.log(`✓ Admin พร้อมใช้: ${admin.email}`);

  const existing = await prisma.match.count();
  if (existing === 0) {
    const now = Date.now();
    await prisma.match.createMany({
      data: [
        {
          homeTeam: "Buriram United",
          awayTeam: "BG Pathum United",
          venue: "Chang Arena",
          kickoffAt: new Date(now + 7 * 86400_000),
          totalSeats: 32000,
          pricePerSeat: 30000, // 300 บาท (สตางค์)
          status: "ON_SALE",
          description: "Thai League 1 — Matchday 28",
        },
        {
          homeTeam: "Muangthong United",
          awayTeam: "Port FC",
          venue: "Thunderdome Stadium",
          kickoffAt: new Date(now + 14 * 86400_000),
          totalSeats: 13500,
          pricePerSeat: 25000,
          status: "SCHEDULED",
        },
      ],
    });
    console.log("✓ เพิ่มแมตช์ตัวอย่าง 2 แมตช์");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
