"use client";

import { useState } from "react";
import type { Permission } from "@prisma/client";
import { ADMIN_SECTIONS } from "@/lib/admin-sections";

// Checkbox grid สำหรับเลือก permission — ใช้ทั้งในฟอร์มสร้างและแก้ไข
export default function PermissionCheckboxes({
  defaultChecked = [],
  disabled = false,
}: {
  defaultChecked?: Permission[];
  disabled?: boolean;
}) {
  const [checked, setChecked] = useState<Set<Permission>>(
    new Set(defaultChecked),
  );

  const toggle = (perm: Permission, on: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(perm);
      else next.delete(perm);
      return next;
    });
  };

  const allOn = ADMIN_SECTIONS.every((s) => checked.has(s.permission));
  const noneOn = checked.size === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          disabled={disabled || allOn}
          onClick={() =>
            setChecked(new Set(ADMIN_SECTIONS.map((s) => s.permission)))
          }
          className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          เลือกทั้งหมด
        </button>
        <button
          type="button"
          disabled={disabled || noneOn}
          onClick={() => setChecked(new Set())}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          ล้างทั้งหมด
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {ADMIN_SECTIONS.map((sec) => {
          const isChecked = checked.has(sec.permission);
          return (
            <label
              key={sec.permission}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors ${
                isChecked
                  ? "border-green-400 bg-green-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="checkbox"
                name="permissions"
                value={sec.permission}
                checked={isChecked}
                disabled={disabled}
                onChange={(e) => toggle(sec.permission, e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-green-700"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium text-slate-900">
                  <span aria-hidden>{sec.icon}</span>
                  <span>{sec.label}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {sec.description}
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
