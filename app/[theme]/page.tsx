import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBothUsers, getCurrentUser } from "@/lib/auth";
import { countByStatus, listEntries } from "@/lib/entries";
import { ENTRY_STATUSES, themeBySlug, type EntryStatus } from "@/lib/themes";
import { EntryCard } from "@/components/entry-card";

type Params = { theme: string };
type Search = { status?: string; sub?: string; who?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const theme = themeBySlug((await params).theme);
  return { title: theme?.label ?? "없는 테마" };
}

/**
 * 테마 목록 화면. 테마 설정(lib/themes.ts)만 읽어 동작하므로
 * 여섯 테마가 이 한 파일을 공유한다.
 */
export default async function ThemePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const theme = themeBySlug((await params).theme);
  if (!theme) notFound();

  const query = await searchParams;
  const status: EntryStatus = ENTRY_STATUSES.includes(query.status as EntryStatus)
    ? (query.status as EntryStatus)
    : "DONE";

  const subCategory =
    theme.subCategories && query.sub && theme.subCategories.includes(query.sub)
      ? query.sub
      : undefined;

  const [user, people, counts] = await Promise.all([
    getCurrentUser(),
    getBothUsers(),
    countByStatus(theme.key),
  ]);

  const who = people.find((person) => person.slug === query.who);

  const entries = await listEntries({
    theme: theme.key,
    status,
    subCategory,
    participantId: who?.id,
  });

  const link = (next: Partial<Search>) => {
    const search = new URLSearchParams();
    const merged = { status, sub: subCategory, who: who?.slug, ...next };
    if (merged.status && merged.status !== "DONE") search.set("status", merged.status);
    if (merged.sub) search.set("sub", merged.sub);
    if (merged.who) search.set("who", merged.who);
    const qs = search.toString();
    return `/${theme.slug}${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{theme.label}</h1>
          <p className="mt-1 text-sm text-ink-muted">{theme.tagline}</p>
        </div>
        {user && (
          <Link
            href={`/${theme.slug}/new`}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            기록 남기기
          </Link>
        )}
      </header>

      {/* 했음 / 하고싶음 */}
      <nav className="flex flex-wrap gap-2">
        {ENTRY_STATUSES.map((value) => (
          <Link
            key={value}
            href={link({ status: value })}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              status === value
                ? "bg-accent text-white"
                : "border border-border text-ink-muted hover:text-ink"
            }`}
          >
            {theme.statusLabels[value]}
            <span className="ml-1.5 tabular-nums opacity-70">{counts[value]}</span>
          </Link>
        ))}
      </nav>

      {/* 공간 테마의 데이트 / 여행 */}
      {theme.subCategories && (
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href={link({ sub: undefined })}
            className={subCategory ? "text-ink-muted hover:text-ink" : "font-medium text-accent"}
          >
            전체
          </Link>
          {theme.subCategories.map((value) => (
            <Link
              key={value}
              href={link({ sub: value })}
              className={
                subCategory === value ? "font-medium text-accent" : "text-ink-muted hover:text-ink"
              }
            >
              {theme.subCategoryLabels?.[value] ?? value}
            </Link>
          ))}
        </nav>
      )}

      {/* 각자 기록을 구분하는 테마에서만 보여준다 */}
      {theme.tracksPerPerson && (
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href={link({ who: undefined })}
            className={who ? "text-ink-muted hover:text-ink" : "font-medium text-accent"}
          >
            둘 다
          </Link>
          {people.map((person) => (
            <Link
              key={person.id}
              href={link({ who: person.slug })}
              className={
                who?.id === person.id
                  ? "font-medium text-accent"
                  : "text-ink-muted hover:text-ink"
              }
            >
              {person.displayName}
            </Link>
          ))}
        </nav>
      )}

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
          아직 없다.
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
    </div>
  );
}
