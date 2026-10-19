import type { KakaoPlace } from "./kakao";

/** "use server" 파일은 async 함수만 내보낼 수 있어 상수를 여기 둔다. */
export type PlaceSearchState =
  | { status: "idle" }
  | { status: "ok"; term: string; places: KakaoPlace[] }
  | { status: "error"; term: string; error: string; needsSetup: boolean };

export const PLACE_SEARCH_IDLE: PlaceSearchState = { status: "idle" };
