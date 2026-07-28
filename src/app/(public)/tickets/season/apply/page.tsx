import SeasonPassApplyPage from "../../../season-pass/apply/page";

export const dynamic = "force-dynamic";

export default function TicketSeasonApplyPage(props: {
  searchParams: Promise<{ tier?: string }>;
}) {
  return <SeasonPassApplyPage {...props} />;
}
