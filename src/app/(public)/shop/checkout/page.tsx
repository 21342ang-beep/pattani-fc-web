import { readCustomerSession } from "@/lib/customer-session";
import { prisma } from "@/lib/prisma";
import PageHero from "../../_components/PageHero";
import CheckoutForm from "./CheckoutForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "ชำระเงิน — Pattani FC Shop" };

export default async function ShopCheckoutPage() {
  // pre-fill จาก session (ถ้าเป็นสมาชิก)
  const session = await readCustomerSession();
  let prefill = { name: "", phone: "", email: "" };
  if (session?.customerId) {
    const c = await prisma.customer.findUnique({
      where: { id: session.customerId },
      select: { name: true, phone: true, email: true },
    });
    if (c) prefill = { name: c.name, phone: c.phone ?? "", email: c.email };
  }

  return (
    <>
      <PageHero
        title="ชำระเงิน"
        subtitle="กรอกข้อมูลจัดส่งและเลือกวิธีชำระเงิน"
      />
      <div className="mx-auto max-w-5xl px-4 py-10">
        <CheckoutForm prefill={prefill} />
      </div>
    </>
  );
}
