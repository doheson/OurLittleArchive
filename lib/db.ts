import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

/**
 * Prisma 7 은 런타임 연결을 드라이버 어댑터로 받아요.
 *
 * Postgres 하나만 써요. 개발도 같은 provider 여야 해요.
 * SQLite 로 개발하고 Postgres 로 배포하면 마이그레이션 기록이 갈라지고,
 * 로컬에서는 통과하는데 운영에서 깨지는 차이가 생겨요.
 * Neon 은 브랜치를 여러 개 주니까 개발용 브랜치를 따로 쓰면 돼요.
 */
function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL 이 없어요. .env.example 을 복사해 .env 를 만들어 주세요.");
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    /*
      서버리스 함수는 한 번에 요청 하나를 처리해요. 그래서 인스턴스마다
      커넥션을 여러 개 들고 있을 이유가 없어요.
      pg 의 기본값은 10인데, 함수 인스턴스가 늘어나면 그만큼 곱해져서
      Neon 쪽 한도를 금방 넘겨요. 그때는 오류가 아니라 쿼리가 빈 자리를
      기다리며 그냥 멈춰요. 화면이 로딩 상태에서 안 넘어가는 증상이 그거였어요.
    */
    max: 2,
    // 안 쓰는 커넥션은 빨리 돌려줘요.
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({ adapter });
}

/*
  전역에 담아둬요.

  개발에서는 HMR 이 모듈을 다시 평가해서 연결이 쌓이는 걸 막아주고,
  운영(서버리스)에서는 같은 함수 인스턴스가 여러 요청을 처리할 때
  풀을 다시 만들지 않게 해줘요. 예전에는 운영에서만 이 캐시를 건너뛰었는데,
  그래서 요청이 쌓일수록 커넥션이 늘어나다가 멈췄어요.
*/
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
