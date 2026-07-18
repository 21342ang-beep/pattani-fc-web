"use client";

import { useEffect } from "react";

function eyeIcon(hidden: boolean) {
  return hidden
    ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c5 0 8.3 4.3 9.5 6-0.5.7-1.4 1.9-2.7 3.1"/><path d="M6.6 6.6C4.8 7.9 3.5 9.6 2.5 11c1.2 1.7 4.5 6 9.5 6 1.5 0 2.8-.4 3.9-1"/></svg>'
    : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
}

export default function CmsPasswordToggle() {
  useEffect(() => {
    const addToggle = () => {
      const input = document.querySelector<HTMLInputElement>('input[name="password"]');
      if (!input || input.dataset.eyeToggleAttached === "true") return;

      const container = input.parentElement;
      if (!container) return;
      input.dataset.eyeToggleAttached = "true";
      input.style.paddingRight = "3rem";
      container.style.position = "relative";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "cms-password-toggle";
      button.setAttribute("aria-label", "แสดงรหัสผ่าน");
      button.setAttribute("aria-pressed", "false");
      button.innerHTML = eyeIcon(false);
      button.addEventListener("click", () => {
        const isVisible = input.type === "text";
        input.type = isVisible ? "password" : "text";
        button.setAttribute("aria-label", isVisible ? "แสดงรหัสผ่าน" : "ซ่อนรหัสผ่าน");
        button.setAttribute("aria-pressed", String(!isVisible));
        button.innerHTML = eyeIcon(!isVisible);
        input.focus();
      });
      container.append(button);
    };

    addToggle();
    const observer = new MutationObserver(addToggle);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
