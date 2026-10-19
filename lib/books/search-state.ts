import type { KakaoBook } from "./kakao";

/**
 * 책 검색 결과 상태.
 * "use server" 파일은 async 함수만 내보낼 수 있어 상수를 여기 둔다.
 */
export type BookSearchState =
  | { status: "idle" }
  | { status: "ok"; term: string; books: KakaoBook[] }
  /** needsSetup 이면 화면이 키 발급 안내를 보여준다. */
  | { status: "error"; term: string; error: string; needsSetup: boolean };

export const BOOK_SEARCH_IDLE: BookSearchState = { status: "idle" };
