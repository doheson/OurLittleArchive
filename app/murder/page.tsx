import type { Metadata } from "next";
import Link from "next/link";
import { getBothUsers, getCurrentUser } from "@/lib/auth";
import { formatKoreanDate } from "@/lib/date";
import { countByStatus, listEntries } from "@/lib/entries";
import { THEMES } from "@/lib/themes";
import { EntryCard } from "@/components/entry-card";
import { PlayedBoard, type PlayedColumn } from "@/components/collections/played-board";

export const metadata: Metadata = { title: "머더미스터리" };

const THEME = THEMES.MURDER_MYSTERY;

/**
 * 머더미스터리는 보드게임의 한 종류다. 서로 밀담을 나누며 진범을 찾아간다.
 * "각자 해본 것" 이 주인공이라 전용 화면을 쓴다.
 * 한쪽만 해본 작품이 많아서 사람별로 칸을 나눠 보여주고,
 * 같이 하고 싶은 목록은 아래에 따로 둔다.
 */
export default async function MurderPage() {
  const [user, people, played, wishlist, counts] = await Promise.all([
    getCurrentUser(),
    getBothUsers(),
    listEntries({ theme: "MURDER_MYSTERY", status: "DONE" }),
    listEntries({ theme: "MURDER_MYSTERY", status: "WISHLIST" }),
    countByStatus("MURDER_MYSTERY"),
  ]);

  const columns: PlayedColumn[] = people.map((person) => ({
    userId: person.id,
    displayName: person.displayName,
    items: played
      .filter((entry) => entry.participations.some((row) => row.userId === person.id))
      .map((entry) => ({
        entryId: entry.id,
        title: entry.title,
        subtitle: entry.subtitle,
        role: entry.participations.find((row) => row.userId === person.id)?.role ?? null,
        score: entry.ratings.find((row) => row.userId === person.id)?.score ?? null,
        playedOn: formatKoreanDate(entry.experiencedOn),
        together: entry.participations.length > 1,
      })),
  }));

  // 아무도 참여자로 기록되지 않은 작품은 어느 칸에도 안 들어간다. 따로 보여준다.
  const unassigned = played.filter((entry) => entry.participations.length === 0);

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">머더미스터리</h1>
          <p className="mt-1 text-sm text-ink-muted">{THEME.tagline}</p>
        </div>
        {user && (
          <Link
            href="/murder/new"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            작품 추가
          </Link>
        )}
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">
          각자 해본 작품
          <span className="ml-1.5 tabular-nums opacity-70">{counts.DONE}</span>
        </h2>
        <PlayedBoard
          columns={columns}
          emptyHint="작품 상세에서 '나도 해봤음' 을 누르면 여기에 쌓인다."
        />

        {unassigned.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-ink-muted">
              누가 했는지 아직 표시하지 않은 작품
            </p>
            <ul className="space-y-2">
              {unassigned.map((entry) => (
                <li key={entry.id}>
                  <EntryCard entry={entry} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-muted">
          {THEME.statusLabels.WISHLIST}
          <span className="ml-1.5 tabular-nums opacity-70">{counts.WISHLIST}</span>
        </h2>

        {wishlist.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            아직 없다.
          </p>
        ) : (
          <ul className="space-y-2">
            {wishlist.map((entry) => (
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
