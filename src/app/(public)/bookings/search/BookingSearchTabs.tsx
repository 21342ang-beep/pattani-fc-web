import BookingSearchForm from "./BookingSearchForm";
import type { Locale } from "@/lib/i18n/dict";

export default function BookingSearchTabs({ locale }: { locale: Locale }) {
  return (
    <section className="mt-8">
      <BookingSearchForm locale={locale} />
    </section>
  );
}
