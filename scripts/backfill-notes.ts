import "dotenv/config";
import { prisma } from "../lib/db";

/**
 * 예전에 DailyPick 에만 저장되던 한마디를 항목으로 옮겨요.
 *
 *   npm run db:backfill-notes            무엇이 바뀌는지만 보여줘요
 *   npm run db:backfill-notes -- --yes   실제로 옮겨요
 *
 * 비어 있는 note 만 채워요. 이미 적힌 글은 건드리지 않아요.
 */
async function main() {
  const confirmed = process.argv.includes("--yes");

  const picks = await prisma.dailyPick.findMany({
    where: { comment: { not: null }, entry: { note: null } },
    select: {
      comment: true,
      entry: { select: { id: true, title: true, createdBy: { select: { displayName: true } } } },
    },
  });

  if (picks.length === 0) {
    console.log("옮길 한마디가 없어요.");
    return;
  }

  console.log(`옮길 대상 ${picks.length}건:`);
  for (const p of picks) {
    console.log(`  「${p.entry.title}」 (등록: ${p.entry.createdBy.displayName})`);
    console.log(`     ${p.comment?.slice(0, 50)}…`);
  }

  if (!confirmed) {
    console.log("\n미리보기예요. 실제로 옮기려면 --yes 를 붙여 주세요.");
    return;
  }

  for (const p of picks) {
    await prisma.entry.update({
      where: { id: p.entry.id },
      data: { note: p.comment },
    });
  }
  console.log(`\n${picks.length}건을 항목으로 옮겼어요.`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
