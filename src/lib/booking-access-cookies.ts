import "server-only";

import { cookies } from "next/headers";

export const BOOKING_ACCESS_COOKIE = "booking_access";
export const BOOKING_RECOVERY_ACCESS_COOKIE = "booking_recovery_access";

export async function clearBookingAccessCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(BOOKING_ACCESS_COOKIE);
  cookieStore.delete(BOOKING_RECOVERY_ACCESS_COOKIE);
}
