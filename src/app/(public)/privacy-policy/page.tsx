import Link from "next/link";
import { access } from "fs/promises";
import path from "path";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "นโยบายความเป็นส่วนตัว (PDPA) — Pattani FC",
  description:
    "นโยบายการเก็บและใช้ข้อมูลส่วนบุคคลของสมาชิก Pattani FC ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล 2562",
};

export default async function PrivacyPolicyPage() {
  const pdfPath = path.join(process.cwd(), "public", "uploads", "legal", "pattani-fc-sales-terms.pdf");
  let attachmentHref = "/pattani-fc-sales-terms.txt";
  try {
    await access(pdfPath);
    attachmentHref = "/uploads/legal/pattani-fc-sales-terms.pdf";
  } catch {
    // ใช้ไฟล์เริ่มต้นจนกว่าจะมีผู้ดูแลอัปโหลด PDF
  }
  const { locale } = await getT();
  if (locale === "ms") return <MalayPrivacyPolicy attachmentHref={attachmentHref} />;
  if (locale === "en") return <EnglishPrivacyPolicy attachmentHref={attachmentHref} />;
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 md:py-16">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-yellow-600 md:text-base">
          Privacy Policy · PDPA
        </p>
        <h1 className="mt-1 text-4xl font-black text-green-900 md:text-5xl">
          นโยบายความเป็นส่วนตัว
        </h1>
        <p className="mt-2 text-base text-slate-600 md:text-lg">
          ปรับปรุงล่าสุด: 8 กรกฎาคม 2569
        </p>
        <div className="mt-5 rounded-lg border border-green-100 bg-green-50 p-5 text-base text-green-950 md:text-lg">
          <p className="font-bold">ชื่อนิติบุคคล: ห้างหุ้นส่วนจำกัด สโมสรฟุตบอลปัตตานี เอฟซี</p>
          <p className="mt-1">ที่อยู่: 140/3 ถนนยะรัง ตำบลจะบังติกอ อำเภอเมืองปัตตานี จังหวัดปัตตานี 94000</p>
          <p className="mt-1">เบอร์โทรติดต่อ: <a href="tel:0815998925" className="font-semibold hover:underline">0815998925</a></p>
        </div>
      </div>

      <div className="prose prose-slate max-w-none space-y-8 text-slate-800">
        <Section title="1. ผู้ควบคุมข้อมูลส่วนบุคคล">
          <p>
            สโมสรฟุตบอลปัตตานี เอฟซี (&ldquo;Pattani FC&rdquo;, &ldquo;เรา&rdquo;)
            เคารพความเป็นส่วนตัวของคุณ และปฏิบัติตาม
            <strong> พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 </strong>
            (PDPA)
          </p>
        </Section>

        <Section title="2. ข้อมูลที่เราเก็บ">
          <ul className="list-disc space-y-1 pl-6">
            <li>ชื่อ-นามสกุล อีเมล เบอร์โทร (จากการสมัครสมาชิก)</li>
            <li>
              ข้อมูลจาก provider ภายนอกเมื่อคุณเลือก login ด้วย Google หรือ LINE
              (ชื่อ, อีเมล, provider user id)
            </li>
            <li>ประวัติการซื้อบัตร / สินค้า / บัตรรายปี</li>
            <li>เวลา login ล่าสุด, IP ที่ใช้ (เก็บชั่วคราวเพื่อความปลอดภัย)</li>
          </ul>
        </Section>

        <Section title="3. วัตถุประสงค์ในการใช้">
          <ul className="list-disc space-y-1 pl-6">
            <li>ยืนยันตัวตนและให้บริการซื้อบัตร / สินค้าออนไลน์</li>
            <li>ส่งอีเมลยืนยันการจอง / ใบเสร็จ</li>
            <li>ประชาสัมพันธ์กิจกรรมของสโมสร (เฉพาะที่คุณยอมรับ)</li>
            <li>วิเคราะห์การใช้งานเว็บไซต์เพื่อปรับปรุงบริการ</li>
          </ul>
        </Section>

        <Section title="4. ระยะเวลาการเก็บ">
          <p>
            เราจะเก็บข้อมูลตราบเท่าที่บัญชีของคุณยังเปิดใช้งาน
            หรือตามระยะเวลาที่กฎหมายกำหนด (เช่น
            ข้อมูลใบเสร็จเก็บ 5 ปีตามกฎหมายภาษี)
            เมื่อคุณลบบัญชี ข้อมูลจะถูกลบภายใน 30 วัน
            ยกเว้นส่วนที่ต้องเก็บตามกฎหมาย
          </p>
        </Section>

        <Section title="5. การเปิดเผยข้อมูลต่อบุคคลที่สาม">
          <p>
            เราไม่ขายหรือให้เช่าข้อมูลกับผู้อื่น
            มีเพียงกรณีที่จำเป็นเท่านั้น เช่น
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>ผู้ให้บริการชำระเงิน (PromptPay, ธนาคาร)</li>
            <li>ผู้ให้บริการขนส่ง (สำหรับสินค้าออนไลน์)</li>
            <li>เมื่อได้รับหมายศาลหรือคำสั่งจากหน่วยงานราชการ</li>
          </ul>
        </Section>

        <Section title="6. สิทธิของคุณ">
          <p>ตาม พ.ร.บ. คุณมีสิทธิดังนี้</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>ขอเข้าถึง / ขอสำเนาข้อมูลของตัวเอง</li>
            <li>ขอแก้ไข / อัปเดตข้อมูล</li>
            <li>ขอลบข้อมูล (right to be forgotten)</li>
            <li>ขอถอนความยินยอมเมื่อไหร่ก็ได้</li>
            <li>ร้องเรียนต่อคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล</li>
          </ul>
        </Section>

        <Section title="7. ความปลอดภัย">
          <p>
            เราเข้ารหัสรหัสผ่านด้วย bcrypt, ใช้ HTTPS ตลอดทุกหน้าเว็บ,
            และเก็บ session token แบบ httpOnly cookie
            ระบบชำระเงินไม่เก็บเลขบัตรเครดิตของคุณบน server ของเรา
          </p>
        </Section>

        <Section title="8. ติดต่อเรา">
          <p>
            หากต้องการใช้สิทธิของคุณ หรือมีข้อสงสัยเกี่ยวกับนโยบายนี้
            กรุณาติดต่อเราที่{" "}
            <a
              href="mailto:pattanifc2009@gmail.com"
              className="font-semibold text-green-800 hover:underline"
            >
              pattanifc2009@gmail.com
            </a>
          </p>
        </Section>

        <Section title="9. ข้อกำหนดและเงื่อนไขการขายของ PATTANI FC">
          <p>
            กรุณาอ่านข้อกำหนดและเงื่อนไขการขายก่อนทำรายการสั่งซื้อบัตรหรือสินค้า
          </p>
          <a
            href={attachmentHref}
            download
            className="inline-flex items-center rounded-md bg-green-800 px-4 py-2 font-semibold text-white hover:bg-green-700"
          >
            ดาวน์โหลดข้อกำหนดและเงื่อนไขการขาย
          </a>
        </Section>
        <Section title="การคืนเงิน">
          <p>
            ผู้ซื้อที่เข้าเงื่อนไขสามารถแจ้งขอคืนเงินภายใน 7 วัน นับจากวันที่ประกาศยกเลิกการแข่งขันหรือวันที่เกิดเหตุ
            โดยผู้ซื้อต้องแสดงหลักฐานประกอบดังนี้
          </p>
          <ol className="list-decimal space-y-1 pl-6">
            <li>เลขคำสั่งซื้อ</li>
            <li>หลักฐานการชำระเงิน</li>
            <li>รายละเอียดการติดต่อ</li>
          </ol>
          <p>
            เมื่อสโมสรตรวจสอบข้อมูลเรียบร้อยแล้ว จะดำเนินการคืนเงินภายใน 7–14 วันทำการ
            ผ่านช่องทางการชำระเงินเดิม หรือช่องทางอื่นที่ตกลงร่วมกัน
          </p>
        </Section>
        <Section title="ข้อกำหนดและเงื่อนไขการใช้บริการ (Terms & Conditions)">
          <p>
            <strong>การเข้าใช้งานเว็บไซต์</strong> การสมัครสมาชิก และการสั่งซื้อบัตรเข้าชมการแข่งขัน
            ถือว่าผู้ใช้งานยอมรับข้อกำหนดและเงื่อนไขทั้งหมดของสโมสร
          </p>
          <p>
            <strong>การสมัครสมาชิก</strong> ผู้ใช้งานต้องให้ข้อมูลที่ถูกต้อง ครบถ้วน และเป็นปัจจุบัน
            โดยสโมสรขอสงวนสิทธิ์ในการระงับหรือยกเลิกบัญชีผู้ใช้งาน หากพบว่ามีการให้ข้อมูลอันเป็นเท็จ
            หรือมีการใช้งานที่ผิดกฎหมายหรือผิดวัตถุประสงค์ของเว็บไซต์
          </p>
          <p>
            <strong>การสั่งซื้อบัตรเข้าชมการแข่งขัน</strong> บัตรเข้าชมทุกใบใช้ได้เฉพาะการแข่งขัน วันที่
            เวลา และสนามที่ระบุไว้เท่านั้น ผู้ซื้อควรตรวจสอบรายละเอียดการแข่งขัน ประเภทบัตร
            และโซนที่นั่งก่อนชำระเงิน เมื่อชำระเงินเรียบร้อยแล้ว จะไม่สามารถยกเลิก เปลี่ยนแปลง
            หรือขอคืนเงินได้ เว้นแต่เป็นไปตามนโยบายการคืนเงินของสโมสร
          </p>
          <p>
            <strong>บัตรอิเล็กทรอนิกส์ (E-Ticket)</strong> บัตรเข้าชมการแข่งขันจะจัดส่งในรูปแบบบาร์โค้ด
            (Barcode) ผ่านบัญชีผู้ใช้งานหรืออีเมลที่ลงทะเบียนไว้ บาร์โค้ดแต่ละใบสามารถใช้เข้าสนามได้เพียง 1 ครั้ง
            เท่านั้น ห้ามคัดลอก ดัดแปลง เผยแพร่ หรือส่งต่อบาร์โค้ดให้บุคคลอื่นโดยไม่ได้รับอนุญาต
            ผู้ที่นำบาร์โค้ดมาแสดงและผ่านการตรวจสอบเข้าสนามเป็นคนแรก จะถือเป็นผู้มีสิทธิ์เข้าชมการแข่งขัน
            ผู้ซื้อมีหน้าที่เก็บรักษาบาร์โค้ดไว้เป็นความลับ หากมีการเปิดเผย ส่งต่อ หรือสูญหาย
            สโมสรจะไม่รับผิดชอบต่อความเสียหายที่เกิดขึ้น
          </p>
          <p>
            <strong>การเลื่อนหรือเปลี่ยนแปลงการแข่งขัน</strong> สโมสรอาจเปลี่ยนแปลงวันแข่งขัน
            เวลาแข่งขัน สนามแข่งขัน หรือรายละเอียดอื่นของการแข่งขัน ตามความเหมาะสมหรือเหตุสุดวิสัย
            โดยบัตรเดิมยังสามารถใช้เข้าชมการแข่งขันได้ เว้นแต่สโมสรจะแจ้งเป็นอย่างอื่น
          </p>
          <div>
            <p>
              <strong>การปฏิเสธการเข้าสนาม</strong> สโมสรมีสิทธิ์ปฏิเสธการเข้าสนามของบุคคล ดังนี้
            </p>
            <ol className="list-decimal space-y-1 pl-6">
              <li>ใช้บัตรหรือบาร์โค้ดปลอม</li>
              <li>ใช้บาร์โค้ดที่ถูกใช้งานแล้ว</li>
              <li>มีพฤติกรรมก่อความไม่สงบ หรือฝ่าฝืนกฎระเบียบของสนาม</li>
              <li>พกพาสิ่งของต้องห้ามตามที่สนามหรือฝ่ายจัดการแข่งขันกำหนด</li>
              <li>ไม่ปฏิบัติตามคำแนะนำของเจ้าหน้าที่รักษาความปลอดภัย</li>
            </ol>
          </div>
          <p>จากพฤติกรรมดังกล่าว สโมสรจะไม่คืนเงินค่าบัตร</p>
        </Section>
      </div>

      <div className="mt-10 border-t border-slate-200 pt-6 text-base md:text-lg">
        <Link
          href="/register"
          className="font-semibold text-green-800 hover:underline"
        >
          ← กลับไปหน้าสมัครสมาชิก
        </Link>
      </div>
    </main>
  );
}

