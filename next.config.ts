import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    create-next-app 은 cacheComponents 를 켜 둔다. 이 옵션은 동적 데이터 접근을
    전부 <Suspense> 로 감싸거나 "use cache" 로 캐시하라고 요구한다.

    지금은 루트 레이아웃이 cookies() 로 로그인 상태를 읽어 헤더를 그리므로
    모든 페이지가 동적이고, 켜 두면 라우트마다 instant = false 를 붙이는 것 말고는
    할 수 있는 게 없다. 그러면 옵션을 켠 의미가 없다.

    나중에 헤더의 로그인 영역을 Suspense 로 떼어내고 테마 목록에 캐시를 붙일 때
    다시 켜면 된다. 그때는 껍데기가 즉시 뜨고 목록만 스트리밍된다.

    partialPrefetching 도 cacheComponents 를 요구하므로 함께 꺼 둔다.
  */

  // Tailwind 4 는 Turbopack 로더로 들어온다. 이 규칙이 없으면 CSS 가 그대로 지나가
  // 스타일이 하나도 적용되지 않는다.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  images: {
    /**
     * 우리가 업로드한 사진은 /api/photos/... 로 같은 출처에서 오므로 설정이 필요 없다.
     *
     * 아래 호스트는 외부 API 가 주는 커버 이미지 주소다.
     * 지금은 외부 커버를 일반 <img> 로 그려서 임의 주소도 깨지지 않게 하고 있고,
     * 음악/책 검색 연동을 붙인 뒤 이 호스트들만 next/image 로 바꿀 수 있다.
     */
    remotePatterns: [
      { protocol: "https", hostname: "is1-ssl.mzstatic.com" }, // iTunes 앨범 아트
      { protocol: "https", hostname: "is2-ssl.mzstatic.com" },
      { protocol: "https", hostname: "is3-ssl.mzstatic.com" },
      { protocol: "https", hostname: "e-cdns-images.dzcdn.net" }, // Deezer 커버
      { protocol: "https", hostname: "search1.kakaocdn.net" }, // 카카오 책 표지
      { protocol: "https", hostname: "img1.kakaocdn.net" },
      { protocol: "https", hostname: "cf.geekdo-images.com" }, // BoardGameGeek
    ],
  },
};

export default nextConfig;
