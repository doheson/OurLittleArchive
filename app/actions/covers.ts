"use server";

import { CoverSearchError, searchCovers } from "@/lib/images/kakao";
import { COVER_SEARCH_IDLE, type CoverSearchState } from "@/lib/images/search-state";

/**
 * 커버 이미지 후보를 찾는다.
 * 보드게임·머더미스터리·방탈출처럼 커버를 줄 공개 API 가 없는 테마에서 쓴다.
 */
export async function searchCoverImages(rawTerm: string): Promise<CoverSearchState> {
  const term = rawTerm.trim();
  if (term.length < 2) return COVER_SEARCH_IDLE;

  try {
    const covers = await searchCovers(term);
    return { status: "ok", term, covers };
  } catch (error) {
    if (error instanceof CoverSearchError) {
      return { status: "error", term, error: error.message, needsSetup: error.needsSetup };
    }
    console.error("[searchCoverImages]", error);
    return { status: "error", term, error: "이미지 검색에 실패했다.", needsSetup: false };
  }
}
