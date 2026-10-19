import type { Prisma } from "./generated/prisma/client";
import { prisma } from "./db";
import { parseMeta, type EntryStatus, type ThemeKey } from "./themes";
import { photoUrl } from "./storage";
import { toDayKey } from "./date";

/**
 * 화면에서 쓰는 조회 함수들.
 * 테마마다 화면은 다르지만 필요한 데이터 모양은 같아서 여기서 한 번만 정의한다.
 */

const entryInclude = {
  createdBy: { select: { id: true, slug: true, displayName: true } },
  participations: {
    select: {
      userId: true,
      role: true,
      user: { select: { id: true, slug: true, displayName: true } },
    },
  },
  ratings: {
    select: { userId: true, score: true, updatedAt: true },
  },
  reviews: {
    select: {
      id: true,
      userId: true,
      body: true,
      isSpoiler: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  photos: {
    select: { id: true, key: true, width: true, height: true, caption: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  },
} as const;

type RawEntry = Prisma.EntryGetPayload<{ include: typeof entryInclude }>;

/** 화면에 넘기기 좋게 가공한 항목. metaJson 은 파싱해서 meta 로 바꿔 둔다. */
export type EntryView = Omit<RawEntry, "metaJson" | "photos"> & {
  theme: ThemeKey;
  status: EntryStatus;
  meta: Record<string, unknown>;
  photos: (RawEntry["photos"][number] & { url: string })[];
  /** 두 사람의 평점 평균. 한 명만 매겼으면 그 점수. 아무도 안 매겼으면 null. */
  averageScore: number | null;
};

function toView(entry: RawEntry): EntryView {
  const { metaJson, photos, ...rest } = entry;
  const scores = entry.ratings.map((r) => r.score);

  return {
    ...rest,
    theme: entry.theme as ThemeKey,
    status: entry.status as EntryStatus,
    meta: parseMeta(entry.theme as ThemeKey, metaJson),
    photos: photos.map((photo) => ({ ...photo, url: photoUrl(photo.key) })),
    averageScore: scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null,
  };
}

export type ListEntriesOptions = {
  theme: ThemeKey;
  status?: EntryStatus;
  subCategory?: string | null;
  /** 특정 사람이 경험한 것만. 머더미스터리의 "각자 기록" 에서 쓴다. */
  participantId?: string;
  take?: number;
};

export async function listEntries(options: ListEntriesOptions): Promise<EntryView[]> {
  const { theme, status, subCategory, participantId, take } = options;

  const entries = await prisma.entry.findMany({
    where: {
      theme,
      ...(status ? { status } : {}),
      ...(subCategory !== undefined ? { subCategory } : {}),
      ...(participantId ? { participations: { some: { userId: participantId } } } : {}),
    },
    include: entryInclude,
    // 경험한 날짜가 있으면 최근 순, 없으면 등록 순으로 본다.
    orderBy: [{ experiencedOn: "desc" }, { createdAt: "desc" }],
    ...(take ? { take } : {}),
  });

  return entries.map(toView);
}

export async function getEntry(id: string): Promise<EntryView | null> {
  const entry = await prisma.entry.findUnique({ where: { id }, include: entryInclude });
  return entry ? toView(entry) : null;
}

/** 테마별 개수. 목록 화면의 탭에 숫자를 붙일 때 쓴다. */
export async function countByStatus(theme: ThemeKey): Promise<Record<EntryStatus, number>> {
  const rows = await prisma.entry.groupBy({
    by: ["status"],
    where: { theme },
    _count: { _all: true },
  });

  const counts: Record<EntryStatus, number> = { DONE: 0, WISHLIST: 0 };
  for (const row of rows) {
    if (row.status === "DONE" || row.status === "WISHLIST") {
      counts[row.status] = row._count._all;
    }
  }
  return counts;
}

/** 해당 날짜의 추천. 음악의 "오늘 추천" 과 독서의 "추천 코너" 가 공유한다. */
export async function getDailyPick(theme: ThemeKey, date: Date) {
  const pick = await prisma.dailyPick.findUnique({
    where: { theme_pickedOn: { theme, pickedOn: toDayKey(date) } },
    include: {
      pickedBy: { select: { id: true, slug: true, displayName: true } },
      entry: { include: entryInclude },
    },
  });

  if (!pick) return null;
  return { ...pick, entry: toView(pick.entry) };
}

/** 각자의 베스트 목록. */
export async function listFavorites(theme: ThemeKey) {
  const favorites = await prisma.favorite.findMany({
    where: { theme },
    orderBy: [{ userId: "asc" }, { rank: "asc" }],
    include: {
      user: { select: { id: true, slug: true, displayName: true } },
      entry: { include: entryInclude },
    },
  });

  return favorites.map((favorite) => ({ ...favorite, entry: toView(favorite.entry) }));
}

/** 홈 화면용. 테마를 가로질러 최근 기록을 가져온다. */
export async function listRecentEntries(take = 12): Promise<EntryView[]> {
  const entries = await prisma.entry.findMany({
    include: entryInclude,
    orderBy: { createdAt: "desc" },
    take,
  });
  return entries.map(toView);
}

/** 지난 추천 목록. 음악의 "그동안 고른 곡" 줄에 쓴다. */
export async function listRecentDailyPicks(theme: ThemeKey, take = 14) {
  const picks = await prisma.dailyPick.findMany({
    where: { theme },
    orderBy: { pickedOn: "desc" },
    take,
    include: {
      pickedBy: { select: { id: true, slug: true, displayName: true } },
      entry: { include: entryInclude },
    },
  });

  return picks.map((pick) => ({ ...pick, entry: toView(pick.entry) }));
}

/**
 * 공간 테마의 세 분류별 개수.
 * 화면은 "데이트 / 여행 / 가보고 싶은 곳" 으로 보지만
 * DB 에는 status 와 subCategory 두 칸으로 나뉘어 있어 여기서 합친다.
 */
export async function countPlaceBuckets(): Promise<{
  DATE: number;
  TRAVEL: number;
  WISH: number;
}> {
  const rows = await prisma.entry.groupBy({
    by: ["status", "subCategory"],
    where: { theme: "PLACE" },
    _count: { _all: true },
  });

  const counts = { DATE: 0, TRAVEL: 0, WISH: 0 };
  for (const row of rows) {
    if (row.status === "WISHLIST") {
      counts.WISH += row._count._all;
    } else if (row.subCategory === "DATE" || row.subCategory === "TRAVEL") {
      counts[row.subCategory] += row._count._all;
    }
  }
  return counts;
}
