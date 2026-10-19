"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { ACTION_IDLE } from "@/lib/action-result";
import { SubmitButton } from "./submit-button";

/** 가입 화면은 없다. 두 계정 중 누구인지 고르고 비밀번호만 넣는다. */
export function LoginForm({ people }: { people: { slug: string; displayName: string }[] }) {
  const [state, formAction] = useActionState(login, ACTION_IDLE);

  return (
    <form action={formAction} className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-muted">누구인지</legend>
        <div className="flex gap-2">
          {people.map((person, index) => (
            <label
              key={person.slug}
              className="flex-1 cursor-pointer rounded-lg border border-border px-3 py-2 text-center text-sm has-checked:border-accent has-checked:bg-accent-soft"
            >
              <input
                type="radio"
                name="slug"
                value={person.slug}
                defaultChecked={index === 0}
                className="sr-only"
              />
              {person.displayName}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-muted">비밀번호</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>

      <SubmitButton pendingLabel="확인 중…" className="w-full">
        로그인
      </SubmitButton>

      {!state.ok && <p className="text-sm text-accent">{state.error}</p>}
    </form>
  );
}
