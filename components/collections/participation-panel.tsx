"use client";

import { useActionState, useState } from "react";
import { toggleParticipation } from "@/app/actions/entries";
import { ACTION_IDLE } from "@/lib/action-result";
import { SubmitButton } from "@/components/submit-button";

export type ParticipantRow = {
  userId: string;
  displayName: string;
  joined: boolean;
  role: string | null;
};

/**
 * 누가 이걸 해봤는지.
 *
 * 머더미스터리처럼 한쪽만 해본 작품이 많은 테마에서 쓴다.
 * 같은 작품이라도 맡은 캐릭터는 사람마다 다르므로 역할은 사람별로 적는다.
 */
export function ParticipationPanel({
  entryId,
  participants,
  currentUserId,
  tracksRole,
  roleLabel,
  joinLabel,
  leaveLabel,
}: {
  entryId: string;
  participants: ParticipantRow[];
  currentUserId: string | null;
  tracksRole: boolean;
  roleLabel: string;
  joinLabel: string;
  leaveLabel: string;
}) {
  const [state, formAction] = useActionState(toggleParticipation, ACTION_IDLE);
  const me = currentUserId
    ? participants.find((row) => row.userId === currentUserId)
    : undefined;
  const [role, setRole] = useState(me?.role ?? "");

  return (
    <section className="card rounded-xl p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink-muted">누가 해봤는지</h2>

      <ul className="space-y-2">
        {participants.map((person) => (
          <li
            key={person.userId}
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span className="font-medium">{person.displayName}</span>
            <span className="text-ink-muted">
              {person.joined ? (
                <>
                  해봤음
                  {tracksRole && person.role && (
                    <span className="ml-2 text-ink">· {person.role}</span>
                  )}
                </>
              ) : (
                "아직 안 해봤음"
              )}
            </span>
          </li>
        ))}
      </ul>

      {currentUserId && (
        <form action={formAction} className="mt-4 space-y-2 border-t border-border pt-3">
          <input type="hidden" name="entryId" value={entryId} />

          {tracksRole && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-muted">
                {roleLabel}
              </span>
              <input
                name="role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                maxLength={100}
                placeholder="비워두고 눌러도 돼요"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton variant={me?.joined ? "subtle" : "primary"} className="px-3 py-1.5">
              {/* 역할을 적어둔 상태로 다시 누르면 빼는 게 아니라 고치는 동작이 된다 */}
              {me?.joined ? (tracksRole && role.trim() ? "역할 고치기" : leaveLabel) : joinLabel}
            </SubmitButton>

            {!state.ok && <span className="text-sm text-accent">{state.error}</span>}
            {state.ok && state.message && (
              <span className="text-sm text-ink-muted">{state.message}</span>
            )}
          </div>

          {me?.joined && tracksRole && role.trim() && (
            <p className="text-xs text-ink-muted">
              기록에서 빼려면 역할 칸을 비우고 다시 눌러 주세요.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
