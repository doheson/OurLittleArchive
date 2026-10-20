"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  mergeMeta,
  parseEntryForm,
  parseInitialScore,
  ratingSchema,
  reviewSchema,
  validateMeta,
} from "@/lib/entry-schema";
import { THEMES, themeKeySchema, type ThemeKey } from "@/lib/themes";
import { deletePhoto, putPhoto } from "@/lib/storage";
import { todayKey } from "@/lib/date";
import { runAction, type ActionResult } from "./result";

/**
 * 모든 테마가 이 액션들을 공유한다.
 * 테마를 추가해도 lib/themes.ts 에 설정만 더하면 되고 여기는 손대지 않는다.
 */

function revalidateEntry(theme: ThemeKey, entryId?: string) {
  revalidatePath("/");
  revalidatePath(`/${THEMES[theme].slug}`);
  if (entryId) revalidatePath(`/entry/${entryId}`);
}

/** 참여자 id 가 실제 계정인지 확인한다. 잘못된 id 로 외래키 오류가 나지 않게 한다. */
async function validParticipantIds(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

async function entryThemeOrThrow(entryId: string): Promise<ThemeKey> {
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    select: { theme: true },
  });
  if (!entry) throw new z.ZodError([
    { code: "custom", path: ["entryId"], message: "항목을 찾을 수 없어요.", input: entryId },
  ]);
  return entry.theme as ThemeKey;
}

// --- 항목 ------------------------------------------------------------------

export async function createEntry(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  let createdId: string | null = null;

  const result = await runAction(async () => {
    const user = await requireUser();
    const input = parseEntryForm(formData);
    const metaJson = validateMeta(input.theme, input.meta);
    const participantIds = await validParticipantIds(input.participantIds);
    // 등록하면서 바로 평점을 매길 수 있어요. 안 매기면 null 이고, 나중에 상세에서 매기면 돼요.
    const score = parseInitialScore(formData);

    const entry = await prisma.entry.create({
      data: {
        theme: input.theme,
        status: input.status,
        subCategory: input.subCategory,
        title: input.title,
        subtitle: input.subtitle,
        note: input.note,
        coverImageUrl: input.coverImageUrl,
        externalId: input.externalId,
        externalSource: input.externalSource,
        experiencedOn: input.experiencedOn,
        locationName: input.locationName,
        address: input.address,
        lat: input.lat,
        lng: input.lng,
        metaJson,
        createdById: user.id,
        ...(participantIds.length
          ? { participations: { create: participantIds.map((userId) => ({ userId })) } }
          : {}),
        ...(score != null ? { ratings: { create: { userId: user.id, score } } } : {}),
      },
      select: { id: true, theme: true },
    });

    createdId = entry.id;
    revalidateEntry(entry.theme as ThemeKey, entry.id);
  });

  // redirect 는 예외를 던지므로 runAction 밖에서 호출한다.
  if (result.ok && createdId) redirect(`/entry/${createdId}`);
  return result;
}

export async function updateEntry(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();

    const entryId = z.string().min(1).parse(formData.get("entryId"));
    const input = parseEntryForm(formData);
    const participantIds = await validParticipantIds(input.participantIds);

    // 폼에 없는 meta 값(검색 연동이 채운 것들)을 지우지 않도록 기존 값과 합친다.
    const before = await prisma.entry.findUnique({
      where: { id: entryId },
      select: { metaJson: true },
    });
    const metaJson = mergeMeta(input.theme, before?.metaJson ?? null, input.meta);

    await prisma.$transaction([
      prisma.entry.update({
        where: { id: entryId },
        data: {
          status: input.status,
          subCategory: input.subCategory,
          title: input.title,
          subtitle: input.subtitle,
          note: input.note,
          coverImageUrl: input.coverImageUrl,
          experiencedOn: input.experiencedOn,
          locationName: input.locationName,
          address: input.address,
          lat: input.lat,
          lng: input.lng,
          metaJson,
        },
      }),
      // 참여자는 통째로 바꾼다. 둘 중 하나뿐이라 diff 를 계산할 이유가 없다.
      prisma.participation.deleteMany({ where: { entryId } }),
      ...(participantIds.length
        ? [
            prisma.participation.createMany({
              data: participantIds.map((userId) => ({ entryId, userId })),
            }),
          ]
        : []),
    ]);

    revalidateEntry(input.theme, entryId);
    return "저장했어요.";
  });
}

