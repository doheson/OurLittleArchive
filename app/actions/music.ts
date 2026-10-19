"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { todayKey } from "@/lib/date";
import { MusicSearchError, searchTracks } from "@/lib/music/itunes";
import { SEARCH_IDLE, type SearchState } from "@/lib/music/search-state";
import { entryStatusSchema } from "@/lib/themes";
import { mergeApiMeta } from "@/lib/entry-schema";
import { runAction, type ActionResult } from "./result";

/**
 * 검색창에서 입력이 멈출 때마다 부른다.
 * 폼 제출이 아니라 인자로 직접 받는다. 디바운스해서 호출하기에 그 편이 간단하다.
 * 실패해도 화면이 깨지지 않도록 예외 대신 상태로 돌려준다.
 */
export async function searchMusicTracks(rawTerm: string): Promise<SearchState> {
  const term = rawTerm.trim();
  if (term.length < 2) return SEARCH_IDLE;

  try {
    const tracks = await searchTracks(term);
    return { status: "ok", term, tracks };
  } catch (error) {
    if (error instanceof MusicSearchError) {
      return { status: "error", term, error: error.message };
    }
    console.error("[searchMusicTracks]", error);
    return { status: "error", term, error: "음악 검색에 실패했어요." };
  }
}

const trackSchema = z.object({
  trackId: z.string().min(1),
  title: z.string().min(1).max(200),
  artist: z.string().min(1).max(200),
  album: z.string().max(200).nullable(),
  artworkUrl: z.string().url().max(2000).nullable(),
  previewUrl: z.string().url().max(2000).nullable(),
  appleUrl: z.string().url().max(2000).nullable(),
  genre: z.string().max(100).nullable(),
  releasedAt: z.string().max(10).nullable(),
});

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * 검색 결과에서 고른 곡을 저장한다.
 *
 * 같은 곡을 또 고르면 새로 만들지 않고 기존 항목을 쓴다.
 * Entry 의 (theme, externalSource, externalId) 고유 제약이 그 기준이다.
 * 그래서 어제 추천한 곡을 오늘 다시 골라도 기록이 한 줄로 유지된다.
 */
export async function saveTrack(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let targetEntryId: string | null = null;

  const result = await runAction(async () => {
    const user = await requireUser();

    const track = trackSchema.parse({
      trackId: emptyToNull(formData.get("trackId")),
      title: emptyToNull(formData.get("title")),
      artist: emptyToNull(formData.get("artist")),
      album: emptyToNull(formData.get("album")),
      artworkUrl: emptyToNull(formData.get("artworkUrl")),
      previewUrl: emptyToNull(formData.get("previewUrl")),
      appleUrl: emptyToNull(formData.get("appleUrl")),
      genre: emptyToNull(formData.get("genre")),
      releasedAt: emptyToNull(formData.get("releasedAt")),
    });

    const status = entryStatusSchema.parse(formData.get("status"));
    const asDailyPick = formData.get("asDailyPick") === "on";
    const comment = emptyToNull(formData.get("comment"));

    // 이미 있던 곡이면 손으로 적어둔 유튜브/Spotify 링크를 지우지 않도록 합친다.
    const before = await prisma.entry.findUnique({
      where: {
        theme_externalSource_externalId: {
          theme: "MUSIC",
          externalSource: "ITUNES",
          externalId: track.trackId,
        },
      },
      select: { metaJson: true },
    });

    const metaJson = mergeApiMeta("MUSIC", before?.metaJson ?? null, {
      artist: track.artist,
      album: track.album ?? undefined,
      genre: track.genre ?? undefined,
      releasedAt: track.releasedAt ?? undefined,
      previewUrl: track.previewUrl ?? undefined,
      appleUrl: track.appleUrl ?? undefined,
    });

    const entry = await prisma.entry.upsert({
      where: {
        theme_externalSource_externalId: {
          theme: "MUSIC",
          externalSource: "ITUNES",
          externalId: track.trackId,
        },
      },
      /*
        이미 있던 곡이면 메타만 최신으로 맞춰요.
        제목을 손으로 고쳐둔 경우가 있어 title 과 status 는 건드리지 않아요.
        한마디는 새로 적었을 때만 바꿔요. 비워둔 채 다시 고른다고 해서
        전에 적어둔 글이 지워지면 안 되니까요.
      */
      update: {
        coverImageUrl: track.artworkUrl,
        metaJson,
        ...(comment ? { note: comment } : {}),
      },
      create: {
        theme: "MUSIC",
        status,
        title: track.title,
        subtitle: track.artist,
        // 한마디는 항목에 담아둬요. 오늘의 추천으로 올리지 않아도
        // 곡을 열면 읽을 수 있어야 해요.
        note: comment,
        coverImageUrl: track.artworkUrl,
        externalSource: "ITUNES",
        externalId: track.trackId,
        metaJson,
        createdById: user.id,
      },
      select: { id: true },
    });

    targetEntryId = entry.id;

    if (asDailyPick) {
      const today = todayKey();
      /*
        DailyPick 은 "누가 언제 대문에 올렸는지" 만 남겨요.
        한마디는 곡을 등록한 사람이 쓴 글이라 Entry 에 있어요.
        둘을 같이 담아두면, 남이 올린 곡을 대문에 올렸을 때
        글쓴이가 올린 사람으로 바뀌어 보여요.
      */
      await prisma.dailyPick.upsert({
        where: { theme_pickedOn: { theme: "MUSIC", pickedOn: today } },
        update: { entryId: entry.id, pickedById: user.id },
        create: {
          theme: "MUSIC",
          pickedOn: today,
          entryId: entry.id,
          pickedById: user.id,
        },
      });
    }

    revalidatePath("/");
    revalidatePath("/music");
    revalidatePath(`/entry/${entry.id}`);
  });

  if (result.ok && targetEntryId) redirect("/music");
  return result;
}

/** 이미 등록된 곡을 오늘의 추천으로 올린다. */
export async function promoteToTodaysPick(formData: FormData): Promise<void> {
  const user = await requireUser();
  const entryId = z.string().min(1).parse(formData.get("entryId"));

  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    select: { id: true, theme: true },
  });
  if (!entry || entry.theme !== "MUSIC") return;

  const today = todayKey();
  await prisma.dailyPick.upsert({
    where: { theme_pickedOn: { theme: "MUSIC", pickedOn: today } },
    update: { entryId: entry.id, pickedById: user.id },
    create: { theme: "MUSIC", pickedOn: today, entryId: entry.id, pickedById: user.id },
  });

  revalidatePath("/music");
  revalidatePath(`/entry/${entry.id}`);
}
