"use client";

import { useState } from "react";
import { X, Upload } from "lucide-react";

export default function LogoUpload({
  label,
  fileFieldName,
  existingFieldName,
  initialPath,
}: {
  label: string;
  fileFieldName: string;
  existingFieldName: string;
  initialPath: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(initialPath);
  const [removed, setRemoved] = useState(false);
  // path ที่จะ submit กลับ — null ถ้าผู้ใช้กดลบ, ไม่งั้นเป็น initialPath
  const submitExisting = removed ? "" : initialPath ?? "";

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setRemoved(false);
    // preview ฝั่ง client เท่านั้น (browser-only) — ไม่ส่งไป server
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  function onRemove() {
    setPreview(null);
    setRemoved(true);
    // reset file input ถ้ามี
    const el = document.querySelector<HTMLInputElement>(
      `input[name="${fileFieldName}"]`
    );
    if (el) el.value = "";
  }

  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <div className="mt-1 flex items-center gap-3 rounded-md border border-dashed border-slate-300 p-2">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-50">
          {preview ? (
            // ใช้ <img> เพราะ preview อาจเป็น blob: URL (Next/Image ไม่รองรับ)
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-contain" />
          ) : (
            <Upload className="size-5 text-slate-400" />
          )}
        </div>
        <div className="flex-1 space-y-1">
          <input
            type="file"
            name={fileFieldName}
            accept="image/png,image/jpeg,image/webp"
            onChange={onPick}
            className="block w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-slate-200"
          />
          <p className="text-[11px] text-slate-500">PNG, JPG, WEBP ≤ 2MB</p>
        </div>
        {preview && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600"
            aria-label="ลบโล้โก้"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <input type="hidden" name={existingFieldName} value={submitExisting} />
      {removed && <input type="hidden" name={`${fileFieldName}__remove`} value="1" />}
    </div>
  );
}
