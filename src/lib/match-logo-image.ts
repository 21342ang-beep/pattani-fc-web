/** Fetch public match uploads through nginx so newly uploaded logos work too. */
export function matchLogoImage(logo: string) {
  if (logo.startsWith("/uploads/matches/")) {
    return { src: `https://pattanifc.co${logo}`, unoptimized: false };
  }

  // Preserve support for other existing logo sources.
  return { src: logo, unoptimized: true };
}
