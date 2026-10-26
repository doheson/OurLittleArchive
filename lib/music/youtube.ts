import { z } from "zod";
import { youtubeVideoId } from "./embeds";
import { MusicSearchError, type MusicTrack } from "./track";

/**
 * 붙여넣은 유튜브 주소에서 곡 정보를 읽어와요.
 *
 * 유튜브에는 oEmbed 라는 공개 창구가 있어요. API 키도 계정도 할당량도 없어요.
 * YouTube Data API 는 검색 한 번에 100포인트씩 깎여서 하루 100번이 끝인데,
 * 이쪽은 그런 제한이 없어요. music.youtube.com 주소도 그대로 받아줘요.
 *
 * 다만 돌려주는 건 "영상" 정보예요. 그래서 두 가지를 손봐요.
 *
 * 1) 유튜브뮤직에서 복사한 링크(아트 트랙)는 채널명이 "BIG Naughty - Topic" 으로 와요.
 *    뒤의 " - Topic" 만 떼면 가수 이름이 돼요.
 * 2) 일반 영상은 제목이 "가수 - 곡 (Official Video)" 처럼 와요.
 *    앞의 가수명과 뒤의 꼬리표를 떼어 두되, 어차피 저장 전에 고칠 수 있게 해요.
 */

const OEMBED_ENDPOINT = "https://www.youtube.com/oembed";
const REQUEST_TIMEOUT_MS = 8000;

const oembedSchema = z.object({
  title: z.string().optional(),
  author_name: z.string().optional(),
});

/** 영상 제목에 흔히 붙는 꼬리표예요. 곡 제목이 아니라서 떼어내요. */
const NOISE_TAG =
  /\s*[([](?:official\s+)?(?:music\s+)?(?:lyric\s+)?(?:video|audio|mv|m\/v|lyrics?|visualizer|teaser|performance\s+video|4k\s*remaster(?:ed)?)[)\]]/gi;

function cleanTitle(rawTitle: string, artist: string): string {
  let title = rawTitle.trim();

  // "가수 - 곡" 형태면 앞의 가수명을 떼요. 부제 칸에 따로 들어가니까요.
  if (artist) {
    const prefix = new RegExp(`^${escapeRegExp(artist)}\\s*[-–—]\\s*`, "i");
    title = title.replace(prefix, "");
  }

  let previous: string;
  do {
    previous = title;
    title = title.replace(NOISE_TAG, "");
  } while (title !== previous);

  return title.replace(/\s{2,}/g, " ").trim() || rawTitle.trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 쓸 수 있는 가장 큰 썸네일을 골라요.
 *
 * 아트 트랙은 1280x720 가운데에 정사각형 앨범 아트가 들어 있어요.
 * 화면에서는 정사각 칸에 object-cover 로 그리니 가운데만 잘려서 앨범 아트 그대로 나와요.
 * maxresdefault 가 없는 영상도 있어서 없으면 한 단계 낮춰요.
 */
async function pickArtwork(videoId: string): Promise<string | null> {
  for (const name of ["maxresdefault", "hqdefault"]) {
    const url = `https://i.ytimg.com/vi/${videoId}/${name}.jpg`;
    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) return url;
    } catch {
      // 한 장 확인에 실패해도 다음 크기를 계속 시도해요.
    }
  }
  return null;
}

export async function fetchYouTubeTrack(rawUrl: string): Promise<MusicTrack> {
  const videoId = youtubeVideoId(rawUrl.trim());
  if (!videoId) {
    throw new MusicSearchError(
      "유튜브 주소가 아니에요. 유튜브나 유튜브뮤직에서 '공유 → 링크 복사' 로 받은 주소를 붙여넣어 주세요.",
    );
  }

  const url = new URL(OEMBED_ENDPOINT);
  url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
  url.searchParams.set("format", "json");

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new MusicSearchError("유튜브에 연결하지 못했어요.");
  }

  // 비공개·삭제·연령제한 영상은 oEmbed 가 열어주지 않아요.
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    throw new MusicSearchError("비공개이거나 삭제된 영상이에요. 다른 링크를 넣어 주세요.");
  }
  if (!response.ok) {
    throw new MusicSearchError("유튜브에서 곡 정보를 가져오지 못했어요.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await response.text());
  } catch {
    throw new MusicSearchError("유튜브가 보낸 정보를 읽지 못했어요.");
  }

  const parsed = oembedSchema.safeParse(payload);
  if (!parsed.success || !parsed.data.title) {
    throw new MusicSearchError("유튜브가 보낸 정보에 제목이 없어요.");
  }

  const artist = (parsed.data.author_name ?? "").replace(/\s*-\s*Topic$/i, "").trim();

  return {
    source: "YOUTUBE",
    trackId: videoId,
    title: cleanTitle(parsed.data.title, artist),
    // 채널명이 비어 오는 일은 거의 없지만, 비면 부제 칸을 비워 두고 직접 적게 해요.
    artist: artist || "",
    album: null,
    artworkUrl: await pickArtwork(videoId),
    appleUrl: null,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    genre: null,
    releasedAt: null,
  };
}
