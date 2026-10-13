"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type DealerPin = {
  id: string;
  nomCommercial: string;
  wilayaLabel: string;
  latitude: number;
  longitude: number;
  listingCount: number;
  badgeVerifie: boolean;
};

type Props = {
  dealers: DealerPin[];
  locale: string;
};

type LeafletMap = {
  remove(): void;
  setView(center: [number, number], zoom: number): LeafletMap;
};

type LeafletMarker = {
  addTo(map: LeafletMap): LeafletMarker;
  bindPopup(content: string): LeafletMarker;
};

type LeafletDivIcon = unknown;

type LeafletStatic = {
  map(el: HTMLElement, opts: { center: [number, number]; zoom: number; scrollWheelZoom: boolean }): LeafletMap;
  tileLayer(url: string, opts: { attribution: string; maxZoom: number }): { addTo(map: LeafletMap): void };
  marker(latlng: [number, number], opts?: { icon?: LeafletDivIcon }): LeafletMarker;
  divIcon(opts: { className: string; html: string; iconSize: [number, number]; iconAnchor: [number, number] }): LeafletDivIcon;
};

declare global {
  interface Window {
    L?: LeafletStatic;
  }
}

const LEAFLET_CSS =
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
const LEAFLET_JS =
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";

const ALGERIA_CENTER: [number, number] = [28.0, 3.0];
const ALGERIA_ZOOM = 5;

export function DealerMap({ dealers, locale }: Props) {
  const t = useTranslations("ProDirectory");
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<LeafletMap | null>(null);
  const [ready, setReady] = useState(() => typeof window !== "undefined" && !!window.L);

  useEffect(() => {
    if (ready) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.onload = () => setReady(true);
    document.head.appendChild(script);

    return () => {
      link.remove();
      script.remove();
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.L) return;

    const L = window.L;

    if (leafletMap.current) {
      leafletMap.current.remove();
    }

    const map = L.map(mapRef.current, {
      center: ALGERIA_CENTER,
      zoom: ALGERIA_ZOOM,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    const grouped = new Map<string, DealerPin[]>();
    for (const d of dealers) {
      const key = `${d.latitude},${d.longitude}`;
      const list = grouped.get(key) ?? [];
      list.push(d);
      grouped.set(key, list);
    }

    for (const [, group] of grouped) {
      const { latitude, longitude } = group[0];
      const lines = group.map((d) => {
        const badge = d.badgeVerifie ? " ✓" : "";
        const href = `/${locale}/pro/${d.id}`;
        return `<a href="${href}" style="color:#047857;font-weight:500;text-decoration:none">${d.nomCommercial}${badge}</a> <span style="color:#64748b;font-size:12px">(${d.listingCount})</span>`;
      });
      const header = `<strong style="font-size:13px">${group[0].wilayaLabel}</strong>`;
      const popup = `<div style="max-height:200px;overflow-y:auto;line-height:1.6">${header}<br>${lines.join("<br>")}</div>`;

      const count = group.length;
      const icon = L.divIcon({
        className: "dealer-cluster-icon",
        html: `<div style="background:#059669;color:#fff;width:${count > 9 ? 32 : 28}px;height:${count > 9 ? 32 : 28}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${count > 9 ? 11 : 13}px;font-weight:600;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)">${count}</div>`,
        iconSize: [count > 9 ? 32 : 28, count > 9 ? 32 : 28],
        iconAnchor: [count > 9 ? 16 : 14, count > 9 ? 16 : 14],
      });

      L.marker([latitude, longitude], { icon }).addTo(map).bindPopup(popup);
    }

    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, [ready, dealers, locale]);

  return (
    <div className="relative">
      {!ready && (
        <div className="flex h-[500px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("mapLoading")}</p>
        </div>
      )}
      <div
        ref={mapRef}
        className="h-[500px] rounded-lg border border-slate-200 dark:border-slate-700"
        style={{ display: ready ? "block" : "none" }}
      />
    </div>
  );
}
