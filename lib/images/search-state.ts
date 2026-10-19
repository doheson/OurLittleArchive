import type { CoverCandidate } from "./kakao";

/** "use server" 파일은 async 함수만 내보낼 수 있어 상수를 여기 둔다. */
export type CoverSearchState =
  | { status: "idle" }
  | { status: "ok"; term: string; covers: CoverCandidate[] }
  | { status: "error"; term: string; error: string; needsSetup: boolean };

export const COVER_SEARCH_IDLE: CoverSearchState = { status: "idle" };
