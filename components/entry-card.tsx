import Image from "next/image";
import Link from "next/link";
import type { EntryView } from "@/lib/entries";
import { THEMES } from "@/lib/themes";
import { formatKoreanDate } from "@/lib/date";
import { Stars } from "./stars";

/** 우리 서버에 올린 사진인지. 그런 경우에만 next/image 로 최적화한다. */
function isUploaded(url: string): boolean {
  return url.startsWith("/api/photos/");
}

/** 목록에 쓰는 카드. 테마와 상관없이 같은 모양을 쓴다. */
export function EntryCard({ entry }: { entry: EntryView }) {
  const theme = THEMES[entry.theme];
  const cover = entry.coverImageUrl ?? entry.photos[0]?.url ?? null;
  const date = formatKoreanDate(entry.experiencedOn);
  const participants = entry.participations.map((p) => p.user.displayName);
  /*
    보드게임과 머더미스터리는 커버도 사진도 안 받아요.
    그래서 빈 네모만 남는데, 자리만 차지하고 알려주는 게 없어서 아예 안 그려요.
    커버를 쓰는 테마는 아직 안 고른 경우에도 네모를 남겨둬요. 나중에 채울 자리니까요.
  */
  const showCover = cover != null || theme.hasCover || theme.hasPhotos;

  return (
    <Link
      href={`/entry/${entry.id}`}
      className="group flex gap-3 card-interactive rounded-xl p-3"
    >
      {showCover && (
        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
          {!cover ? (
            <span className="flex size-full items-center justify-center text-xs text-ink-muted">
              {theme.label}
            </span>
          ) : isUploaded(cover) ? (
            <Image src={cover} alt="" fill sizes="80px" className="object-cover" />
          ) : (
            // 외부 커버는 손으로 붙여넣은 임의 주소일 수 있다. next/image 는 호스트를
            // 미리 등록해야 하므로, 여기서는 일반 img 로 그려 어떤 주소든 깨지지 않게 한다.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" loading="lazy" className="size-full object-cover" />
          )}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-medium group-hover:text-accent">{entry.title}</h3>
          {entry.status === "WISHLIST" && (
            <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">
              {theme.statusLabels.WISHLIST}
            </span>
          )}
        </div>

        {entry.subtitle && (
          <p className="truncate text-sm text-ink-muted">{entry.subtitle}</p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          {date && <span>{date}</span>}
          {entry.locationName && <span>{entry.locationName}</span>}
          {participants.length > 0 && <span>{participants.join(" · ")}</span>}
        </div>

        {entry.status === "DONE" && (
          <div className="mt-1">
            <Stars score={entry.averageScore} size="sm" />
          </div>
        )}
      </div>
    </Link>
  );
}
