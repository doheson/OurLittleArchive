"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { savePlace, searchPlacesAction } from "@/app/actions/places";
import { ACTION_IDLE } from "@/lib/action-result";
import { PLACE_SEARCH_IDLE, type PlaceSearchState } from "@/lib/places/search-state";
import type { KakaoPlace } from "@/lib/places/kakao";
import { SubmitButton } from "@/components/submit-button";

const DEBOUNCE_MS = 400;

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

/** 화면에서는 세 가지 중 하나만 고르면 된다. status/subCategory 변환은 서버가 한다. */
const BUCKET_OPTIONS = [
  ["DATE", "데이트"],
  ["TRAVEL", "여행"],
  ["WISH", "가보고 싶은 곳"],
] as const;

export function PlaceSearch({ defaultBucket }: { defaultBucket: string }) {
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState<PlaceSearchState>(PLACE_SEARCH_IDLE);
  const [isSearching, startSearch] = useTransition();
  const [picked, setPicked] = useState<KakaoPlace | null>(null);

  const tooShort = term.trim().length < 2;
  const shown: PlaceSearchState = tooShort ? PLACE_SEARCH_IDLE : search;

  useEffect(() => {
    if (tooShort) return;

    const timer = setTimeout(() => {
      startSearch(async () => {
        setSearch(await searchPlacesAction(term));
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term, tooShort]);

  if (picked) {
    return (
      <PickedPlaceForm
        place={picked}
        defaultBucket={defaultBucket}
        onBack={() => setPicked(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-muted">장소 검색</span>
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="가게 이름이나 동네 (예: 성수동 카페)"
          autoFocus
          className={fieldClass}
        />
      </label>

      {isSearching && <p className="text-sm text-ink-muted">찾는 중…</p>}

      {shown.status === "error" &&
        (shown.needsSetup ? (
          <KakaoMapSetupNotice message={shown.error} />
        ) : (
          <p className="text-sm text-accent">{shown.error}</p>
        ))}

      {shown.status === "ok" && shown.places.length === 0 && (
        <p className="text-sm text-ink-muted">결과가 없다. 동네 이름을 같이 넣어보자.</p>
      )}

      {shown.status === "ok" && shown.places.length > 0 && (
        <ul className="space-y-2">
          {shown.places.map((place) => (
            <li
              key={place.placeId}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{place.name}</p>
                {place.category && (
                  <p className="text-xs text-ink-muted">{place.category}</p>
                )}
                <p className="truncate text-sm text-ink-muted">
                  {place.roadAddress ?? place.address ?? ""}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPicked(place)}
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

/** 키는 있는데 앱에서 카카오맵이 꺼져 있는 경우가 가장 흔하다. */
function KakaoMapSetupNotice({ message }: { message: string }) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-muted p-4 text-sm">
      <p className="font-medium">{message}</p>
      <ol className="list-decimal space-y-1 pl-5 text-ink-muted">
        <li>
          <a
            href="https://developers.kakao.com/console/app"
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent hover:underline"
          >
            내 애플리케이션
          </a>{" "}
          에서 앱을 연다
        </li>
        <li>
          좌측 <span className="text-ink">카카오맵 &gt; 사용 설정</span> 에서 상태를{" "}
          <span className="text-ink">ON</span> 으로 바꾼다
        </li>
        <li>개발 서버를 다시 시작할 필요는 없다. 바로 다시 검색하면 된다</li>
      </ol>
      <p className="text-ink-muted">
        무료 쿼터는 계정에서 처음 카카오맵을 켠 앱에만 주어진다.
      </p>
    </div>
  );
}

function PickedPlaceForm({
  place,
  defaultBucket,
  onBack,
}: {
  place: KakaoPlace;
  defaultBucket: string;
  onBack: () => void;
}) {
  const [state, formAction] = useActionState(savePlace, ACTION_IDLE);
  const [bucket, setBucket] = useState(
    BUCKET_OPTIONS.some(([value]) => value === defaultBucket) ? defaultBucket : "DATE",
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="placeId" value={place.placeId} />
      <input type="hidden" name="name" value={place.name} />
      <input type="hidden" name="category" value={place.category ?? ""} />
      <input type="hidden" name="address" value={place.address ?? ""} />
      <input type="hidden" name="roadAddress" value={place.roadAddress ?? ""} />
      <input type="hidden" name="phone" value={place.phone ?? ""} />
      <input type="hidden" name="lat" value={place.lat} />
      <input type="hidden" name="lng" value={place.lng} />
      <input type="hidden" name="placeUrl" value={place.placeUrl ?? ""} />

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="font-medium">{place.name}</p>
        {place.category && <p className="text-sm text-ink-muted">{place.category}</p>}
        <p className="text-sm text-ink-muted">{place.roadAddress ?? place.address}</p>
        {place.placeUrl && (
          <a
            href={place.placeUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-block text-sm text-accent hover:underline"
          >
            카카오맵에서 보기 ↗
          </a>
        )}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-muted">어디에 넣을지</legend>
        <div className="flex gap-2">
          {BUCKET_OPTIONS.map(([value, label]) => (
            <label
              key={value}
              className="flex-1 cursor-pointer rounded-lg border border-border px-3 py-2 text-center text-sm has-checked:border-accent has-checked:bg-accent-soft"
            >
              <input
                type="radio"
                name="bucket"
                value={value}
                checked={bucket === value}
                onChange={() => setBucket(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* 아직 안 간 곳에 날짜를 묻는 건 말이 안 된다. */}
      {bucket !== "WISH" && (
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink-muted">다녀온 날</span>
          <input type="date" name="experiencedOn" className={fieldClass} />
        </label>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-muted">메모</span>
        <textarea
          name="note"
          rows={2}
          maxLength={5000}
          placeholder={bucket === "WISH" ? "왜 가보고 싶은지" : "어땠는지"}
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
