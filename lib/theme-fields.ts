import type { ThemeKey } from "./themes";

/**
 * meta 필드를 폼에 어떻게 그릴지 적어둔 표.
 *
 * 검증 규칙은 lib/themes.ts 의 Zod 스키마가 갖고 있고, 여기는 화면 표시만 담당한다.
 * 둘을 나눈 이유는 스키마에 라벨 같은 표시용 정보를 섞지 않기 위해서다.
 * 필드를 추가할 때는 양쪽을 같이 고쳐야 한다.
 */
export type MetaField = {
  name: string;
  label: string;
  /** list 는 쉼표로 구분해 입력받아 배열로 저장한다. */
  type: "text" | "number" | "boolean" | "list";
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
};

export const THEME_META_FIELDS: Record<ThemeKey, MetaField[]> = {
  MUSIC: [
    // artist 는 스키마에 남아 있지만 폼에는 없다. 부제 칸이 아티스트이고,
    // 검색 연동을 붙이면 meta.artist 는 자동으로 채워진다.
    { name: "album", label: "앨범", type: "text" },
    { name: "genre", label: "장르", type: "text" },
    { name: "spotifyUrl", label: "Spotify 링크", type: "text", hint: "여기에 넣으면 전곡을 들을 수 있어요" },
    { name: "youtubeUrl", label: "YouTube 링크", type: "text" },
  ],
  ESCAPE_ROOM: [
    { name: "genre", label: "장르", type: "text", placeholder: "공포, 추리, 감성…" },
    { name: "difficulty", label: "공식 난이도", type: "number", min: 1, max: 5, step: 0.5 },
    { name: "cleared", label: "탈출 성공", type: "boolean" },
    { name: "remainingSec", label: "남은 시간(초)", type: "number", min: 0, step: 1 },
    { name: "hintCount", label: "힌트 사용", type: "number", min: 0, step: 1 },
    { name: "playerCount", label: "인원", type: "number", min: 1, step: 1 },
  ],
  BOOK: [
    // authors 도 부제 칸과 겹쳐서 폼에서는 뺐다. 책 검색 연동이 채운다.
    { name: "translators", label: "역자", type: "list", hint: "여러 명이면 쉼표로 구분해 주세요" },
    { name: "publisher", label: "출판사", type: "text" },
    { name: "isbn", label: "ISBN", type: "text" },
    { name: "pageCount", label: "쪽수", type: "number", min: 1, step: 1 },
    { name: "publishedAt", label: "출간일", type: "text", placeholder: "2024-03" },
  ],
  // 보드게임은 제목만 적어두면 충분해요. 칸을 비워두면 "보드게임 정보" 묶음 자체가 안 나와요.
  // 나중에 필요해지면 lib/themes.ts 의 boardGameMeta 스키마가 그대로 있으니 되살리면 돼요.
  BOARD_GAME: [],
  MURDER_MYSTERY: [
    { name: "genre", label: "장르", type: "text" },
    // 맡은 캐릭터는 사람마다 달라서 각자 기록(Participation.role)에 적어요.
    // 인원과 소요 시간은 쓰지 않기로 해서 뺐어요.
  ],
  PLACE: [
    { name: "category", label: "분류", type: "text", placeholder: "카페, 전시, 식당…" },
    { name: "phone", label: "전화", type: "text" },
    { name: "kakaoPlaceUrl", label: "카카오맵 링크", type: "text" },
    { name: "visitCount", label: "방문 횟수", type: "number", min: 1, step: 1 },
  ],
};

/** 부제 칸의 라벨은 테마마다 다르다. */
export const SUBTITLE_LABELS: Record<ThemeKey, string> = {
  MUSIC: "아티스트",
  ESCAPE_ROOM: "업체 / 지점",
  BOOK: "저자",
  BOARD_GAME: "퍼블리셔",
  MURDER_MYSTERY: "퍼블리셔 / 제작",
  PLACE: "한 줄 설명",
};
