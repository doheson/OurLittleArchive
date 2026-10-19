import "dotenv/config";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/password";

/**
 * 두 사람 계정만 만든다. 가입 화면은 없다.
 * 이름이나 비밀번호를 바꾸려면 .env 를 고치고 다시 실행하면 된다 (upsert 라 안전하다).
 */

type SeedUser = {
  slug: string;
  displayName: string;
  password: string;
};

function readSeedUser(suffix: "A" | "B", fallbackSlug: string, fallbackName: string): SeedUser {
  const slug = process.env[`SEED_USER_${suffix}_SLUG`] ?? fallbackSlug;
  const displayName = process.env[`SEED_USER_${suffix}_NAME`] ?? fallbackName;
  const password = process.env[`SEED_USER_${suffix}_PASSWORD`];

  if (!password) {
    throw new Error(
      `SEED_USER_${suffix}_PASSWORD 가 .env 에 없다. .env.example 을 참고해 채운다.`,
    );
  }
  return { slug, displayName, password };
}

async function main() {
  const users = [readSeedUser("A", "zeons", "나"), readSeedUser("B", "partner", "너")];

  if (users[0].slug === users[1].slug) {
    throw new Error("두 계정의 SLUG 가 같다. 서로 다르게 설정한다.");
  }

  for (const user of users) {
    const passwordHash = await hashPassword(user.password);
    const saved = await prisma.user.upsert({
      where: { slug: user.slug },
      update: { displayName: user.displayName, passwordHash },
      create: { slug: user.slug, displayName: user.displayName, passwordHash },
    });
    console.log(`계정 준비됨: ${saved.slug} (${saved.displayName})`);
  }

  const total = await prisma.user.count();
  if (total > 2) {
    console.warn(`주의: 계정이 ${total}개 있다. 이 사이트는 2명을 전제로 만들어졌다.`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
