"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "light";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export default function TurnstileWidget({
  siteKey,
  resetKey,
  onTokenChange,
}: {
  siteKey: string;
  resetKey: number;
  onTokenChange: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [error, setError] = useState(false);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action: "register",
      theme: "light",
      callback: (token) => {
        setError(false);
        onTokenChange(token);
      },
      "expired-callback": () => onTokenChange(""),
      "error-callback": () => {
        setError(true);
        onTokenChange("");
      },
    });
  }, [onTokenChange, siteKey]);

  useEffect(() => {
    const widgetId = widgetIdRef.current;
    if (!widgetId || !window.turnstile) return;
    onTokenChange("");
    window.turnstile.reset(widgetId);
  }, [onTokenChange, resetKey]);

  useEffect(() => () => {
    const widgetId = widgetIdRef.current;
    if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    widgetIdRef.current = null;
  }, []);

  return (
    <div className="space-y-2">
      <Script
        id="cloudflare-turnstile-register"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderWidget}
        onError={() => setError(true)}
      />
      <div ref={containerRef} className="flex min-h-[65px] justify-center" />
      {error && (
        <p className="text-center text-sm text-red-600">
          ระบบตรวจสอบความปลอดภัยโหลดไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองใหม่
        </p>
      )}
    </div>
  );
}
