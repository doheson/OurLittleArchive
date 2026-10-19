"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { saveBook, searchBooksAction } from "@/app/actions/books";
import { ACTION_IDLE } from "@/lib/action-result";
import { BOOK_SEARCH_IDLE, type BookSearchState } from "@/lib/books/search-state";
import type { KakaoBook } from "@/lib/books/kakao";
import { SubmitButton } from "@/components/submit-button";

const DEBOUNCE_MS = 400;

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

export function BookSearch({
  people,
  defaultAsRecommendation,
  currentUserId,
}: {
  people: { id: string; displayName: string }[];
  defaultAsRecommendation: boolean;
  currentUserId: string;
}) {
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState<BookSearchState>(BOOK_SEARCH_IDLE);
  const [isSearching, startSearch] = useTransition();
  const [picked, setPicked] = useState<KakaoBook | null>(null);

  const tooShort = term.trim().length < 2;
  const shown: BookSearchState = tooShort ? BOOK_SEARCH_IDLE : search;

  useEffect(() => {
    if (tooShort) return;

    const timer = setTimeout(() => {
      startSearch(async () => {
        setSearch(await searchBooksAction(term));
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term, tooShort]);

  if (picked) {
    return (
      <PickedBookForm
        book={picked}
        people={people}
        currentUserId={currentUserId}
        defaultAsRecommendation={defaultAsRecommendation}
        onBack={() => setPicked(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-muted">책 검색</span>
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="책 제목이나 저자"
          autoFocus
          className={fieldClass}
        />
      </label>

      {isSearching && <p className="text-sm text-ink-muted">찾는 중…</p>}

      {shown.status === "error" &&
        (shown.needsSetup ? <KakaoSetupNotice /> : (
          <p className="text-sm text-accent">{shown.error}</p>
        ))}

      {shown.status === "ok" && shown.books.length === 0 && (
        <p className="text-sm text-ink-muted">결과가 없어요. 저자 이름을 같이 넣어 보세요.</p>
      )}

      {shown.status === "ok" && shown.books.length > 0 && (
        <ul className="space-y-2">
          {shown.books.map((book) => (
            <li
              key={book.isbn}
              className="flex items-start gap-3 card rounded-xl p-3"
            >
              {/* 카카오 CDN 표지. 썸네일 한 장이라 일반 img 로 충분하다. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={book.thumbnail ?? ""}
                alt=""
                loading="lazy"
                className="h-20 w-14 shrink-0 rounded bg-surface-muted object-cover"
              />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{book.title}</p>
                <p className="truncate text-sm text-ink-muted">
                  {book.authors.join(", ") || "저자 미상"}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {[book.publisher, book.publishedAt].filter(Boolean).join(" · ")}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPicked(book)}
                className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                고르기
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 키가 없을 때. 실패 메시지 대신 발급 방법을 알려준다. */
function KakaoSetupNotice() {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-muted p-4 text-sm">
      <p className="font-medium">카카오 키가 아직 없어요</p>
      <ol className="list-decimal space-y-1 pl-5 text-ink-muted">
        <li>
          <a
            href="https://developers.kakao.com"
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent hover:underline"
          >
            developers.kakao.com
          </a>{" "}
          에서 애플리케이션을 추가해요 (심사 없이 바로 돼요)
        </li>
        <li>[앱 키] 메뉴의 REST API 키를 복사해요</li>
        <li>
          프로젝트의 <code className="rounded bg-background px-1">.env</code> 에서{" "}
          <code className="rounded bg-background px-1">KAKAO_REST_API_KEY</code> 에 붙여넣어요
        </li>
        <li>개발 서버를 다시 시작해요</li>
      </ol>
      <p className="text-ink-muted">
        같은 키를 공간 테마의 장소 검색에서도 써요. 키 없이 책을 넣고 싶으면{" "}
        <span className="text-ink">직접 입력</span>으로 등록하면 돼요.
      </p>
    </div>
  );
}

function PickedBookForm({
  book,
  people,
  currentUserId,
  defaultAsRecommendation,
  onBack,
}: {
  book: KakaoBook;
  people: { id: string; displayName: string }[];
  currentUserId: string;
  defaultAsRecommendation: boolean;
  onBack: () => void;
}) {
  const [state, formAction] = useActionState(saveBook, ACTION_IDLE);
  const [status, setStatus] = useState<"DONE" | "WISHLIST">("DONE");

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="isbn" value={book.isbn} />
      <input type="hidden" name="authors" value={book.authors.join(", ")} />
      <input type="hidden" name="translators" value={book.translators.join(", ")} />
      <input type="hidden" name="publisher" value={book.publisher ?? ""} />
      <input type="hidden" name="thumbnail" value={book.thumbnail ?? ""} />
      <input type="hidden" name="publishedAt" value={book.publishedAt ?? ""} />

      <div className="flex gap-4 card rounded-xl p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={book.thumbnail ?? ""}
          alt=""
          className="h-32 w-22 shrink-0 rounded bg-surface-muted object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{book.authors.join(", ") || "저자 미상"}</p>
          <p className="text-sm text-ink-muted">
            {[book.publisher, book.publishedAt].filter(Boolean).join(" · ")}
          </p>
          {book.contents && (
            <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-ink-muted">
              {book.contents}
            </p>
          )}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-muted">제목</span>
        <input
          name="title"
          defaultValue={book.title}
          required
          maxLength={200}
          className={fieldClass}
        />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-muted">상태</legend>
        <div className="flex gap-2">
          {([
            ["DONE", "읽은 책"],
            ["WISHLIST", "읽고 싶은 책"],
          ] as const).map(([value, label]) => (
            <label
              key={value}
              className="flex-1 cursor-pointer rounded-lg border border-border px-3 py-2 text-center text-sm has-checked:border-accent has-checked:bg-accent-soft"
            >
              <input
                type="radio"
                name="status"
                value={value}
                checked={status === value}
                onChange={() => setStatus(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* 읽고 싶은 책 단계에서는 "누가 읽었는지" 를 물을 이유가 없다. */}
      {status === "DONE" && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-muted">누가 읽었는지</legend>
          <div className="flex flex-wrap gap-2">
            {people.map((person) => (
              <label
                key={person.id}
                className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-sm has-checked:border-accent has-checked:bg-accent-soft"
              >
                <input
                  type="checkbox"
                  name="readerIds"
                  value={person.id}
                  defaultChecked={person.id === currentUserId}
                  className="sr-only"
                />
                {person.displayName}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            나중에 상대가 다 읽으면 책 상세에서 직접 표시할 수 있어요.
          </p>
        </fieldset>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="asRecommendation"
          defaultChecked={defaultAsRecommendation}
          className="size-4 accent-[var(--accent)]"
        />
        추천 코너에 올리기
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-muted">한마디</span>
        <textarea
          name="comment"
          rows={2}
          maxLength={500}
          placeholder="왜 이 책인지"
          className={fieldClass}
        />
      </label>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="저장 중…">저장</SubmitButton>
        <button type="button" onClick={onBack} className="text-sm text-ink-muted hover:text-ink">
          다시 고르기
        </button>
        {!state.ok && <p className="text-sm text-accent">{state.error}</p>}
      </div>
    </form>
  );
}
