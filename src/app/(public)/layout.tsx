import localFont from "next/font/local";
import { cookies } from "next/headers";
import ScrollProgress from "./_components/ScrollProgress";
import SiteFooter from "./_components/SiteFooter";
import CookieConsentBanner from "./_components/CookieConsentBanner";
import TopNav from "./TopNav";
import {
  COOKIE_CONSENT_NAME,
  COOKIE_CONSENT_VALUES,
  type CookieConsentValue,
} from "@/lib/cookie-consent";
import { readCustomerSession } from "@/lib/customer-session";
import { getT } from "@/lib/i18n/server";
import "../globals.css";

const dbHeavent = localFont({
  src: "../../fonts/DBHeaventCond.ttf",
  variable: "--font-db-heavent",
  display: "swap",
});

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [customer, { locale, dict }, cookieStore] = await Promise.all([
    readCustomerSession(),
    getT(),
    cookies(),
  ]);
  const consent = cookieStore.get(COOKIE_CONSENT_NAME)?.value;
  const hasConsent = COOKIE_CONSENT_VALUES.includes(consent as CookieConsentValue);
  return (
    <html
      lang={locale}
      className={`${dbHeavent.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-slate-900">
        <div className="flex min-h-screen flex-col">
          <ScrollProgress />
          <TopNav
            locale={locale}
            dict={dict}
            showLocalVisuals={process.env.NODE_ENV === "development"}
            customer={
              customer ? { name: customer.name, email: customer.email } : null
            }
          />
          <main className="flex-1">{children}</main>
          <SiteFooter dict={dict} />
          {!hasConsent && <CookieConsentBanner locale={locale} />}
        </div>
      </body>
    </html>
  );
}
