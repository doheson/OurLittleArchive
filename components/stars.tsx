/** 점수를 별로 보여주기만 한다. 서버 컴포넌트에서도 쓸 수 있다. */
export function Stars({ score, size = "md" }: { score: number | null; size?: "sm" | "md" }) {
  const textSize = size === "sm" ? "text-sm" : "text-base";

  if (score == null) {
    return <span className={`${textSize} text-ink-muted`}>아직 평점 없음</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1 ${textSize}`}>
      <span className="inline-flex leading-none" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((index) => {
          // 이 별이 채워질 비율. 3.5점이면 네 번째 별이 50% 찬다.
          const fill = Math.max(0, Math.min(1, score - (index - 1))) * 100;
          return (
            <span key={index} className="relative inline-block">
              <span className="text-border">★</span>
              <span
                className="absolute inset-0 overflow-hidden text-accent"
                style={{ width: `${fill}%` }}
              >
                ★
              </span>
            </span>
          );
        })}
      </span>
      <span className="tabular-nums text-ink-muted">{score.toFixed(1)}</span>
      <span className="sr-only">5점 만점에 {score.toFixed(1)}점</span>
    </span>
  );
}
