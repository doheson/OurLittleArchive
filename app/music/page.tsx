import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { formatKoreanDate } from "@/lib/date";
import {
  countByStatus,
  getDailyPick,
  listEntries,
  listRecentDailyPicks,
} from "@/lib/entries";
import { ENTRY_STATUSES, THEMES, type EntryStatus } from "@/lib/themes";
import { EntryCard } from "@/components/entry-card";

export const metadata: Metadata = { title: "음악" };

const THEME = THEMES.MUSIC;

/**
 * 음악만 전용 화면을 쓴다.
 * 다른 테마는 app/[theme]/page.tsx 의 공통 목록을 그대로 쓰지만,
 * 음악은 "오늘의 한 곡" 이 주인공이라 레이아웃이 다르다.
 * 정적 경로가 동적 경로보다 우선하므로 /music 은 이 파일이 받는다.
 */
export default async function MusicPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const query = await searchParams;
  const status: EntryStatus = ENTRY_STATUSES.includes(query.status as EntryStatus)
    ? (query.status as EntryStatus)
    : "DONE";

  const [user, today, recentPicks, counts, entries] = await Promise.all([
    getCurrentUser(),
    getDailyPick("MUSIC", new Date()),
    listRecentDailyPicks("MUSIC", 8),
    countByStatus("MUSIC"),
    listEntries({ theme: "MUSIC", status }),
  ]);

  // 오늘 고른 건 위에 크게 나오므로 아래 줄에서는 뺀다.
  const pastPicks = recentPicks.filter((pick) => pick.id !== today?.id);

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">음악</h1>
          <p className="mt-1 text-sm text-ink-muted">{THEME.tagline}</p>
        </div>
        {user && (
          <Link
            href="/music/pick?daily=1"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            오늘의 곡 고르기
          </Link>
        )}
      </header>

      {/* 오늘의 한 곡 */}
      {today ? (
        <section className="card overflow-hidden rounded-2xl">
          <div className="flex flex-col gap-5 p-5 sm:flex-row">
            {today.entry.coverImageUrl && (
              // iTunes CDN 의 정사각 앨범 이미지
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={today.entry.coverImageUrl}
                alt=""
                className="aspect-square w-full shrink-0 rounded-xl bg-surface-muted object-cover sm:w-48"
              />
            )}

            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-xs tracking-wide text-accent uppercase">오늘의 곡</p>

              <Link href={`/entry/${today.entry.id}`} className="mt-1 block">
                <h2 className="text-xl font-semibold hover:text-accent">{today.entry.title}</h2>
              </Link>
              {today.entry.subtitle && (
                <p className="text-ink-muted">{today.entry.subtitle}</p>
              )}

              {today.entry.note && (
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {today.entry.note}
                </p>
              )}

              {/* 한마디를 쓴 사람과 대문에 올린 사람이 다를 수 있어요. */}
              <p className="mt-2 text-xs text-ink-muted">
                <span className="font-semibold text-ink">
                  {today.entry.createdBy.displayName}
                </span>{" "}
                고름
                {today.pickedBy.id !== today.entry.createdBy.id && (
                  <>
                    {" · "}
                    <span className="font-semibold text-ink">
                      {today.pickedBy.displayName}
                    </span>{" "}
                    올림
                  </>
                )}
                {" · "}
                {formatKoreanDate(today.pickedOn)}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-ink-muted">오늘 고른 곡이 아직 없어요.</p>
          {user && (
            <Link
              href="/music/pick?daily=1"
              className="mt-3 inline-block text-sm text-accent hover:underline"
            >
              오늘의 곡 고르러 가기
            </Link>
          )}
        </section>
      )}

      {/* 그동안 고른 곡 */}
      {pastPicks.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-muted">그동안 고른 곡</h2>
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {pastPicks.map((pick) => (
              <li key={pick.id} className="w-28 shrink-0">
                <Link href={`/entry/${pick.entry.id}`} className="group block">
                  {pick.entry.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pick.entry.coverImageUrl}
                      alt=""
                      loading="lazy"
                      className="aspect-square w-full rounded-lg bg-surface-muted object-cover"
                    />
                  ) : (
                    <div className="aspect-square w-full rounded-lg bg-surface-muted" />
                  )}
                  <p className="mt-1.5 truncate text-xs font-medium group-hover:text-accent">
                    {pick.entry.title}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {formatKoreanDate(pick.pickedOn)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 전체 목록 */}
      <section className="space-y-4">
        <nav className="flex flex-wrap gap-2">
          {ENTRY_STATUSES.map((value) => (
            <Link
              key={value}
              href={value === "DONE" ? "/music" : `/music?status=${value}`}
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
