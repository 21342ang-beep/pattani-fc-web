import { listGateMatches } from "@/app/actions/gate-check";
import GateCheckClient from "./GateCheckClient";

// Server entry — โหลด match list ครั้งแรก แล้วส่งต่อให้ client
// ทุก action ในหน้านี้ผ่าน verifyAdmin (ดู /actions/gate-check.ts)
// Layout ตรวจ session ให้แล้ว → ที่นี่ปลอดภัยเรียก action ได้เลย

export default async function GateCheckPage() {
  const matches = await listGateMatches();
  return <GateCheckClient initialMatches={matches} />;
}
