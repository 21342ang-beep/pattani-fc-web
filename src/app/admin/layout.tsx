import localFont from "next/font/local";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/dal";
import Sidebar from "./Sidebar";
import "../globals.css";

const dbHeavent = localFont({
  src: "../../fonts/DBHeaventMed.ttf",
  variable: "--font-db-heavent",
  display: "swap",
});

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyAdmin();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });

  return (
    <html lang="th" className={`${dbHeavent.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900">
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar
            role={session.role as "ADMIN" | "SUPER_ADMIN"}
            email={user?.email}
          />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
