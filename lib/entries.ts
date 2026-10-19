import type { Prisma } from "./generated/prisma/client";
import { prisma } from "./db";
import { parseMeta, THEME_KEYS, type EntryStatus, type ThemeKey } from "./themes";
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

/**
 * 홈 화면용. 테마를 가로질러 최근에 "한 것" 을 가져온다.
 *
 * 하고 싶은 것은 listUpcoming 이 따로 가져온다.
 * 둘을 나눠두지 않으면 같은 항목이 홈 한 화면에 두 번 나온다.
 */
export async function listRecentEntries(take = 12): Promise<EntryView[]> {
  const entries = await prisma.entry.findMany({
    where: { status: "DONE" },
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

/** 테마별 했음/하고싶음 개수. 홈의 현황 칸에서 쓴다. */
export async function countAllThemes(): Promise<
  Record<ThemeKey, Record<EntryStatus, number>>
> {
  const rows = await prisma.entry.groupBy({
    by: ["theme", "status"],
    _count: { _all: true },
  });

  const counts = Object.fromEntries(
    THEME_KEYS.map((key) => [key, { DONE: 0, WISHLIST: 0 }]),
  ) as Record<ThemeKey, Record<EntryStatus, number>>;

  for (const row of rows) {
    const theme = row.theme as ThemeKey;
    if (!(theme in counts)) continue; // 더 이상 쓰지 않는 테마가 남아 있어도 무시한다
    if (row.status === "DONE" || row.status === "WISHLIST") {
      counts[theme][row.status] = row._count._all;
    }
  }
  return counts;
}

/**
 * 테마를 가로질러 "앞으로 할 것들" 을 모은다.
 * 사이트의 절반은 함께 할 일을 모아두는 쪽이라 홈에서 같이 보여준다.
 */
export async function listUpcoming(take = 6): Promise<EntryView[]> {
  const entries = await prisma.entry.findMany({
    where: { status: "WISHLIST" },
    include: entryInclude,
    orderBy: { createdAt: "desc" },
    take,
  });
  return entries.map(toView);
}

/**
 * 그 테마에서 지금까지 쓴 부제 목록이에요.
 *
 * 방탈출의 업체/지점처럼 같은 값을 반복해서 적게 되는 칸이 있어요.
 * 등록 화면에서 고를 수 있게 모아서 넘겨요.
 */
export async function listSubtitleSuggestions(
  theme: ThemeKey,
  take = 30,
): Promise<string[]> {
  /*
    groupBy 로 묶어요. findMany + distinct 를 쓰면 take 가 먼저 걸리고 중복은
    그 뒤에 걸러져서, 같은 업체를 여러 번 적었을 때 후보가 몇 개 안 남아요.
    groupBy 는 DB 에서 묶은 뒤에 자르니까 그런 일이 없어요.
  */
  const rows = await prisma.entry.groupBy({
    by: ["subtitle"],
    where: { theme, subtitle: { not: null } },
    // take 를 쓰려면 orderBy 가 있어야 해요. 최종 정렬은 아래에서 한글 기준으로 다시 해요.
    orderBy: { subtitle: "asc" },
    take,
  });

  return rows
    .map((row) => row.subtitle)
    .filter((value): value is string => Boolean(value && value.trim()))
    .sort((a, b) => a.localeCompare(b, "ko"));
}
