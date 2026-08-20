import { getOptionalCustomer } from "@/lib/customer-dal";
import PageHero from "../../_components/PageHero";
import CheckoutForm from "./CheckoutForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "ชำระเงิน — Pattani FC Shop" };

export default async function ShopCheckoutPage() {
  // pre-fill จาก session (ถ้าเป็นสมาชิก)
  const customer = await getOptionalCustomer();
  let prefill = { name: "", phone: "", email: "" };
  if (customer) {
    prefill = {
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email,
    };
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
