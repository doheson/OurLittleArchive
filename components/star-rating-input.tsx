"use client";

import { useActionState, useRef, useState } from "react";
import { setRating } from "@/app/actions/entries";
import { ACTION_IDLE } from "@/lib/action-result";

/**
 * 내 평점을 매긴다. 별 하나를 좌/우 두 칸으로 나눠 0.5 단위로 받는다.
 * 화면을 키우지 않고도 터치로 반 개를 고를 수 있게 각 반쪽이 따로 버튼이다.
 */
export function StarRatingInput({
  entryId,
  initialScore,
}: {
  entryId: string;
  initialScore: number | null;
}) {
  const [state, formAction] = useActionState(setRating, ACTION_IDLE);
  const [score, setScore] = useState<number | null>(initialScore);
  const [hover, setHover] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const scoreRef = useRef<HTMLInputElement>(null);

  const shown = hover ?? score;

  function choose(value: number) {
    setScore(value);
    if (scoreRef.current) scoreRef.current.value = String(value);
    // 별을 누르면 바로 저장한다. 따로 저장 버튼을 두지 않는다.
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="entryId" value={entryId} />
      <input ref={scoreRef} type="hidden" name="score" defaultValue={score ?? ""} />

      <div
        className="inline-flex text-xl leading-none"
        onMouseLeave={() => setHover(null)}
        role="group"
        aria-label="내 평점"
      >
        {[1, 2, 3, 4, 5].map((index) => {
          const fill = Math.max(0, Math.min(1, (shown ?? 0) - (index - 1))) * 100;
          return (
            <span key={index} className="relative inline-block">
              <span className="text-border">★</span>
              <span
                className="pointer-events-none absolute inset-0 overflow-hidden text-accent"
                style={{ width: `${fill}%` }}
                aria-hidden="true"
              >
                ★
              </span>

              {/* 왼쪽 반 = x.5, 오른쪽 반 = x.0 */}
              {[index - 0.5, index].map((value, half) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => choose(value)}
                  onMouseEnter={() => setHover(value)}
                  className="absolute top-0 bottom-0 w-1/2 cursor-pointer"
                  style={{ left: half === 0 ? 0 : "50%" }}
                  aria-label={`${value}점`}
                />
              ))}
            </span>
          );
        })}
      </div>

      <span className="text-sm tabular-nums text-ink-muted">
        {score == null ? "눌러서 평점 주기" : `${score.toFixed(1)}점`}
      </span>

      {!state.ok && <span className="text-sm text-accent">{state.error}</span>}
    </form>
  );
}
