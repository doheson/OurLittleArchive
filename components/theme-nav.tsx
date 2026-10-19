"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export type NavItem = {
  slug: string;
  label: string;
};

/**
 * 상단 테마 탭.
 *
 * 지금 어느 탭에 있는지 표시하려면 현재 경로를 알아야 해서 클라이언트 컴포넌트예요.
 * 테마 목록은 레이아웃에서 그대로 넘겨받아요. lib/themes 를 여기서 불러오면
 * 거기 딸린 Zod 까지 브라우저로 따라와요.
 */
export function ThemeNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);

  // 모바일에서는 탭이 가로로 넘쳐서, 지금 탭이 화면 밖에 있을 수 있어요.
  useEffect(() => {
    const active = listRef.current?.querySelector('[aria-current="page"]');
    active?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <nav aria-label="테마" className="-mx-4 overflow-x-auto px-4 pb-2">
      <ul ref={listRef} className="flex items-center gap-1 text-sm whitespace-nowrap">
        {items.map((item) => {
          const href = `/${item.slug}`;
          // 목록뿐 아니라 그 아래 화면(/books/pick 등)에서도 같은 탭을 켜둬요.
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={item.slug}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "inline-block rounded-full bg-accent-soft px-3 py-1.5 font-semibold text-accent"
                    : "inline-block rounded-full px-3 py-1.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
