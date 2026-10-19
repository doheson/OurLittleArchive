"use client";

import { useEffect, useRef, useState } from "react";
import { loadKakaoMaps, type KakaoMap, type KakaoMarker } from "./kakao-maps-loader";

export type MapPin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

/**
 * 핀을 찍은 지도.
 *
 * 좌표가 있는 장소만 들어온다. 핀이 하나면 그 자리를 적당한 배율로 보여주고,
 * 여러 개면 전부 들어오도록 범위를 맞춘다.
 */
export function PlaceMap({ pins, appKey }: { pins: MapPin[]; appKey: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<KakaoMarker[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appKey || !containerRef.current || pins.length === 0) return;

    let cancelled = false;
    const container = containerRef.current;

    loadKakaoMaps(appKey)
      .then((maps) => {
        if (cancelled) return;

        if (!mapRef.current) {
          mapRef.current = new maps.Map(container, {
            center: new maps.LatLng(pins[0].lat, pins[0].lng),
            level: 5,
          });
        }
        const map = mapRef.current;

        // 탭을 바꾸면 핀이 통째로 달라지므로 이전 핀을 먼저 걷어낸다.
        for (const marker of markersRef.current) marker.setMap(null);
        markersRef.current = [];

        const bounds = new maps.LatLngBounds();
        const infoWindow = new maps.InfoWindow({ content: "", removable: true });

        for (const pin of pins) {
          const position = new maps.LatLng(pin.lat, pin.lng);
          const marker = new maps.Marker({ position, title: pin.name });
          marker.setMap(map);
          markersRef.current.push(marker);
          bounds.extend(position);

          maps.event.addListener(marker, "click", () => {
            // 장소 이름은 사용자 데이터라 HTML 로 넣기 전에 이스케이프한다.
            const safeName = pin.name.replace(
              /[&<>"']/g,
              (ch) =>
                ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!,
            );
            infoWindow.close();
            const bubble = new maps.InfoWindow({
              content: `<div style="padding:6px 10px;font-size:13px;white-space:nowrap">
                <a href="/entry/${pin.id}" style="color:#a3573b;text-decoration:none">${safeName}</a>
              </div>`,
              removable: true,
            });
            bubble.open(map, marker);
          });
        }

        if (pins.length === 1) {
          map.setCenter(new maps.LatLng(pins[0].lat, pins[0].lng));
          map.setLevel(4);
        } else {
          map.setBounds(bounds);
        }
        map.relayout();
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "지도를 불러오지 못했다.");
      });

    return () => {
      cancelled = true;
    };
  }, [pins, appKey]);

  if (!appKey) {
    return (
      <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm text-ink-muted">
        지도를 보려면 <code className="rounded bg-background px-1">NEXT_PUBLIC_KAKAO_JS_KEY</code>{" "}
        에 카카오 <span className="text-ink">JavaScript 키</span>를 넣고, 콘솔의 [플랫폼] &gt;
        [Web] 에 <code className="rounded bg-background px-1">http://localhost:3000</code> 을
        등록한다. REST 키와는 다른 키다.
      </div>
    );
  }

  if (pins.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-ink-muted">
        지도에 찍을 장소가 아직 없다.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="h-64 w-full overflow-hidden rounded-xl border border-border bg-surface-muted sm:h-80"
      />
      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}
