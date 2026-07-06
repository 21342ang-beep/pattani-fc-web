import PageHero from "../../_components/PageHero";
import CartView from "./CartView";

export const metadata = { title: "ตะกร้าสินค้า — Pattani FC Shop" };

export default function CartPage() {
  return (
    <>
      <PageHero
        title="ตะกร้าสินค้า"
        subtitle="ตรวจสอบรายการ ก่อนดำเนินการชำระเงิน"
      />
      <div className="mx-auto max-w-5xl px-4 py-10">
        <CartView />
      </div>
    </>
  );
}
