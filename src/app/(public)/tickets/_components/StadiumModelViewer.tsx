"use client";

import { createElement, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Box, Loader2, MousePointer2, Rotate3D } from "lucide-react";

type LoadState = "loading" | "ready" | "error";

export type StadiumModelZone = {
  code: string;
  label: string;
  priceLabel: string;
  availabilityLabel: string;
  details?: string[];
  note?: string;
};

type ModelMaterial = {
  name: string;
  pbrMetallicRoughness: {
    baseColorFactor: readonly [number, number, number, number];
    setBaseColorFactor: (factor: [number, number, number, number]) => void;
  };
};

type ModelViewerElement = HTMLElement & {
  loaded?: boolean;
  modelIsVisible?: boolean;
  model?: { materials: ModelMaterial[] };
  materialFromPoint: (clientX: number, clientY: number) => ModelMaterial | null;
};

const ZONE_MATERIAL_PATTERN = /^Zone_(.+)_(?:Deck|Seats)$/;

export default function StadiumModelViewer({
  title,
  description,
  loadingLabel,
  errorLabel,
  interactionLabel,
  labelModelSrc,
  poster,
  plainBackground = false,
  zones = [],
  zoneHintLabel,
}: {
  title: string;
  description: string;
  loadingLabel: string;
  errorLabel: string;
  interactionLabel: string;
  labelModelSrc: string;
  poster?: string;
  plainBackground?: boolean;
  zones?: StadiumModelZone[];
  zoneHintLabel?: string;
}) {
  const viewerRef = useRef<ModelViewerElement>(null);
  const zonesRef = useRef(zones);
  const zoneMaterialsRef = useRef(new Map<string, ModelMaterial[]>());
  const originalColorsRef = useRef(new Map<ModelMaterial, [number, number, number, number]>());
  const highlightedZoneRef = useRef<string | null>(null);
  const lastPointerPickAtRef = useRef(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [progress, setProgress] = useState(0);
  const [activeZoneCode, setActiveZoneCode] = useState<string | null>(null);
  const activeZone = zones.find((zone) => zone.code === activeZoneCode) ?? null;
  zonesRef.current = zones;

  useEffect(() => {
    let active = true;
    const viewer = viewerRef.current;
    if (!viewer) return;

    const setZoneEmphasis = (zoneCode: string | null) => {
      if (highlightedZoneRef.current === zoneCode) return;
      highlightedZoneRef.current = zoneCode;

      for (const [code, materials] of zoneMaterialsRef.current) {
        for (const material of materials) {
          const original = originalColorsRef.current.get(material);
          if (!original) continue;

          if (zoneCode == null || code === zoneCode) {
            material.pbrMetallicRoughness.setBaseColorFactor([...original]);
          } else {
            const luminance = original[0] * 0.2126 + original[1] * 0.7152 + original[2] * 0.0722;
            const muted = Math.min(0.72, 0.48 + luminance * 0.15);
            material.pbrMetallicRoughness.setBaseColorFactor([muted, muted, muted, original[3]]);
          }
        }
      }
      viewer.style.cursor = zoneCode == null ? "grab" : "pointer";
      setActiveZoneCode(zoneCode);
    };

    const prepareZoneMaterials = () => {
      zoneMaterialsRef.current.clear();
      originalColorsRef.current.clear();
      for (const material of viewer.model?.materials ?? []) {
        const match = material.name.match(ZONE_MATERIAL_PATTERN);
        if (!match) continue;
        const code = match[1];
        const materials = zoneMaterialsRef.current.get(code) ?? [];
        materials.push(material);
        zoneMaterialsRef.current.set(code, materials);
        originalColorsRef.current.set(material, [...material.pbrMetallicRoughness.baseColorFactor]);
      }
    };

    const onLoad = () => {
      prepareZoneMaterials();
      if (active) setLoadState("ready");
    };
    const onError = () => {
      if (active) setLoadState("error");
    };
    const onProgress = (event: Event) => {
      if (!active) return;
      const detail = (event as CustomEvent<{ totalProgress?: number }>).detail;
      if (typeof detail?.totalProgress === "number") {
        setProgress(Math.round(detail.totalProgress * 100));
      }
    };
    const zoneFromPoint = (clientX: number, clientY: number) => {
      if (!viewer.modelIsVisible || zonesRef.current.length === 0) return null;
      const material = viewer.materialFromPoint(clientX, clientY);
      const code = material?.name.match(ZONE_MATERIAL_PATTERN)?.[1] ?? null;
      return code && zonesRef.current.some((zone) => zone.code === code) ? code : null;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const now = performance.now();
      if (now - lastPointerPickAtRef.current < 40) return;
      lastPointerPickAtRef.current = now;
      setZoneEmphasis(zoneFromPoint(event.clientX, event.clientY));
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      setZoneEmphasis(zoneFromPoint(event.clientX, event.clientY));
    };
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") setZoneEmphasis(null);
    };

    viewer.addEventListener("load", onLoad);
    viewer.addEventListener("error", onError);
    viewer.addEventListener("progress", onProgress);
    viewer.addEventListener("pointermove", onPointerMove, { capture: true });
    viewer.addEventListener("pointerup", onPointerUp, { capture: true });
    viewer.addEventListener("pointerleave", onPointerLeave, { capture: true });

    void customElements.whenDefined("model-viewer").then(() => {
      if (active && (viewer as ModelViewerElement).loaded) {
        onLoad();
      }
    });

    return () => {
      active = false;
      viewer.removeEventListener("load", onLoad);
      viewer.removeEventListener("error", onError);
      viewer.removeEventListener("progress", onProgress);
      viewer.removeEventListener("pointermove", onPointerMove, { capture: true });
      viewer.removeEventListener("pointerup", onPointerUp, { capture: true });
      viewer.removeEventListener("pointerleave", onPointerLeave, { capture: true });
      for (const [material, original] of originalColorsRef.current) {
        material.pbrMetallicRoughness.setBaseColorFactor([...original]);
      }
      highlightedZoneRef.current = null;
      viewer.style.cursor = "";
    };
  }, []);

  return (
    <>
      <Script
        id="pattani-model-viewer"
        type="module"
        src="/vendor/model-viewer-4.3.1.min.js"
        strategy="afterInteractive"
        onError={() => setLoadState("error")}
      />
      <div
        className={
          plainBackground
            ? "bg-white"
            : "overflow-hidden rounded-3xl border border-green-200 bg-gradient-to-b from-green-950 via-green-900 to-green-950 shadow-xl"
        }
      >
      <div
        className={`flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-7 ${
          plainBackground ? "text-green-950" : "border-b border-white/10 text-white"
        }`}
      >
        <div>
          <p className={`inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] md:text-base ${plainBackground ? "text-yellow-600" : "text-yellow-300"}`}>
            <Box className="size-5" /> 3D Stadium
          </p>
          <h3 className="mt-1 text-2xl font-black md:text-3xl">{title}</h3>
          <p className={`mt-1 text-sm leading-relaxed md:text-base ${plainBackground ? "text-slate-600" : "text-white/70"}`}>{description}</p>
        </div>
        <div className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${plainBackground ? "bg-slate-100 text-slate-700" : "border border-white/15 bg-white/10 text-white/85"}`}>
          <Rotate3D className={`size-4 ${plainBackground ? "text-yellow-600" : "text-yellow-300"}`} />
          {interactionLabel}
        </div>
      </div>

      <div className={`relative h-[320px] w-full sm:h-[430px] lg:h-[560px] ${plainBackground ? "bg-white" : "bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.16),_transparent_65%)]"}`}>
        {createElement(
          "model-viewer",
          {
            ref: viewerRef,
            src: "/models/pattani-stadium.glb?v=20260808-3",
            poster,
            alt: title,
            "camera-controls": "",
            "auto-rotate": "",
            "auto-rotate-delay": "1200",
            "rotation-per-second": "8deg",
            // The GLB includes a 1,240 m ground plane around a ~232 m stadium.
            // Explicit framing keeps the stadium large enough to explore.
            "camera-target": "0m 5m 0m",
            "camera-orbit": "35deg 65deg 350m",
            // Keep the camera above the GLB ground plane (Y=0) so users cannot
            // rotate underneath the stadium or pan the model through the floor.
            "min-camera-orbit": plainBackground ? "auto 20deg 210m" : "auto auto 210m",
            "max-camera-orbit": plainBackground ? "auto 85deg 800m" : "auto auto 800m",
            "disable-pan": plainBackground ? "" : undefined,
            "field-of-view": "40deg",
            "shadow-intensity": "1",
            "shadow-softness": "0.8",
            "environment-image": "neutral",
            "tone-mapping": "neutral",
            "interaction-prompt": "auto",
            loading: "eager",
            reveal: "auto",
            "touch-action": "pan-y",
            className: "absolute inset-0 h-full w-full bg-transparent",
          },
          createElement("extra-model", { src: labelModelSrc }),
        )}

        {activeZone && loadState === "ready" && (
          <div
            aria-live="polite"
            className="pointer-events-none absolute left-4 top-4 z-10 max-w-[calc(100%-2rem)] rounded-2xl border border-green-200 bg-white/95 px-4 py-3 text-left shadow-xl backdrop-blur sm:left-6 sm:top-6 sm:max-w-sm sm:px-5 sm:py-4"
          >
            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-600 sm:text-sm">
              Zone {activeZone.code}
            </p>
            <h4 className="mt-1 text-lg font-black leading-tight text-green-950 sm:text-2xl">
              {activeZone.label}
            </h4>
            <p className="mt-2 text-xl font-black text-green-700 sm:text-3xl">
              {activeZone.priceLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-600 sm:text-base">
              {activeZone.availabilityLabel}
            </p>
            {activeZone.details && activeZone.details.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-green-100 pt-3 text-sm font-semibold text-slate-700 sm:text-base">
                {activeZone.details.map((detail) => (
                  <li key={detail} className="flex items-start gap-2">
                    <span className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-yellow-500" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            )}
            {activeZone.note && (
              <p className="mt-2 text-sm font-bold text-fuchsia-700 sm:text-base">{activeZone.note}</p>
            )}
          </div>
        )}

        {loadState !== "ready" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-4">
            <div
              role="status"
              className={`flex max-w-md items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg backdrop-blur md:text-base ${
                loadState === "error"
                  ? "border border-red-200 bg-red-50/95 text-red-800"
                  : "border border-white/20 bg-green-950/85 text-white"
              }`}
            >
              {loadState === "error" ? (
                <Box className="size-5 shrink-0" />
              ) : (
                <Loader2 className="size-5 shrink-0 animate-spin text-yellow-300" />
              )}
              <span>
                {loadState === "error"
                  ? errorLabel
                  : `${loadingLabel}${progress > 0 ? ` ${progress}%` : ""}`}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className={`flex items-center justify-center gap-2 px-5 py-3 text-center text-sm md:text-base ${plainBackground ? "text-slate-500" : "border-t border-white/10 bg-black/15 text-white/70"}`}>
        <MousePointer2 className={`size-4 shrink-0 ${plainBackground ? "text-yellow-600" : "text-yellow-300"}`} />
        {zones.length > 0 && zoneHintLabel ? zoneHintLabel : interactionLabel}
      </div>
      </div>
    </>
  );
}
