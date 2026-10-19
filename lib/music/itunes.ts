import { z } from "zod";

/**
 * iTunes Search API.
 *
 * 키도 계정도 필요 없다. 대신 두 가지를 알고 있어야 한다.
 *
 * 1) country=KR 을 넣으면 결과가 항상 0건으로 돌아온다. 직접 확인했다.
 *    파라미터를 빼면 한글 검색어도 잘 찾는다("아이유" → IU). 그래서 country 를 보내지 않는다.
 *    대신 아티스트명이 로마자로 돌아오는 경우가 있어, 등록 화면에서 제목을 고칠 수 있게 해 두었다.
 *
 * 2) 분당 20회 정도로 제한된다. 타이핑할 때마다 부르면 금방 막히므로
 *    화면에서 입력을 debounce 하고 여기서 결과를 짧게 캐시한다.
 *
 * Spotify 는 2024-11-27 정책 변경으로 신규 앱이 preview_url 을 받을 수 없다.
 * iTunes 는 미리듣기를 그대로 주기 때문에 여기를 기본으로 쓴다.
 */

const SEARCH_ENDPOINT = "https://itunes.apple.com/search";
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const REQUEST_TIMEOUT_MS = 8000;

export type ITunesTrack = {
  /** iTunes 의 trackId. Entry.externalId 로 저장해 같은 곡이 두 번 등록되지 않게 한다. */
  trackId: string;
  title: string;
  artist: string;
  album: string | null;
  /** 600x600 으로 키운 앨범 이미지 */
  artworkUrl: string | null;
  /** 30초 미리듣기 */
  previewUrl: string | null;
  appleUrl: string | null;
  genre: string | null;
  releasedAt: string | null;
};

/** 응답에서 우리가 쓰는 필드만 느슨하게 받는다. 없는 필드가 있어도 검색이 통째로 실패하지 않게 한다. */
const rawTrackSchema = z.object({
  trackId: z.number().optional(),
  trackName: z.string().optional(),
  artistName: z.string().optional(),
  collectionName: z.string().optional(),
  artworkUrl100: z.string().optional(),
  previewUrl: z.string().optional(),
  trackViewUrl: z.string().optional(),
  primaryGenreName: z.string().optional(),
  releaseDate: z.string().optional(),
});

const responseSchema = z.object({
  resultCount: z.number().optional(),
  results: z.array(z.unknown()).optional(),
});

/**
 * 앨범 이미지 주소는 끝에 크기가 박혀 있어서 바꿔치기하면 더 큰 이미지를 받는다.
 * 1200까지 올라가지만 600이면 화면에 충분하고 용량이 1/4 수준이다.
 */
function upscaleArtwork(url: string | undefined): string | null {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb\.(jpg|png)$/, "/600x600bb.$1");
}

function toTrack(raw: unknown): ITunesTrack | null {
  const parsed = rawTrackSchema.safeParse(raw);
  if (!parsed.success) return null;

  const { trackId, trackName, artistName } = parsed.data;
  // 이 셋이 없으면 화면에 보여줄 것도, 중복을 가릴 기준도 없다.
  if (trackId == null || !trackName || !artistName) return null;

  return {
    trackId: String(trackId),
    title: trackName,
    artist: artistName,
    album: parsed.data.collectionName ?? null,
    artworkUrl: upscaleArtwork(parsed.data.artworkUrl100),
    previewUrl: parsed.data.previewUrl ?? null,
    appleUrl: parsed.data.trackViewUrl ?? null,
    genre: parsed.data.primaryGenreName ?? null,
    releasedAt: parsed.data.releaseDate?.slice(0, 10) ?? null,
  };
}

const cache = new Map<string, { at: number; tracks: ITunesTrack[] }>();

function readCache(key: string): ITunesTrack[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.tracks;
}

function writeCache(key: string, tracks: ITunesTrack[]): void {
  // 가장 오래된 항목부터 버린다. Map 은 삽입 순서를 유지한다.
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), tracks });
}

export class MusicSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MusicSearchError";
  }
}

export async function searchTracks(term: string, limit = 12): Promise<ITunesTrack[]> {
  const query = term.trim();
  if (query.length < 2) return [];

  const cacheKey = `${query.toLowerCase()}::${limit}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("term", query);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", String(limit));
  // country 는 일부러 넣지 않는다. 위 설명 참고.

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new MusicSearchError("음악 검색 서버에 연결하지 못했어요.");
  }

  if (response.status === 403 || response.status === 429) {
    throw new MusicSearchError("검색을 너무 자주 했어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!response.ok) {
    throw new MusicSearchError("음악 검색에 실패했어요.");
  }

  // 가끔 Content-Type 이 text/javascript 로 와서 json() 이 실패할 수 있다.
  const body = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new MusicSearchError("음악 검색 결과를 읽지 못했어요.");
  }

  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new MusicSearchError("음악 검색 결과 형식이 예상과 달라요.");
  }

  const tracks = (parsed.data.results ?? [])
    .map(toTrack)
    .filter((track): track is ITunesTrack => track !== null);

  writeCache(cacheKey, tracks);
  return tracks;
}
