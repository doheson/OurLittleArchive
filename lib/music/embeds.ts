/**
 * 붙여넣은 링크를 임베드 주소로 바꾼다.
 *
 * 유튜브와 Spotify 임베드는 API 키가 필요 없다.
 * iTunes 가 주는 건 30초 미리듣기뿐이라, 전곡을 듣고 싶으면
 * 곡 상세에서 유튜브 링크를 적어두면 된다.
 */

/** 유튜브 영상 id 만 뽑는다. 주소를 그대로 iframe 에 넣지 않기 위해서다. */
export function youtubeEmbedUrl(url: string | undefined): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "");
  let id: string | null = null;

  if (host === "youtu.be") {
    id = parsed.pathname.slice(1);
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (parsed.pathname === "/watch") {
      id = parsed.searchParams.get("v");
    } else if (parsed.pathname.startsWith("/embed/")) {
      id = parsed.pathname.slice("/embed/".length);
    } else if (parsed.pathname.startsWith("/shorts/")) {
      id = parsed.pathname.slice("/shorts/".length);
    }
  }

  // 영상 id 는 영숫자와 -_ 로만 이루어진다. 그 외가 섞였으면 주소를 믿지 않는다.
  if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

/** Spotify 트랙 링크를 임베드 주소로. 키 없이 동작한다. */
export function spotifyEmbedUrl(url: string | undefined): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.hostname.replace(/^www\./, "") !== "open.spotify.com") return null;

  // /track/{id} 또는 /intl-ko/track/{id}
  const match = /\/track\/([A-Za-z0-9]+)/.exec(parsed.pathname);
  if (!match) return null;

  return `https://open.spotify.com/embed/track/${match[1]}`;
}