export async function deleteEntry(formData: FormData): Promise<void> {
  const entryId = z.string().min(1).parse(formData.get("entryId"));

  await requireUser();
  const theme = await entryThemeOrThrow(entryId);

  // 사진 파일은 DB 와 함께 지워지지 않으므로 먼저 치운다.
  const photos = await prisma.photo.findMany({
    where: { entryId },
    select: { key: true },
  });
  await Promise.all(photos.map((photo) => deletePhoto(photo.key)));

  // 나머지 관계는 스키마의 onDelete: Cascade 로 같이 지워진다.
  await prisma.entry.delete({ where: { id: entryId } });

  revalidateEntry(theme);
  redirect(`/${THEMES[theme].slug}`);
}

// --- 평점 / 감상평 ----------------------------------------------------------

export async function setRating(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const { entryId, score } = ratingSchema.parse({
      entryId: formData.get("entryId"),
      score: Number(formData.get("score")),
    });

    await prisma.rating.upsert({
      where: { entryId_userId: { entryId, userId: user.id } },
      update: { score },
      create: { entryId, userId: user.id, score },
    });

    revalidateEntry(await entryThemeOrThrow(entryId), entryId);
  });
}

export async function clearRating(formData: FormData): Promise<void> {
  const user = await requireUser();
  const entryId = z.string().min(1).parse(formData.get("entryId"));

  await prisma.rating
    .delete({ where: { entryId_userId: { entryId, userId: user.id } } })
    .catch(() => undefined); // 이미 없으면 그냥 넘어간다

  revalidateEntry(await entryThemeOrThrow(entryId), entryId);
}

export async function setReview(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const { entryId, body, isSpoiler } = reviewSchema.parse({
      entryId: formData.get("entryId"),
      body: formData.get("body"),
      isSpoiler: formData.get("isSpoiler") === "on" || formData.get("isSpoiler") === "true",
    });

    await prisma.review.upsert({
      where: { entryId_userId: { entryId, userId: user.id } },
      update: { body, isSpoiler },
      create: { entryId, userId: user.id, body, isSpoiler },
    });

    revalidateEntry(await entryThemeOrThrow(entryId), entryId);
    return "감상평을 저장했어요.";
  });
}

export async function deleteReview(formData: FormData): Promise<void> {
  const user = await requireUser();
  const entryId = z.string().min(1).parse(formData.get("entryId"));

  await prisma.review
    .delete({ where: { entryId_userId: { entryId, userId: user.id } } })
    .catch(() => undefined);

  revalidateEntry(await entryThemeOrThrow(entryId), entryId);
}

// --- 베스트 / 오늘의 추천 ----------------------------------------------------

/** 각자의 베스트에 넣거나 뺀다. rank 는 1위부터 채운다. */
export async function toggleFavorite(formData: FormData): Promise<void> {
  const user = await requireUser();
  const entryId = z.string().min(1).parse(formData.get("entryId"));
  const theme = await entryThemeOrThrow(entryId);

  const existing = await prisma.favorite.findUnique({
    where: { userId_entryId: { userId: user.id, entryId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
  } else {
    // 빈 순위 중 가장 앞자리를 찾는다.
    const taken = await prisma.favorite.findMany({
      where: { userId: user.id, theme },
      select: { rank: true },
      orderBy: { rank: "asc" },
    });
    const used = new Set(taken.map((row) => row.rank));
    let rank = 1;
    while (used.has(rank)) rank += 1;

    await prisma.favorite.create({ data: { userId: user.id, entryId, theme, rank } });
  }

  revalidateEntry(theme, entryId);
}

const dailyPickSchema = z.object({
  theme: themeKeySchema,
  entryId: z.string().min(1),
});

/** 오늘 날짜의 추천을 정한다. 같은 날 다시 호출하면 교체된다. */
export async function setDailyPick(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const { theme, entryId } = dailyPickSchema.parse({
      theme: formData.get("theme"),
      entryId: formData.get("entryId"),
    });

    const today = todayKey();
    // 한마디는 항목에 있어요. 여기서는 누가 언제 올렸는지만 남겨요.
    await prisma.dailyPick.upsert({
      where: { theme_pickedOn: { theme, pickedOn: today } },
      update: { entryId, pickedById: user.id },
      create: { theme, pickedOn: today, entryId, pickedById: user.id },
    });

    revalidateEntry(theme, entryId);
    return "오늘의 추천을 정했어요.";
  });
}

// --- 사진 ------------------------------------------------------------------

export async function uploadPhotos(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    const entryId = z.string().min(1).parse(formData.get("entryId"));
    const theme = await entryThemeOrThrow(entryId);

    const files = formData
      .getAll("photos")
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (!files.length) {
      throw new z.ZodError([
        { code: "custom", path: ["photos"], message: "올릴 사진을 골라 주세요.", input: null },
      ]);
    }

    const last = await prisma.photo.findFirst({
      where: { entryId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    let sortOrder = (last?.sortOrder ?? -1) + 1;

    for (const file of files) {
      const stored = await putPhoto(file);
      await prisma.photo.create({
        data: {
          entryId,
          key: stored.key,
          width: stored.width,
          height: stored.height,
          sortOrder: sortOrder++,
        },
      });
    }

    revalidateEntry(theme, entryId);
    return `사진 ${files.length}장을 올렸어요.`;
  });
}

export async function removePhoto(formData: FormData): Promise<void> {
  await requireUser();
  const photoId = z.string().min(1).parse(formData.get("photoId"));

  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { key: true, entryId: true, entry: { select: { theme: true } } },
  });
  if (!photo) return;

  await prisma.photo.delete({ where: { id: photoId } });
  await deletePhoto(photo.key);

  revalidateEntry(photo.entry.theme as ThemeKey, photo.entryId);
}

