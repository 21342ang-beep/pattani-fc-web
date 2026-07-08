import localFont from "next/font/local";
import { getAdminUser } from "@/lib/dal";
import TopBar from "./TopBar";
import "../globals.css";

const dbHeavent = localFont({
  src: "../../fonts/DBHeaventMed.ttf",
  variable: "--font-db-heavent",
  display: "swap",
});

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAdminUser();

  return (
    <html lang="th" className={`${dbHeavent.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900">
        <TopBar role={user.role} email={user.email} />
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
