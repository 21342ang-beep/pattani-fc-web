import MemberSubNav from "./_components/MemberSubNav";
import { readCustomerSession } from "@/lib/customer-session";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readCustomerSession();
  // ถ้าไม่มี session — proxy.ts จะ redirect ก่อนถึง layout นี้แล้ว
  // แต่หน้า /member/login ก็ render ผ่าน layout นี้ด้วย จึง render เฉยๆ ถ้าไม่มี session
  if (!session) return <>{children}</>;
  return (
    <>
      <MemberSubNav />
      {children}
    </>
  );
}
