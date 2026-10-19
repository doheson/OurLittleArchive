"use client";

import { useActionState, useState } from "react";
import { deleteReview, setReview } from "@/app/actions/entries";
import { ACTION_IDLE } from "@/lib/action-result";
import { SubmitButton } from "./submit-button";

export type ReviewRow = {
  id: string;
  userId: string;
  body: string;
  isSpoiler: boolean;
  updatedAt: string;
};

export type ReviewAuthor = { id: string; displayName: string };

/**
 * 각자의 감상평.
 *
 * 스포일러로 표시한 감상평은 기본적으로 가려 둔다.
 * 머더미스터리나 책처럼 한쪽만 먼저 경험하는 경우가 많아서,
 * 상대방이 아직 안 봤을 때 내용이 그냥 보이면 곤란하다.
 */
export function ReviewPanel({
  entryId,
  authors,
  reviews,
  currentUserId,
  defaultSpoiler,
}: {
  entryId: string;
  authors: ReviewAuthor[];
  reviews: ReviewRow[];
  currentUserId: string | null;
  defaultSpoiler: boolean;
}) {
  const myReview = currentUserId ? reviews.find((r) => r.userId === currentUserId) : undefined;

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink-muted">감상평</h2>

      <ul className="space-y-3">
        {authors.map((author) => {
          const review = reviews.find((r) => r.userId === author.id);
          if (!review) {
            return (
              <li key={author.id} className="text-sm text-ink-muted">
                <span className="font-medium text-ink">{author.displayName}</span> — 아직 안 남겼음
              </li>
            );
          }
          return (
            <li key={author.id}>
              <ReviewBody
                authorName={author.displayName}
                review={review}
                // 내가 쓴 글은 가리지 않는다. 가릴 이유가 없다.
                startHidden={review.isSpoiler && review.userId !== currentUserId}
              />
            </li>
          );
        })}
      </ul>

      {currentUserId && (
        <ReviewEditor
          entryId={entryId}
          existing={myReview}
          defaultSpoiler={defaultSpoiler}
        />
      )}
    </section>
  );
}

function ReviewBody({
  authorName,
  review,
  startHidden,
}: {
  authorName: string;
  review: ReviewRow;
  startHidden: boolean;
}) {
  const [hidden, setHidden] = useState(startHidden);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm">
        <span className="font-medium">{authorName}</span>
        {review.isSpoiler && (
          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs text-accent">
            스포일러
          </span>
        )}
      </div>

      {hidden ? (
        <button
          type="button"
          onClick={() => setHidden(false)}
          className="w-full rounded-lg border border-dashed border-border bg-surface-muted px-3 py-4 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          스포일러가 있다. 눌러서 보기
        </button>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{review.body}</p>
      )}
    </div>
  );
}

function ReviewEditor({
  entryId,
  existing,
  defaultSpoiler,
}: {
  entryId: string;
  existing?: ReviewRow;
  defaultSpoiler: boolean;
}) {
  const [state, formAction] = useActionState(setReview, ACTION_IDLE);
  const [open, setOpen] = useState(!existing);

  if (!open) {
    return (
      <div className="mt-4 flex gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-accent hover:underline"
        >
          내 감상평 고치기
        </button>
        <form action={deleteReview}>
          <input type="hidden" name="entryId" value={entryId} />
          <SubmitButton variant="danger" className="px-2 py-0 text-sm">
            지우기
          </SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-2 border-t border-border pt-3">
      <input type="hidden" name="entryId" value={entryId} />

      <textarea
        name="body"
        rows={4}
        defaultValue={existing?.body ?? ""}
        placeholder="어땠는지 남겨두기"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />

      <label className="flex items-center gap-2 text-sm text-ink-muted">
        <input
          type="checkbox"
          name="isSpoiler"
          defaultChecked={existing?.isSpoiler ?? defaultSpoiler}
          className="size-4 accent-[var(--accent)]"
        />
        스포일러 포함 (상대방에게는 가려서 보여준다)
      </label>

      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel="저장 중…">저장</SubmitButton>
        {existing && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-ink-muted hover:text-ink"
          >
            취소
          </button>
        )}
      </div>

      {!state.ok && <p className="text-sm text-accent">{state.error}</p>}
      {state.ok && state.message && <p className="text-sm text-ink-muted">{state.message}</p>}
    </form>
  );
}
