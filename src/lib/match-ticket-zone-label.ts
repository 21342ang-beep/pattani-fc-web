const ZONE_BUTTON_LABEL = /^[A-Z]+$/;

export const MAX_MATCH_TICKET_ZONE_BUTTON_LABEL_LENGTH = 12;

export function getMatchTicketZoneButtonLabel({
  buttonLabel,
  code,
  name,
}: {
  buttonLabel?: string | null;
  code: string;
  name: string;
}) {
  const explicitLabel = buttonLabel?.trim().toUpperCase();
  if (
    explicitLabel &&
    explicitLabel.length <= MAX_MATCH_TICKET_ZONE_BUTTON_LABEL_LENGTH &&
    ZONE_BUTTON_LABEL.test(explicitLabel)
  ) {
    return explicitLabel;
  }

  const normalizedCode = code.trim().toUpperCase();
  const normalizedName = name.trim().toUpperCase();
  if (normalizedCode.includes("VVIP") || normalizedName.includes("VVIP")) return "V";

  const codeSuffix = normalizedCode.match(/(?:^|-)([A-Z])$/)?.[1];
  if (codeSuffix) return codeSuffix;

  const nameZoneLetter = normalizedName.match(/(?:ZONE|โซน)\s*([A-Z])(?:\s|$)/)?.[1];
  if (nameZoneLetter) return nameZoneLetter;

  return normalizedCode.match(/[A-Z]/)?.[0] ?? "X";
}
