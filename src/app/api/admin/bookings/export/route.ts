import { prisma } from "@/lib/prisma";
import { getAdminUser, hasPermission } from "@/lib/dal";
import { expirePendingBookings } from "@/lib/booking-expiry";
import { escapeCsvCell } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAdminUser();
  if (!hasPermission(user, "BOOKINGS")) {
    return new Response("Forbidden", { status: 403 });
  }

  await expirePendingBookings();

  const bookings = await prisma.booking.findMany({
    where: { status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    include: {
      match: { select: { homeTeam: true, awayTeam: true, kickoffAt: true } },
    },
    take: 5000,
  });

  const header = [
    "bookingCode",
    "createdAt",
    "status",
    "customerName",
    "customerEmail",
    "customerPhone",
    "homeTeam",
    "awayTeam",
    "kickoffAt",
    "quantity",
    "totalAmountBaht",
    "salesChannel",
    "paymentMethod",
    "offlineReceiptNo",
    "soldById",
    "soldAt",
    "notes",
  ];

  const rows = bookings.map((b) =>
    [
      b.bookingCode,
      b.createdAt.toISOString(),
      b.status,
      b.customerName,
      b.customerEmail,
      b.customerPhone,
      b.match.homeTeam,
      b.match.awayTeam,
      b.match.kickoffAt?.toISOString() ?? "",
      b.quantity,
      (b.totalAmount / 100).toFixed(2),
      b.salesChannel,
      b.paymentMethod,
      b.offlineReceiptNo,
      b.soldById,
      b.soldAt?.toISOString() ?? "",
      b.notes ?? "",
    ]
      .map(escapeCsvCell)
      .join(",")
  );

  const csv = "﻿" + [header.join(","), ...rows].join("\n");
  const filename = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
