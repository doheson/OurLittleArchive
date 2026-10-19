import { z } from "zod";

/**
 * 카카오 로컬 — 키워드로 장소 검색.
 *
 * GET https://dapi.kakao.com/v2/local/search/keyword.json
 * 헤더: Authorization: KakaoAK {REST_API_KEY}   (책 검색과 같은 키)
 *
 * 단, 앱에서 카카오맵을 켜야 한다.
 * 켜지 않으면 403 과 함께 "disabled OPEN_MAP_AND_LOCAL service" 가 돌아온다.
 * 콘솔의 [카카오맵] > [사용 설정] 에서 상태를 ON 으로 바꾸면 된다.
 * 무료 쿼터는 계정에서 처음 카카오맵을 켠 앱에만 주어져요.
 */

const SEARCH_ENDPOINT = "https://dapi.kakao.com/v2/local/search/keyword.json";
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const REQUEST_TIMEOUT_MS = 8000;

export type KakaoPlace = {
  /** 카카오 장소 id. Entry.externalId 가 되어 같은 곳이 두 번 등록되지 않게 한다. */
  placeId: string;
  name: string;
  category: string | null;
  address: string | null;
  roadAddress: string | null;
  phone: string | null;
  /** 지도에 찍을 좌표 */
  lat: number;
  lng: number;
  placeUrl: string | null;
};

const documentSchema = z.object({
  id: z.string().optional(),
  place_name: z.string().optional(),
  category_name: z.string().optional(),
  category_group_name: z.string().optional(),
  address_name: z.string().optional(),
  road_address_name: z.string().optional(),
  phone: z.string().optional(),
  // 좌표는 문자열로 온다. x 가 경도(lng), y 가 위도(lat) 다. 헷갈리기 쉽다.
  x: z.string().optional(),
  y: z.string().optional(),
  place_url: z.string().optional(),
});

const responseSchema = z.object({
  documents: z.array(z.unknown()).optional(),
});

export class PlaceSearchError extends Error {
  /** 키가 없거나 카카오맵이 꺼져 있어 못 쓰는 상태인지. 화면에서 안내를 다르게 보여준다. */
  readonly needsSetup: boolean;

  constructor(message: string, needsSetup = false) {
    super(message);
    this.name = "PlaceSearchError";
    this.needsSetup = needsSetup;
  }
}

export function isPlaceSearchConfigured(): boolean {
  return Boolean(process.env.KAKAO_REST_API_KEY?.trim());
}

function toPlace(raw: unknown): KakaoPlace | null {
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) return null;

  const { id, place_name } = parsed.data;
  const lng = Number(parsed.data.x);
  const lat = Number(parsed.data.y);

  // 좌표가 없으면 지도에 찍을 수 없고, id 가 없으면 중복을 가릴 기준이 없다.
  if (!id || !place_name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    placeId: id,
    name: place_name,
    // category_name 은 "음식점 > 카페 > 커피전문점" 처럼 길게 온다. 끝 단어만 쓴다.
    category:
      parsed.data.category_group_name?.trim() ||
      parsed.data.category_name?.split(">").pop()?.trim() ||
      null,
    address: parsed.data.address_name?.trim() || null,
    roadAddress: parsed.data.road_address_name?.trim() || null,
    phone: parsed.data.phone?.trim() || null,
    lat,
    lng,
    placeUrl: parsed.data.place_url || null,
  };
}

const cache = new Map<string, { at: number; places: KakaoPlace[] }>();

function readCache(key: string): KakaoPlace[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.places;
}

function writeCache(key: string, places: KakaoPlace[]): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), places });
}

export async function searchPlaces(term: string, size = 12): Promise<KakaoPlace[]> {
  const query = term.trim();
  if (query.length < 2) return [];

  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!apiKey) {
    throw new PlaceSearchError(
      "카카오 REST API 키가 없어요. .env 의 KAKAO_REST_API_KEY 를 채워 주세요.",
      true,
    );
  }

  const cacheKey = `${query.toLowerCase()}::${size}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("size", String(Math.min(Math.max(size, 1), 15)));

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new PlaceSearchError("장소 검색 서버에 연결하지 못했어요.");
  }

  if (response.status === 401) {
    throw new PlaceSearchError("카카오 키가 거부됐어요. 키가 맞는지 확인해 주세요.", true);
  }
  if (response.status === 403) {
    // 앱에서 카카오맵을 켜지 않으면 여기로 온다. 가장 자주 걸리는 지점이라 따로 안내한다.
    throw new PlaceSearchError(
      "앱에서 카카오맵이 꺼져 있어요. 콘솔의 [카카오맵] > [사용 설정] 에서 켜 주세요.",
      true,
    );
  }
  if (response.status === 429) {
    throw new PlaceSearchError("검색을 너무 많이 했어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!response.ok) {
    throw new PlaceSearchError("장소 검색에 실패했어요.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PlaceSearchError("장소 검색 결과를 읽지 못했어요.");
  }

  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new PlaceSearchError("장소 검색 결과 형식이 예상과 달라요.");
  }

  const places = (parsed.data.documents ?? [])
    .map(toPlace)
    .filter((place): place is KakaoPlace => place !== null);

  writeCache(cacheKey, places);
  return places;
}
