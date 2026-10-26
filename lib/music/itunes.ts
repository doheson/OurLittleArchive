import { z } from "zod";
import { MusicSearchError, type MusicTrack } from "./track";

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
 * 검색에 안 나오는 곡도 있어요. 그때는 유튜브 링크를 붙여넣는 쪽을 쓰면 돼요.
 * lib/music/youtube.ts 가 그쪽을 맡아요.
 */

const SEARCH_ENDPOINT = "https://itunes.apple.com/search";
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const REQUEST_TIMEOUT_MS = 8000;

/** 응답에서 우리가 쓰는 필드만 느슨하게 받는다. 없는 필드가 있어도 검색이 통째로 실패하지 않게 한다. */
const rawTrackSchema = z.object({
  trackId: z.number().optional(),
  trackName: z.string().optional(),
  artistName: z.string().optional(),
  collectionName: z.string().optional(),
  artworkUrl100: z.string().optional(),
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

function toTrack(raw: unknown): MusicTrack | null {
  const parsed = rawTrackSchema.safeParse(raw);
  if (!parsed.success) return null;

  const { trackId, trackName, artistName } = parsed.data;
  // 이 셋이 없으면 화면에 보여줄 것도, 중복을 가릴 기준도 없다.
  if (trackId == null || !trackName || !artistName) return null;

  return {
    source: "ITUNES",
    trackId: String(trackId),
    title: trackName,
    artist: artistName,
    album: parsed.data.collectionName ?? null,
    artworkUrl: upscaleArtwork(parsed.data.artworkUrl100),
    appleUrl: parsed.data.trackViewUrl ?? null,
    youtubeUrl: null,
    genre: parsed.data.primaryGenreName ?? null,
    releasedAt: parsed.data.releaseDate?.slice(0, 10) ?? null,
  };
}


/** 검색어를 의미 있는 토막으로 나눠요. 한 글자는 걸러요. */
function queryTokens(query: string): string[] {
  return query
    .split(/\s+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length >= 2);
}

/**
 * 일반 검색이 끝내 못 찾아준 검색어 토막을 추려요.
 *
 * 제목에도 아티스트명에도 안 걸린 토막이 "찾던 건데 안 나온 것" 이에요.
 * 되짚기는 이 토막만 기준으로 삼아요. 전체 토막으로 하면
 * "BIG Naughty Hachiko" 에서 아티스트명이 긴 탓에 다른 곡의 피처링 표기가
 * 더 높은 점수를 받아, 정작 Hachiko 가 뒤로 밀려요.
 */
function missingTokens(tracks: MusicTrack[], tokens: string[]): string[] {
  return tokens.filter(
    (token) =>
      !tracks.some(
        (track) =>
          track.title.toLowerCase().includes(token) ||
          track.artist.toLowerCase().includes(token),
      ),
  );
}

/** 제목이 검색어와 얼마나 맞는지. 긴 토막이 걸릴수록 높아요. */
function score(title: string, tokens: string[]): number {
  const lower = title.toLowerCase();
  return tokens.reduce(
    (sum, token) => (lower.includes(token) ? sum + token.length : sum),
    0,
  );
}

/**
 * 아티스트 목록에서 되짚어요.
 *
 * iTunes 의 검색 색인에 없는 곡이 있어요. 빅나티의 Hachiko 가 그랬어요.
 * 제목으로도 아티스트명을 같이 넣어도 100위 안에 안 나오는데,
 * 아티스트 id 로 카탈로그를 받으면 멀쩡히 들어 있어요.
 * 그래서 일반 검색이 빗나갔을 때만 이 경로로 한 번 더 찾아봐요.
 * 매번 하면 요청이 세 배가 되어 분당 제한에 걸려요.
 */
async function searchViaArtistCatalog(
  query: string,
  tokens: string[],
): Promise<MusicTrack[]> {
  if (tokens.length === 0) return [];

  try {
    const artistUrl = new URL(SEARCH_ENDPOINT);
    artistUrl.searchParams.set("term", query);
    artistUrl.searchParams.set("entity", "musicArtist");
    artistUrl.searchParams.set("limit", "1");

    const artistResponse = await fetch(artistUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!artistResponse.ok) return [];

    const artistPayload = JSON.parse(await artistResponse.text()) as {
      results?: { artistId?: number }[];
    };
    const artistId = artistPayload.results?.[0]?.artistId;
    if (!artistId) return [];

    const lookupUrl = new URL("https://itunes.apple.com/lookup");
    lookupUrl.searchParams.set("id", String(artistId));
    lookupUrl.searchParams.set("entity", "song");
    lookupUrl.searchParams.set("limit", "200");

    const lookupResponse = await fetch(lookupUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!lookupResponse.ok) return [];

    const lookupPayload = JSON.parse(await lookupResponse.text()) as { results?: unknown[] };

    return (lookupPayload.results ?? [])
      .map(toTrack)
      .filter((track): track is MusicTrack => track !== null)
      // 그 아티스트의 전곡이 아니라, 검색어가 제목에 들어간 것만 보여줘요.
      .filter((track) =>
        tokens.some((token) => track.title.toLowerCase().includes(token)),
      )
      /*
        가장 긴 토막이 제목에 든 곡을 앞에 둬요.
        "BIG Naughty Hachiko" 처럼 아티스트명이 섞이면 "naughty" 가
        다른 곡 제목(피처링 표기)에도 걸려서, 정작 찾던 Hachiko 가 뒤로 밀려요.
        긴 토막일수록 곡 제목일 가능성이 높아요.
      */
      .sort((a, b) => score(b.title, tokens) - score(a.title, tokens));
  } catch {
    // 되짚기가 실패해도 일반 검색 결과는 그대로 보여줘요.
    return [];
  }
}

const cache = new Map<string, { at: number; tracks: MusicTrack[] }>();

function readCache(key: string): MusicTrack[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.tracks;
}

function writeCache(key: string, tracks: MusicTrack[]): void {
  // 가장 오래된 항목부터 버린다. Map 은 삽입 순서를 유지한다.
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), tracks });
}

