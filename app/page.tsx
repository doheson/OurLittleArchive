import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listRecentEntries } from "@/lib/entries";
import { THEME_LIST } from "@/lib/themes";
import { EntryCard } from "@/components/entry-card";

export default async function HomePage() {
  const [user, recent] = await Promise.all([getCurrentUser(), listRecentEntries(8)]);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">OurLittleArchive</h1>
        <p className="mt-1 text-ink-muted">
          둘이 함께한 것들과, 앞으로 같이 할 것들을 모아두는 곳.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">테마</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {THEME_LIST.map((theme) => (
            <li key={theme.key}>
              <Link
                href={`/${theme.slug}`}
                className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent"
              >
                <span className="font-medium">{theme.label}</span>
                <p className="mt-0.5 text-sm text-ink-muted">{theme.tagline}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">최근 기록</h2>
        {recent.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-ink-muted">
            {user
              ? "아직 아무것도 없다. 위에서 테마를 고르고 첫 기록을 남겨보자."
              : "아직 아무것도 없다."}
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
    </div>
  );
}
