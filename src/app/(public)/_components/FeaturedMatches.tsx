"use client";

import Image from "next/image";
import Link from "next/link";
import { Calendar, MapPin, ArrowRight, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { formatBaht, formatDateTime } from "@/lib/format";

export type FeaturedMatch = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  venue: string | null;
  kickoffAt: Date | string | null;
  pricePerSeat: number | null;
  status: string;
};

function TeamCrest({ logo, name }: { logo: string | null; name: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex size-16 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm">
        {logo ? (
          <Image
            src={logo}
            alt={name}
            width={64}
            height={64}
            unoptimized
            className="size-full object-contain p-1"
          />
        ) : (
          <Shield className="size-7 text-slate-300" />
        )}
      </div>
      <span className="line-clamp-2 max-w-[10rem] text-center text-base font-semibold text-green-900 sm:text-lg lg:text-xl">
        {name}
      </span>
    </div>
  );
}

export default function FeaturedMatches({
  matches,
}: {
  matches: FeaturedMatch[];
}) {
  if (matches.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-muted-foreground">
          ยังไม่มีแมตช์ในระบบ
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {matches.map((m) => {
        const isOnSale = m.status === "ON_SALE";
        const isPattaniHomeMatch = isPattaniHomeTeam(m.homeTeam);
        return (
          <li key={m.id}>
            <Card className="group h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <Badge
                  variant={isOnSale ? "default" : "secondary"}
                  className={
                    isOnSale
                      ? "bg-emerald-100 px-3 py-1.5 text-base text-emerald-700 hover:bg-emerald-100 sm:text-lg"
                      : "px-3 py-1.5 text-base sm:text-lg"
                  }
                >
                  {isOnSale ? "เปิดจอง" : "ใกล้เปิด"}
                </Badge>
                <span className="flex items-center gap-1.5 text-base text-muted-foreground sm:text-lg lg:text-xl">
                  <Calendar className="size-4" />
                  {m.kickoffAt ? formatDateTime(m.kickoffAt) : "ยังไม่กำหนด"}
                </span>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="flex items-center justify-between gap-2 py-2">
                  <TeamCrest logo={m.homeTeamLogo} name={m.homeTeam} />
                  <span className="text-lg font-bold uppercase tracking-widest text-yellow-600 sm:text-xl lg:text-2xl">
                    VS
                  </span>
                  <TeamCrest logo={m.awayTeamLogo} name={m.awayTeam} />
                </div>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-lg text-muted-foreground sm:text-xl lg:text-2xl">
                  <MapPin className="size-4" /> {m.venue ?? "ยังไม่กำหนดสนาม"}
                </p>
              </CardContent>
              {isPattaniHomeMatch && (
                <CardFooter className="justify-between border-t pt-3">
                  <span className="text-lg font-medium sm:text-xl lg:text-2xl">
                    {m.pricePerSeat != null
                      ? `เริ่มต้น ${formatBaht(m.pricePerSeat)}/ใบ`
                      : "ราคารอประกาศ"}
                  </span>
                  <Button
                    asChild
                    size="default"
                    variant={isOnSale ? "default" : "secondary"}
                    className={
                      isOnSale
                        ? "bg-green-800 text-lg text-yellow-300 hover:bg-green-900 sm:text-xl"
                        : ""
                    }
                  >
                    <Link href={`/matches/${m.id}`}>
                      {isOnSale ? "จอง" : "ดู"}
                      <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </Button>
                </CardFooter>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

function isPattaniHomeTeam(teamName: string) {
  const normalized = teamName.trim().toLocaleLowerCase("th-TH");
  return normalized.includes("pattani") || normalized.includes("ปัตตานี");
}
