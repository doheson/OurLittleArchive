/**
 * 카카오맵 JavaScript SDK 로더.
 *
 * 지도 SDK 는 REST 키가 아니라 JavaScript 키를 쓴다. 키를 바꿔 넣으면 그냥 안 뜬다.
 * 그리고 콘솔의 [플랫폼] > [Web] 에 도메인(개발 중이면 http://localhost:3000)을
 * 등록해야 동작한다.
 *
 * 탭을 옮길 때마다 스크립트를 다시 넣지 않도록 약속(Promise)을 모듈에 들고 있는다.
 */

type KakaoLatLng = { __latlng: never };
type KakaoBounds = { extend: (latlng: KakaoLatLng) => void };

type KakaoMap = {
  setBounds: (bounds: KakaoBounds) => void;
  setCenter: (latlng: KakaoLatLng) => void;
  setLevel: (level: number) => void;
  relayout: () => void;
};

type KakaoMarker = { setMap: (map: KakaoMap | null) => void };
type KakaoInfoWindow = {
  open: (map: KakaoMap, marker: KakaoMarker) => void;
  close: () => void;
};

export type KakaoMapsApi = {
  load: (callback: () => void) => void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoBounds;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMap;
  Marker: new (options: { position: KakaoLatLng; title?: string }) => KakaoMarker;
  InfoWindow: new (options: { content: string; removable?: boolean }) => KakaoInfoWindow;
  event: {
    addListener: (target: unknown, type: string, handler: () => void) => void;
  };
};

declare global {
  interface Window {
    kakao?: { maps?: KakaoMapsApi };
  }
}

export type { KakaoMap, KakaoMarker, KakaoInfoWindow };

const SDK_ID = "kakao-maps-sdk";
let loading: Promise<KakaoMapsApi> | null = null;

export function loadKakaoMaps(appKey: string): Promise<KakaoMapsApi> {
  if (loading) return loading;

  loading = new Promise<KakaoMapsApi>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("브라우저에서만 불러올 수 있다."));
      return;
    }

    // 이미 들어와 있으면 그대로 쓴다.
    const existing = window.kakao?.maps;
    if (existing) {
      existing.load(() => resolve(existing));
      return;
    }

    const onReady = () => {
      const api = window.kakao?.maps;
      if (!api) {
        reject(new Error("지도 SDK 를 불러오지 못했다."));
        return;
      }
      // autoload=false 로 받았으므로 여기서 직접 준비시킨다.
      api.load(() => resolve(api));
    };

    const already = document.getElementById(SDK_ID) as HTMLScriptElement | null;
    if (already) {
      already.addEventListener("load", onReady, { once: true });
      already.addEventListener(
        "error",
        () => reject(new Error("지도 SDK 를 불러오지 못했다.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SDK_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      appKey,
    )}&autoload=false`;
    script.addEventListener("load", onReady, { once: true });
    script.addEventListener(
      "error",
      () => {
        // 다음 시도에서 다시 받을 수 있도록 약속을 비운다.
        loading = null;
        reject(new Error("지도 SDK 를 불러오지 못했다. 도메인이 등록됐는지 확인한다."));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  return loading;
}
