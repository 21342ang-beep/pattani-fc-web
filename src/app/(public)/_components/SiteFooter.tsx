import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone, Shield } from "lucide-react";
import type { Dict } from "@/lib/i18n/dict";
import { payload } from "@/lib/payload";
import SponsorFooter from "./SponsorFooter";

// ไอคอน social — ใช้ภาพ raster ปรับแต่งจาก /public ตามที่ user เลือก
// ทั้งหมดเป็นไฟล์ local — ไม่มี external request, ปลอดภัยจาก SSRF/hotlink
function SocialIcon({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={36}
      height={36}
      sizes="36px"
      className={`object-contain ${className ?? ""}`}
    />
  );
}

function buildGroups(dict: Dict) {
  return [
    {
      title: dict.footer.aboutTitle,
      links: [
        { href: "/club", label: dict.nav.club },
        { href: "/management", label: dict.nav.management },
        { href: "/squad", label: dict.nav.squad },
        { href: "/youth", label: dict.nav.youth },
      ],
    },
    {
      title: dict.footer.fanTitle,
      links: [
        { href: "/matches", label: dict.nav.matches },
        { href: "/tickets", label: dict.nav.tickets },
        { href: "/news", label: dict.nav.news },
        { href: "/shop", label: dict.nav.shop },
      ],
    },
    {
      title: dict.footer.serviceTitle,
      links: [
        { href: "/bookings/check", label: dict.util.checkBooking },
        { href: "/faq", label: dict.util.faq },
        { href: "/contact", label: dict.util.contact },
        { href: "/partners", label: dict.nav.partners },
      ],
    },
  ];
}

export default async function SiteFooter({ dict }: { dict: Dict }) {
  const cms = await payload();
  const { docs } = await cms.find({
    collection: "sponsors",
    where: { active: { equals: true } },
    limit: 50,
    sort: "createdAt",
    overrideAccess: true,
  });
  const sponsors = (docs as unknown as {
    id: string | number;
    name: string;
    logo?: { url?: string } | string | null;
  }[]).map((sponsor) => ({
    id: String(sponsor.id),
    name: sponsor.name,
    logoUrl:
      typeof sponsor.logo === "object" && sponsor.logo
        ? sponsor.logo.url
        : undefined,
  }));
  const groups = buildGroups(dict);
  return (
    <footer className="bg-green-950 text-yellow-100">
      <SponsorFooter sponsors={sponsors} />
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.03] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px]"
        />
        <div className="relative mx-auto max-w-7xl px-4 pt-14 pb-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src="/logo-pattani-fc.png"
                alt="Pattani FC"
                width={56}
                height={56}
              />
              <div>
                <p className="text-lg font-black tracking-wide text-yellow-300">
                  {dict.brand.name}
                </p>
                <p className="text-xs uppercase tracking-widest text-green-300">
                  {dict.footer.estTagline}
                </p>
              </div>
            </Link>
            <p className="mt-4 max-w-sm text-base text-green-100/70">
              {dict.footer.description}
            </p>
            <div className="mt-5 flex gap-3">
              <SocialButton
                href="https://www.facebook.com/PattaniFC"
                label="Facebook"
              >
                <SocialIcon src="/social-facebook.png" alt="Facebook" />
              </SocialButton>
              <SocialButton
                href="https://www.instagram.com/pattanifc.official/"
                label="Instagram"
              >
                <SocialIcon src="/social-instagram.png" alt="Instagram" />
              </SocialButton>
              <SocialButton
                href="https://www.youtube.com/@PattaniFCTV"
                label="YouTube"
              >
                <SocialIcon src="/social-youtube.png" alt="YouTube" />
              </SocialButton>
              <SocialButton
                href="https://www.tiktok.com/@pattanifc.official"
                label="TikTok"
              >
                <SocialIcon src="/social-tiktok.png" alt="TikTok" />
              </SocialButton>
            </div>
          </div>

          {groups.map((g) => (
            <div key={g.title}>
              <p className="mb-3 text-sm font-bold uppercase tracking-widest text-yellow-300/80">
                {g.title}
              </p>
              <ul className="space-y-2.5">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-base text-green-100/80 transition-colors hover:text-yellow-300"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-3 border-t border-yellow-300/10 pt-6 text-base text-green-100/60 md:grid-cols-3">
          <div className="flex items-center gap-2">
            <MapPin className="size-5" /> {dict.footer.location}
          </div>
          <a
            href="mailto:pattanifc2009@gmail.com"
            className="flex items-center gap-2 transition hover:text-yellow-300"
          >
            <Mail className="size-5" /> pattanifc2009@gmail.com
          </a>
          <a
            href="tel:+66731234567"
            className="flex items-center gap-2 transition hover:text-yellow-300"
          >
            <Phone className="size-5" /> {dict.footer.phoneLabel} +66 (0) 73-123-4567
          </a>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-yellow-300/10 pt-4 text-sm text-green-100/50 md:flex-row">
          <p>
            © {new Date().getFullYear()} Pattani FC. {dict.footer.rights}
          </p>
          <div className="flex items-center gap-4">
            <p>{dict.footer.tagline}</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-green-100/40 transition hover:text-yellow-300"
              title={dict.util.admin}
            >
              <Shield className="size-4" />
              {dict.util.admin}
            </Link>
          </div>
        </div>
        </div>
      </div>
    </footer>
  );
}

function SocialButton({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      className="flex size-10 items-center justify-center transition-transform hover:scale-110"
    >
      {children}
    </a>
  );
}