// --- 각자 기록 / 베스트 순위 -------------------------------------------------

const participationSchema = z.object({
  entryId: z.string().min(1),
  role: z.string().max(100).nullable(),
});

/**
 * "나도 해봤음" 을 켜고 끈다. 켤 때 맡은 역할을 같이 적을 수 있다.
 * 머더미스터리처럼 한쪽만 해본 작품이 많은 테마에서 쓴다.
 */
export async function toggleParticipation(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const roleRaw = formData.get("role");
    const { entryId, role } = participationSchema.parse({
      entryId: formData.get("entryId"),
      role: typeof roleRaw === "string" && roleRaw.trim() ? roleRaw.trim() : null,
    });

    const theme = await entryThemeOrThrow(entryId);
    const existing = await prisma.participation.findUnique({
      where: { entryId_userId: { entryId, userId: user.id } },
    });

    // 이미 기록돼 있는데 역할만 바꾸려는 경우가 있어, 역할이 들어오면 끄지 않고 고친다.
    if (existing && role !== null) {
      await prisma.participation.update({ where: { id: existing.id }, data: { role } });
      revalidateEntry(theme, entryId);
      return "기록을 고쳤어요.";
    }

    if (existing) {
      await prisma.participation.delete({ where: { id: existing.id } });
      revalidateEntry(theme, entryId);
      return "기록에서 뺐어요.";
    }

    await prisma.participation.create({ data: { entryId, userId: user.id, role } });
    revalidateEntry(theme, entryId);
    return "기록에 넣었어요.";
  });
}

/**
 * 내 베스트에서 순위를 한 칸 올리거나 내린다.
 *
 * rank 에 (userId, theme) 기준 고유 제약이 걸려 있어 두 줄을 그냥 맞바꾸면 충돌한다.
 * 그래서 한쪽을 잠깐 음수로 빼두고 세 단계로 바꾼다.
 */
export async function moveFavorite(formData: FormData): Promise<void> {
  const user = await requireUser();
  const entryId = z.string().min(1).parse(formData.get("entryId"));
  const direction = z.enum(["up", "down"]).parse(formData.get("direction"));

  const current = await prisma.favorite.findUnique({
    where: { userId_entryId: { userId: user.id, entryId } },
  });
  if (!current) return;

  const neighbor = await prisma.favorite.findFirst({
    where: {
      userId: user.id,
      theme: current.theme,
      rank: direction === "up" ? { lt: current.rank } : { gt: current.rank },
    },
    orderBy: { rank: direction === "up" ? "desc" : "asc" },
  });
  // 맨 위에서 올리거나 맨 아래에서 내리면 할 일이 없다.
  if (!neighbor) return;

  await prisma.$transaction([
    prisma.favorite.update({ where: { id: current.id }, data: { rank: -1 } }),
    prisma.favorite.update({ where: { id: neighbor.id }, data: { rank: current.rank } }),
    prisma.favorite.update({ where: { id: current.id }, data: { rank: neighbor.rank } }),
  ]);

  revalidateEntry(current.theme as ThemeKey, entryId);
}
