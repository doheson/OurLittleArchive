"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { saveTrack, searchMusicTracks } from "@/app/actions/music";
import { SEARCH_IDLE, type SearchState } from "@/lib/music/search-state";
import { ACTION_IDLE } from "@/lib/action-result";
import type { ITunesTrack } from "@/lib/music/itunes";
import { SubmitButton } from "@/components/submit-button";
import { PreviewPlayer } from "./preview-player";

const DEBOUNCE_MS = 400;

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

/**
 * 곡을 검색해서 고른 뒤 저장한다.
 *
 * iTunes 는 한국 곡도 잘 찾지만 제목을 로마자로 돌려준다
 * (밤편지 → Through the Night). 그래서 저장 전에 제목을 고칠 수 있게 두었다.
 */
export function TrackSearch({ defaultAsDailyPick }: { defaultAsDailyPick: boolean }) {
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState<SearchState>(SEARCH_IDLE);
  const [isSearching, startSearch] = useTransition();
  const [picked, setPicked] = useState<ITunesTrack | null>(null);

  // 검색어가 짧을 때의 표시는 상태를 되돌리지 않고 렌더에서 파생시킨다.
  // effect 안에서 바로 setState 하면 불필요한 렌더가 연쇄된다.
  const tooShort = term.trim().length < 2;
  const shown: SearchState = tooShort ? SEARCH_IDLE : search;

  // 입력이 멈춘 뒤에만 부른다. iTunes 는 분당 20회 정도로 제한된다.
  useEffect(() => {
    if (tooShort) return;

    const timer = setTimeout(() => {
      startSearch(async () => {
        setSearch(await searchMusicTracks(term));
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term, tooShort]);

  if (picked) {
    return <PickedTrackForm
      track={picked}
      defaultAsDailyPick={defaultAsDailyPick}
      onBack={() => setPicked(null)}
    />;
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-muted">곡 검색</span>
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="노래 제목이나 가수 이름"
          autoFocus
          className={fieldClass}
        />
        <span className="mt-1 block text-xs text-ink-muted">
          한글로 검색해도 찾아준다. 다만 제목은 영어로 올 수 있어서, 고른 뒤 고칠 수 있다.
        </span>
      </label>

      {isSearching && <p className="text-sm text-ink-muted">찾는 중…</p>}

      {shown.status === "error" && <p className="text-sm text-accent">{shown.error}</p>}

      {shown.status === "ok" && shown.tracks.length === 0 && (
        <p className="text-sm text-ink-muted">결과가 없다. 가수 이름을 같이 넣어보자.</p>
      )}

      {shown.status === "ok" && shown.tracks.length > 0 && (
        <ul className="space-y-2">
          {shown.tracks.map((track) => (
            <li
              key={track.trackId}
              className="flex items-center gap-3 card rounded-xl p-3"
            >
              {/* iTunes CDN 이미지. 썸네일 한 장이라 일반 img 로 충분하다. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={track.artworkUrl ?? ""}
                alt=""
                loading="lazy"
                className="size-14 shrink-0 rounded-lg bg-surface-muted object-cover"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{track.title}</p>
                <p className="truncate text-sm text-ink-muted">{track.artist}</p>
                {track.album && (
                  <p className="truncate text-xs text-ink-muted">{track.album}</p>
                )}
              </div>

              {track.previewUrl && (
                <PreviewPlayer src={track.previewUrl} label={track.title} size="sm" />
              )}

              <button
                type="button"
                onClick={() => setPicked(track)}
                className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                고르기
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PickedTrackForm({
  track,
  defaultAsDailyPick,
  onBack,
}: {
  track: ITunesTrack;
  defaultAsDailyPick: boolean;
  onBack: () => void;
}) {
  const [state, formAction] = useActionState(saveTrack, ACTION_IDLE);

  return (
    <form action={formAction} className="space-y-5">
      {/* 검색 결과를 그대로 넘긴다. 제목만 아래에서 고칠 수 있다. */}
      <input type="hidden" name="trackId" value={track.trackId} />
      <input type="hidden" name="artist" value={track.artist} />
      <input type="hidden" name="album" value={track.album ?? ""} />
      <input type="hidden" name="artworkUrl" value={track.artworkUrl ?? ""} />
      <input type="hidden" name="previewUrl" value={track.previewUrl ?? ""} />
      <input type="hidden" name="appleUrl" value={track.appleUrl ?? ""} />
      <input type="hidden" name="genre" value={track.genre ?? ""} />
      <input type="hidden" name="releasedAt" value={track.releasedAt ?? ""} />

      <div className="flex items-center gap-4 card rounded-xl p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={track.artworkUrl ?? ""}
          alt=""
          className="size-24 shrink-0 rounded-lg bg-surface-muted object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{track.artist}</p>
          {track.album && <p className="text-sm text-ink-muted">{track.album}</p>}
          {track.previewUrl && (
            <div className="mt-2">
              <PreviewPlayer src={track.previewUrl} label={track.title} />
            </div>
          )}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-muted">제목</span>
        <input name="title" defaultValue={track.title} required maxLength={200} className={fieldClass} />
        <span className="mt-1 block text-xs text-ink-muted">
          한글 제목으로 바꿔 적어도 된다. 저장할 때 이 제목이 쓰인다.
        </span>
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-muted">상태</legend>
        <div className="flex gap-2">
          {([
            ["DONE", "추천한 곡"],
            ["WISHLIST", "들어볼 곡"],
          ] as const).map(([value, label], index) => (
            <label
              key={value}
              className="flex-1 cursor-pointer rounded-lg border border-border px-3 py-2 text-center text-sm has-checked:border-accent has-checked:bg-accent-soft"
            >
              <input
                type="radio"
                name="status"
                value={value}
                defaultChecked={index === 0}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="asDailyPick"
          defaultChecked={defaultAsDailyPick}
          className="size-4 accent-[var(--accent)]"
        />
        오늘의 추천 곡으로 올리기
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-muted">한마디</span>
        <textarea
          name="comment"
          rows={2}
          maxLength={500}
          placeholder="왜 이 곡인지"
          className={fieldClass}
        />
      </label>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="저장 중…">저장</SubmitButton>
        <button type="button" onClick={onBack} className="text-sm text-ink-muted hover:text-ink">
          다시 고르기
        </button>
        {!state.ok && <p className="text-sm text-accent">{state.error}</p>}
      </div>
    </form>
  );
}
