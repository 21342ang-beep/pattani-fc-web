import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const session = await readSession();
  if (
    !session ||
    (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const bookings = await prisma.booking.findMany({
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
      b.notes ?? "",
    ]
      .map(csvEscape)
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
