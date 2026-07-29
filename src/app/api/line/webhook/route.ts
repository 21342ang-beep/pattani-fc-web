import { replyLineText, verifyLineWebhookSignature } from "@/lib/line-messaging";

type LineEvent = {
  type?: string;
  replyToken?: string;
  message?: { type?: string; text?: string };
};

export async function POST(request: Request) {
  const body = await request.text();
  if (!verifyLineWebhookSignature(body, request.headers.get("x-line-signature"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: { events?: LineEvent[] };
  try {
    payload = JSON.parse(body) as { events?: LineEvent[] };
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  for (const event of payload.events ?? []) {
    if (!event.replyToken) continue;
    if (event.type === "follow") {
      await replyLineText(event.replyToken, "ยินดีต้อนรับสู่ Pattani FC\nเลือกบริการได้จากเมนูด้านล่าง");
    }
  }

  return Response.json({ ok: true });
}
