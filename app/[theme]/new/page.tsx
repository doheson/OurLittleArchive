import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getBothUsers, getCurrentUser } from "@/lib/auth";
import { themeBySlug } from "@/lib/themes";
import { EntryForm } from "@/components/entry-form";

type Params = { theme: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const theme = themeBySlug((await params).theme);
  return { title: theme ? `${theme.label} 기록 남기기` : "없는 테마" };
}

export default async function NewEntryPage({ params }: { params: Promise<Params> }) {
  const theme = themeBySlug((await params).theme);
  if (!theme) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const people = await getBothUsers();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{theme.label} 기록 남기기</h1>
        <p className="mt-1 text-sm text-ink-muted">{theme.tagline}</p>
      </header>

      <EntryForm theme={theme} people={people} />
    </div>
  );
}
