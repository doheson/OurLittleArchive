import type { ITunesTrack } from "./itunes";

/**
 * 검색 결과 상태.
 *
 * "use server" 파일은 async 함수만 내보낼 수 있어서 상수 SEARCH_IDLE 을 여기 둔다.
 * app/actions/result.ts 와 lib/action-result.ts 를 나눈 것과 같은 이유다.
 */
export type SearchState =
  | { status: "idle" }
  | { status: "ok"; term: string; tracks: ITunesTrack[] }
  | { status: "error"; term: string; error: string };

export const SEARCH_IDLE: SearchState = { status: "idle" };
