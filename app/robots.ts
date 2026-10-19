import type { MetadataRoute } from "next";

/**
 * 링크를 아는 사람은 들어올 수 있지만 검색에는 걸리지 않게 한다.
 * layout.tsx 의 robots 메타태그와 짝을 이룬다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
