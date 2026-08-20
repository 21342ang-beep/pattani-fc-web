const DEFAULT_JSON_CONTENT_TYPE = "application/json; charset=utf-8";

export class RequestBodyTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes`);
    this.name = "RequestBodyTooLargeError";
  }
}

export class InvalidJsonBodyError extends Error {
  constructor() {
    super("Request body is not valid JSON");
    this.name = "InvalidJsonBodyError";
  }
}

export async function readRequestBodyLimited(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new RequestBodyTooLargeError(maxBytes);
    }
  }

  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("request body too large").catch(() => undefined);
        throw new RequestBodyTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readJsonBodyLimited(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const body = await readRequestBodyLimited(request, maxBytes);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown;
  } catch {
    throw new InvalidJsonBodyError();
  }
}

export function jsonNoStore(
  body: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  if (!headers.has("Content-Type")) headers.set("Content-Type", DEFAULT_JSON_CONTENT_TYPE);
  return Response.json(body, { ...init, headers });
}

export function rateLimitedJson(retryAfterSec: number): Response {
  return jsonNoStore(
    { error: "ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, retryAfterSec)) },
    },
  );
}

export function paymentTargetNotFound(): Response {
  return jsonNoStore(
    { error: "ไม่พบรายการชำระเงิน" },
    { status: 404 },
  );
}
