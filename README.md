# OurLittleArchive

둘이 함께한 것들과 앞으로 같이 할 것들을 모아두는 비공개 기록 사이트.

음악 · 방탈출 · 독서 · 보드게임 · 머더미스터리 · 공간, 여섯 가지 테마를 다룬다.

## 시작하기

```bash
cp .env.example .env     # 값을 채운다 (아래 참고)
npm install
npm run db:migrate       # SQLite 파일 생성 + 스키마 적용
npm run db:seed          # 두 사람 계정 생성
npm run dev
```

http://localhost:3000 에서 열린다.

### .env

| 변수 | 설명 |
| --- | --- |
| `DATABASE_URL` | 개발은 `file:./prisma/dev.db` 그대로 두면 된다 |
| `AUTH_SECRET` | 세션 쿠키 서명 키. `openssl rand -base64 32` 결과를 넣는다 |
| `SEED_USER_A_*` / `SEED_USER_B_*` | 두 사람의 slug / 표시 이름 / 비밀번호 |
| `KAKAO_REST_API_KEY` | 책 검색과 장소 검색에 쓴다 (아직 연동 전) |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | 지도 표시에 쓴다 (아직 연동 전) |

이름이나 비밀번호를 바꾸면 `npm run db:seed` 를 다시 실행한다. upsert 라 기존 기록은 그대로 남는다.

## 구조

테마 여섯 개가 사실상 같은 모양이라 — **항목 + 했음/하고싶음 + 각자 평점 + 각자 감상평** —
`Entry` 하나로 모두 표현한다. 테마마다 다른 필드만 `metaJson` 에 넣는다.

| 파일 | 역할 |
| --- | --- |
| `lib/themes.ts` | **테마 정의의 단일 출처.** 허용값, 기능 플래그, 테마별 meta 의 Zod 스키마 |
| `lib/theme-fields.ts` | meta 를 폼에 어떻게 그릴지. 검증이 아니라 표시 담당 |
| `lib/entry-schema.ts` | 폼 입력을 검증해 저장 가능한 모양으로 바꾼다 |
| `lib/entries.ts` | 화면이 쓰는 조회 함수 |
| `app/actions/entries.ts` | 등록·수정·평점·감상평·베스트·사진 서버 액션 |
| `lib/storage.ts` | 사진 저장. 위치를 숨겨 두어 클라우드로 바꾸기 쉽게 했다 |
| `lib/music/itunes.ts` | iTunes 곡 검색. 키 없이 쓰고 결과를 캐시한다 |
| `lib/music/embeds.ts` | 붙여넣은 유튜브/Spotify 링크를 임베드 주소로 바꾼다 |
| `lib/auth.ts` | 세션. 읽기는 누구나, 쓰기는 로그인 |

### 테마를 추가하려면

1. `lib/themes.ts` 의 `THEME_KEYS` 에 키를 넣고 `THEMES` 에 설정을 더한다
2. meta 가 필요하면 Zod 스키마와 `lib/theme-fields.ts` 의 필드 표를 더한다

목록·상세·등록 화면은 이 설정을 읽어 동작하므로 화면 코드는 고치지 않아도 된다.

### 데이터 모델

- `Entry` — 모든 테마의 항목. `status` 로 했음(DONE)/하고싶음(WISHLIST) 구분
- `Participation` — 누가 경험했는지. 방탈출은 보통 둘 다, 머더미스터리는 각자
- `Rating` / `Review` — 사람마다 하나씩. 감상평은 스포일러 플래그로 가릴 수 있다
- `Favorite` — 각자의 베스트 (보드게임 베스트가 여기 해당)
- `DailyPick` — 날짜별 추천 (음악의 오늘의 곡, 독서 추천 코너)
- `Photo` — 항목에 붙는 사진

## 사진

업로드된 사진은 `./uploads` 에 저장되고 `/api/photos/...` 로 서빙된다.
서버에서 `sharp` 를 거치므로:

- 아이폰 HEIC 가 JPEG 로 변환된다
- EXIF 회전이 실제 픽셀에 적용된다
- 긴 변이 2400px 로 줄어든다
- EXIF 가 제거되어 촬영 위치가 링크로 새어나가지 않는다

## 음악

곡 검색은 **iTunes Search API** 를 쓴다. 키도 계정도 필요 없다.

고를 때 알아둘 것:

- 한글로 검색해도 잘 찾는다. 다만 제목이 로마자로 올 때가 있어
  (밤편지 → Through the Night) 저장 전에 고칠 수 있게 해 두었다.
- `country=KR` 을 붙이면 결과가 항상 0건이라 그 파라미터는 보내지 않는다.
- 분당 20회 제한이 있어 검색창은 입력이 멈춘 뒤에 호출하고, 결과를 10분간 캐시한다.

듣기는 두 가지다:

- **30초 미리듣기** — iTunes 가 주는 것. 곡을 고르면 자동으로 붙는다.
- **전곡 재생** — 곡 상세의 `고치기` 에서 유튜브 링크를 적으면 임베드로 재생된다.
  유튜브와 Spotify 임베드는 API 키가 필요 없다.

### 다른 음원 서비스를 안 쓴 이유

- **멜론 · 지니 · 벅스** — 공개 API 가 없다.
- **Deezer** — 키는 필요 없지만 한국 곡 검색이 거의 안 된다.
  "아이유 밤편지" 를 치면 엉뚱한 피아노 커버가 나온다.
- **MusicBrainz** — 한글 제목을 제대로 주지만 K-pop 검색 정확도가 낮고 초당 1회 제한이라
  검색창에 쓰기 어렵다.
- **Spotify** — 2024-11-27 정책 변경으로 신규 앱은 미리듣기 주소를 받을 수 없다.
  링크를 적어두면 임베드 재생은 된다.
- **YouTube Data API** — 한글 제목과 전곡 재생을 모두 주지만 Google Cloud 키가 필요하고
  검색이 하루 100회로 제한된다. 썸네일도 정사각 앨범아트가 아니라 16:9 영상 캡처다.
  나중에 한글 제목을 자동으로 채우고 싶으면 이걸 더하면 된다.

## 공개 범위

링크를 아는 사람은 볼 수 있고, 기록을 남기려면 로그인해야 한다.
검색엔진에는 걸리지 않도록 `robots.txt` 와 메타태그로 막아두었다.

## 아직 안 한 것

- 카카오 책 검색 연동 (독서)
- 카카오 장소 검색과 지도 (공간)
- 테마별 전용 화면 (베스트 보드게임 진열, 공간 지도)
- 운영 배포 (Postgres 전환, 사진 클라우드 스토리지)

### Postgres 로 옮길 때

1. `prisma/schema.prisma` 의 `provider` 를 `postgresql` 로
2. `npm i @prisma/adapter-pg` 후 `lib/db.ts` 의 어댑터 교체 (주석에 적어두었다)
3. 마이그레이션을 새로 만든다
