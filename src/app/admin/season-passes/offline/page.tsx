import { redirect } from "next/navigation";

/**
 * Keep the former offline-booking URL working for existing bookmarks.
 * Staff season-pass bookings now use the same real booking flow as other tiers.
 */
export default function LegacyOfflineSeasonPassPage() {
  redirect("/admin/season-passes/staff");
}
