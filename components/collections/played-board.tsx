import Link from "next/link";
import { Stars } from "@/components/stars";

export type PlayedRow = {
  entryId: string;
  title: string;
  subtitle: string | null;
  /** 그 사람이 맡았던 캐릭터 */
  role: string | null;
  score: number | null;
  playedOn: string | null;
  /** 상대도 같이 한 작품인지 */
  together: boolean;
};

export type PlayedColumn = {
  userId: string;
  displayName: string;
  items: PlayedRow[];
};

/**
 * 각자 해본 것들을 나란히 보여준다.
 *
 * 머더미스터리는 한쪽만 해본 작품이 많아서, 둘을 한 목록에 섞으면
 * 누가 뭘 했는지가 묻힌다. 사람별로 칸을 나누는 편이 읽기 쉽다.
 * 둘이 같이 한 작품에는 표시를 달아 구분한다.
 */
export function PlayedBoard({
  columns,
  emptyHint,
}: {
  columns: PlayedColumn[];
  emptyHint: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {columns.map((column) => (
        <section key={column.userId} className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 flex items-baseline justify-between gap-2 text-sm font-semibold">
            {/*
              조사를 붙이지 않는다. 받침에 따라 이/가가 달라지고
              "나/너" 같은 대명사는 "내가/네가" 로 불규칙하게 바뀌어서,
              이름이 무엇이든 깨지지 않으려면 조사를 안 쓰는 편이 안전하다.
            */}
            <span>{column.displayName} · 해본 공연</span>
            <span className="text-xs font-normal text-ink-muted tabular-nums">
              {column.items.length}편
            </span>
          </h3>

          {column.items.length === 0 ? (
            <p className="text-sm text-ink-muted">{emptyHint}</p>
          ) : (
            <ul className="space-y-3">
              {column.items.map((item) => (
                <li key={item.entryId}>
                  <Link href={`/entry/${item.entryId}`} className="group block">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium group-hover:text-accent">
                        {item.title}
                      </span>
                      {item.together && (
                        <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">
                          같이
                        </span>
                      )}
                    </div>

                    {item.role && (
                      <p className="text-xs text-ink-muted">맡은 역: {item.role}</p>
                    )}

                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Stars score={item.score} size="sm" />
                      {item.playedOn && (
                        <span className="text-xs text-ink-muted">{item.playedOn}</span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
