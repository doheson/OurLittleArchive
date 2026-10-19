"use client";

import { useEffect, useState, useTransition } from "react";
import { searchCoverImages } from "@/app/actions/covers";
import { COVER_SEARCH_IDLE, type CoverSearchState } from "@/lib/images/search-state";

const DEBOUNCE_MS = 500;

/**
 * 커버 이미지를 검색해서 고른다.
 *
 * 보드게임이나 머더미스터리는 커버를 주는 공개 API 가 없다.
 * (보드라이프는 공개 API 가 없고, BoardGameGeek 은 등록과 승인이 필요하다.)
 * 그래서 카카오 이미지 검색을 쓰고, 다른 사이트에서 실제로 열리는 것만 보여준다.
 * 네이버 블로그 이미지처럼 막히는 주소는 서버에서 미리 걸러진다.
 */
export function CoverPicker({
  defaultTerm,
  onPick,
  onClose,
}: {
  defaultTerm: string;
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [term, setTerm] = useState(defaultTerm);
  const [search, setSearch] = useState<CoverSearchState>(COVER_SEARCH_IDLE);
  const [isSearching, startSearch] = useTransition();

  const tooShort = term.trim().length < 2;
  const shown: CoverSearchState = tooShort ? COVER_SEARCH_IDLE : search;

  useEffect(() => {
    if (tooShort) return;

    const timer = setTimeout(() => {
      startSearch(async () => {
        setSearch(await searchCoverImages(term));
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term, tooShort]);

  return (
    <div className="mt-2 space-y-3 card rounded-xl p-3">
      <div className="flex items-center gap-2">
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="예: 윙스팬 보드게임"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-sm text-ink-muted hover:text-ink"
        >
          닫기
        </button>
      </div>

      {isSearching && <p className="text-sm text-ink-muted">찾는 중…</p>}

      {shown.status === "error" && (
        <p className="text-sm text-accent">{shown.error}</p>
      )}

      {shown.status === "ok" && shown.covers.length === 0 && (
        <p className="text-sm text-ink-muted">
          쓸 만한 이미지가 없어요. 검색어를 바꾸거나 주소를 직접 넣어 보세요.
        </p>
      )}

      {shown.status === "ok" && shown.covers.length > 0 && (
        <>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {shown.covers.map((cover) => (
              <li key={cover.url}>
                <button
                  type="button"
                  onClick={() => onPick(cover.url)}
                  className="block w-full overflow-hidden rounded-lg border border-border transition-colors hover:border-accent"
                  title={`${cover.width}x${cover.height}`}
                >
                  {/* 검색 결과라 호스트가 제각각이다. next/image 는 호스트를 미리 등록해야 해서 일반 img 를 쓴다. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cover.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full bg-surface-muted object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted">
            웹에서 찾은 이미지예요. 누르면 주소가 채워져요.
          </p>
        </>
      )}
    </div>
  );
}
