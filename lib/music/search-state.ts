import type { MusicTrack } from "./track";

/**
 * 검색 결과 상태.
 *
 * "use server" 파일은 async 함수만 내보낼 수 있어서 상수 SEARCH_IDLE 을 여기 둔다.
 * app/actions/result.ts 와 lib/action-result.ts 를 나눈 것과 같은 이유다.
 */
export type SearchState =
  | { status: "idle" }
  | { status: "ok"; term: string; tracks: MusicTrack[] }
  | { status: "error"; term: string; error: string };

export const SEARCH_IDLE: SearchState = { status: "idle" };

/** 붙여넣은 유튜브 링크를 읽어온 결과예요. */
export type LookupState =
  | { status: "idle" }
  | { status: "ok"; track: MusicTrack }
  | { status: "error"; error: string };

export const LOOKUP_IDLE: LookupState = { status: "idle" };
