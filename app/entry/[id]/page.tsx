import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEntry, toggleFavorite } from "@/app/actions/entries";
import { promoteToTodaysPick } from "@/app/actions/music";
import { recommendBook } from "@/app/actions/books";
import { markPlaceVisited } from "@/app/actions/places";
import { getBothUsers, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntry } from "@/lib/entries";
import { isPhotoUploadAvailable } from "@/lib/storage";
import { THEME_META_FIELDS } from "@/lib/theme-fields";
import { THEMES } from "@/lib/themes";
import { formatKoreanDate } from "@/lib/date";
import { MusicPanel } from "@/components/music/music-panel";
import { ParticipationPanel } from "@/components/collections/participation-panel";
import { PhotoManager } from "@/components/photo-manager";
import { RatingPanel } from "@/components/rating-panel";
import { ReviewPanel } from "@/components/review-panel";
import { SubmitButton } from "@/components/submit-button";

type Params = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const entry = await getEntry((await params).id);
  return { title: entry?.title ?? "없는 기록" };
}

/** meta 값을 사람이 읽을 수 있는 문자열로. 필드 타입은 theme-fields 가 알고 있다. */
function displayMetaValue(value: unknown): string {
  if (value === true) return "예";
  if (value === false) return "아니오";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export default async function EntryPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const entry = await getEntry(id);
  if (!entry) notFound();

  const theme = THEMES[entry.theme];
  const [user, people] = await Promise.all([getCurrentUser(), getBothUsers()]);

  const myFavorite = user
    ? await prisma.favorite.findUnique({
        where: { userId_entryId: { userId: user.id, entryId: entry.id } },
        select: { rank: true },
      })
    : null;

  const date = formatKoreanDate(entry.experiencedOn);
  // 듣기 영역에서 플레이어로 보여주는 링크는 정보 표에 또 적지 않는다.
  const handledByPlayer = new Set(
    theme.key === "MUSIC" ? ["spotifyUrl", "youtubeUrl"] : [],
  );
  const metaRows = THEME_META_FIELDS[theme.key]
    .filter((field) => !handledByPlayer.has(field.name))
    .map((field) => ({ label: field.label, value: entry.meta[field.name] }))
    .filter((row) => row.value !== undefined && row.value !== null && row.value !== "");

  const isUploadedCover = entry.coverImageUrl?.startsWith("/api/photos/") ?? false;

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href={`/${theme.slug}`} className="text-ink-muted hover:text-ink">
          ← {theme.label}
        </Link>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row">
        {entry.coverImageUrl && (
          <div className="relative h-40 w-30 shrink-0 overflow-hidden rounded-xl bg-surface-muted">
            {isUploadedCover ? (
              <Image
                src={entry.coverImageUrl}
                alt=""
                fill
                sizes="120px"
                className="object-cover"
              />
            ) : (
              // 손으로 붙여넣은 임의 주소도 받으므로 일반 img 로 그린다.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={entry.coverImageUrl}
                alt=""
                className="size-full object-cover"
              />
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">
              {theme.statusLabels[entry.status]}
            </span>
            {entry.subCategory && theme.subCategoryLabels?.[entry.subCategory] && (
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">
                {theme.subCategoryLabels[entry.subCategory]}
              </span>
            )}
            {myFavorite && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                내 베스트 {myFavorite.rank}위
              </span>
            )}
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{entry.title}</h1>
          {entry.subtitle && <p className="text-ink-muted">{entry.subtitle}</p>}

          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
            {date && <div>{date}</div>}
            {entry.locationName && <div>{entry.locationName}</div>}
            {entry.participations.length > 0 && (
              <div>{entry.participations.map((p) => p.user.displayName).join(" · ")}</div>
            )}
          </dl>

          {user && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href={`/entry/${entry.id}/edit`}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
              >
                고치기
              </Link>

              {theme.key === "MUSIC" && (
                <form action={promoteToTodaysPick}>
                  <input type="hidden" name="entryId" value={entry.id} />
                  <SubmitButton variant="subtle" className="px-3 py-1.5">
                    오늘의 추천으로
                  </SubmitButton>
                </form>
              )}

              {theme.key === "BOOK" && (
                <form action={recommendBook}>
                  <input type="hidden" name="entryId" value={entry.id} />
                  <SubmitButton variant="subtle" className="px-3 py-1.5">
                    추천 코너에 올리기
                  </SubmitButton>
                </form>
              )}

              {theme.key === "PLACE" && entry.status === "WISHLIST" && (
                <>
                  {([
                    ["DATE", "데이트로 다녀옴"],
                    ["TRAVEL", "여행으로 다녀옴"],
                  ] as const).map(([value, label]) => (
                    <form key={value} action={markPlaceVisited}>
                      <input type="hidden" name="entryId" value={entry.id} />
                      <input type="hidden" name="bucket" value={value} />
                      <SubmitButton variant="subtle" className="px-3 py-1.5">
                        {label}
                      </SubmitButton>
                    </form>
                  ))}
                </>
              )}

              {theme.hasFavorite && (
                <form action={toggleFavorite}>
                  <input type="hidden" name="entryId" value={entry.id} />
                  <SubmitButton variant="subtle" className="px-3 py-1.5">
                    {myFavorite ? "베스트에서 빼기" : "내 베스트에 넣기"}
                  </SubmitButton>
                </form>
              )}

              <form action={deleteEntry}>
                <input type="hidden" name="entryId" value={entry.id} />
                <SubmitButton variant="danger" className="px-3 py-1.5">
                  지우기
                </SubmitButton>
              </form>
            </div>
          )}
        </div>
      </header>

      {metaRows.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-muted">{theme.label} 정보</h2>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {metaRows.map((row) => (
              <div key={row.label} className="flex justify-between gap-3 text-sm">
                <dt className="text-ink-muted">{row.label}</dt>
                <dd className="text-right">{displayMetaValue(row.value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {entry.note && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink-muted">메모</h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.note}</p>
        </section>
      )}

      {theme.key === "MUSIC" && <MusicPanel title={entry.title} meta={entry.meta} />}

      {theme.tracksPerPerson && (
        <ParticipationPanel
          entryId={entry.id}
          participants={people.map((person) => {
            const row = entry.participations.find((p) => p.userId === person.id);
            return {
              userId: person.id,
              displayName: person.displayName,
              joined: Boolean(row),
              role: row?.role ?? null,
            };
          })}
          currentUserId={user?.id ?? null}
          tracksRole={theme.tracksRole}
          roleLabel="맡은 캐릭터"
          joinLabel={theme.key === "BOOK" ? "다 읽었음" : "나도 해봤음"}
          leaveLabel={theme.key === "BOOK" ? "안 읽은 걸로" : "기록에서 빼기"}
        />
      )}

      {theme.hasRating && (
        <RatingPanel
          entryId={entry.id}
          users={people}
          ratings={entry.ratings.map((r) => ({ userId: r.userId, score: r.score }))}
          currentUserId={user?.id ?? null}
        />
      )}

      {theme.hasReview && (
        <ReviewPanel
          entryId={entry.id}
          authors={people.map((p) => ({ id: p.id, displayName: p.displayName }))}
          reviews={entry.reviews.map((review) => ({
            id: review.id,
            userId: review.userId,
            body: review.body,
            isSpoiler: review.isSpoiler,
            updatedAt: review.updatedAt.toISOString(),
          }))}
          currentUserId={user?.id ?? null}
          defaultSpoiler={theme.spoilerSensitive}
        />
      )}

      {theme.hasPhotos && (isPhotoUploadAvailable() || entry.photos.length > 0) && (
        <PhotoManager
          entryId={entry.id}
          photos={entry.photos.map((photo) => ({
            id: photo.id,
            url: photo.url,
            width: photo.width,
            height: photo.height,
            caption: photo.caption,
          }))}
          canEdit={Boolean(user) && isPhotoUploadAvailable()}
        />
      )}
    </div>
  );
}
