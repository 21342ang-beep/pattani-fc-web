// Dictionary 2 ภาษา — th (default) / en
// เพิ่ม key ใหม่: ใส่ใน TH ก่อน แล้วใส่ EN ให้ครบทันที (TypeScript จะ enforce)

export type Locale = "th" | "en";
export const LOCALES: Locale[] = ["th", "en"];
export const DEFAULT_LOCALE: Locale = "th";

// helper: ทำให้ TS infer shape โดยที่ค่าแต่ละ field เป็น `string`
// ไม่ใช่ literal — มิเช่นนั้น EN จะถูกบังคับให้ตรงข้อความ TH
const defineDict = <T extends Record<string, Record<string, string>>>(d: T) => d;

const th = defineDict({
  // TopNav utility bar
  util: {
    checkBooking: "ตรวจสอบการจอง",
    faq: "กฎกติกา",
    contact: "ติดต่อเรา",
    admin: "ผู้ดูแลระบบ",
  },
  // Main nav
  nav: {
    home: "หน้าแรก",
    about: "เกี่ยวกับสโมสร",
    club: "สโมสร",
    news: "ข่าว",
    management: "ผู้บริหาร",
    squad: "ผู้เล่นและสตาฟ",
    youth: "ทีมเยาวชน",
    matches: "โปรแกรม",
    tickets: "จองตั๋ว",
    seasonTickets: "ตั๋วรายปี",
    partners: "สปอนเซอร์",
    shop: "ร้านค้า",
    contact: "ติดต่อ",
  },
  // Auth buttons
  auth: {
    login: "เข้าสู่ระบบ",
    register: "สมัครสมาชิก",
    logout: "ออกจากระบบ",
  },
  // Brand
  brand: {
    name: "PATTANI FC",
    suffix: "OFFICIAL",
    motto: "Langkasuka · ปัตตานี เอฟซี · EST. 2009",
  },
  // Hero
  hero: {
    badge: "สวัสดี ไทยลีก 1 · THAI LEAGUE 1 PROMOTION 2026/2027",
    title1: "PATTANI",
    title2: "FC OFFICIAL",
    description:
      "ระบบจองตั๋วการแข่งขันอย่างเป็นทางการของสโมสรปัตตานี เอฟซี เลือกแมตช์ · จองที่นั่ง · รับตั๋วทันที สะดวก ปลอดภัย",
    ctaMatches: "ดูตารางแข่งขัน",
    ctaCheck: "ตรวจสอบการจอง",
    memberCtaTitle: "สมัครสมาชิกฟรี · ลุ้นรางวัลพิเศษ",
    memberCtaDesc: "ซื้อสินค้าทางการ · เข้าร่วมกิจกรรมเฉพาะสมาชิก",
    memberCtaButton: "สมัคร",
    presentedBy: "Presented by",
    scrollDown: "เลื่อนลง",
  },
  // Footer
  footer: {
    aboutTitle: "สโมสร",
    fanTitle: "แฟนคลับ",
    serviceTitle: "บริการ",
    description:
      "เว็บไซต์ทางการของสโมสรปัตตานี เอฟซี ระบบจองตั๋วการแข่งขันออนไลน์ ติดตามข่าวสาร และโปรแกรมการแข่งขัน",
    location: "จังหวัดปัตตานี, ประเทศไทย",
    phoneLabel: "โทร",
    rights: "All rights reserved.",
    tagline: "ระบบจองตั๋วฟุตบอลออนไลน์อย่างเป็นทางการ",
    estTagline: "Langkasuka · Est. 2009",
  },
  // Locale switcher
  locale: {
    label: "Language",
    switchTo: "เปลี่ยนเป็น",
  },
});

const en: typeof th = {
  util: {
    checkBooking: "Check Booking",
    faq: "Rules",
    contact: "Contact Us",
    admin: "Admin",
  },
  nav: {
    home: "Home",
    about: "About the Club",
    club: "Club",
    news: "News",
    management: "Management",
    squad: "Players & Staff",
    youth: "Youth Team",
    matches: "Fixtures",
    tickets: "Match Tickets",
    seasonTickets: "Season Tickets",
    partners: "Sponsors",
    shop: "Shop",
    contact: "Contact",
  },
  auth: {
    login: "Sign In",
    register: "Sign Up",
    logout: "Sign Out",
  },
  brand: {
    name: "PATTANI FC",
    suffix: "OFFICIAL",
    motto: "Langkasuka · Pattani FC · EST. 2009",
  },
  hero: {
    badge: "Hello Thai League 1 · THAI LEAGUE 1 PROMOTION 2026/2027",
    title1: "PATTANI",
    title2: "FC OFFICIAL",
    description:
      "The official ticket booking system of Pattani FC. Choose your match · Select seats · Get tickets instantly. Convenient and secure.",
    ctaMatches: "View Fixtures",
    ctaCheck: "Check Booking",
    memberCtaTitle: "Free Membership · Win Special Prizes",
    memberCtaDesc: "Shop official merchandise · Join member-only activities",
    memberCtaButton: "Sign Up",
    presentedBy: "Presented by",
    scrollDown: "Scroll down",
  },
  footer: {
    aboutTitle: "Club",
    fanTitle: "Fans",
    serviceTitle: "Services",
    description:
      "The official website of Pattani FC. Online ticket booking system, news, and match fixtures.",
    location: "Pattani Province, Thailand",
    phoneLabel: "Tel",
    rights: "All rights reserved.",
    tagline: "Official online football ticket booking system",
    estTagline: "Langkasuka · Est. 2009",
  },
  locale: {
    label: "ภาษา",
    switchTo: "Switch to",
  },
};

const dictionaries = { th, en } as const;

export type Dict = typeof th;

export function getDict(locale: Locale): Dict {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}
