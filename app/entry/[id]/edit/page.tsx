import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getBothUsers, getCurrentUser } from "@/lib/auth";
import { getEntry } from "@/lib/entries";
import { THEMES } from "@/lib/themes";
import { toDateInput } from "@/lib/date";
import { EntryForm } from "@/components/entry-form";

type Params = { id: string };

export const metadata: Metadata = { title: "기록 고치기" };

export default async function EditEntryPage({ params }: { params: Promise<Params> }) {
  const entry = await getEntry((await params).id);
  if (!entry) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const people = await getBothUsers();
  const theme = THEMES[entry.theme];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">기록 고치기</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {theme.label} · {entry.title}
        </p>
      </header>

      <EntryForm
        theme={theme}
        people={people}
        defaults={{
          id: entry.id,
          status: entry.status,
          subCategory: entry.subCategory,
          title: entry.title,
          subtitle: entry.subtitle,
          note: entry.note,
          coverImageUrl: entry.coverImageUrl,
          experiencedOn: toDateInput(entry.experiencedOn),
          locationName: entry.locationName,
          address: entry.address,
          meta: entry.meta,
          participantIds: entry.participations.map((p) => p.userId),
        }}
      />
    </div>
  );
}
