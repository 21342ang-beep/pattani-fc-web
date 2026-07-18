import localFont from "next/font/local";
import ScrollProgress from "./_components/ScrollProgress";
import SiteFooter from "./_components/SiteFooter";
import TopNav from "./TopNav";
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
  const [customer, { locale, dict }] = await Promise.all([
    readCustomerSession(),
    getT(),
  ]);
  return (
    <html
      lang={locale}
      className={`${dbHeavent.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <div className="flex min-h-screen flex-col">
          <ScrollProgress />
          <TopNav
            locale={locale}
            dict={dict}
            customer={
              customer ? { name: customer.name, email: customer.email } : null
            }
          />
          <main className="flex-1">{children}</main>
          <SiteFooter dict={dict} />
        </div>
      </body>
    </html>
  );
}
