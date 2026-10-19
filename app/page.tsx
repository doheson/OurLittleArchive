import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { formatKoreanDate } from "@/lib/date";
import {
  countAllThemes,
  getDailyPick,
  listRecentEntries,
  listUpcoming,
} from "@/lib/entries";
import { THEME_LIST } from "@/lib/themes";
import { EntryCard } from "@/components/entry-card";
import { TodayCard, TodayEmpty } from "@/components/home/today-card";

/**
 * 홈.
 *
 * 읽히는 순서를 "오늘 → 최근 → 앞으로 → 테마" 로 잡았다.
 * 이 사이트는 함께한 것과 앞으로 할 것을 같이 모아두는 곳이라,
 * 지나간 기록만 쌓이지 않도록 앞으로 할 것들도 첫 화면에 둔다.
 */
export default async function HomePage() {
  const [user, todaysSong, todaysBook, recent, upcoming, counts] = await Promise.all([
    getCurrentUser(),
    getDailyPick("MUSIC", new Date()),
    getDailyPick("BOOK", new Date()),
    listRecentEntries(6),
    listUpcoming(5),
    countAllThemes(),
  ]);

  const totalDone = Object.values(counts).reduce((sum, row) => sum + row.DONE, 0);
  const totalWish = Object.values(counts).reduce((sum, row) => sum + row.WISHLIST, 0);
  const isEmpty = totalDone + totalWish === 0;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">OurLittleArchive</h1>
        <p className="mt-1 text-ink-muted">
          둘이 함께한 것들과, 앞으로 같이 할 것들을 모아두는 곳.
        </p>
        {!isEmpty && (
          <p className="mt-2 text-sm text-ink-muted">
            지금까지 <span className="text-ink tabular-nums">{totalDone}</span>개를 함께했고,{" "}
            <span className="text-ink tabular-nums">{totalWish}</span>개가 기다리고 있어요.
          </p>
        )}
      </header>

      {/* 오늘 */}
      <section className="grid gap-4 sm:grid-cols-2">
        {todaysSong ? (
          <TodayCard
            label="오늘의 곡"
            href={`/entry/${todaysSong.entry.id}`}
            title={todaysSong.entry.title}
            subtitle={todaysSong.entry.subtitle}
            coverImageUrl={todaysSong.entry.coverImageUrl}
            comment={todaysSong.comment}
            picker={todaysSong.pickedBy.displayName}
            pickedOn={formatKoreanDate(todaysSong.pickedOn)}
            pickedVerb="고름"
            previewUrl={
              typeof todaysSong.entry.meta.previewUrl === "string"
                ? todaysSong.entry.meta.previewUrl
                : null
            }
          />
        ) : (
          <TodayEmpty
            label="오늘의 곡"
            message="오늘 고른 곡이 아직 없어요."
            actionHref="/music/pick?daily=1"
            actionLabel="곡 고르러 가기"
            canAct={Boolean(user)}
          />
        )}

        {todaysBook ? (
          <TodayCard
            label="추천 코너"
            href={`/entry/${todaysBook.entry.id}`}
            title={todaysBook.entry.title}
            subtitle={todaysBook.entry.subtitle}
            coverImageUrl={todaysBook.entry.coverImageUrl}
            comment={todaysBook.comment}
            picker={todaysBook.pickedBy.displayName}
            pickedOn={formatKoreanDate(todaysBook.pickedOn)}
            pickedVerb="추천"
            previewUrl={null}
            coverShape="book"
          />
        ) : (
          <TodayEmpty
            label="추천 코너"
            message="추천한 책이 아직 없어요."
            actionHref="/books/pick?recommend=1"
            actionLabel="책 추천하러 가기"
            canAct={Boolean(user)}
          />
        )}
      </section>

      {/* 최근 기록 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">최근 기록</h2>
        {recent.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            {user
              ? "아직 아무것도 없어요. 아래에서 테마를 고르고 첫 기록을 남겨 보세요."
              : "아직 아무것도 없어요."}
          </p>
        ) : (
          <ul className="space-y-2">
            {recent.map((entry) => (
              <li key={entry.id}>
                <EntryCard entry={entry} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 앞으로 할 것들 */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-muted">앞으로 할 것들</h2>
          <ul className="space-y-2">
            {upcoming.map((entry) => (
              <li key={entry.id}>
                <EntryCard entry={entry} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 테마별 현황 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">테마</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {THEME_LIST.map((theme) => {
            const count = counts[theme.key];
            return (
              <li key={theme.key}>
                <Link
                  href={`/${theme.slug}`}
                  className="block card-interactive rounded-xl p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{theme.label}</span>
                    <span className="text-xs text-ink-muted tabular-nums">
                      {count.DONE > 0 && `${theme.statusLabels.DONE} ${count.DONE}`}
                      {count.DONE > 0 && count.WISHLIST > 0 && " · "}
                      {count.WISHLIST > 0 &&
                        `${theme.statusLabels.WISHLIST} ${count.WISHLIST}`}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-muted">{theme.tagline}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
