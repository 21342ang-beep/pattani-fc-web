import { verifyPermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import BarcodeGenerator from "./BarcodeGenerator";

export const dynamic = "force-dynamic";
export const metadata = { title: "สร้างบาร์โค้ด — Admin" };

export default async function CreateBarcodePage() {
  await verifyPermission("BARCODE_MANAGEMENT");

  const [vvipElite, vipAdvanced, premium, gold] = await Promise.all([
    prisma.seasonPassBarcode.count({ where: { tierId: "vvip-elite", isGenerated: true } }),
    prisma.seasonPassBarcode.count({ where: { tierId: "vip-advanced", isGenerated: true } }),
    prisma.seasonPassBarcode.count({ where: { tierId: "premium", isGenerated: true } }),
    prisma.seasonPassBarcode.count({ where: { tierId: "gold", isGenerated: true } }),
  ]);

  return <BarcodeGenerator initialBarcodeCounts={{ "vvip-elite": vvipElite, "vip-advanced": vipAdvanced, premium, gold }} />;
}
