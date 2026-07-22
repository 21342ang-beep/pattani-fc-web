import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone, Shield } from "lucide-react";
import type { Dict } from "@/lib/i18n/dict";
import SponsorFooter from "./SponsorFooter";

// แสดง Footer หลักของเว็บไซต์ พร้อมส่วนสปอนเซอร์ด้านบน
const SHOW_SITE_FOOTER = true;

function SocialIcon({
  symbol,
  tone,
}: {
  symbol: string;
  tone: string;
}) {
  return <span className={`flex size-9 items-center justify-center rounded-lg bg-white/10 text-lg font-black text-green-100/60 transition-colors ${tone}`} aria-hidden>{symbol}</span>;
}

export default function SiteFooter({ dict }: { dict: Dict }) {
  if (!SHOW_SITE_FOOTER) {
    return <SponsorFooter />;
  }

  return (
    <footer className="bg-green-950 text-yellow-100">
      <SponsorFooter />
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.03] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px]"
        />
        <div className="relative mx-auto max-w-7xl px-4 pt-14 pb-6">
        <div className="flex justify-center">
          <div className="max-w-2xl text-center">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src="/logo-pattani-fc.png"
                alt="Pattani FC"
                width={56}
                height={56}
              />
              <div>
                <p className="text-base font-black tracking-wide text-yellow-300 sm:text-lg lg:text-xl">
                  {dict.brand.name}
                </p>
                <p className="text-xs uppercase tracking-widest text-green-300 sm:text-sm">
                  {dict.footer.estTagline}
                </p>
              </div>
            </Link>
            <p className="mx-auto mt-4 max-w-md text-sm text-green-100/70 sm:text-base lg:text-lg">
              {dict.footer.description}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-3 text-sm text-green-100/60 sm:gap-x-6 sm:text-base lg:text-lg">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 sm:size-5" /> {dict.footer.location}
              </div>
              <a
                href="mailto:pattanifc2009@gmail.com"
                className="flex items-center gap-2 transition hover:text-yellow-300"
              >
                <Mail className="size-4 shrink-0 sm:size-5" /> pattanifc2009@gmail.com
              </a>
              <a
                href="tel:+66731234567"
                className="flex items-center gap-2 transition hover:text-yellow-300"
              >
                <Phone className="size-4 shrink-0 sm:size-5" /> {dict.footer.phoneLabel} +66 (0) 73-123-4567
              </a>
            </div>
            <div className="mt-5 flex justify-center gap-3">
              <SocialButton
                href="https://www.facebook.com/PattaniFC"
                label="Facebook"
              >
                <SocialIcon symbol="f" tone="hover:bg-[#1877f2] hover:text-white" />
              </SocialButton>
              <SocialButton
                href="https://www.instagram.com/pattanifc.official/"
                label="Instagram"
              >
                <SocialIcon symbol="◎" tone="hover:bg-[#d62976] hover:text-white" />
              </SocialButton>
              <SocialButton
                href="https://www.youtube.com/@PattaniFCTV"
                label="YouTube"
              >
                <SocialIcon symbol="▶" tone="hover:bg-[#ff0000] hover:text-white" />
              </SocialButton>
              <SocialButton
                href="https://www.tiktok.com/@pattanifc.official"
                label="TikTok"
              >
                <SocialIcon symbol="♪" tone="hover:bg-slate-900 hover:text-white" />
              </SocialButton>
            </div>
          </div>

        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-yellow-300/10 pt-4 text-xs text-green-100/50 sm:text-sm lg:text-base md:flex-row">
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
