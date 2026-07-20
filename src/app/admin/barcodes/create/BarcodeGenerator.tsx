"use client";

import { useState, useTransition } from "react";
import {
  createSeasonPassBarcodes,
  deleteSeasonPassBarcodes,
  resetSeasonPassBarcodes,
  type CreateBarcodesState,
} from "@/app/actions/barcodes";

const packages = [
  { id: "vip-advanced", price: 2500, label: "VIP ADVANCED" },
  { id: "premium", price: 2000, label: "PREMIUM" },
  { id: "gold", price: 1500, label: "GOLD" },
] as const;

type TierId = (typeof packages)[number]["id"];
type BarcodeItem = Extract<CreateBarcodesState, { ok: true }>['barcodes'][number];
type BarcodesByTier = Record<TierId, BarcodeItem[]>;

const initialCreateBarcodesState: CreateBarcodesState = {
  ok: false,
  message: "",
  barcodes: [],
};

const emptyBarcodesByTier: BarcodesByTier = {
  "vip-advanced": [],
  premium: [],
  gold: [],
};

export default function BarcodeGenerator() {
  const [state, setState] = useState<CreateBarcodesState>(initialCreateBarcodesState);
  const [selectedTier, setSelectedTier] = useState<TierId>("vip-advanced");
  const [activeTab, setActiveTab] = useState<TierId>("vip-advanced");
  const [barcodesByTier, setBarcodesByTier] = useState<BarcodesByTier>(emptyBarcodesByTier);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [pending, startTransition] = useTransition();
  const activePackage = packages.find((item) => item.id === activeTab)!;
  const activeBarcodes = barcodesByTier[activeTab];

  function submit(formData: FormData) {
    startTransition(async () => {
      const nextState = await createSeasonPassBarcodes(state, formData);
      setState(nextState);
      if (!nextState.ok) return;

      const tierId = nextState.barcodes[0]?.tierId;
      if (!tierId) return;
      setBarcodesByTier((current) => ({
        ...current,
        [tierId]: [...current[tierId], ...nextState.barcodes],
      }));
      setActiveTab(tierId);
    });
  }

  async function downloadPackage() {
    if (activeBarcodes.length === 0) return;
    setDownloadError("");
    setDownloading(true);
    try {
      const response = await fetch("/api/admin/barcodes/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId: activeTab,
          barcodes: activeBarcodes.map((item) => item.barcode),
        }),
      });
      if (!response.ok) throw new Error("DOWNLOAD_FAILED");

      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `PFC26-${activePackage.price}-barcodes.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("ดาวน์โหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setDownloading(false);
    }
  }

  function resetBarcodes() {
    if (activeBarcodes.length === 0) return;
    if (!window.confirm(`ลบบาร์โค้ดทั้งหมดในแพ็กเกจ ฿${activePackage.price.toLocaleString("th-TH")} และเริ่มลำดับใหม่ที่ 0001 ใช่หรือไม่?\n\nรายการที่ถูกใช้งานแล้วจะไม่ถูกลบ`)) return;

    startTransition(async () => {
      const result = await resetSeasonPassBarcodes(activeTab);
      if (!result.ok) {
        setState({ ok: false, message: result.message, barcodes: [] });
        return;
      }
      setBarcodesByTier((current) => ({ ...current, [activeTab]: [] }));
      setState({ ok: true, message: `ลบแล้ว ${result.deleted.toLocaleString("th-TH")} ใบ — ครั้งถัดไปจะเริ่มที่ 0001`, barcodes: [] });
    });
  }

  function deleteBarcodes(items: BarcodeItem[]) {
    if (items.length === 0) return;
    const description = items.length === 1
      ? `ลบบาร์โค้ด ${items[0].barcode} ใช่หรือไม่?`
      : `ลบบาร์โค้ด ${items.length.toLocaleString("th-TH")} ใบในแพ็กเกจ ฿${activePackage.price.toLocaleString("th-TH")} ใช่หรือไม่?`;
    if (!window.confirm(description)) return;

    startTransition(async () => {
      const result = await deleteSeasonPassBarcodes(items.map((item) => item.barcode));
      if (!result.ok) {
        setState({ ok: false, message: result.message, barcodes: [] });
        return;
      }
      const deletedCodes = new Set(items.map((item) => item.barcode));
      setBarcodesByTier((current) => ({
        ...current,
        [activeTab]: current[activeTab].filter((item) => !deletedCodes.has(item.barcode)),
      }));
      setState({ ok: true, message: `ลบบาร์โค้ด ${result.deleted.toLocaleString("th-TH")} ใบแล้ว`, barcodes: [] });
    });
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-green-900">สร้างบาร์โค้ด</h1>
        <p className="mt-1 text-sm text-slate-600">
          เลือกแพ็กเกจและจำนวนที่ต้องการสร้าง ระบบจะรันเลขต่อจากลำดับล่าสุดของแพ็กเกจนั้น
        </p>
      </div>

      <form action={submit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <fieldset>
          <legend className="text-sm font-semibold text-slate-800">เลือกแพ็กเกจ</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {packages.map((item) => (
              <label
                key={item.id}
                className="cursor-pointer rounded-lg border border-slate-200 p-3 transition has-[:checked]:border-green-600 has-[:checked]:bg-green-50"
              >
                <input
                  type="radio"
                  name="tierId"
                  value={item.id}
                  checked={selectedTier === item.id}
                  onChange={() => setSelectedTier(item.id)}
                  className="accent-green-700"
                />
                <span className="ml-2 text-sm font-bold text-green-900">฿{item.price.toLocaleString("th-TH")}</span>
                <span className="mt-1 block text-xs text-slate-600">{item.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 max-w-xs">
          <label htmlFor="quantity" className="block text-sm font-semibold text-slate-800">
            จำนวนบาร์โค้ด
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min="1"
            max="500"
            defaultValue="1"
            required
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
          />
          <p className="mt-1 text-xs text-slate-500">สร้างได้ครั้งละ 1–500 ใบ</p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-5 rounded-lg bg-green-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {pending ? "กำลังสร้าง..." : "สร้างบาร์โค้ด"}
        </button>
      </form>

      {state.message && (
        <p
          aria-live="polite"
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}
        >
          {state.message}
        </p>
      )}

      <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold text-green-900">รายการบาร์โค้ดที่สร้าง</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetBarcodes}
              disabled={activeBarcodes.length === 0 || pending}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              ลบทั้งหมดในแท็บ
            </button>
            <button
              type="button"
              onClick={downloadPackage}
              disabled={activeBarcodes.length === 0 || downloading}
              className="rounded-lg bg-green-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {downloading ? "กำลังรวมไฟล์..." : `ดาวน์โหลดทั้งหมด ฿${activePackage.price.toLocaleString("th-TH")}`}
            </button>
          </div>
        </div>
        <div className="flex overflow-x-auto border-b border-slate-200 px-3">
          {packages.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === item.id ? "border-green-700 text-green-800" : "border-transparent text-slate-500 hover:text-green-800"}`}
            >
              ฿{item.price.toLocaleString("th-TH")}
              {barcodesByTier[item.id].length > 0 && ` (${barcodesByTier[item.id].length})`}
            </button>
          ))}
        </div>
        {activeBarcodes.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            ยังไม่มีบาร์โค้ดที่สร้างในแพ็กเกจ ฿{activePackage.price.toLocaleString("th-TH")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3">ลำดับที่</th>
                  <th className="px-4 py-3">รหัสบาร์โค้ด</th>
                  <th className="px-4 py-3">บาร์โค้ด</th>
                  <th className="px-4 py-3">ดาวน์โหลด</th>
                  <th className="px-4 py-3">ลบ</th>
                </tr>
              </thead>
              <tbody>
                {activeBarcodes.map((item) => {
                  const barcodeUrl = `/api/season-passes/${encodeURIComponent(item.barcode)}/barcode`;
                  return (
                    <tr key={item.barcode} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-700">{item.sequence.toLocaleString("th-TH")}</td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-green-900">{item.barcode}</td>
                      <td className="px-4 py-3">
                        {/* SVG is generated by the existing season-pass barcode endpoint. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={barcodeUrl} alt={`บาร์โค้ด ${item.barcode}`} className="h-14 min-w-52 bg-white" />
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={barcodeUrl}
                          download={`${item.barcode}.svg`}
                          className="text-sm font-semibold text-green-800 hover:underline"
                        >
                          SVG
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => deleteBarcodes([item])}
                          disabled={pending}
                          className="text-sm font-semibold text-red-700 hover:underline disabled:text-slate-400"
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {downloadError && <p className="px-5 pb-4 text-sm text-red-700">{downloadError}</p>}
      </section>
    </div>
  );
}
