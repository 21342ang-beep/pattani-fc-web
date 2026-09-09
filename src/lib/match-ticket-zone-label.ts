const ZONE_BUTTON_LABEL_CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/;
const ZONE_BUTTON_LABEL_CONTROL_CHARACTERS_GLOBAL = /[\u0000-\u001F\u007F-\u009F]/g;

export function sanitizeMatchTicketZoneButtonLabelInput(value: string) {
  return value
    .toUpperCase()
    .replace(ZONE_BUTTON_LABEL_CONTROL_CHARACTERS_GLOBAL, "");
}

export function isValidMatchTicketZoneButtonLabel(value: string) {
  return value.length >= 1
    && !ZONE_BUTTON_LABEL_CONTROL_CHARACTERS.test(value);
}

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
  if (explicitLabel && isValidMatchTicketZoneButtonLabel(explicitLabel)) {
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
