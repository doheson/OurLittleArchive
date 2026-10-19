import { z } from "zod";
import { THEME_META_FIELDS } from "./theme-fields";
import {
  THEME_META_SCHEMAS,
  entryStatusSchema,
  externalSourceSchema,
  isValidSubCategory,
  themeKeySchema,
  type ThemeKey,
} from "./themes";

/**
 * 폼에서 들어온 값을 DB 에 넣을 수 있는 모양으로 바꾸고 검증한다.
 * 화면은 테마마다 다르지만 들어오는 형태는 같아서 검증도 한 곳에 모아둔다.
 */

/** 빈 문자열은 "값 없음" 으로 본다. 폼은 비워둔 칸을 "" 로 보내기 때문이다. */
function text(value: FormDataEntryValue | null, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOrNull(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  // <input type="date"> 는 YYYY-MM-DD 로 온다. 시간대 때문에 날짜가 하루 밀리지 않도록
  // UTC 정오로 고정해 저장한다.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * meta.* 로 들어온 폼 값을 테마 스키마가 받을 수 있는 타입으로 바꾼다.
 *
 * 폼은 모든 값을 문자열로 보내지만 meta 스키마는 number/boolean/배열을 요구한다.
 * 값의 모양을 보고 추측하면 저자 한 명("김영하")이 배열이 안 되는 식으로 틀리므로,
 * lib/theme-fields.ts 에 적어둔 필드 타입을 보고 변환한다.
 */
function collectMeta(formData: FormData, theme: ThemeKey): Record<string, unknown> {
  const meta: Record<string, unknown> = {};

  for (const field of THEME_META_FIELDS[theme]) {
    const raw = formData.get(`meta.${field.name}`);
    if (typeof raw !== "string") continue;

    const value = raw.trim();
    if (!value) continue; // 비워둔 칸은 아예 저장하지 않는다

    switch (field.type) {
      case "number": {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) meta[field.name] = parsed;
        break;
      }
      case "boolean": {
        // select 는 "기록 안 함" 일 때 빈 문자열을 보내므로 위에서 이미 걸러진다.
        if (value === "true") meta[field.name] = true;
        else if (value === "false") meta[field.name] = false;
        break;
      }
      case "list": {
        const items = value
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
        if (items.length) meta[field.name] = items;
        break;
      }
      default:
        meta[field.name] = value;
    }
  }

  return meta;
}

export const entryInputSchema = z
  .object({
    theme: themeKeySchema,
    status: entryStatusSchema,
    subCategory: z.string().max(40).nullable(),
    title: z.string().min(1, "제목은 비워둘 수 없다.").max(200),
    subtitle: z.string().max(200).nullable(),
    note: z.string().max(5000).nullable(),
    coverImageUrl: z.string().url().max(2000).nullable(),
    externalId: z.string().max(200).nullable(),
    externalSource: externalSourceSchema.nullable(),
    experiencedOn: z.date().nullable(),
    locationName: z.string().max(200).nullable(),
    address: z.string().max(300).nullable(),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    meta: z.record(z.string(), z.unknown()),
    /** 누가 이걸 경험했는지. 비어 있으면 참여 기록을 만들지 않는다. */
    participantIds: z.array(z.string().min(1)),
  })
  .refine((value) => isValidSubCategory(value.theme, value.subCategory), {
    path: ["subCategory"],
    error: "이 테마에서 쓸 수 없는 분류다.",
  })
  .refine(
    (value) =>
      // 외부 출처를 쓸 때는 식별자가 같이 있어야 중복 등록을 막을 수 있다.
      (value.externalSource == null) === (value.externalId == null) ||
      value.externalSource === "MANUAL",
    { path: ["externalId"], error: "외부 출처와 식별자는 함께 있어야 한다." },
  );

export type EntryInput = z.infer<typeof entryInputSchema>;

/** 테마 스키마까지 통과한 meta 를 저장용 JSON 문자열로 만든다. */
export function validateMeta(theme: ThemeKey, meta: Record<string, unknown>): string | null {
  const parsed = THEME_META_SCHEMAS[theme].parse(meta);
  const kept = Object.entries(parsed as Record<string, unknown>).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  return kept.length ? JSON.stringify(Object.fromEntries(kept)) : null;
}

export function parseEntryForm(formData: FormData): EntryInput {
  // meta 변환이 테마를 알아야 하므로 테마를 먼저 확정한다.
  const theme = themeKeySchema.parse(formData.get("theme"));

  const raw = {
    theme,
    status: formData.get("status"),
    subCategory: text(formData.get("subCategory"), 40),
    title: text(formData.get("title"), 200) ?? "",
    subtitle: text(formData.get("subtitle"), 200),
    note: text(formData.get("note"), 5000),
    coverImageUrl: text(formData.get("coverImageUrl"), 2000),
    externalId: text(formData.get("externalId"), 200),
    externalSource: text(formData.get("externalSource"), 40),
    experiencedOn: dateOrNull(formData.get("experiencedOn")),
    locationName: text(formData.get("locationName"), 200),
    address: text(formData.get("address"), 300),
    lat: numberOrNull(formData.get("lat")),
    lng: numberOrNull(formData.get("lng")),
    meta: collectMeta(formData, theme),
    participantIds: formData.getAll("participantIds").filter((v): v is string => typeof v === "string"),
  };

  return entryInputSchema.parse(raw);
}

export const ratingSchema = z.object({
  entryId: z.string().min(1),
  // 별 반 개 단위로 0.5 ~ 5.0
  score: z.number().min(0.5).max(5).multipleOf(0.5),
});

export const reviewSchema = z.object({
  entryId: z.string().min(1),
  body: z.string().min(1, "감상평을 입력한다.").max(5000),
  isSpoiler: z.boolean(),
});
