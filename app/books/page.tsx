import type { Metadata } from "next";
import Link from "next/link";
import { getBothUsers, getCurrentUser } from "@/lib/auth";
import { formatKoreanDate } from "@/lib/date";
import { countByStatus, getDailyPick, listEntries, type EntryView } from "@/lib/entries";
import { ENTRY_STATUSES, THEMES, type EntryStatus } from "@/lib/themes";
import { EntryCard } from "@/components/entry-card";
import { BookCard, type BookCardData } from "@/components/books/book-card";

export const metadata: Metadata = { title: "독서" };

const THEME = THEMES.BOOK;

/** EntryView 를 독서 카드가 쓰는 모양으로 바꾼다. 두 사람 줄을 항상 만든다. */
function toBookCard(
  entry: EntryView,
  people: { id: string; displayName: string }[],
): BookCardData {
  return {
    id: entry.id,
    title: entry.title,
    subtitle: entry.subtitle,
    coverImageUrl: entry.coverImageUrl,
    publisher: typeof entry.meta.publisher === "string" ? entry.meta.publisher : null,
    readers: people.map((person) => {
      const review = entry.reviews.find((row) => row.userId === person.id);
      return {
        id: person.id,
        displayName: person.displayName,
        hasRead: entry.participations.some((row) => row.userId === person.id),
        score: entry.ratings.find((row) => row.userId === person.id)?.score ?? null,
        review: review ? { body: review.body, isSpoiler: review.isSpoiler } : null,
      };
    }),
  };
}

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const query = await searchParams;
  const status: EntryStatus = ENTRY_STATUSES.includes(query.status as EntryStatus)
    ? (query.status as EntryStatus)
    : "DONE";

  const [user, people, recommended, counts, entries] = await Promise.all([
    getCurrentUser(),
    getBothUsers(),
    getDailyPick("BOOK", new Date()),
    countByStatus("BOOK"),
    listEntries({ theme: "BOOK", status }),
  ]);

  const peopleLite = people.map((person) => ({
    id: person.id,
    displayName: person.displayName,
  }));

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">독서</h1>
          <p className="mt-1 text-sm text-ink-muted">{THEME.tagline}</p>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <Link
              href="/books/pick?recommend=1"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              책 추천하기
            </Link>
            <Link
              href="/books/pick"
              className="text-sm text-ink-muted transition-colors hover:text-ink"
            >
              그냥 등록
            </Link>
          </div>
        )}
      </header>

      {/* 추천 코너 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">추천 코너</h2>

        {recommended ? (
          <div className="flex gap-4 card rounded-2xl p-5">
            {recommended.entry.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={recommended.entry.coverImageUrl}
                alt=""
                className="h-40 w-28 shrink-0 rounded bg-surface-muted object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <Link href={`/entry/${recommended.entry.id}`}>
                <h3 className="text-lg font-semibold hover:text-accent">
                  {recommended.entry.title}
                </h3>
              </Link>
              {recommended.entry.subtitle && (
                <p className="text-sm text-ink-muted">{recommended.entry.subtitle}</p>
              )}

              {recommended.comment && (
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {recommended.comment}
                </p>
              )}

              <p className="mt-2 text-xs text-ink-muted">
                {recommended.pickedBy.displayName} 추천 ·{" "}
                {formatKoreanDate(recommended.pickedOn)}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-ink-muted">아직 추천한 책이 없다.</p>
            {user && (
              <Link
                href="/books/pick?recommend=1"
                className="mt-3 inline-block text-sm text-accent hover:underline"
              >
                책 추천하러 가기
              </Link>
            )}
          </div>
        )}
      </section>

      {/* 목록 */}
      <section className="space-y-4">
        <nav className="flex flex-wrap gap-2">
          {ENTRY_STATUSES.map((value) => (
            <Link
              key={value}
              href={value === "DONE" ? "/books" : `/books?status=${value}`}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                status === value
                  ? "bg-accent text-white"
                  : "border border-border text-ink-muted hover:text-ink"
              }`}
            >
              {THEME.statusLabels[value]}
              <span className="ml-1.5 tabular-nums opacity-70">{counts[value]}</span>
            </Link>
          ))}
        </nav>

        {entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            아직 없다.
          </p>
        ) : status === "DONE" ? (
          // 읽은 책은 두 사람의 평점과 감상평을 나란히 보여준다.
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id}>
                <BookCard
                  book={toBookCard(entry, peopleLite)}
                  currentUserId={user?.id ?? null}
                />
              </li>
            ))}
          </ul>
        ) : (
          // 읽고 싶은 책은 아직 감상평이 있을 수 없으니 공통 카드로 충분하다.
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id}>
                <EntryCard entry={entry} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
