// PromptPay QR payload generator (EMVCo + Thai PromptPay spec)
// อ้างอิง: https://www.bot.or.th/content/dam/bot/documents/th/our-roles/payment-systems/standardised-qr-code.pdf
//
// ใช้สำหรับ generate payload string ที่นำไปสร้าง QR code
// รับเบอร์โทร (10 หลัก) หรือเลขบัตรประชาชน (13 หลัก) + จำนวนเงิน (บาท)

const ID_PAYLOAD_FORMAT = "00";
const ID_POI_METHOD = "01";
const ID_MERCHANT_INFO = "29";
const ID_COUNTRY = "58";
const ID_CURRENCY = "53";
const ID_AMOUNT = "54";
const ID_CRC = "63";

const AID_PROMPTPAY = "A000000677010111";
const PROMPTPAY_MOBILE = "01";
const PROMPTPAY_CITIZEN = "02";

const POI_STATIC = "11";
const POI_DYNAMIC = "12";

const COUNTRY_TH = "TH";
const CURRENCY_THB = "764";

function field(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

// แปลงเบอร์โทรไทยเป็น 13 หลักตามสเปก PromptPay (0066xxxxxxxxx)
function formatTarget(target: string): { tag: string; value: string } {
  const digits = target.replace(/\D/g, "");
  if (digits.length === 13) {
    return { tag: PROMPTPAY_CITIZEN, value: digits };
  }
  // เบอร์โทร: ตัด 0 หน้า เติม 0066
  const local = digits.startsWith("0") ? digits.slice(1) : digits;
  return { tag: PROMPTPAY_MOBILE, value: `0066${local}`.padStart(13, "0") };
}

// CRC16-CCITT (poly 0x1021, init 0xFFFF) — ใช้ closing tag 6304 ก่อน checksum
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPromptPayPayload(opts: {
  target: string;     // เบอร์โทร 10 หลัก หรือเลขบัตรประชาชน 13 หลัก
  amountBaht?: number; // ถ้าไม่ใส่ → static QR (ผู้ใช้กรอกเอง)
}): string {
  const tgt = formatTarget(opts.target);
  const merchant =
    field("00", AID_PROMPTPAY) + field(tgt.tag, tgt.value);

  const parts = [
    field(ID_PAYLOAD_FORMAT, "01"),
    field(ID_POI_METHOD, opts.amountBaht ? POI_DYNAMIC : POI_STATIC),
    field(ID_MERCHANT_INFO, merchant),
    field(ID_COUNTRY, COUNTRY_TH),
    field(ID_CURRENCY, CURRENCY_THB),
  ];
  if (opts.amountBaht !== undefined) {
    parts.push(field(ID_AMOUNT, opts.amountBaht.toFixed(2)));
  }

  const body = parts.join("");
  const withCrcTag = `${body}${ID_CRC}04`;
  return `${withCrcTag}${crc16(withCrcTag)}`;
}
