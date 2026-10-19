import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PlaceSearch } from "@/components/places/place-search";

export const metadata: Metadata = { title: "장소 찾기" };

export default async function PickPlacePage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { bucket } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <nav className="text-sm">
        <Link href="/places" className="text-ink-muted hover:text-ink">
          ← 공간
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">장소 찾기</h1>
          <p className="mt-1 text-sm text-ink-muted">
            검색해서 고르면 주소와 좌표가 같이 저장돼서 지도에 표시돼요.
          </p>
        </div>
        <Link
          href="/places/new"
          className="text-sm text-ink-muted transition-colors hover:text-ink"
        >
          직접 입력
        </Link>
      </header>

      <PlaceSearch defaultBucket={bucket ?? "DATE"} />
    </div>
  );
}
