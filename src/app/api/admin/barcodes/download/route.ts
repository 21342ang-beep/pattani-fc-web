import bwipjs from "bwip-js/node";
import { z } from "zod";
import { getAdminUser, hasPermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

const inputSchema = z.object({
  tierId: z.enum(["vip-advanced", "premium", "gold"]),
  barcodes: z
    .array(z.string().regex(/^PFC26-(4000|2500|2000|1500)-\d{4}$/))
    .min(1)
    .max(500),
});

export async function POST(request: Request) {
  const user = await getAdminUser();
  if (!hasPermission(user, "BARCODE_MANAGEMENT")) {
    return new Response("Forbidden", { status: 403 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("Invalid request", { status: 400 });

  const requestedCodes = [...new Set(parsed.data.barcodes)];
  const records = await prisma.seasonPassBarcode.findMany({
    where: {
      tierId: parsed.data.tierId,
      barcode: { in: requestedCodes },
    },
    select: { barcode: true },
  });
  if (records.length !== requestedCodes.length) {
    return new Response("Barcode not found", { status: 404 });
  }

  const zip = createZip(
    requestedCodes.map((barcode) => ({
      name: `${barcode}.svg`,
      content: Buffer.from(
        bwipjs.toSVG({
          bcid: "code128",
          text: barcode,
          scale: 2,
          height: 12,
          includetext: true,
        }),
        "utf8",
      ),
    })),
  );
  const price = parsed.data.tierId === "vip-advanced" ? 2500 : parsed.data.tierId === "premium" ? 2000 : 1500;

  return new Response(Uint8Array.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="PFC26-${price}-barcodes.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function createZip(files: { name: string; content: Buffer }[]): Buffer {
  const localFiles: Buffer[] = [];
  const centralDirectory: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const fileName = Buffer.from(file.name, "utf8");
    const crc = crc32(file.content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(file.content.length, 18);
    localHeader.writeUInt32LE(file.content.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    const localFile = Buffer.concat([localHeader, fileName, file.content]);
    localFiles.push(localFile);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(file.content.length, 20);
    centralHeader.writeUInt32LE(file.content.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    centralDirectory.push(Buffer.concat([centralHeader, fileName]));
    offset += localFile.length;
  }

  const directory = Buffer.concat(centralDirectory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localFiles, directory, end]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
