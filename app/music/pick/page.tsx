import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TrackSearch } from "@/components/music/track-search";

export const metadata: Metadata = { title: "곡 고르기" };

export default async function PickMusicPage({
  searchParams,
}: {
  searchParams: Promise<{ daily?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // /music 의 "오늘의 곡 고르기" 버튼에서 넘어오면 체크를 기본으로 켜 둔다.
  const { daily } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <nav className="text-sm">
        <Link href="/music" className="text-ink-muted hover:text-ink">
          ← 음악
        </Link>
      </nav>

      <header>
        <h1 className="text-xl font-semibold tracking-tight">곡 고르기</h1>
        <p className="mt-1 text-sm text-ink-muted">
          검색해서 고르면 앨범 이미지와 30초 미리듣기가 같이 저장돼요.
        </p>
      </header>

      <TrackSearch defaultAsDailyPick={daily === "1"} />
    </div>
  );
}
