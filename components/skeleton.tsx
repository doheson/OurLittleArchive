/**
 * 화면이 오는 동안 자리를 잡아두는 뼈대.
 *
 * 이 사이트는 모든 화면이 동적이라 탭을 누르면 서버 렌더를 기다려야 한다.
 * 그 사이 아무것도 안 보이면 멈춘 것처럼 느껴지므로, 올 내용의 모양을 미리 그린다.
 */
export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-muted ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="card flex gap-3 rounded-xl p-3">
      <SkeletonLine className="size-20 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2 py-1">
        <SkeletonLine className="h-4 w-1/2" />
        <SkeletonLine className="h-3 w-1/3" />
        <SkeletonLine className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <ul className="space-y-2">
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <SkeletonCard />
        </li>
      ))}
    </ul>
  );
}
