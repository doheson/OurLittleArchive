import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { THEME_LIST } from "@/lib/themes";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { ThemeNav } from "@/components/theme-nav";

export const metadata: Metadata = {
  title: {
    default: "OurLittleArchive",
    template: "%s · OurLittleArchive",
  },
  description: "둘이 함께한 것들과 앞으로 할 것들을 모아두는 작은 기록 보관소.",
  // 링크를 아는 사람은 볼 수 있지만 검색에는 걸리지 않아야 한다.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#16140f" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="ko" className="h-full">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-border bg-surface/80 backdrop-blur">
          <div className="mx-auto w-full max-w-5xl px-4">
            <div className="flex h-14 items-center justify-between gap-4">
              <Link href="/" className="font-semibold tracking-tight">
                OurLittleArchive
              </Link>

              {user ? (
                <form action={logout}>
                  <button
                    type="submit"
                    className="text-sm text-ink-muted transition-colors hover:text-ink"
                  >
                    {user.displayName} · 로그아웃
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  className="text-sm text-ink-muted transition-colors hover:text-ink"
                >
                  로그인
                </Link>
              )}
            </div>

            <ThemeNav
              items={THEME_LIST.map((theme) => ({ slug: theme.slug, label: theme.label }))}
            />

          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>

        <footer className="border-t border-border px-4 py-6 text-center text-xs text-ink-muted">
          우리 둘의 기록
        </footer>
      </body>
    </html>
  );
}
