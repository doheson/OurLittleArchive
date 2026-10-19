"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PlaceSearchError, searchPlaces } from "@/lib/places/kakao";
import { PLACE_SEARCH_IDLE, type PlaceSearchState } from "@/lib/places/search-state";
import { mergeApiMeta } from "@/lib/entry-schema";
import { runAction, type ActionResult } from "./result";

/** 검색창에서 입력이 멈출 때마다 부른다. 예외 대신 상태로 돌려준다. */
export async function searchPlacesAction(rawTerm: string): Promise<PlaceSearchState> {
  const term = rawTerm.trim();
  if (term.length < 2) return PLACE_SEARCH_IDLE;

  try {
    const places = await searchPlaces(term);
    return { status: "ok", term, places };
  } catch (error) {
    if (error instanceof PlaceSearchError) {
      return { status: "error", term, error: error.message, needsSetup: error.needsSetup };
    }
    console.error("[searchPlacesAction]", error);
    return { status: "error", term, error: "장소 검색에 실패했어요.", needsSetup: false };
  }
}

/**
 * 화면에서는 "데이트 / 여행 / 가보고 싶은 곳" 세 가지 중 하나를 고른다.
 * DB 에서는 status 와 subCategory 두 칸으로 나뉘는데,
 * 쓰는 사람 머릿속에서는 하나의 선택이므로 여기서 한 번만 변환한다.
 */
const BUCKETS = ["DATE", "TRAVEL", "WISH"] as const;
export type PlaceBucket = (typeof BUCKETS)[number];

const bucketSchema = z.enum(BUCKETS);

function bucketToFields(bucket: PlaceBucket): {
  status: "DONE" | "WISHLIST";
  subCategory: string | null;
} {
  // 가보고 싶은 곳은 데이트냐 여행이냐를 아직 나눌 이유가 없다.
  if (bucket === "WISH") return { status: "WISHLIST", subCategory: null };
  return { status: "DONE", subCategory: bucket };
}

const placeSchema = z.object({
  placeId: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  category: z.string().max(100).nullable(),
  address: z.string().max(300).nullable(),
  roadAddress: z.string().max(300).nullable(),
  phone: z.string().max(40).nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  placeUrl: z.string().url().max(2000).nullable(),
});

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberOrNaN(value: FormDataEntryValue | null): number {
  return typeof value === "string" ? Number(value) : Number.NaN;
}

function dateOrNull(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  // lib/date.ts 와 같은 규칙으로 UTC 정오에 고정한다.
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 검색 결과에서 고른 장소를 저장한다.
 * 같은 장소를 다시 고르면 새로 만들지 않고 기존 항목을 쓴다.
 * 그래서 "가보고 싶은 곳" 에 담아둔 데를 다녀온 뒤 다시 등록해도
 * 기록이 한 줄로 이어지고 평점과 감상평이 남는다.
 */
export async function savePlace(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let targetEntryId: string | null = null;

  const result = await runAction(async () => {
    const user = await requireUser();

    const place = placeSchema.parse({
      placeId: emptyToNull(formData.get("placeId")),
      name: emptyToNull(formData.get("name")),
      category: emptyToNull(formData.get("category")),
      address: emptyToNull(formData.get("address")),
      roadAddress: emptyToNull(formData.get("roadAddress")),
      phone: emptyToNull(formData.get("phone")),
      lat: numberOrNaN(formData.get("lat")),
      lng: numberOrNaN(formData.get("lng")),
      placeUrl: emptyToNull(formData.get("placeUrl")),
    });

    const bucket = bucketSchema.parse(formData.get("bucket"));
    const { status, subCategory } = bucketToFields(bucket);
    const experiencedOn = dateOrNull(formData.get("experiencedOn"));
    const note = emptyToNull(formData.get("note"));

    const before = await prisma.entry.findUnique({
      where: {
        theme_externalSource_externalId: {
          theme: "PLACE",
          externalSource: "KAKAO_LOCAL",
          externalId: place.placeId,
        },
      },
      select: { metaJson: true },
    });

    const metaJson = mergeApiMeta("PLACE", before?.metaJson ?? null, {
      category: place.category ?? undefined,
      phone: place.phone ?? undefined,
      kakaoPlaceUrl: place.placeUrl ?? undefined,
    });

    const entry = await prisma.entry.upsert({
      where: {
        theme_externalSource_externalId: {
          theme: "PLACE",
          externalSource: "KAKAO_LOCAL",
          externalId: place.placeId,
        },
      },
      update: {
        status,
        subCategory,
        experiencedOn,
        ...(note ? { note } : {}),
        metaJson,
      },
      create: {
        theme: "PLACE",
        status,
        subCategory,
        title: place.name,
        subtitle: place.category,
        note,
        locationName: place.name,
        address: place.roadAddress ?? place.address,
        lat: place.lat,
        lng: place.lng,
        experiencedOn,
        externalSource: "KAKAO_LOCAL",
        externalId: place.placeId,
        metaJson,
        createdById: user.id,
        // 공간은 보통 둘이 함께 간다. 다르면 상세에서 고치면 된다.
        participations: { create: [{ userId: user.id }] },
      },
      select: { id: true },
    });

    targetEntryId = entry.id;

    revalidatePath("/");
    revalidatePath("/places");
    revalidatePath(`/entry/${entry.id}`);
  });

  if (result.ok && targetEntryId) redirect("/places");
  return result;
}

/** 가보고 싶던 곳을 다녀왔다고 옮긴다. */
export async function markPlaceVisited(formData: FormData): Promise<void> {
  await requireUser();
  const entryId = z.string().min(1).parse(formData.get("entryId"));
  const bucket = bucketSchema.parse(formData.get("bucket"));
  const { status, subCategory } = bucketToFields(bucket);

  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    select: { id: true, theme: true },
  });
  if (!entry || entry.theme !== "PLACE") return;

  await prisma.entry.update({
    where: { id: entryId },
    data: { status, subCategory },
  });

  revalidatePath("/places");
  revalidatePath(`/entry/${entryId}`);
}
