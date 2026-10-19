import "dotenv/config";
import { prisma } from "../lib/db";
import { deletePhoto } from "../lib/storage";

/**
 * 기록을 전부 지워요. 계정 두 개는 남겨요.
 *
 *   npm run db:reset-entries           보기만 해요
 *   npm run db:reset-entries -- --yes  실제로 지워요
 *
 * Entry 를 지우면 거기 달린 참여·평점·감상평·베스트·추천·사진 레코드는
 * 스키마의 onDelete: Cascade 로 같이 지워져요.
 * 사진 파일은 저장소에서 따로 지워야 해서 먼저 치워요.
 */
async function main() {
  const confirmed = process.argv.includes("--yes");

  const [entries, photos, users] = await Promise.all([
    prisma.entry.count(),
    prisma.photo.findMany({ select: { key: true } }),
    prisma.user.count(),
  ]);

  const counts = await prisma.entry.groupBy({
    by: ["theme"],
    _count: { _all: true },
  });

  console.log(`기록 ${entries}건, 사진 ${photos.length}장 (계정 ${users}개는 그대로 둬요)`);
  for (const row of counts) {
    console.log(`  ${row.theme}: ${row._count._all}건`);
  }

  if (!confirmed) {
    console.log("\n미리보기예요. 실제로 지우려면 --yes 를 붙여 주세요.");
    return;
  }

  for (const photo of photos) {
    await deletePhoto(photo.key);
  }

  const removed = await prisma.entry.deleteMany({});
  console.log(`\n기록 ${removed.count}건을 지웠어요.`);

  const left = await prisma.user.findMany({
    select: { slug: true, displayName: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("남은 계정:", left.map((u) => `${u.displayName}(${u.slug})`).join(", "));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
