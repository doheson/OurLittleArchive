import { z } from "zod";

/**
 * 카카오 책 검색 (Daum 검색 API).
 *
 * GET https://dapi.kakao.com/v3/search/book
 * 헤더: Authorization: KakaoAK {REST_API_KEY}
 *
 * 국내 도서는 여기가 사실상 유일한 선택지다.
 * 알라딘 OpenAPI 는 2026-10 종료, 네이버 검색 API 는 신규 신청이 막혔고,
 * 멜론처럼 다른 국내 서비스도 공개 API 가 없다.
 *
 * 키는 https://developers.kakao.com 에서 앱을 만들면 바로 나온다(심사 없음).
 * 같은 키로 공간 테마의 장소 검색도 쓴다.
 */

const SEARCH_ENDPOINT = "https://dapi.kakao.com/v3/search/book";
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const REQUEST_TIMEOUT_MS = 8000;

export type KakaoBook = {
  /** ISBN-13 을 우선 쓴다. Entry.externalId 가 되어 중복 등록을 막는다. */
  isbn: string;
  title: string;
  authors: string[];
  translators: string[];
  publisher: string | null;
  /** 표지 이미지 */
  thumbnail: string | null;
  /** 책 소개 */
  contents: string | null;
  /** YYYY-MM-DD */
  publishedAt: string | null;
  /** 카카오 책 상세 페이지 */
  url: string | null;
};

const documentSchema = z.object({
  title: z.string().optional(),
  contents: z.string().optional(),
  url: z.string().optional(),
  isbn: z.string().optional(),
  datetime: z.string().optional(),
  authors: z.array(z.string()).optional(),
  publisher: z.string().optional(),
  translators: z.array(z.string()).optional(),
  thumbnail: z.string().optional(),
});

const responseSchema = z.object({
  documents: z.array(z.unknown()).optional(),
});

export class BookSearchError extends Error {
  /** 키가 없어서 못 쓰는 상태인지. 화면에서 안내 문구를 다르게 보여준다. */
  readonly needsSetup: boolean;

  constructor(message: string, needsSetup = false) {
    super(message);
    this.name = "BookSearchError";
    this.needsSetup = needsSetup;
  }
}

export function isBookSearchConfigured(): boolean {
  return Boolean(process.env.KAKAO_REST_API_KEY?.trim());
}

/**
 * isbn 필드에는 ISBN-10 과 ISBN-13 이 공백으로 구분되어 함께 올 수 있다.
 * 13자리를 우선 쓰고, 없으면 첫 번째 값을 쓴다.
 */
function pickIsbn(raw: string | undefined): string | null {
  if (!raw) return null;
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  return parts.find((part) => part.replace(/-/g, "").length === 13) ?? parts[0];
}

/**
 * 표지는 기본이 작게 온다(R120x174 수준).
 * 주소에 크기가 들어 있으면 두 배로 올려 고해상도 화면에서 흐려지지 않게 한다.
 * 형식이 다르면 원본을 그대로 쓴다.
 */
function upscaleThumbnail(url: string | undefined): string | null {
  if (!url) return null;
  return url.replace(/\/R(\d+)x(\d+)/, (whole, w: string, h: string) => {
    const width = Number(w) * 2;
    const height = Number(h) * 2;
    return Number.isFinite(width) && Number.isFinite(height)
      ? `/R${width}x${height}`
      : whole;
  });
}

function toBook(raw: unknown): KakaoBook | null {
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) return null;

  const isbn = pickIsbn(parsed.data.isbn);
  const title = parsed.data.title?.trim();
  // 제목이 없으면 보여줄 수 없고, isbn 이 없으면 중복을 가릴 기준이 없다.
  if (!isbn || !title) return null;

  return {
    isbn,
    title,
    authors: parsed.data.authors?.filter(Boolean) ?? [],
    translators: parsed.data.translators?.filter(Boolean) ?? [],
    publisher: parsed.data.publisher?.trim() || null,
    thumbnail: upscaleThumbnail(parsed.data.thumbnail),
    contents: parsed.data.contents?.trim() || null,
    publishedAt: parsed.data.datetime?.slice(0, 10) ?? null,
    url: parsed.data.url || null,
  };
}

const cache = new Map<string, { at: number; books: KakaoBook[] }>();

function readCache(key: string): KakaoBook[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.books;
}

function writeCache(key: string, books: KakaoBook[]): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), books });
}

export async function searchBooks(term: string, size = 12): Promise<KakaoBook[]> {
  const query = term.trim();
  if (query.length < 2) return [];

  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!apiKey) {
    throw new BookSearchError(
      "카카오 REST API 키가 설정되지 않았다. .env 의 KAKAO_REST_API_KEY 를 채운다.",
      true,
    );
  }

  const cacheKey = `${query.toLowerCase()}::${size}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("size", String(Math.min(Math.max(size, 1), 50)));
  url.searchParams.set("sort", "accuracy");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new BookSearchError("책 검색 서버에 연결하지 못했다.");
  }

  if (response.status === 401 || response.status === 403) {
    throw new BookSearchError(
      "카카오 키가 거부됐다. 키가 맞는지, 앱에 검색 기능이 켜져 있는지 확인한다.",
      true,
    );
  }
  if (response.status === 429) {
    throw new BookSearchError("검색 요청이 한도를 넘었다. 잠시 후 다시 시도한다.");
  }
  if (!response.ok) {
    throw new BookSearchError("책 검색에 실패했다.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new BookSearchError("책 검색 응답을 읽지 못했다.");
  }

  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new BookSearchError("책 검색 응답 형식이 예상과 다르다.");
  }

  const books = (parsed.data.documents ?? [])
    .map(toBook)
    .filter((book): book is KakaoBook => book !== null);

  writeCache(cacheKey, books);
  return books;
}
