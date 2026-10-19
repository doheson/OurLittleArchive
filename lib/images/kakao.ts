import { z } from "zod";

/**
 * 카카오 이미지 검색으로 커버 이미지를 찾는다.
 *
 * 보드게임·머더미스터리·방탈출은 커버를 줄 만한 공개 API 가 없다.
 *  - 보드라이프: 공개 API 없음
 *  - BoardGameGeek: 등록과 토큰이 필요하고 비상업 승인에 일주일 이상 걸린다
 *    (인증 없이 부르면 401 이다. 직접 확인했다)
 * 그래서 이미 쓰고 있는 카카오 키로 이미지 검색을 쓴다.
 *
 * 다만 검색 결과를 그대로 쓰면 안 된다. 상당수가 네이버 블로그 이미지인데
 * 다른 도메인에서 부르면 403 으로 막힌다. 화면에는 깨진 이미지만 남는다.
 * 그래서 고르기 전에 서버에서 실제로 열리는지 확인하고, 되는 것만 보여준다.
 */

const SEARCH_ENDPOINT = "https://dapi.kakao.com/v2/search/image";
const SEARCH_TIMEOUT_MS = 8000;
const PROBE_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 50;

export type CoverCandidate = {
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
};

const documentSchema = z.object({
  image_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const responseSchema = z.object({
  documents: z.array(z.unknown()).optional(),
});

export class CoverSearchError extends Error {
  readonly needsSetup: boolean;

  constructor(message: string, needsSetup = false) {
    super(message);
    this.name = "CoverSearchError";
    this.needsSetup = needsSetup;
  }
}

export function isCoverSearchConfigured(): boolean {
  return Boolean(process.env.KAKAO_REST_API_KEY?.trim());
}

/** 운영은 https 라 http 이미지는 브라우저가 막는다. 올려서 쓴다. */
function toHttps(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * 브라우저가 이 주소를 띄울 때 쓰는 Referer.
 *
 * 네이버 블로그 이미지는 Referer 를 보고 다른 도메인이면 403 을 준다.
 * 서버에서 Referer 없이 받아보면 통과해버려서, 화면에서만 깨지는 것을 못 거른다.
 * 그래서 브라우저와 같은 조건으로 확인한다.
 */
function probeReferer(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return site.replace(/\/+$/, "") + "/";
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}/`;
  return "http://localhost:3000/";
}

/**
 * 이 주소가 우리 사이트에서 실제로 열리는지 본다.
 * HEAD 를 거부하는 CDN 이 있어 GET 으로 맨 앞 1바이트만 받아본다.
 */
async function loadsFromOutside(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: {
        Range: "bytes=0-0",
        "User-Agent": "Mozilla/5.0",
        Referer: probeReferer(),
      },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!response.ok && response.status !== 206) return false;
    // 차단 페이지를 이미지인 척 돌려주는 곳도 있어 타입을 확인한다.
    return (response.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}

const cache = new Map<string, { at: number; covers: CoverCandidate[] }>();

function readCache(key: string): CoverCandidate[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.covers;
}

function writeCache(key: string, covers: CoverCandidate[]): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), covers });
}

export async function searchCovers(term: string, want = 9): Promise<CoverCandidate[]> {
  const query = term.trim();
  if (query.length < 2) return [];

  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!apiKey) {
    throw new CoverSearchError(
      "카카오 REST API 키가 설정되지 않았다. .env 의 KAKAO_REST_API_KEY 를 채운다.",
      true,
    );
  }

  const cacheKey = `${query.toLowerCase()}::${want}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("query", query);
  // 열리지 않는 게 섞여 있으므로 넉넉히 받아 거른다.
  url.searchParams.set("size", "30");
  url.searchParams.set("sort", "accuracy");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
  } catch {
    throw new CoverSearchError("이미지 검색 서버에 연결하지 못했다.");
  }

  if (response.status === 401 || response.status === 403) {
    throw new CoverSearchError("카카오 키가 거부됐다. 키가 맞는지 확인한다.", true);
  }
  if (response.status === 429) {
    throw new CoverSearchError("검색 요청이 한도를 넘었다. 잠시 후 다시 시도한다.");
  }
  if (!response.ok) {
    throw new CoverSearchError("이미지 검색에 실패했다.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CoverSearchError("이미지 검색 응답을 읽지 못했다.");
  }

  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new CoverSearchError("이미지 검색 응답 형식이 예상과 다르다.");
  }

  const seen = new Set<string>();
  const candidates: CoverCandidate[] = [];

  for (const raw of parsed.data.documents ?? []) {
    const doc = documentSchema.safeParse(raw);
    if (!doc.success) continue;

    const full = doc.data.image_url ? toHttps(doc.data.image_url) : null;
    const thumb = doc.data.thumbnail_url ? toHttps(doc.data.thumbnail_url) : null;
    if (!full || !thumb || seen.has(full)) continue;

    // 너무 작은 건 커버로 쓰기 어렵다.
    const width = doc.data.width ?? 0;
    const height = doc.data.height ?? 0;
    if (width < 200 || height < 200) continue;

    seen.add(full);
    candidates.push({ url: full, thumbnailUrl: thumb, width, height });
  }

  // 열리는지 한꺼번에 확인하고 순서는 그대로 둔다(정확도 순).
  const usable = await Promise.all(
    candidates.map(async (candidate) => ((await loadsFromOutside(candidate.url)) ? candidate : null)),
  );

  const covers = usable
    .filter((candidate): candidate is CoverCandidate => candidate !== null)
    .slice(0, want);

  writeCache(cacheKey, covers);
  return covers;
}
