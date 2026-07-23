"use client";

import { useState } from "react";
import BookingSearchForm from "./BookingSearchForm";
import SeasonPassSearchForm from "./SeasonPassSearchForm";

type SearchType = "match" | "season";

export default function BookingSearchTabs() {
  const [searchType, setSearchType] = useState<SearchType>("match");

  return (
    <section className="mt-8">
      <label htmlFor="booking-type" className="block text-lg font-semibold text-green-900 md:text-xl">
        ประเภทการตรวจสอบ
      </label>
      <select
        id="booking-type"
        value={searchType}
        onChange={(event) => setSearchType(event.target.value as SearchType)}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3.5 text-lg font-semibold text-green-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 md:text-xl"
      >
        <option value="match">บัตรรายแมตช์</option>
        <option value="season">บัตรรายปี</option>
      </select>

      {searchType === "match" ? <BookingSearchForm /> : <SeasonPassSearchForm />}
    </section>
  );
}
