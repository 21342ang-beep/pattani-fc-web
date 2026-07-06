import { getPayload } from "payload";
import config from "../src/payload.config";

type SeedSponsor = {
  name: string;
  logoUrl: string;
  tier: "title" | "main" | "partner" | "supporter";
  website?: string;
};

const SPONSORS: SeedSponsor[] = [
  {
    name: "เมืองไทยประกันภัย (Muang Thai Insurance)",
    logoUrl: "/sponsor-muang-thai-insurance.png",
    tier: "main",
    website: "https://www.muangthaiinsurance.com",
  },
  {
    name: "UNiQUE 2 พี่น้อง",
    logoUrl: "/sponsor-unique-v2.png",
    tier: "partner",
  },
  {
    name: "HiHi Buffet",
    logoUrl: "/sponsor-hihi-buffet-v2.png",
    tier: "partner",
  },
  {
    name: "Thai-Malay Zidan Tour",
    logoUrl: "/sponsor-zidan-tour.png",
    tier: "partner",
  },
  {
    name: "BG Sports",
    logoUrl: "/sponsor-bg-sports.png",
    tier: "partner",
  },
  {
    name: "ธนาคารอิสลามแห่งประเทศไทย",
    logoUrl: "/sponsor-islamic-bank-thailand.png",
    tier: "partner",
  },
  {
    name: "Park Intown Hotel",
    logoUrl: "/sponsor-park-intown-hotel.png",
    tier: "partner",
  },
  {
    name: "Roti de Forest",
    logoUrl: "/sponsor-roti-de-forest.png",
    tier: "partner",
  },
  {
    name: "Tu Yong Steel Trade",
    logoUrl: "/sponsor-tu-yong-steel-trade.png",
    tier: "partner",
  },
  {
    name: "Dentsquare",
    logoUrl: "/sponsor-dentsquare.jpg",
    tier: "partner",
  },
  {
    name: "อาซัน ของฝาก ปัตตานี (Pattani Souvenir)",
    logoUrl: "/sponsor-ason-pattani-souvenir.jpg",
    tier: "partner",
  },
];

async function main() {
  const payload = await getPayload({ config });

  for (const s of SPONSORS) {
    const existing = await payload.find({
      collection: "sponsors",
      where: { name: { equals: s.name } },
      limit: 1,
      overrideAccess: true,
    });

    if (existing.totalDocs > 0) {
      console.log(`↺  skip (exists): ${s.name}`);
      continue;
    }

    const created = await payload.create({
      collection: "sponsors",
      data: { ...s, active: true },
      overrideAccess: true,
    });

    console.log(`+  created: ${created.name} (id=${created.id})`);
  }

  console.log("done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
