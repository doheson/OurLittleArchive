import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI 설정.
 *
 * TypeScript 가 아니라 .mjs 로 둔다. Prisma 는 .ts 설정을 읽을 때 Node 의
 * 타입 스트리핑에 기대는데, 그게 기본으로 켜지는 Node 버전이 환경마다 다르다.
 * 평범한 ESM 으로 두면 어느 Node 에서든 그냥 읽힌다.
 *
 * datasource.url 에 prisma/config 의 env() 를 쓰지 않는다.
 * env() 는 변수가 없으면 설정을 읽는 시점에 바로 던진다. 그래서 DATABASE_URL 이
 * 아직 없는 환경에서는 URL 이 필요 없는 prisma generate 까지 같이 실패한다.
 * Vercel 첫 배포가 postinstall 의 generate 에서 이것 때문에 죽었다.
 *
 * 빈 문자열이면 마이그레이션 명령이 자기 메시지로 실패하고, generate 는 통과한다.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
