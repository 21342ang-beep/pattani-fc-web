export const SPONSOR_SEASON_PASS_IMPORT_VERSION = "2026-v1";

export type SponsorSeasonPassEntry = Readonly<{
  barcode: string;
  sourceBarcode: string;
  tierId: "vip-advanced" | "premium" | "gold";
  seatZone: "VIP-A" | "PRIMIUM-F" | "GOLD-J";
  sponsorName: string;
  sourceFile: string;
  sourceRow: number;
}>;

const VIP_SOURCE_FILE = "บัตร VIP ที่ให้ Sponsor.xlsx";
const OTHER_SOURCE_FILE = "บัตรที่ให้สปอนเซอร์.xlsx";

// Physical VIP-A cards were handed out continuously from 0144 through 0189.
// Cards 0190-0191 remain with the club and 0192-0193 are lost, so none of
// 0190-0193 may be registered in this batch. The source sequences retain the
// original spreadsheet values solely for audit history.
const VIP_ALLOCATIONS = [
  { sponsorName: "บริษัท ซีเอ็มจี เอ็นจิเนียริ่ง แอนด์ คอนสตรัคชั่น จำกัด (CMG)", sourceRow: 2, sourceStartSequence: 141, sourceEndSequence: 145, issuedStartSequence: 144 },
  { sponsorName: "Martensite Corporation", sourceRow: 3, sourceStartSequence: 146, sourceEndSequence: 147, issuedStartSequence: 149 },
  { sponsorName: "น้ำปลาหวานแม่อารีย์", sourceRow: 4, sourceStartSequence: 148, sourceEndSequence: 149, issuedStartSequence: 151 },
  { sponsorName: "Elrah Exclusive Thailand", sourceRow: 5, sourceStartSequence: 150, sourceEndSequence: 152, issuedStartSequence: 153 },
  { sponsorName: "ตุยงค้าเหล็ก จำกัด", sourceRow: 6, sourceStartSequence: 153, sourceEndSequence: 154, issuedStartSequence: 156 },
  { sponsorName: "Unique 2 พี่น้อง", sourceRow: 7, sourceStartSequence: 155, sourceEndSequence: 156, issuedStartSequence: 158 },
  { sponsorName: "ไทยยามาฮ่ามอเตอร์ จำกัด", sourceRow: 8, sourceStartSequence: 157, sourceEndSequence: 161, issuedStartSequence: 160 },
  { sponsorName: "IBNU AFFAN", sourceRow: 9, sourceStartSequence: 162, sourceEndSequence: 163, issuedStartSequence: 165 },
  { sponsorName: "บริษัท ทรัพย์ธีระก่อสร้าง จำกัด (STR)", sourceRow: 10, sourceStartSequence: 164, sourceEndSequence: 165, issuedStartSequence: 167 },
  { sponsorName: "DENT SQUARE", sourceRow: 11, sourceStartSequence: 166, sourceEndSequence: 167, issuedStartSequence: 169 },
  { sponsorName: "Regent Thailand Hotel", sourceRow: 12, sourceStartSequence: 168, sourceEndSequence: 169, issuedStartSequence: 171 },
  { sponsorName: "นาครัว ฮาลาล", sourceRow: 13, sourceStartSequence: 170, sourceEndSequence: 171, issuedStartSequence: 173 },
  { sponsorName: "ธนาคารอิสลามแห่งประเทศไทย", sourceRow: 14, sourceStartSequence: 172, sourceEndSequence: 173, issuedStartSequence: 175 },
  { sponsorName: "The view Beach", sourceRow: 15, sourceStartSequence: 174, sourceEndSequence: 175, issuedStartSequence: 177 },
  { sponsorName: "FISC", sourceRow: 16, sourceStartSequence: 176, sourceEndSequence: 177, issuedStartSequence: 179 },
  { sponsorName: "Dent Peace Dental Clinic", sourceRow: 17, sourceStartSequence: 178, sourceEndSequence: 179, issuedStartSequence: 181 },
  { sponsorName: "บริษัท มาร์กี้โฟน จำกัด", sourceRow: 18, sourceStartSequence: 180, sourceEndSequence: 181, issuedStartSequence: 183 },
  { sponsorName: "บริษัท ทรัพย์เพชรขุมทอง จำกัด (SPT)", sourceRow: 19, sourceStartSequence: 182, sourceEndSequence: 183, issuedStartSequence: 185 },
  { sponsorName: "บริษัท อัลทานี่ พาวเวอร์ จำกัด", sourceRow: 20, sourceStartSequence: 184, sourceEndSequence: 185, issuedStartSequence: 187 },
  { sponsorName: "HiHi Buffet", sourceRow: 21, sourceStartSequence: 186, sourceEndSequence: 186, issuedStartSequence: 189 },
] as const;

