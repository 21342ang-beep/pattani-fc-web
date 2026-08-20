export type TurnstileVerificationResult = {
  success?: boolean;
  action?: string;
  hostname?: string;
};

export function isValidRegistrationTurnstileResult(
  result: TurnstileVerificationResult | null,
  allowedHostnames: ReadonlySet<string>,
): boolean {
  if (
    result?.success !== true ||
    result.action !== "register" ||
    typeof result.hostname !== "string"
  ) {
    return false;
  }
  return allowedHostnames.has(result.hostname.trim().toLowerCase());
}
