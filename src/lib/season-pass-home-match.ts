// บัตรรายปีใช้สิทธิ์เฉพาะเกมเหย้าของ Pattani FC เท่านั้น
export function isPattaniHomeTeam(homeTeam: string): boolean {
  const normalized = homeTeam.trim().toLocaleLowerCase("en-US");
  return (
    normalized === "pattani fc" ||
    normalized === "pattani f.c." ||
    normalized === "pattani" ||
    homeTeam.includes("ปัตตานี เอฟซี")
  );
}
