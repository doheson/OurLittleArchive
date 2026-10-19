import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

/**
 * Prisma 7 은 런타임 연결을 드라이버 어댑터로 받는다.
 *
 * Postgres 하나만 쓴다. 개발도 같은 provider 를 써야 한다.
 * SQLite 로 개발하고 Postgres 로 배포하면 마이그레이션 기록이 갈라지고,
 * 로컬에서는 통과하는데 운영에서 깨지는 차이가 생긴다.
 * Neon 은 브랜치를 여러 개 주므로 개발용 브랜치를 따로 쓰면 된다.
 *
 * 서버리스에서는 연결이 금방 쌓이므로 Neon 의 pooled 연결 문자열
 * (-pooler 가 붙은 host)을 쓴다.
 */
function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL 이 설정되지 않았다. .env.example 을 복사해 .env 를 만든다.");
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

// dev 서버는 HMR 로 모듈을 다시 평가하므로 전역에 붙여 연결이 쌓이지 않게 한다.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