/**
 * 한 번에 돌려줄 곡 수.
 * 요청 수는 그대로이고 응답만 길어지므로 분당 제한에는 영향이 없어요.
 * 제목이 흔한 곡은 12개로는 원하는 게 안 나와서 늘렸어요.
 */
const DEFAULT_LIMIT = 30;

/** 검색 요청 한 번. 넓힌 검색어로 다시 부를 수 있도록 따로 떼어 뒀어요. */
async function fetchSearch(query: string, limit: number): Promise<MusicTrack[]> {
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

  return (parsed.data.results ?? [])
    .map(toTrack)
    .filter((track): track is MusicTrack => track !== null);
}

/**
 * 검색어가 좁으면 한 토막 줄여 더 받아와요.
 *
 * iTunes 는 넣은 말을 모두 만족하는 곡만 줘요. 그래서 말을 보탤수록 결과가 줄어요.
 * "아이유 밤편지" 는 30곡인데 "아이유 밤편지 라이브" 는 2곡이고,
 * "잔나비" 는 30곡인데 "잔나비 주저하는" 은 11곡이에요. 직접 세어 본 수예요.
 *
 * 정확히 맞은 곡을 앞에 두고, 뒤에 넓힌 결과를 덧붙여요.
 * 찾던 게 앞에 없으면 이어서 훑어볼 수 있게요.
 */
async function broadenSearch(
  tokens: string[],
  limit: number,
  already: MusicTrack[],
): Promise<MusicTrack[]> {
  // 마지막 토막을 떼요. 보통 마지막에 덧붙인 말이 결과를 가장 많이 깎아요.
  const broader = tokens.slice(0, -1).join(" ");
  if (!broader) return [];

  try {
    const more = await fetchSearch(broader, limit);
    const seen = new Set(already.map((track) => track.trackId));
    return more.filter((track) => !seen.has(track.trackId));
  } catch {
    // 넓히기가 실패해도 원래 결과는 그대로 보여줘요.
    return [];
  }
}

export async function searchTracks(
  term: string,
  limit = DEFAULT_LIMIT,
): Promise<MusicTrack[]> {
  const query = term.trim();
  if (query.length < 2) return [];

  const cacheKey = `${query.toLowerCase()}::${limit}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const tracks = await fetchSearch(query, limit);
  const tokens = queryTokens(query);
  let merged = tracks;

  // 1) 색인에 아예 없는 곡은 아티스트 목록에서 되짚어요.
  const missing = missingTokens(tracks, tokens);
  if (missing.length > 0) {
    const extra = await searchViaArtistCatalog(query, missing);
    if (extra.length > 0) {
      // 검색으로 못 찾은 곡을 앞에 둬요. 찾던 게 그쪽일 가능성이 높아요.
      const seen = new Set(tracks.map((track) => track.trackId));
      merged = [...extra.filter((track) => !seen.has(track.trackId)), ...tracks];
    }
  }

  // 2) 그래도 목록이 짧으면 검색어를 넓혀 채워요. 요청은 한 번만 더 해요.
  if (merged.length < limit && tokens.length >= 2) {
    merged = [...merged, ...(await broadenSearch(tokens, limit, merged))];
  }

  const result = merged.slice(0, limit);
  writeCache(cacheKey, result);
  return result;
}
