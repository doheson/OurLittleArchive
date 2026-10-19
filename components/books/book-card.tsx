"use client";

import Link from "next/link";
import { useState } from "react";
import { Stars } from "@/components/stars";

export type ReaderView = {
  id: string;
  displayName: string;
  hasRead: boolean;
  score: number | null;
  review: { body: string; isSpoiler: boolean } | null;
};

export type BookCardData = {
  id: string;
  title: string;
  subtitle: string | null;
  coverImageUrl: string | null;
  publisher: string | null;
  readers: ReaderView[];
};

/**
 * 독서 목록의 카드.
 *
 * 공통 EntryCard 와 달리 두 사람의 평점과 감상평을 나란히 보여준다.
 * "읽고 나서 서로의 감상평을 남긴다" 가 이 테마의 핵심이라,
 * 상세로 들어가지 않아도 목록에서 바로 비교되는 편이 낫다.
 */
export function BookCard({
  book,
  currentUserId,
}: {
  book: BookCardData;
  currentUserId: string | null;
}) {
  return (
    <article className="flex gap-4 card rounded-xl p-4">
      <Link href={`/entry/${book.id}`} className="shrink-0">
        {book.coverImageUrl ? (
          // 카카오 CDN 표지. 임의 주소도 들어올 수 있어 일반 img 로 그린다.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.coverImageUrl}
            alt=""
            loading="lazy"
            className="h-28 w-20 rounded bg-surface-muted object-cover"
          />
        ) : (
          <div className="flex h-28 w-20 items-center justify-center rounded bg-surface-muted text-xs text-ink-muted">
            표지 없음
          </div>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link href={`/entry/${book.id}`} className="group block">
          <h3 className="font-medium group-hover:text-accent">{book.title}</h3>
          {book.subtitle && <p className="text-sm text-ink-muted">{book.subtitle}</p>}
          {book.publisher && <p className="text-xs text-ink-muted">{book.publisher}</p>}
        </Link>

        <ul className="mt-3 space-y-2 border-t border-border pt-3">
          {book.readers.map((reader) => (
            <li key={reader.id}>
              <ReaderRow reader={reader} isMe={reader.id === currentUserId} />
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function ReaderRow({ reader, isMe }: { reader: ReaderView; isMe: boolean }) {
  // 내가 쓴 글은 가릴 이유가 없다.
  const [hidden, setHidden] = useState(Boolean(reader.review?.isSpoiler) && !isMe);

  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{reader.displayName}</span>

        {reader.hasRead ? (
          <Stars score={reader.score} size="sm" />
        ) : (
          <span className="text-xs text-ink-muted">아직 안 읽음</span>
        )}
      </div>

      {reader.review && (
        hidden ? (
          <button
            type="button"
            onClick={() => setHidden(false)}
            className="mt-1 w-full rounded border border-dashed border-border bg-surface-muted px-2 py-1.5 text-left text-xs text-ink-muted transition-colors hover:text-ink"
          >
            스포일러가 있다. 눌러서 보기
          </button>
        ) : (
          <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-ink-muted">
            {reader.review.body}
          </p>
        )
      )}

      {reader.hasRead && !reader.review && (
        <p className="mt-0.5 text-xs text-ink-muted">감상평 아직 없음</p>
      )}
    </div>
  );
}
