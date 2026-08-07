export const COOKIE_CONSENT_NAME = "pfc_cookie_consent";
export const COOKIE_CONSENT_VALUES = ["all-v1", "necessary-v1"] as const;

export type CookieConsentValue = (typeof COOKIE_CONSENT_VALUES)[number];
