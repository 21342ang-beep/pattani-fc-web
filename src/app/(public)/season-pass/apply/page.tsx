import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAllProvinces } from "geothai";
import { prisma } from "@/lib/prisma";
import { readCustomerSession } from "@/lib/customer-session";
import { SEASON_LABEL, getSeasonTier } from "@/lib/season-pass-tiers";
import { calculateSeasonPassZoneRanges } from "@/lib/season-pass-zone-ranges";
import SeasonPassWizard, {
  type SeasonPassZoneOption,
  type ShippingProvince,
} from "./SeasonPassWizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "สมัครบัตรสมาชิกรายปี — Pattani FC" };

export default async function SeasonPassApplyPage(props: {
  searchParams: Promise<{ tier?: string }>;
}) {
  const { tier: tierId } = await props.searchParams;
  const tier = getSeasonTier(tierId);
  if (!tier) notFound();

  // ⚠️ mock flow — ไม่มีการเขียน DB ใด ๆ
  // session ใช้แค่ auto-fill ฟอร์มให้สมาชิก (guest กรอกเองได้)
  const session = await readCustomerSession();
  if (!session) {
    // ต้องเป็นสมาชิกก่อนจอง — เข้าสู่ระบบ (หรือกดสมัครจากหน้า login) แล้วเด้งกลับมาต่อ
    redirect(`/member/login?returnTo=${encodeURIComponent(`/tickets/season/apply?tier=${tier.id}`)}`);
  }
  const [customer, quotas, soldGroups] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: session.customerId },
      select: {
        name: true,
        email: true,
        phone: true,
        address: true,
        province: true,
        district: true,
        postalCode: true,
      },
    }),
    prisma.seasonPassZoneQuota.findMany({
      where: { seasonLabel: SEASON_LABEL, tierId: tier.id },
    }),
    prisma.seasonPassOrder.groupBy({
      by: ["seatZone"],
      where: {
        seasonLabel: SEASON_LABEL,
        tierId: tier.id,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      _count: { _all: true },
    }),
  ]);
  const ranges = calculateSeasonPassZoneRanges(tier.allowedSeatZones, quotas);
  const zoneOptions: SeasonPassZoneOption[] = tier.allowedSeatZones.map((seatZone) => {
    const range = ranges.find((item) => item.seatZone === seatZone);
    const sold = soldGroups.find((item) => item.seatZone === seatZone)?._count._all ?? 0;
    return {
      seatZone,
      publicStartSequence: range?.publicStartSequence ?? null,
      publicEndSequence: range?.publicEndSequence ?? null,
      remaining: range ? Math.max(0, range.publicSeatCount - sold) : null,
    };
  });
  const memberEmail = customer?.email.endsWith("@accounts.pattanifc.local")
    ? null
    : (customer?.email ?? session.email);
  const shippingProvinces: ShippingProvince[] = getAllProvinces()
    .map((province) => ({
      name: province.name_th,
      districts: province.districts.map((district) => ({
        name: district.name_th,
        postalCodes: [...new Set(district.subdistricts.map((subdistrict) => String(subdistrict.postal_code)))].sort(),
      })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "th-TH"));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
      <Link href="/tickets/season" className="text-sm text-slate-500 hover:text-slate-900">
        ← กลับหน้าตั๋ว
      </Link>

      <div className="mt-4 mb-6">
        <p className="text-sm font-bold uppercase tracking-widest text-yellow-600">
          บัตรสมาชิกรายปี
        </p>
        <h1 className="mt-1 text-4xl font-black text-green-900 md:text-5xl">
          สมัคร {tier.name}
        </h1>
        <p className="mt-2 text-base text-slate-600">
          {`ยินดีต้อนรับกลับ ${session.name} — เราเติมข้อมูลสมาชิกให้แล้ว`}
        </p>
      </div>

      <SeasonPassWizard
        tier={tier}
        memberEmail={memberEmail}
        defaultName={customer?.name ?? session.name}
        defaultPhone={customer?.phone ?? ""}
        defaultAddress={customer?.address ?? ""}
        defaultProvince={customer?.province ?? ""}
        defaultDistrict={customer?.district ?? ""}
        defaultPostalCode={customer?.postalCode ?? ""}
        shippingProvinces={shippingProvinces}
        zoneOptions={zoneOptions}
      />
    </div>
  );
}
