import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { deriveSecurityKey } from "@/lib/security-keys";

export const SHOP_ORDER_ACCESS_COOKIE = "shop_order_access";
const key = deriveSecurityKey(
  "pattani-fc/shop-order-access/v1",
  process.env.SHOP_ORDER_ACCESS_SECRET,
);

export async function createShopOrderAccessToken(
  orderCode: string,
): Promise<string> {
  return new SignJWT({ kind: "shop-order", orderCode })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("pattani-fc")
    .setAudience("shop-order-access")
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(key);
}

export async function verifyShopOrderAccessToken(
  token: string | undefined,
  expectedOrderCode: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: "pattani-fc",
      audience: "shop-order-access",
    });
    return (
      payload.kind === "shop-order" &&
      payload.orderCode === expectedOrderCode
    );
  } catch {
    return false;
  }
}
