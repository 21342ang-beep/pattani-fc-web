"use client";

import { useState } from "react";
import BookingSearchForm from "./BookingSearchForm";
import SeasonPassSearchForm from "./SeasonPassSearchForm";

type SearchType = "match" | "season";

export default function BookingSearchTabs() {
  const [searchType, setSearchType] = useState<SearchType>("match");

  return (
    <section className="mt-6">
      <label htmlFor="booking-type" className="block text-sm font-semibold text-green-900">
        ประเภทการตรวจสอบ
      </label>
      <select
        id="booking-type"
        value={searchType}
        onChange={(event) => setSearchType(event.target.value as SearchType)}
        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-green-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
      >
        <option value="match">บัตรรายแมตช์</option>
        <option value="season">บัตรรายปี</option>
      </select>

      {searchType === "match" ? <BookingSearchForm /> : <SeasonPassSearchForm />}
    </section>
  );
}
