import { clearRating } from "@/app/actions/entries";
import type { SessionUser } from "@/lib/auth";
import { Stars } from "./stars";
import { StarRatingInput } from "./star-rating-input";
import { SubmitButton } from "./submit-button";

type RatingRow = { userId: string; score: number };

/**
 * 두 사람의 평점을 나란히 보여준다.
 * 로그인한 사람의 줄만 입력 가능하고, 상대방 줄은 읽기 전용이다.
 */
export function RatingPanel({
  entryId,
  users,
  ratings,
  currentUserId,
}: {
  entryId: string;
  users: SessionUser[];
  ratings: RatingRow[];
  currentUserId: string | null;
}) {
  const scoreOf = (userId: string) => ratings.find((r) => r.userId === userId)?.score ?? null;

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink-muted">평점</h2>

      <ul className="space-y-3">
        {users.map((user) => {
          const score = scoreOf(user.id);
          const isMe = user.id === currentUserId;

          return (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-16 text-sm font-medium">{user.displayName}</span>

              {isMe ? (
                <div className="flex flex-wrap items-center gap-3">
                  <StarRatingInput entryId={entryId} initialScore={score} />
                  {score != null && (
                    <form action={clearRating}>
                      <input type="hidden" name="entryId" value={entryId} />
                      <SubmitButton variant="danger" className="px-2 py-1 text-xs">
                        지우기
                      </SubmitButton>
                    </form>
                  )}
                </div>
              ) : (
                <Stars score={score} />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
