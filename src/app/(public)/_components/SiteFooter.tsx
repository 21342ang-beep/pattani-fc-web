import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone, Shield } from "lucide-react";
import type { Dict } from "@/lib/i18n/dict";
import SponsorFooter from "./SponsorFooter";

// แสดง Footer หลักของเว็บไซต์ พร้อมส่วนสปอนเซอร์ด้านบน
const SHOW_SITE_FOOTER = true;

function SocialIcon({ symbol }: { symbol: string }) {
  return <span className="flex size-11 items-center justify-center rounded-xl bg-white/[0.07] text-lg font-black text-green-100/55 transition-colors group-hover:bg-white/15 group-hover:text-yellow-300" aria-hidden>{symbol}</span>;
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
        <div className="relative mx-auto max-w-7xl px-4 pb-6 pt-14 sm:pt-16">
        <div className="flex justify-center text-center">
          <div className="w-full max-w-5xl">
            <Link href="/" className="inline-flex items-center justify-center gap-5 sm:gap-6" aria-label="Pattani FC และ UNI-X">
              <Image
                src="/logo-pattani-fc.png"
                alt="Pattani FC"
                width={88}
                height={88}
                className="size-16 object-contain sm:size-20 lg:size-24"
              />
              <Image
                src="/uni-x-logo.png"
                alt="UNI-X"
                width={1187}
                height={303}
                className="h-auto w-40 object-contain sm:w-52 lg:w-64"
              />
            </Link>
            <p className="mx-auto mt-7 max-w-3xl text-lg leading-relaxed text-green-100/80 sm:text-xl lg:text-2xl">
              {dict.footer.description}
            </p>
            <p className="mx-auto mt-1 max-w-3xl text-lg font-bold leading-relaxed text-yellow-300 sm:text-xl lg:text-2xl">
              {dict.footer.tagline}
            </p>
            <div className="mt-12 flex flex-col items-center justify-center gap-4 text-base text-green-100/60 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:text-lg lg:gap-x-12 lg:text-xl">
              <div className="flex items-center gap-2">
                <MapPin className="size-5 shrink-0" /> {dict.footer.location}
              </div>
              <a
                href="mailto:pattanifc2009@gmail.com"
                className="flex items-center gap-2 transition hover:text-yellow-300"
              >
                <Mail className="size-5 shrink-0" /> pattanifc2009@gmail.com
              </a>
              <a
                href="tel:+66731234567"
                className="flex items-center gap-2 transition hover:text-yellow-300"
              >
                <Phone className="size-5 shrink-0" /> {dict.footer.phoneLabel} +66 (0) 73-123-4567
              </a>
            </div>
            <div className="mt-8 flex justify-center gap-4">
              <SocialButton
                href="https://www.facebook.com/PattaniFC"
                label="Facebook"
              >
                <SocialIcon symbol="f" />
              </SocialButton>
              <SocialButton
                href="https://www.instagram.com/pattanifc.official/"
                label="Instagram"
              >
                <SocialIcon symbol="◎" />
              </SocialButton>
              <SocialButton
                href="https://www.youtube.com/@PattaniFCTV"
                label="YouTube"
              >
                <SocialIcon symbol="▶" />
              </SocialButton>
              <SocialButton
                href="https://www.tiktok.com/@pattanifc.official"
                label="TikTok"
              >
                <SocialIcon symbol="♪" />
              </SocialButton>
            </div>
          </div>

        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-yellow-300/10 pt-4 text-sm text-green-100/45 sm:text-base md:flex-row">
          <p className="text-center leading-relaxed md:text-left">
            © {new Date().getFullYear()} {dict.footer.rights}
          </p>
          <div className="flex items-center gap-4">
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
      className="group flex size-11 items-center justify-center transition-transform hover:scale-110"
    >
      {children}
    </a>
  );
}
