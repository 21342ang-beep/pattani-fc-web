import bwipjs from "bwip-js/node";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  props: { params: Promise<{ code: string }> },
) {
  const { code } = await props.params;
  const barcode = code.toUpperCase();
  if (!/^PFC26-(4000|2500|2000|1500)-\d{4}$/.test(barcode)) {
    return new Response("Not found", { status: 404 });
  }
  const pass = await prisma.seasonPassBarcode.findUnique({
    where: { barcode },
    select: { id: true },
  });
  if (!pass) return new Response("Not found", { status: 404 });

  const svg = bwipjs.toSVG({ bcid: "code128", text: barcode, scale: 2, height: 12, includetext: true });
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=300" },
  });
}
