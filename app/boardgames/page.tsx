import type { Metadata } from "next";
import Link from "next/link";
import { getBothUsers, getCurrentUser } from "@/lib/auth";
import { countByStatus, listEntries, listFavorites } from "@/lib/entries";
import { ENTRY_STATUSES, THEMES, type EntryStatus } from "@/lib/themes";
import { EntryCard } from "@/components/entry-card";
import {
  FavoriteBoard,
  type FavoriteColumn,
} from "@/components/collections/favorite-board";

export const metadata: Metadata = { title: "보드게임" };

const THEME = THEMES.BOARD_GAME;

/**
 * 보드게임은 "각자의 베스트" 가 주인공이라 전용 화면을 쓴다.
 * 베스트는 Favorite(테마별 rank)로, 앞으로 해볼 것들은 WISHLIST 로 관리한다.
 */
export default async function BoardGamesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const query = await searchParams;
  const status: EntryStatus = ENTRY_STATUSES.includes(query.status as EntryStatus)
    ? (query.status as EntryStatus)
    : "DONE";

  const [user, people, favorites, counts, entries] = await Promise.all([
    getCurrentUser(),
    getBothUsers(),
    listFavorites("BOARD_GAME"),
    countByStatus("BOARD_GAME"),
    listEntries({ theme: "BOARD_GAME", status }),
  ]);

  // 사람마다 한 칸씩. 아직 아무것도 안 고른 사람도 칸은 보여준다.
  const columns: FavoriteColumn[] = people.map((person) => ({
    userId: person.id,
    displayName: person.displayName,
    items: favorites
      .filter((favorite) => favorite.userId === person.id)
      .map((favorite) => ({
        entryId: favorite.entry.id,
        rank: favorite.rank,
        title: favorite.entry.title,
        subtitle: favorite.entry.subtitle,
        coverImageUrl: favorite.entry.coverImageUrl,
        myScore:
          favorite.entry.ratings.find((row) => row.userId === person.id)?.score ?? null,
      })),
  }));

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">보드게임</h1>
          <p className="mt-1 text-sm text-ink-muted">{THEME.tagline}</p>
        </div>
        {user && (
          <Link
            href="/boardgames/new"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            게임 추가
          </Link>
        )}
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">각자의 베스트</h2>
        <FavoriteBoard
          columns={columns}
          currentUserId={user?.id ?? null}
          emptyHint="게임 상세에서 ‘내 베스트에 넣기’를 누르면 여기에 쌓여요."
        />
      </section>

      <section className="space-y-4">
        <nav className="flex flex-wrap gap-2">
          {ENTRY_STATUSES.map((value) => (
            <Link
              key={value}
              href={value === "DONE" ? "/boardgames" : `/boardgames?status=${value}`}
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
            아직 없어요.
          </p>
        ) : (
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
