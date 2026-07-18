import { verifyPermission } from "@/lib/dal";
import BarcodeGenerator from "./BarcodeGenerator";

export const dynamic = "force-dynamic";
export const metadata = { title: "สร้างบาร์โค้ด — Admin" };

export default async function CreateBarcodePage() {
  await verifyPermission("BARCODE_MANAGEMENT");

  return <BarcodeGenerator />;
}
