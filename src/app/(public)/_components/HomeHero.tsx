import Image from "next/image";

// Mainboard = รูป collage ทีมเต็มใบ (ขนาดจริง 1584×672)
// ใช้ width/height จริง + w-full h-auto → บอร์ดสูงตามสัดส่วนของรูป ไม่ครอป ไม่บิด
export default function HomeHero() {
  return (
    <section className="relative isolate overflow-hidden bg-green-950">
      <Image
        src="/home-hero-bg-team-collage.png"
        alt=""
        width={1584}
        height={672}
        priority
        sizes="100vw"
        className="pointer-events-none mx-auto h-auto w-full"
      />
    </section>
  );
}
