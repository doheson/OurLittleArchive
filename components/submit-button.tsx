"use client";

import { useFormStatus } from "react-dom";

/**
 * 폼 제출 중 상태를 스스로 아는 버튼.
 * useFormStatus 는 바로 감싸는 <form> 의 상태만 읽으므로 폼 안에 있어야 한다.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "subtle" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();

  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";
  const styles = {
    primary: "bg-accent text-white hover:opacity-90",
    subtle: "border border-border bg-surface text-ink hover:bg-surface-muted",
    danger: "border border-border text-ink-muted hover:text-ink",
  }[variant];

  return (
    <button type="submit" disabled={pending} className={`${base} ${styles} ${className}`}>
      {pending ? (pendingLabel ?? "처리 중…") : children}
    </button>
  );
}
