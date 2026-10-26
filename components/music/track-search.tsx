"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { lookupYouTubeTrack, saveTrack, searchMusicTracks } from "@/app/actions/music";
import {
  LOOKUP_IDLE,
  SEARCH_IDLE,
  type LookupState,
  type SearchState,
} from "@/lib/music/search-state";
import { ACTION_IDLE } from "@/lib/action-result";
import type { MusicTrack } from "@/lib/music/track";
import { SubmitButton } from "@/components/submit-button";

const DEBOUNCE_MS = 400;

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

type Mode = "search" | "link";

/**
 * 곡을 고르는 화면.
 *
 * 두 갈래로 들어와요.
 * - 검색: iTunes 로 찾아요. 빠르지만 검색 색인에 없는 곡이 가끔 있어요.
 * - 링크: 유튜브·유튜브뮤직 주소를 붙여넣으면 제목·가수·커버가 채워져요.
 *   검색으로 안 나오는 곡은 이쪽으로 넣으면 돼요.
 *
 * 어느 쪽으로 왔든 고른 뒤의 화면은 같아요.
 */
export function TrackSearch({ defaultAsDailyPick }: { defaultAsDailyPick: boolean }) {
  const [mode, setMode] = useState<Mode>("search");
  const [picked, setPicked] = useState<MusicTrack | null>(null);

  if (picked) {
    return (
      <PickedTrackForm
        track={picked}
        defaultAsDailyPick={defaultAsDailyPick}
        onBack={() => setPicked(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {(
          [
            ["search", "검색으로 찾기"],
            ["link", "유튜브 링크로 넣기"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm transition-colors ${
              mode === value
                ? "bg-accent text-white"
                : "border border-border text-ink-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "search" ? (
        <SearchPane onPick={setPicked} />
      ) : (
        <LinkPane onPick={setPicked} />
      )}
    </div>
  );
}

function SearchPane({ onPick }: { onPick: (track: MusicTrack) => void }) {
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState<SearchState>(SEARCH_IDLE);
  const [isSearching, startSearch] = useTransition();

  // 검색어가 짧을 때의 표시는 상태를 되돌리지 않고 렌더에서 파생시켜요.
  // effect 안에서 바로 setState 하면 불필요한 렌더가 연쇄돼요.
  const tooShort = term.trim().length < 2;
  const shown: SearchState = tooShort ? SEARCH_IDLE : search;

  // 입력이 멈춘 뒤에만 불러요. iTunes 는 분당 20회 정도로 제한돼요.
  useEffect(() => {
    if (tooShort) return;

    const timer = setTimeout(() => {
      startSearch(async () => {
        setSearch(await searchMusicTracks(term));
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term, tooShort]);

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
          한글로 검색해도 찾아줘요. 제목이 영어로 올 수 있어서, 고른 뒤에 고칠 수 있어요.
        </span>
      </label>

      {isSearching && <p className="text-sm text-ink-muted">찾는 중…</p>}

      {shown.status === "error" && <p className="text-sm text-accent">{shown.error}</p>}

      {shown.status === "ok" && shown.tracks.length === 0 && (
        <p className="text-sm text-ink-muted">
          결과가 없어요. 가수 이름을 같이 넣어 보거나, 위에서 ‘유튜브 링크로 넣기’ 를 써 보세요.
        </p>
      )}

      {shown.status === "ok" && shown.tracks.length > 0 && (
        <>
          {/* 몇 곡이 왔는지 보여줘요. 목록이 짧을 때 이유를 짐작할 수 있게요. */}
          <p className="text-xs text-ink-muted">
            {shown.tracks.length}곡 찾았어요
            {shown.tracks.length < 30 && " · 검색어를 줄이면 더 나와요"}
          </p>
        <ul className="space-y-2">
          {shown.tracks.map((track) => (
            <li
              key={track.trackId}
              className="flex items-center gap-3 card rounded-xl p-3"
            >
              {/* iTunes CDN 이미지. 썸네일 한 장이라 일반 img 로 충분해요. */}
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

              <button
                type="button"
                onClick={() => onPick(track)}
                className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                고르기
              </button>
            </li>
          ))}
        </ul>
        </>
      )}
    </div>
  );
}

function LinkPane({ onPick }: { onPick: (track: MusicTrack) => void }) {
  const [url, setUrl] = useState("");
  const [lookup, setLookup] = useState<LookupState>(LOOKUP_IDLE);
  const [isLoading, startLookup] = useTransition();

  function load() {
    if (!url.trim()) return;
    startLookup(async () => {
      const next = await lookupYouTubeTrack(url);
      setLookup(next);
      // 바로 고른 상태로 넘어가요. 한 곡뿐이라 고를 것이 없어요.
      if (next.status === "ok") onPick(next.track);
    });
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-muted">유튜브 링크</span>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                load();
              }
            }}
            placeholder="https://music.youtube.com/watch?v=..."
            autoFocus
            className={fieldClass}
          />
          <button
            type="button"
            onClick={load}
            disabled={isLoading || !url.trim()}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? "불러오는 중…" : "불러오기"}
          </button>
        </div>
        <span className="mt-1 block text-xs text-ink-muted">
          유튜브뮤직 앱에서 ‘공유 → 링크 복사’ 로 받은 주소가 제일 깔끔하게 들어와요.
          일반 유튜브 영상 주소도 돼요.
        </span>
      </label>

      {lookup.status === "error" && <p className="text-sm text-accent">{lookup.error}</p>}
    </div>
  );
}

function PickedTrackForm({
  track,
  defaultAsDailyPick,
  onBack,
}: {
  track: MusicTrack;
  defaultAsDailyPick: boolean;
  onBack: () => void;
}) {
  const [state, formAction] = useActionState(saveTrack, ACTION_IDLE);

  return (
    <form action={formAction} className="space-y-5">
      {/* 고른 곡을 그대로 넘겨요. 제목과 가수는 아래에서 고칠 수 있어요. */}
      <input type="hidden" name="source" value={track.source} />
      <input type="hidden" name="trackId" value={track.trackId} />
      <input type="hidden" name="album" value={track.album ?? ""} />
      <input type="hidden" name="artworkUrl" value={track.artworkUrl ?? ""} />
      <input type="hidden" name="appleUrl" value={track.appleUrl ?? ""} />
      <input type="hidden" name="youtubeUrl" value={track.youtubeUrl ?? ""} />
      <input type="hidden" name="genre" value={track.genre ?? ""} />
      <input type="hidden" name="releasedAt" value={track.releasedAt ?? ""} />

      <div className="flex items-center gap-4 card rounded-xl p-4">
        {/*
          유튜브 썸네일은 가로로 긴데 가운데가 앨범 아트예요.
          정사각 칸에 object-cover 로 그리면 가운데만 남아 앨범 아트 그대로 보여요.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={track.artworkUrl ?? ""}
          alt=""
          className="size-24 shrink-0 rounded-lg bg-surface-muted object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{track.title}</p>
          {track.album && <p className="truncate text-sm text-ink-muted">{track.album}</p>}
          <p className="mt-1 text-xs text-ink-muted">
            {track.source === "YOUTUBE" ? "유튜브에서 가져왔어요" : "iTunes 에서 가져왔어요"}
          </p>
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-muted">제목</span>
        <input name="title" defaultValue={track.title} required maxLength={200} className={fieldClass} />
        <span className="mt-1 block text-xs text-ink-muted">
          한글 제목으로 바꿔 적어도 돼요. 저장할 때 이 제목이 쓰여요.
        </span>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-muted">가수</span>
        <input name="artist" defaultValue={track.artist} required maxLength={200} className={fieldClass} />
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