function MalayPrivacyPolicy({ attachmentHref }: { attachmentHref: string }) {
  return <main className="mx-auto w-full max-w-6xl px-4 py-10 md:py-16"><div className="mb-8"><p className="text-sm font-semibold uppercase tracking-widest text-yellow-600 md:text-base">Dasar Privasi · PDPA</p><h1 className="mt-1 text-4xl font-black text-green-900 md:text-5xl">Dasar Privasi</h1><p className="mt-2 text-base text-slate-600 md:text-lg">Kemas kini terakhir: 8 Julai 2026</p><div className="mt-5 rounded-lg border border-green-100 bg-green-50 p-5 text-base text-green-950 md:text-lg"><p className="font-bold">Entiti undang-undang: Pattani Football Club Limited Partnership</p><p className="mt-1">Alamat: 140/3 Jalan Yarang, Chabang Tiko, Mueang Pattani, Pattani 94000</p><p className="mt-1">Telefon: <a href="tel:0815998925" className="font-semibold hover:underline">0815998925</a></p></div></div><div className="prose prose-slate max-w-none space-y-8 text-slate-800"><Section title="1. Pengawal Data"><p>Pattani FC menghormati privasi anda dan memproses data peribadi menurut Akta Perlindungan Data Peribadi Thailand (PDPA).</p></Section><Section title="2. Maklumat yang Dikumpulkan"><p>Kami mengumpulkan maklumat yang diperlukan untuk pendaftaran, tempahan dan pembelian, termasuk nama, e-mel, nombor telefon, sejarah transaksi serta maklumat keselamatan akaun.</p></Section><Section title="3. Penggunaan Maklumat"><p>Maklumat digunakan untuk pengesahan identiti, penyediaan tiket dan kedai dalam talian, penghantaran pengesahan serta penambahbaikan perkhidmatan.</p></Section><Section title="4. Penyimpanan dan Pendedahan"><p>Data disimpan selama diperlukan oleh perkhidmatan atau undang-undang. Kami tidak menjual atau menyewakan data dan hanya berkongsi apabila perlu dengan penyedia pembayaran, penghantaran atau pihak berkuasa yang sah.</p></Section><Section title="5. Hak Anda"><p>Anda boleh meminta akses, pembetulan, pemadaman, pengehadan atau penarikan balik persetujuan mengikut hak yang diberikan oleh PDPA.</p></Section><Section title="6. Keselamatan"><p>Kami menggunakan kata laluan disulitkan, HTTPS dan kuki sesi selamat. Butiran kad tidak disimpan pada pelayan Pattani FC.</p></Section><Section title="7. Hubungi"><p>Untuk pertanyaan privasi, e-mel <a href="mailto:pattanifc2009@gmail.com" className="font-semibold text-green-800 hover:underline">pattanifc2009@gmail.com</a>.</p></Section><Section title="8. Terma Jualan dan Bayaran Balik"><p>Sila baca terma jualan penuh sebelum membeli. Permohonan bayaran balik yang layak perlu dibuat dalam tempoh tujuh hari dan biasanya diproses dalam 7–14 hari bekerja selepas pengesahan.</p><a href={attachmentHref} download className="inline-flex items-center rounded-md bg-green-800 px-4 py-2 font-semibold text-white hover:bg-green-700">Muat Turun Terma Jualan</a></Section></div><div className="mt-10 border-t border-slate-200 pt-6 text-base md:text-lg"><Link href="/register" className="font-semibold text-green-800 hover:underline">← Kembali ke Pendaftaran</Link></div></main>;
}

