/**
 * 곡 하나를 담는 모양이에요.
 *
 * 곡은 두 군데서 와요. iTunes 검색과, 붙여넣은 유튜브 링크예요.
 * 고른 뒤의 화면과 저장 과정은 똑같아서 한 모양으로 맞춰 뒀어요.
 */
export type MusicSource = "ITUNES" | "YOUTUBE";

export type MusicTrack = {
  source: MusicSource;
  /** 그 출처 안에서의 id. Entry 의 externalId 로 저장해 같은 곡이 두 번 등록되지 않게 해요. */
  trackId: string;
  title: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null;
  appleUrl: string | null;
  youtubeUrl: string | null;
  genre: string | null;
  releasedAt: string | null;
};

/** 곡을 찾는 중에 생긴, 화면에 그대로 보여줄 수 있는 오류예요. */
export class MusicSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MusicSearchError";
  }
}
