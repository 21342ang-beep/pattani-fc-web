import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALES, type Locale, getDict, type Dict } from "./dict";

export const LOCALE_COOKIE = "locale";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const v = store.get(LOCALE_COOKIE)?.value;
  return LOCALES.includes(v as Locale) ? (v as Locale) : DEFAULT_LOCALE;
}

export async function getT(): Promise<{ locale: Locale; dict: Dict }> {
  const locale = await getLocale();
  return { locale, dict: getDict(locale) };
}
