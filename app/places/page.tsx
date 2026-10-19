import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { countPlaceBuckets, listEntries } from "@/lib/entries";
import { THEMES } from "@/lib/themes";
import { EntryCard } from "@/components/entry-card";
import type { MapPin } from "@/components/places/place-map";
import { PlaceMapToggle } from "@/components/places/place-map-toggle";

export const metadata: Metadata = { title: "공간" };

const THEME = THEMES.PLACE;

/**
 * 공간은 "데이트 갔던 곳 / 여행지 / 가보고 싶은 곳" 세 갈래로 본다.
 * DB 에서는 status 와 subCategory 두 칸이지만 화면에서는 탭 하나로 묶는다.
 */
const BUCKETS = [
  { key: "DATE", label: "데이트" },
  { key: "TRAVEL", label: "여행" },
  { key: "WISH", label: "가보고 싶은 곳" },
] as const;

type BucketKey = (typeof BUCKETS)[number]["key"];

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string }>;
}) {
  const query = await searchParams;
  const bucket: BucketKey = BUCKETS.some((item) => item.key === query.bucket)
    ? (query.bucket as BucketKey)
    : "DATE";

  const [user, counts, entries] = await Promise.all([
    getCurrentUser(),
    countPlaceBuckets(),
    listEntries(
      bucket === "WISH"
        ? { theme: "PLACE", status: "WISHLIST" }
        : { theme: "PLACE", status: "DONE", subCategory: bucket },
    ),
  ]);

  // 좌표가 있는 장소만 지도를 펼 수 있다. 직접 입력한 장소는 좌표가 없을 수 있다.
  const pinFor = (entry: (typeof entries)[number]): MapPin | null =>
    entry.lat != null && entry.lng != null
      ? { id: entry.id, name: entry.title, lat: entry.lat, lng: entry.lng }
      : null;

  const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY?.trim() || null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">공간</h1>
          <p className="mt-1 text-sm text-ink-muted">{THEME.tagline}</p>
        </div>
        {user && (
          <Link
            href={`/places/pick?bucket=${bucket}`}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            장소 추가
          </Link>
        )}
      </header>

      <nav className="flex flex-wrap gap-2">
        {BUCKETS.map((item) => (
          <Link
            key={item.key}
            href={item.key === "DATE" ? "/places" : `/places?bucket=${item.key}`}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              bucket === item.key
                ? "bg-accent text-white"
                : "border border-border text-ink-muted hover:text-ink"
            }`}
          >
            {item.label}
            <span className="ml-1.5 tabular-nums opacity-70">{counts[item.key]}</span>
          </Link>
        ))}
      </nav>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
          아직 없어요.
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => {
            const pin = pinFor(entry);
            return (
              <li key={entry.id}>
                <EntryCard entry={entry} />
                {pin && <PlaceMapToggle pin={pin} appKey={jsKey} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
