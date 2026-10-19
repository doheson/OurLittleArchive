import { SkeletonLine, SkeletonList } from "@/components/skeleton";

/**
 * 모든 화면의 기본 로딩 모양.
 *
 * 하위 경로에 loading.tsx 가 따로 없으면 이게 쓰인다.
 * 제목 줄과 목록만 그려두면 어느 탭으로 가도 크게 어색하지 않다.
 */
export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <SkeletonLine className="h-7 w-32" />
        <SkeletonLine className="h-4 w-56" />
      </div>

      <div className="flex gap-2">
        <SkeletonLine className="h-8 w-24 rounded-full" />
        <SkeletonLine className="h-8 w-24 rounded-full" />
      </div>

      <SkeletonList count={4} />

      <span className="sr-only">불러오는 중</span>
    </div>
  );
}
