import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client";

/**
 * Prisma 7 은 런타임 연결을 드라이버 어댑터로 받는다.
 * Postgres 로 옮길 때는 @prisma/adapter-pg 를 설치하고 이 함수 안의 어댑터만 바꾸면 된다.
 *   const adapter = new PrismaPg({ connectionString: databaseUrl });
 * 스키마의 datasource provider 도 postgresql 로 바꾸고 마이그레이션을 새로 만들어야 한다.
 */
function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL 이 설정되지 않았다. .env.example 을 복사해 .env 를 만든다.");
  }

  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
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