const PREMIUM_SPONSORS = [
  "พินิต มอเตอร์",
  "กีตอ วะดียอ",
  "MAKANAN KAMPONG",
  "M SERVICE",
  "MOREWEAR",
  "INTAN EXPRESS",
  "SAYED MUHAMMAD, MP",
  "IBNU AFFAN CONCRETE",
  "อิสตานา ค้าวัสดุ",
  "NEW WAVE",
  "HAND in HAND",
  "TID TOUR",
  "คนมีเวลา",
] as const;

const GOLD_SPONSORS = [
  "VERTEX SPORT",
  "LAVA BICYCLE since 2017",
  "PATTANI KITA",
  "LAILA INTER COSMETIC",
  "FATONI ENERGY 1440",
  "บริษัทชูเกียรติยนต์ (มาสด้า)",
  "บริษัทชูเกียรติคาร์ (1998) จำกัด (ฟอร์ด)",
  "บริษัทชูเกียรติออโต้พลัส จำกัด (รถเชอร์รี่)",
  "บริษัทชูเกียรติเน็กซ์ออโต้ จำกัด (รถจีลี่)",
  "บริษัทชูเกียรติออโต้อีวี จำกัด (รถดีพอล)",
  "บริษัทชูเกียรติลีซิ่ง",
  "Grand แกรนด์ออโต้เทรดดิ้ง",
  "Dawaniz",
  "อาซัน ของฝากปัตตานี",
  "C.Y.PROMIX",
  "บริษัท มักกี้ เทรเวิล จำกัด",
  "สนามหญ้าเทียมThe Union Arena Pattani",
  "โครงการบ้านอากาศดี",
  "นายสุไลมาน มะรอแม TY.L.SPORT",
  "ร้านไวนิล ตักวาปริ้น ปัตตานี",
  "นายมะรอสดี เงาะ",
  "นายอาดิลัน อาลีอิสเฮาะ",
  "SMART CORE",
  "โกปีปัง",
  "บ้านสวนสวนพร้าว",
  "ปูยุดบารู",
  "โรงแรม ซี.เอส ปัตตานี",
  "ทรี เชล",
  "บริษัท ห้างทองเจริญชัย ปัตตานี 3 จำกัด",
  "ร้าน HUBEESTUDIO ห้องเสื้อผู้ชาย",
  "หจก. วี.อาร์.โยธากิจ",
  "ร้านมิตรไมตรี",
] as const;

function barcode(priceBaht: 2500 | 2000 | 1500, sequence: number) {
  return `PFC26-${priceBaht}-${String(sequence).padStart(4, "0")}`;
}

const vipEntries = VIP_ALLOCATIONS.flatMap((allocation) =>
  Array.from(
    { length: allocation.sourceEndSequence - allocation.sourceStartSequence + 1 },
    (_, index): SponsorSeasonPassEntry => {
      const sourceSequence = allocation.sourceStartSequence + index;
      const issuedSequence = allocation.issuedStartSequence + index;
      return {
        barcode: barcode(2500, issuedSequence),
        sourceBarcode: barcode(2500, sourceSequence),
        tierId: "vip-advanced",
        seatZone: "VIP-A",
        sponsorName: allocation.sponsorName,
        sourceFile: VIP_SOURCE_FILE,
        sourceRow: allocation.sourceRow,
      };
    },
  ),
);

const premiumEntries = PREMIUM_SPONSORS.map(
  (sponsorName, index): SponsorSeasonPassEntry => ({
    barcode: barcode(2000, 988 + index),
    sourceBarcode: barcode(2000, 988 + index),
    tierId: "premium",
    seatZone: "PRIMIUM-F",
    sponsorName,
    sourceFile: OTHER_SOURCE_FILE,
    sourceRow: index + 1,
  }),
);

const goldEntries = GOLD_SPONSORS.map(
  (sponsorName, index): SponsorSeasonPassEntry => ({
    barcode: barcode(1500, 769 + index),
    sourceBarcode: barcode(1500, 769 + index),
    tierId: "gold",
    seatZone: "GOLD-J",
    sponsorName,
    sourceFile: OTHER_SOURCE_FILE,
    sourceRow: index + 14,
  }),
);

export const SPONSOR_SEASON_PASS_ENTRIES: readonly SponsorSeasonPassEntry[] = [
  ...vipEntries,
  ...premiumEntries,
  ...goldEntries,
];

export function sponsorSeasonPassAuditMarker(entry: SponsorSeasonPassEntry) {
  return [
    `SPONSOR_SEASON_PASS_${SPONSOR_SEASON_PASS_IMPORT_VERSION}`,
    `source=${entry.sourceFile}`,
    `row=${entry.sourceRow}`,
    `sourceBarcode=${entry.sourceBarcode}`,
    `issuedBarcode=${entry.barcode}`,
  ].join("|");
}
