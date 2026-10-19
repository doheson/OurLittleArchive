import { z } from "zod";

/**
 * 테마 정의의 단일 출처.
 *
 * DB 는 theme / status 를 문자열로만 들고 있고(SQLite 와 Postgres 양쪽에서 동작하도록),
 * 허용값과 테마별 필드의 진짜 정의는 모두 이 파일에 있다.
 * 테마를 추가하려면 THEME_KEYS 에 키를 넣고 THEMES 에 설정을 더하면 된다.
 * 목록/상세/등록 화면은 이 설정을 읽어 generic 하게 동작한다.
 */

export const THEME_KEYS = [
  "MUSIC",
  "ESCAPE_ROOM",
  "BOOK",
  "BOARD_GAME",
  "MURDER_MYSTERY",
  "PLACE",
] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

export const ENTRY_STATUSES = ["DONE", "WISHLIST"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const EXTERNAL_SOURCES = [
  "ITUNES",
  "DEEZER",
  "KAKAO_BOOK",
  "KAKAO_LOCAL",
  "BGG",
  "MANUAL",
] as const;
export type ExternalSource = (typeof EXTERNAL_SOURCES)[number];

/** 공간 테마만 하위 분류를 쓴다: 데이트 / 여행 */
export const PLACE_SUB_CATEGORIES = ["DATE", "TRAVEL"] as const;
export type PlaceSubCategory = (typeof PLACE_SUB_CATEGORIES)[number];

export const themeKeySchema = z.enum(THEME_KEYS);
export const entryStatusSchema = z.enum(ENTRY_STATUSES);
export const externalSourceSchema = z.enum(EXTERNAL_SOURCES);

// ---------------------------------------------------------------------------
// 테마별 meta 스키마 — Entry.metaJson 에 JSON 문자열로 저장된다.
// ---------------------------------------------------------------------------

const musicMeta = z.object({
  artist: z.string().optional(),
  album: z.string().optional(),
  genre: z.string().optional(),
  releasedAt: z.string().optional(),
  /** Deezer / iTunes 가 주는 30초 미리듣기 */
  previewUrl: z.string().url().optional(),
  appleUrl: z.string().url().optional(),
  /** Spotify 는 API 키 없이 임베드만 쓴다 */
  spotifyUrl: z.string().url().optional(),
  youtubeUrl: z.string().url().optional(),
});

const escapeRoomMeta = z.object({
  // 업체/지점은 Entry.subtitle 이 담는다. 여기에 또 두면 같은 걸 두 번 입력하게 된다.
  genre: z.string().optional(),
  /** 공식 난이도 1~5 */
  difficulty: z.number().min(1).max(5).optional(),
  cleared: z.boolean().optional(),
  /** 남은 시간(초). 탈출 성공했을 때만 의미가 있다. */
  remainingSec: z.number().int().min(0).optional(),
  hintCount: z.number().int().min(0).optional(),
  playerCount: z.number().int().min(1).optional(),
});

const bookMeta = z.object({
  authors: z.array(z.string()).optional(),
  translators: z.array(z.string()).optional(),
  publisher: z.string().optional(),
  isbn: z.string().optional(),
  pageCount: z.number().int().min(1).optional(),
  publishedAt: z.string().optional(),
});

const boardGameMeta = z.object({
  designer: z.string().optional(),
  minPlayers: z.number().int().min(1).optional(),
  maxPlayers: z.number().int().min(1).optional(),
  playTimeMin: z.number().int().min(1).optional(),
  /** BGG 의 weight(복잡도) 1~5 */
  weight: z.number().min(1).max(5).optional(),
  bggId: z.string().optional(),
});

const murderMysteryMeta = z.object({
  // 공연장은 Entry.subtitle 이 담는다.
  genre: z.string().optional(),
  playerCount: z.number().int().min(1).optional(),
  /** 내가 맡은 캐릭터. 사람마다 다르므로 각자 기록에서 쓴다. */
  character: z.string().optional(),
  durationMin: z.number().int().min(1).optional(),
});

const placeMeta = z.object({
  /** 카카오 로컬이 주는 카테고리 문자열 */
  category: z.string().optional(),
  phone: z.string().optional(),
  kakaoPlaceUrl: z.string().url().optional(),
  visitCount: z.number().int().min(1).optional(),
});

export const THEME_META_SCHEMAS = {
  MUSIC: musicMeta,
  ESCAPE_ROOM: escapeRoomMeta,
  BOOK: bookMeta,
  BOARD_GAME: boardGameMeta,
  MURDER_MYSTERY: murderMysteryMeta,
  PLACE: placeMeta,
} satisfies Record<ThemeKey, z.ZodTypeAny>;

export type ThemeMeta = {
  [K in ThemeKey]: z.infer<(typeof THEME_META_SCHEMAS)[K]>;
};

// ---------------------------------------------------------------------------
// 테마 설정 — 화면이 이 플래그를 읽고 무엇을 보여줄지 결정한다.
// ---------------------------------------------------------------------------

export type ThemeConfig = {
  key: ThemeKey;
  /** URL 경로 */
  slug: string;
  label: string;
  tagline: string;
  /** status 를 테마 어휘로 바꿔 보여준다 */
  statusLabels: Record<EntryStatus, string>;
  /** 각자 평점을 매기는가 */
  hasRating: boolean;
  /** 각자 감상평을 남기는가 */
  hasReview: boolean;
  /** 각자의 베스트를 고르는가 */
  hasFavorite: boolean;
  /** 날짜별 추천 코너가 있는가 */
  hasDailyPick: boolean;
  /** 경험한 날짜를 기록하는가 */
  hasDate: boolean;
  /** 위치와 지도를 쓰는가 */
  hasLocation: boolean;
  hasPhotos: boolean;
  /** 둘이 같이 한 것과 각자 한 것을 구분해 보여주는가 */
  tracksPerPerson: boolean;
  /** 감상평에 스포일러 가리기를 기본 제공하는가 */
  spoilerSensitive: boolean;
  subCategories?: readonly string[];
  subCategoryLabels?: Record<string, string>;
};

export const THEMES: Record<ThemeKey, ThemeConfig> = {
  MUSIC: {
    key: "MUSIC",
    slug: "music",
    label: "음악",
    tagline: "오늘 서로에게 들려주고 싶은 한 곡",
    statusLabels: { DONE: "추천한 곡", WISHLIST: "들어볼 곡" },
    hasRating: true,
    hasReview: true,
    hasFavorite: true,
    hasDailyPick: true,
    hasDate: false,
    hasLocation: false,
    hasPhotos: false,
    tracksPerPerson: false,
    spoilerSensitive: false,
  },
  ESCAPE_ROOM: {
    key: "ESCAPE_ROOM",
    slug: "escape",
    label: "방탈출",
    tagline: "같이 들어갔던 방들의 기록",
    statusLabels: { DONE: "다녀온 방", WISHLIST: "가보고 싶은 방" },
    hasRating: true,
    hasReview: true,
    hasFavorite: true,
    hasDailyPick: false,
    hasDate: true,
    hasLocation: true,
    hasPhotos: true,
    tracksPerPerson: true,
    spoilerSensitive: true,
  },
  BOOK: {
    key: "BOOK",
    slug: "books",
    label: "독서",
    tagline: "서로에게 권하고, 읽고 나서 이야기하기",
    statusLabels: { DONE: "읽은 책", WISHLIST: "읽고 싶은 책" },
    hasRating: true,
    hasReview: true,
    hasFavorite: true,
    hasDailyPick: true,
    hasDate: true,
    hasLocation: false,
    hasPhotos: false,
    tracksPerPerson: true,
    spoilerSensitive: true,
  },
  BOARD_GAME: {
    key: "BOARD_GAME",
    slug: "boardgames",
    label: "보드게임",
    tagline: "각자의 베스트와, 앞으로 꺼낼 상자들",
    statusLabels: { DONE: "해본 게임", WISHLIST: "해보고 싶은 게임" },
    hasRating: true,
    hasReview: true,
    hasFavorite: true,
    hasDailyPick: false,
    hasDate: true,
    hasLocation: false,
    hasPhotos: true,
    tracksPerPerson: false,
    spoilerSensitive: false,
  },
  MURDER_MYSTERY: {
    key: "MURDER_MYSTERY",
    slug: "murder",
    label: "머더미스터리",
    tagline: "각자 해본 공연과, 같이 하고 싶은 공연",
    statusLabels: { DONE: "플레이한 공연", WISHLIST: "같이 하고 싶은 공연" },
    hasRating: true,
    hasReview: true,
    hasFavorite: true,
    hasDailyPick: false,
    hasDate: true,
    hasLocation: true,
    hasPhotos: true,
    // 한쪽만 해본 공연이 많은 테마라 각자 기록을 구분해 보여준다.
    tracksPerPerson: true,
    // 스포일러가 가장 민감한 테마. 감상평은 기본적으로 가린다.
    spoilerSensitive: true,
  },
  PLACE: {
    key: "PLACE",
    slug: "places",
    label: "공간",
    tagline: "데이트한 곳, 여행한 곳, 앞으로 갈 곳",
    statusLabels: { DONE: "다녀온 곳", WISHLIST: "가보고 싶은 곳" },
    hasRating: true,
    hasReview: true,
    hasFavorite: true,
    hasDailyPick: false,
    hasDate: true,
    hasLocation: true,
    hasPhotos: true,
    tracksPerPerson: false,
    spoilerSensitive: false,
    subCategories: PLACE_SUB_CATEGORIES,
    subCategoryLabels: { DATE: "데이트", TRAVEL: "여행" },
  },
};

export const THEME_LIST: ThemeConfig[] = THEME_KEYS.map((key) => THEMES[key]);

export function themeBySlug(slug: string): ThemeConfig | undefined {
  return THEME_LIST.find((t) => t.slug === slug);
}

/** 테마가 허용하는 하위 분류인지 확인한다. 하위 분류가 없는 테마는 null 만 허용한다. */
export function isValidSubCategory(theme: ThemeKey, value: string | null | undefined): boolean {
  const allowed = THEMES[theme].subCategories;
  if (!allowed) return value == null;
  return value == null || allowed.includes(value);
}

/**
 * metaJson 을 테마 스키마로 파싱한다.
 * 저장된 값이 깨져 있어도 화면이 죽지 않도록 빈 객체를 돌려준다.
 */
export function parseMeta<K extends ThemeKey>(theme: K, metaJson: string | null): ThemeMeta[K] {
  if (!metaJson) return {} as ThemeMeta[K];
  try {
    const parsed = THEME_META_SCHEMAS[theme].safeParse(JSON.parse(metaJson));
    return (parsed.success ? parsed.data : {}) as ThemeMeta[K];
  } catch {
    return {} as ThemeMeta[K];
  }
}

/** 입력값을 테마 스키마로 검증해 저장용 JSON 문자열로 만든다. 빈 객체면 null. */
export function serializeMeta<K extends ThemeKey>(theme: K, input: unknown): string | null {
  const parsed = THEME_META_SCHEMAS[theme].parse(input ?? {});
  const entries = Object.entries(parsed as Record<string, unknown>).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  return entries.length ? JSON.stringify(Object.fromEntries(entries)) : null;
}
