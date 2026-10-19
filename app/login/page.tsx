import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getBothUsers, getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage() {
  const current = await getCurrentUser();
  if (current) redirect("/");

  const people = await getBothUsers();

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-1 text-xl font-semibold">로그인</h1>
      <p className="mb-6 text-sm text-ink-muted">
        보는 건 로그인 없이도 되고, 기록을 남길 때만 로그인이 필요하다.
      </p>
      <LoginForm people={people} />
    </div>
  );
}
