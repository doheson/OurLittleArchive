import Link from "next/link";
import { moveFavorite, toggleFavorite } from "@/app/actions/entries";
import { SubmitButton } from "@/components/submit-button";
import { Stars } from "@/components/stars";

export type FavoriteRow = {
  entryId: string;
  rank: number;
  title: string;
  subtitle: string | null;
  coverImageUrl: string | null;
  myScore: number | null;
};

export type FavoriteColumn = {
  userId: string;
  displayName: string;
  items: FavoriteRow[];
};

/**
 * 두 사람의 베스트를 나란히 보여준다.
 *
 * 순위는 본인만 바꿀 수 있다. 상대 칸은 읽기 전용이다.
 * 베스트에 넣고 빼는 건 항목 상세에서 한다.
 */
export function FavoriteBoard({
  columns,
  currentUserId,
  emptyHint,
}: {
  columns: FavoriteColumn[];
  currentUserId: string | null;
  emptyHint: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {columns.map((column) => {
        const isMine = column.userId === currentUserId;

        return (
          <section
            key={column.userId}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <h3 className="mb-3 text-sm font-semibold">
              {column.displayName}의 베스트
            </h3>

            {column.items.length === 0 ? (
              <p className="text-sm text-ink-muted">{emptyHint}</p>
            ) : (
              <ol className="space-y-2">
                {column.items.map((item, index) => (
                  <li key={item.entryId} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-center text-sm font-semibold text-accent tabular-nums">
                      {index + 1}
                    </span>

                    {item.coverImageUrl ? (
                      // 손으로 넣은 임의 주소가 올 수 있어 일반 img 로 그린다.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.coverImageUrl}
                        alt=""
                        loading="lazy"
                        className="size-10 shrink-0 rounded bg-surface-muted object-cover"
                      />
                    ) : (
                      <span className="size-10 shrink-0 rounded bg-surface-muted" />
                    )}

                    <Link
                      href={`/entry/${item.entryId}`}
                      className="min-w-0 flex-1 hover:text-accent"
                    >
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      {item.subtitle && (
                        <span className="block truncate text-xs text-ink-muted">
                          {item.subtitle}
                        </span>
                      )}
                    </Link>

                    {isMine ? (
                      <span className="flex shrink-0 gap-0.5">
                        <MoveButton
                          entryId={item.entryId}
                          direction="up"
                          disabled={index === 0}
                        />
                        <MoveButton
                          entryId={item.entryId}
                          direction="down"
                          disabled={index === column.items.length - 1}
                        />
                        <form action={toggleFavorite}>
                          <input type="hidden" name="entryId" value={item.entryId} />
                          <SubmitButton
                            variant="danger"
                            className="px-1.5 py-0.5 text-xs"
                          >
                            빼기
                          </SubmitButton>
                        </form>
                      </span>
                    ) : (
                      <Stars score={item.myScore} size="sm" />
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

function MoveButton({
  entryId,
  direction,
  disabled,
}: {
  entryId: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  if (disabled) {
    return <span className="inline-block w-6" aria-hidden="true" />;
  }

  return (
    <form action={moveFavorite}>
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        aria-label={direction === "up" ? "순위 올리기" : "순위 내리기"}
        className="w-6 rounded text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
      >
        {direction === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}
