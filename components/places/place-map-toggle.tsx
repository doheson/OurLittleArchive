"use client";

import { useState } from "react";
import { PlaceMap, type MapPin } from "./place-map";

/**
 * 장소 하나의 지도를 눌렀을 때만 띄운다.
 *
 * 목록에 들어오자마자 지도를 그리면 SDK 를 받고 타일을 불러오느라
 * 화면 전체가 늦게 뜬다. 보고 싶은 곳만 펴보는 편이 빠르다.
 */
export function PlaceMapToggle({
  pin,
  appKey,
}: {
  pin: MapPin;
  appKey: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="text-sm text-ink-muted transition-colors hover:text-accent"
      >
        {open ? "지도 접기" : "지도 보기"}
      </button>

      {open && (
        <div className="mt-2">
          <PlaceMap pins={[pin]} appKey={appKey} />
        </div>
      )}
    </div>
  );
}
