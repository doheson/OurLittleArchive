"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { todayKey } from "@/lib/date";
import { BookSearchError, searchBooks } from "@/lib/books/kakao";
import { BOOK_SEARCH_IDLE, type BookSearchState } from "@/lib/books/search-state";
import { entryStatusSchema } from "@/lib/themes";
import { mergeApiMeta } from "@/lib/entry-schema";
import { runAction, type ActionResult } from "./result";

/** 검색창에서 입력이 멈출 때마다 부른다. 예외 대신 상태로 돌려준다. */
export async function searchBooksAction(rawTerm: string): Promise<BookSearchState> {
  const term = rawTerm.trim();
  if (term.length < 2) return BOOK_SEARCH_IDLE;

  try {
    const books = await searchBooks(term);
    return { status: "ok", term, books };
  } catch (error) {
    if (error instanceof BookSearchError) {
      return { status: "error", term, error: error.message, needsSetup: error.needsSetup };
    }
    console.error("[searchBooksAction]", error);
    return { status: "error", term, error: "책 검색에 실패했다.", needsSetup: false };
  }
}

const bookSchema = z.object({
  isbn: z.string().min(1).max(40),
  title: z.string().min(1).max(200),
  authors: z.array(z.string().max(100)).max(20),
  translators: z.array(z.string().max(100)).max(20),
  publisher: z.string().max(120).nullable(),
  thumbnail: z.string().url().max(2000).nullable(),
  publishedAt: z.string().max(10).nullable(),
});

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** 쉼표로 묶어 보낸 저자/역자 목록을 배열로 되돌린다. */
function splitList(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * 검색 결과에서 고른 책을 저장한다.
 *
 * 같은 ISBN 을 다시 고르면 새로 만들지 않고 기존 항목을 쓴다.
 * 그래서 "읽고 싶은 책" 에 담아둔 책을 다 읽고 다시 등록해도 기록이 한 줄로 이어지고,
 * 거기 달린 평점과 감상평이 그대로 남는다.
 */
export async function saveBook(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let targetEntryId: string | null = null;

  const result = await runAction(async () => {
    const user = await requireUser();

    const book = bookSchema.parse({
      isbn: emptyToNull(formData.get("isbn")),
      title: emptyToNull(formData.get("title")),
      authors: splitList(formData.get("authors")),
      translators: splitList(formData.get("translators")),
      publisher: emptyToNull(formData.get("publisher")),
      thumbnail: emptyToNull(formData.get("thumbnail")),
      publishedAt: emptyToNull(formData.get("publishedAt")),
    });

    const status = entryStatusSchema.parse(formData.get("status"));
    const asRecommendation = formData.get("asRecommendation") === "on";
    const comment = emptyToNull(formData.get("comment"));

    // 누가 읽었는지. 한쪽만 읽은 책이 많아서 따로 받는다.
    const requestedReaders = formData
      .getAll("readerIds")
      .filter((value): value is string => typeof value === "string");
    const readers = requestedReaders.length
      ? (
          await prisma.user.findMany({
            where: { id: { in: requestedReaders } },
            select: { id: true },
          })
        ).map((row) => row.id)
      : [];

    const before = await prisma.entry.findUnique({
      where: {
        theme_externalSource_externalId: {
          theme: "BOOK",
          externalSource: "KAKAO_BOOK",
          externalId: book.isbn,
        },
      },
      select: { metaJson: true },
    });

    const metaJson = mergeApiMeta("BOOK", before?.metaJson ?? null, {
      authors: book.authors.length ? book.authors : undefined,
      translators: book.translators.length ? book.translators : undefined,
      publisher: book.publisher ?? undefined,
      isbn: book.isbn,
      publishedAt: book.publishedAt ?? undefined,
    });

    const subtitle = book.authors.length ? book.authors.join(", ") : null;

    const entry = await prisma.entry.upsert({
      where: {
        theme_externalSource_externalId: {
          theme: "BOOK",
          externalSource: "KAKAO_BOOK",
          externalId: book.isbn,
        },
      },
      // 이미 있던 책이면 상태와 표지/메타만 갱신한다.
      // 제목은 손으로 고쳐둔 경우가 있어 건드리지 않는다.
      update: { status, coverImageUrl: book.thumbnail, metaJson },
      create: {
        theme: "BOOK",
        status,
        title: book.title,
        subtitle,
        coverImageUrl: book.thumbnail,
        externalSource: "KAKAO_BOOK",
        externalId: book.isbn,
        metaJson,
        createdById: user.id,
      },
      select: { id: true },
    });

    targetEntryId = entry.id;

    // 읽은 사람은 통째로 바꾼다. 둘 중 하나뿐이라 diff 를 계산할 이유가 없다.
    await prisma.participation.deleteMany({ where: { entryId: entry.id } });
    if (readers.length) {
      await prisma.participation.createMany({
        data: readers.map((userId) => ({ entryId: entry.id, userId })),
      });
    }

    if (asRecommendation) {
      const today = todayKey();
      await prisma.dailyPick.upsert({
        where: { theme_pickedOn: { theme: "BOOK", pickedOn: today } },
        update: { entryId: entry.id, pickedById: user.id, comment },
        create: {
          theme: "BOOK",
          pickedOn: today,
          entryId: entry.id,
          pickedById: user.id,
          comment,
        },
      });
    }

    revalidatePath("/");
    revalidatePath("/books");
    revalidatePath(`/entry/${entry.id}`);
  });

  if (result.ok && targetEntryId) redirect("/books");
  return result;
}

/** 이미 등록된 책을 추천 코너에 올린다. */
export async function recommendBook(formData: FormData): Promise<void> {
  const user = await requireUser();
  const entryId = z.string().min(1).parse(formData.get("entryId"));

  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    select: { id: true, theme: true },
  });
  if (!entry || entry.theme !== "BOOK") return;

  const today = todayKey();
  await prisma.dailyPick.upsert({
    where: { theme_pickedOn: { theme: "BOOK", pickedOn: today } },
    update: { entryId: entry.id, pickedById: user.id },
    create: { theme: "BOOK", pickedOn: today, entryId: entry.id, pickedById: user.id },
  });

  revalidatePath("/books");
  revalidatePath(`/entry/${entry.id}`);
}