function EnglishPrivacyPolicy({ attachmentHref }: { attachmentHref: string }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 md:py-16">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-yellow-600 md:text-base">Privacy Policy · PDPA</p>
        <h1 className="mt-1 text-4xl font-black text-green-900 md:text-5xl">Privacy Policy</h1>
        <p className="mt-2 text-base text-slate-600 md:text-lg">Last updated: 8 July 2026</p>
        <div className="mt-5 rounded-lg border border-green-100 bg-green-50 p-5 text-base text-green-950 md:text-lg"><p className="font-bold">Legal entity: Pattani Football Club Limited Partnership</p><p className="mt-1">Address: 140/3 Yarang Road, Chabang Tiko, Mueang Pattani, Pattani 94000</p><p className="mt-1">Phone: <a href="tel:0815998925" className="font-semibold hover:underline">0815998925</a></p></div>
      </div>
      <div className="prose prose-slate max-w-none space-y-8 text-slate-800">
        <Section title="1. Data Controller"><p>Pattani FC respects your privacy and processes personal data in accordance with Thailand’s Personal Data Protection Act B.E. 2562 (PDPA).</p></Section>
        <Section title="2. Information We Collect"><ul className="list-disc space-y-1 pl-6"><li>Name, email address, and phone number supplied during registration or booking.</li><li>Information received when signing in with Google or LINE.</li><li>Ticket, merchandise, and season-pass purchase history.</li><li>Security information such as recent login time and temporarily retained IP address.</li></ul></Section>
        <Section title="3. How We Use Information"><ul className="list-disc space-y-1 pl-6"><li>Identity verification and delivery of ticketing and online-store services.</li><li>Booking confirmations and receipts.</li><li>Club communications where consent has been provided.</li><li>Service improvement and website analytics.</li></ul></Section>
        <Section title="4. Retention"><p>Information is retained while your account remains active or for the period required by law. Data not subject to a legal retention duty will be removed within 30 days after account deletion.</p></Section>
        <Section title="5. Disclosure"><p>We do not sell or rent personal data. Information is shared only where necessary with payment providers, delivery providers, or public authorities acting under lawful authority.</p></Section>
        <Section title="6. Your Rights"><p>You may request access, correction, deletion, restriction, withdrawal of consent, or exercise other rights available under the PDPA.</p></Section>
        <Section title="7. Security"><p>We use encrypted passwords, HTTPS, secure session cookies, and payment providers designed so that card details are not stored on Pattani FC servers.</p></Section>
        <Section title="8. Contact"><p>For privacy questions or rights requests, email <a href="mailto:pattanifc2009@gmail.com" className="font-semibold text-green-800 hover:underline">pattanifc2009@gmail.com</a>.</p></Section>
        <Section title="9. Sales Terms and Refunds"><p>Please read the club’s full sales terms before purchasing tickets or merchandise. Eligible refund requests must be submitted within seven days of the relevant cancellation or qualifying event and are normally processed within 7–14 business days after verification.</p><a href={attachmentHref} download className="inline-flex items-center rounded-md bg-green-800 px-4 py-2 font-semibold text-white hover:bg-green-700">Download Sales Terms</a></Section>
        <Section title="Ticket Terms"><p>Tickets are valid only for the stated match, date, time, venue, and zone. Each E-Ticket barcode may be used once. Keep it private. Match details may change, and venue entry remains subject to safety and stadium regulations.</p></Section>
      </div>
      <div className="mt-10 border-t border-slate-200 pt-6 text-base md:text-lg"><Link href="/register" className="font-semibold text-green-800 hover:underline">← Back to Registration</Link></div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-2xl font-bold text-green-900 md:text-3xl">{title}</h2>
      <div className="space-y-3 text-lg leading-relaxed text-slate-700 md:text-xl">
        {children}
      </div>
    </section>
  );
}
