import { timingSafeEqual } from "node:crypto";

function isValidToken(received: string | null) {
  const expected = process.env.XENDIT_WEBHOOK_TOKEN;
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function POST(request: Request) {
  if (!isValidToken(request.headers.get("x-callback-token"))) {
    return new Response("Invalid callback token", { status: 401 });
  }

  // Parse only after authenticating the callback. Booking confirmation will be
  // added when Payment Requests are created with their booking reference.
  try {
    await request.json();
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  return Response.json({ ok: true });
}
