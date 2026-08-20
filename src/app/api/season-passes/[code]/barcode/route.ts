import bwipjs from "bwip-js/node";
import { prisma } from "@/lib/prisma";
import { withSeasonPassBarcodePrintSize } from "@/lib/season-pass-barcode-svg";
import { verifySeasonPassBarcodeAccessToken } from "@/lib/season-pass-barcode-access";
import { rateLimit } from "@/lib/rate-limit";
import { createSeasonPassGateToken } from "@/lib/season-pass-gate-token";

export async function GET(
  request: Request,
  props: { params: Promise<{ code: string }> },
) {
  const { code } = await props.params;
  const barcode = code.toUpperCase();
  if (!/^PFC26-(4000|2500|2000|1500)-\d{4}$/.test(barcode)) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const limited = await rateLimit("season_barcode_render", {
    max: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const pass = await prisma.seasonPassBarcode.findUnique({
    where: { barcode },
    select: {
      id: true,
      barcode: true,
      isGenerated: true,
      gateVersion: true,
      gateNonce: true,
      orderId: true,
      order: { select: { status: true } },
    },
  });
  const token = new URL(request.url).searchParams.get("token");
  if (
    !pass ||
    !pass.isGenerated ||
    (pass.orderId !== null && pass.order?.status !== "CONFIRMED") ||
    !(await verifySeasonPassBarcodeAccessToken(token, {
      barcodeId: pass.id,
      barcode: pass.barcode,
      gateVersion: pass.gateVersion,
      gateNonce: pass.gateNonce,
      orderId: pass.orderId,
    }))
  ) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const svg = withSeasonPassBarcodePrintSize(
    bwipjs.toSVG({
      bcid: "code128",
      text: createSeasonPassGateToken(pass),
      scale: 2,
      height: 12,
      includetext: false,
    }),
  );
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
