import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifyPermission } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { reportMatchResult } from "@/app/actions/match-results";
import DeleteResultMatchButton from "./DeleteResultMatchButton";

export const dynamic = "force-dynamic";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;

function bangkokDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftMonth(month: string, amount: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function dateLabel(date: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "long",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${date}T00:00:00+07:00`));
}

function daysInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1));
  const leadingBlankDays = firstDay.getUTCDay();
  const totalDays = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { leadingBlankDays, totalDays };
}

export default async function AdminMatchResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string; month?: string; date?: string }>;
}) {
  await verifyPermission("MATCH_RESULTS");
  const { competition, month: rawMonth, date: rawDate } = await searchParams;
  const competitionType = competition === "CUP" ? "CUP" : "LEAGUE";
  const matches = await prisma.match.findMany({
    where: { status: { not: "CANCELLED" }, competitionType },
    orderBy: { kickoffAt: "asc" },
  });
  const selectedDate = rawDate && DATE_PATTERN.test(rawDate) ? rawDate : null;
  const firstMatchMonth = matches.find((match) => match.kickoffAt)?.kickoffAt;
  const month = rawMonth && MONTH_PATTERN.test(rawMonth)
    ? rawMonth
    : selectedDate?.slice(0, 7) ?? (firstMatchMonth ? bangkokDateKey(firstMatchMonth).slice(0, 7) : "2026-01");
  const matchDates = new Set(
    matches.flatMap((match) => (match.kickoffAt ? [bangkokDateKey(match.kickoffAt)] : [])),
  );
  const selectedMatches = selectedDate
    ? matches.filter((match) => match.kickoffAt && bangkokDateKey(match.kickoffAt) === selectedDate)
    : [];
  const { leadingBlankDays, totalDays } = daysInMonth(month);
  const calendarDays = Array.from({ length: totalDays }, (_, index) => index + 1);
  const resultHref = (params: { month: string; date?: string }) => {
    const query = new URLSearchParams({ competition: competitionType, month: params.month });
    if (params.date) query.set("date", params.date);
    return `/admin/results?${query.toString()}`;
  };
  return (
    <div>
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">← กลับหน้าหลังบ้าน</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">รายงานผลการแข่งขัน</h1>
          <p className="mt-1 text-sm text-slate-600">เพิ่มแมตช์และบันทึกสกอร์ เพื่อแสดงผลบนเว็บไซต์</p>
        </div>
        <Link
          href={`/admin/results/new?competition=${competitionType}`}
          className="rounded-md bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          + เพิ่มแมตช์
        </Link>
      </div>

      <nav className="mb-6 flex gap-2" aria-label="ประเภทการแข่งขัน">
        <Link href={`/admin/results?competition=LEAGUE&month=${month}`} className={`rounded-full px-4 py-2 text-sm font-semibold ${competitionType === "LEAGUE" ? "bg-green-800 text-white" : "border bg-white text-green-800"}`}>บอลลีก</Link>
        <Link href={`/admin/results?competition=CUP&month=${month}`} className={`rounded-full px-4 py-2 text-sm font-semibold ${competitionType === "CUP" ? "bg-green-800 text-white" : "border bg-white text-green-800"}`}>บอลถ้วย</Link>
      </nav>

      <section className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <Link href={resultHref({ month: shiftMonth(month, -1) })} className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-slate-50" aria-label="เดือนก่อนหน้า">←</Link>
          <h2 className="text-lg font-bold text-green-900">{monthLabel(month)}</h2>
          <Link href={resultHref({ month: shiftMonth(month, 1) })} className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-slate-50" aria-label="เดือนถัดไป">→</Link>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
          {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day) => <span key={day} className="py-2">{day}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadingBlankDays }, (_, index) => <span key={`blank-${index}`} />)}
          {calendarDays.map((day) => {
            const date = `${month}-${String(day).padStart(2, "0")}`;
            const hasMatch = matchDates.has(date);
            const isSelected = selectedDate === date;
            return (
              <Link
                key={date}
                href={resultHref({ month, date })}
                className={`relative flex aspect-square items-center justify-center rounded-md text-sm font-semibold transition hover:bg-green-100 ${isSelected ? "bg-green-800 text-white" : hasMatch ? "bg-amber-100 text-amber-950" : "text-slate-700"}`}
                aria-label={`เลือกวันที่ ${date}${hasMatch ? " มีการแข่งขัน" : ""}`}
              >
                {day}
                {hasMatch && !isSelected && <span className="absolute bottom-1 size-1.5 rounded-full bg-green-700" />}
              </Link>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-slate-500"><span className="mr-1 inline-block size-2 rounded-full bg-green-700" />วันที่มีการแข่งขัน</p>
      </section>

      {selectedDate && (
        <section className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-green-900">บันทึกผลการแข่งขัน · {dateLabel(selectedDate)}</h2>
            <Link href={resultHref({ month })} className="text-sm font-medium text-green-800 hover:underline">ล้างวันที่เลือก</Link>
          </div>
          {selectedMatches.map((match) => {
          const action = reportMatchResult.bind(null, match.id);
          return (
            <form key={match.id} action={action} className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-4 shadow-sm">
              <div className="min-w-56 flex-1">
                <p className="font-bold text-slate-900">{match.homeTeam} <span className="text-slate-400">vs</span> {match.awayTeam}</p>
                <p className="mt-1 text-xs text-slate-500">{match.kickoffAt ? formatDateTime(match.kickoffAt) : "ยังไม่กำหนดวันแข่ง"}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`home-score-${match.id}`}>สกอร์ทีมเหย้า</label>
                <input id={`home-score-${match.id}`} name="homeScore" type="number" min="0" max="99" required defaultValue={match.homeScore ?? ""} className="w-16 rounded-md border px-2 py-2 text-center font-bold" />
                <span className="font-bold text-slate-400">-</span>
                <label className="sr-only" htmlFor={`away-score-${match.id}`}>สกอร์ทีมเยือน</label>
                <input id={`away-score-${match.id}`} name="awayScore" type="number" min="0" max="99" required defaultValue={match.awayScore ?? ""} className="w-16 rounded-md border px-2 py-2 text-center font-bold" />
              </div>
              <button type="submit" className="rounded-md bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">บันทึกผล</button>
              <Link
                href={`/admin/results/${match.id}`}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                แก้ไข
              </Link>
              <DeleteResultMatchButton matchId={match.id} />
            </form>
          );
          })}
          {selectedMatches.length === 0 && <p className="rounded-lg border bg-white p-6 text-center text-slate-500">ไม่มีแมตช์แข่งขันในวันที่เลือก</p>}
        </section>
      )}
    </div>
  );
}
