import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBothUsers, getCurrentUser } from "@/lib/auth";
import { isBookSearchConfigured } from "@/lib/books/kakao";
import { BookSearch } from "@/components/books/book-search";

export const metadata: Metadata = { title: "책 고르기" };

export default async function PickBookPage({
  searchParams,
}: {
  searchParams: Promise<{ recommend?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [people, { recommend }] = await Promise.all([getBothUsers(), searchParams]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <nav className="text-sm">
        <Link href="/books" className="text-ink-muted hover:text-ink">
          ← 독서
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">책 고르기</h1>
          <p className="mt-1 text-sm text-ink-muted">
            검색해서 고르면 표지와 저자 정보가 같이 저장돼요.
          </p>
        </div>
        <Link
          href="/books/new"
          className="text-sm text-ink-muted transition-colors hover:text-ink"
        >
          직접 입력
        </Link>
      </header>

      {!isBookSearchConfigured() && (
        <p className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm text-ink-muted">
          카카오 키가 아직 없어서 검색이 안 돼요. 검색창에 두 글자 이상 입력하면 발급 방법을 알려드려요.
        </p>
      )}

      <BookSearch
        people={people.map((person) => ({ id: person.id, displayName: person.displayName }))}
        defaultAsRecommendation={recommend === "1"}
        currentUserId={user.id}
      />
    </div>
  );
}
