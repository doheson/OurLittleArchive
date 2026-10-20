"use client";

import { useState } from "react";

/**
 * 폼 안에서 쓰는 별점 입력이에요.
 *
 * 상세 화면의 StarRatingInput 은 누르는 즉시 서버로 보내지만,
 * 이건 폼과 함께 제출돼요. 그래서 값만 hidden 으로 들고 있어요.
 * 별 하나를 좌/우로 나눠 0.5 단위로 받는 건 같아요.
 */
export function StarInput({
  name,
  defaultValue = null,
  label,
}: {
  name: string;
  defaultValue?: number | null;
  label: string;
}) {
  const [score, setScore] = useState<number | null>(defaultValue);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? score;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input type="hidden" name={name} value={score ?? ""} />

      <div
        className="inline-flex text-2xl leading-none"
        onMouseLeave={() => setHover(null)}
        role="group"
        aria-label={label}
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

              {[index - 0.5, index].map((value, half) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScore(value)}
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

      <span className="text-sm text-ink-muted">
        {score == null ? "눌러서 평점 주기" : `${score.toFixed(1)}점`}
      </span>

      {score != null && (
        <button
          type="button"
          onClick={() => setScore(null)}
          className="text-sm text-ink-muted hover:text-ink"
        >
          지우기
        </button>
      )}
    </div>
  );
}
