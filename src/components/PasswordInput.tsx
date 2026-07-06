"use client";

import { useState, forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";

type Tone = "green" | "red" | "redOnError";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** ทำให้กรอบสีแดง (เคสเฉพาะ DangerZone) */
  invalid?: boolean;
  /** สีกรอบ default — "green" (form ปกติ) หรือ "red" (DangerZone) */
  tone?: Tone;
};

const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { invalid, tone = "green", className, ...rest },
  ref
) {
  const [shown, setShown] = useState(false);

  const base =
    "w-full rounded-md border px-3 py-2 pr-10 text-sm outline-none focus:ring-2 transition";
  const palette =
    tone === "red"
      ? invalid
        ? "border-red-400 bg-white focus:border-red-600 focus:ring-red-500/20"
        : "border-red-200 bg-white focus:border-red-500 focus:ring-red-500/20"
      : invalid
      ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
      : "border-green-200 focus:border-green-600 focus:ring-green-600/20";

  return (
    <div className="relative">
      <input
        {...rest}
        ref={ref}
        type={shown ? "text" : "password"}
        suppressHydrationWarning
        className={`${base} ${palette} ${className ?? ""}`}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        aria-pressed={shown}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-green-800"
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});

export default PasswordInput;
