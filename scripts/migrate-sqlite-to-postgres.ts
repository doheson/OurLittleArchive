import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { prisma } from "../lib/db";

/**
 * 개발하면서 SQLite 에 쌓인 기록을 Postgres 로 옮긴다.
 *
 *   npm run db:import-sqlite            # prisma/dev.db 에서 읽는다
 *   npm run db:import-sqlite -- 경로
 *
 * Prisma 의 SQLite 는 DateTime 을 밀리초 정수로, Boolean 을 0/1 로 저장한다.
 * Postgres 로 넣기 전에 그 둘을 되돌려야 한다.
 *
 * 이미 같은 id 가 있으면 건너뛴다. 여러 번 실행해도 안전하다.
 */

const SOURCE = process.argv[2] ?? "prisma/dev.db";

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function toBool(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

async function main() {
  const db = new DatabaseSync(SOURCE, { readOnly: true });
  const read = (table: string) =>
    db.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];

  const summary: string[] = [];

  // 외래키 순서대로 넣는다. User → Entry → 나머지.
  const users = read("User");
  for (const row of users) {
    await prisma.user.upsert({
      where: { id: row.id as string },
      update: {},
      create: {
        id: row.id as string,
        slug: row.slug as string,
        displayName: row.displayName as string,
        avatarUrl: str(row.avatarUrl),
        passwordHash: row.passwordHash as string,
        createdAt: toDate(row.createdAt) ?? new Date(),
      },
    });
  }
  summary.push(`User ${users.length}건`);

  const entries = read("Entry");
  for (const row of entries) {
    await prisma.entry.upsert({
      where: { id: row.id as string },
      update: {},
      create: {
        id: row.id as string,
        theme: row.theme as string,
        status: row.status as string,
        subCategory: str(row.subCategory),
        title: row.title as string,
        subtitle: str(row.subtitle),
        note: str(row.note),
        coverImageUrl: str(row.coverImageUrl),
        externalId: str(row.externalId),
        externalSource: str(row.externalSource),
        experiencedOn: toDate(row.experiencedOn),
        locationName: str(row.locationName),
        address: str(row.address),
        lat: num(row.lat),
        lng: num(row.lng),
        metaJson: str(row.metaJson),
        createdById: row.createdById as string,
        createdAt: toDate(row.createdAt) ?? new Date(),
        updatedAt: toDate(row.updatedAt) ?? new Date(),
      },
    });
  }
  summary.push(`Entry ${entries.length}건`);

  for (const row of read("Participation")) {
    await prisma.participation.upsert({
      where: { id: row.id as string },
      update: {},
      create: {
        id: row.id as string,
        entryId: row.entryId as string,
        userId: row.userId as string,
        role: str(row.role),
      },
    });
  }
  summary.push(`Participation ${read("Participation").length}건`);

  for (const row of read("Rating")) {
    await prisma.rating.upsert({
      where: { id: row.id as string },
      update: {},
      create: {
        id: row.id as string,
        entryId: row.entryId as string,
        userId: row.userId as string,
        score: row.score as number,
        createdAt: toDate(row.createdAt) ?? new Date(),
        updatedAt: toDate(row.updatedAt) ?? new Date(),
      },
    });
  }
  summary.push(`Rating ${read("Rating").length}건`);

  for (const row of read("Review")) {
    await prisma.review.upsert({
      where: { id: row.id as string },
      update: {},
      create: {
        id: row.id as string,
        entryId: row.entryId as string,
        userId: row.userId as string,
        body: row.body as string,
        isSpoiler: toBool(row.isSpoiler),
        createdAt: toDate(row.createdAt) ?? new Date(),
        updatedAt: toDate(row.updatedAt) ?? new Date(),
      },
    });
  }
  summary.push(`Review ${read("Review").length}건`);

  for (const row of read("Favorite")) {
    await prisma.favorite.upsert({
      where: { id: row.id as string },
      update: {},
      create: {
        id: row.id as string,
        userId: row.userId as string,
        entryId: row.entryId as string,
        theme: row.theme as string,
        rank: row.rank as number,
      },
    });
  }
  summary.push(`Favorite ${read("Favorite").length}건`);

  for (const row of read("DailyPick")) {
    await prisma.dailyPick.upsert({
      where: { id: row.id as string },
      update: {},
      create: {
        id: row.id as string,
        theme: row.theme as string,
        pickedOn: toDate(row.pickedOn) ?? new Date(),
        entryId: row.entryId as string,
        pickedById: row.pickedById as string,
        comment: str(row.comment),
        createdAt: toDate(row.createdAt) ?? new Date(),
      },
    });
  }
  summary.push(`DailyPick ${read("DailyPick").length}건`);

  const photos = read("Photo");
  for (const row of photos) {
    await prisma.photo.upsert({
      where: { id: row.id as string },
      update: {},
      create: {
        id: row.id as string,
        entryId: row.entryId as string,
        key: row.key as string,
        width: num(row.width),
        height: num(row.height),
        caption: str(row.caption),
        sortOrder: (row.sortOrder as number) ?? 0,
        createdAt: toDate(row.createdAt) ?? new Date(),
      },
    });
  }
  summary.push(`Photo ${photos.length}건`);

  db.close();

  console.log(`${SOURCE} → Postgres 이전 완료`);
  for (const line of summary) console.log(`  ${line}`);

  if (photos.length > 0) {
    console.log("");
    console.log("주의: 사진 레코드는 옮겼지만 파일은 따로 올려야 한다.");
    console.log("      ./uploads 의 파일을 S3 버킷의 같은 키로 업로드한다.");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
