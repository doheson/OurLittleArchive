import Link from "next/link";
import { PreviewPlayer } from "@/components/music/preview-player";

/**
 * 홈 위쪽의 "오늘" 칸.
 * 음악의 오늘의 곡과 독서의 추천 책이 같은 모양을 쓴다.
 */
export function TodayCard({
  label,
  href,
  title,
  subtitle,
  coverImageUrl,
  comment,
  byline,
  previewUrl,
  /** 커버 비율. 앨범은 정사각, 책은 세로로 길다. */
  coverShape = "square",
}: {
  label: string;
  href: string;
  title: string;
  subtitle: string | null;
  coverImageUrl: string | null;
  comment: string | null;
  byline: string;
  previewUrl: string | null;
  coverShape?: "square" | "book";
}) {
  const coverClass =
    coverShape === "square" ? "size-24 rounded-lg" : "h-32 w-22 rounded";

  return (
    <section className="flex gap-4 card rounded-2xl p-4">
      {coverImageUrl && (
        // 외부 CDN 주소라 일반 img 로 그린다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverImageUrl}
          alt=""
          className={`${coverClass} shrink-0 bg-surface-muted object-cover`}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-xs tracking-wide text-accent uppercase">{label}</p>

        <Link href={href} className="mt-0.5 block">
          <h3 className="truncate font-semibold hover:text-accent">{title}</h3>
        </Link>
        {subtitle && <p className="truncate text-sm text-ink-muted">{subtitle}</p>}

        {comment && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">
            {comment}
          </p>
        )}

        <p className="mt-auto pt-2 text-xs text-ink-muted">{byline}</p>

        {previewUrl && (
          <div className="mt-2">
            <PreviewPlayer src={previewUrl} label={title} size="sm" />
          </div>
        )}
      </div>

    </section>
  );
}

/** 오늘 아직 고르지 않았을 때 */
export function TodayEmpty({
  label,
  message,
  actionHref,
  actionLabel,
  canAct,
}: {
  label: string;
  message: string;
  actionHref: string;
  actionLabel: string;
  canAct: boolean;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-border p-6 text-center">
      <p className="text-xs tracking-wide text-ink-muted uppercase">{label}</p>
      <p className="mt-2 text-sm text-ink-muted">{message}</p>
      {canAct && (
        <Link
          href={actionHref}
          className="mt-3 inline-block text-sm text-accent hover:underline"
        >
          {actionLabel}
        </Link>
      )}
    </section>
  );
}
