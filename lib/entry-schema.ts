import { z } from "zod";
import { THEME_META_FIELDS } from "./theme-fields";
import {
  THEME_META_SCHEMAS,
  entryStatusSchema,
  externalSourceSchema,
  isValidSubCategory,
  parseMeta,
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
 * meta.* 로 들어온 폼 값을 테마 스키마가 받을 수 있는 타입으로 바꿔요.
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
    title: z.string().min(1, "제목은 비워둘 수 없어요.").max(200),
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
    error: "이 테마에서는 쓸 수 없는 분류예요.",
  })
  .refine(
    (value) =>
      // 외부 출처를 쓸 때는 식별자가 같이 있어야 중복 등록을 막을 수 있다.
      (value.externalSource == null) === (value.externalId == null) ||
      value.externalSource === "MANUAL",
    { path: ["externalId"], error: "외부 출처와 식별자는 함께 있어야 해요." },
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
  body: z.string().min(1, "감상평을 입력해 주세요.").max(5000),
  isSpoiler: z.boolean(),
});

/**
 * 수정할 때 meta 를 합친다.
 *
 * 범용 수정 폼은 lib/theme-fields.ts 에 적힌 칸만 보여준다.
 * 그런데 meta 에는 폼에 없는 값도 들어 있다. 검색 연동이 채운 것들
 * (음악의 artist/appleUrl/youtubeUrl, 책의 authors 등)이 그렇다.
 * 폼이 보낸 값으로 통째로 덮어쓰면 그 값들이 조용히 사라진다.
 *
 * 그래서 폼이 관리하는 칸만 걷어내고 나머지는 남긴다.
 * 폼에 있는 칸을 비우면 지워지고, 폼에 없는 칸은 보존된다.
 */
export function mergeMeta<K extends ThemeKey>(
  theme: K,
  existingMetaJson: string | null,
  formMeta: Record<string, unknown>,
): string | null {
  const existing = parseMeta(theme, existingMetaJson) as Record<string, unknown>;
  const formManaged = new Set(THEME_META_FIELDS[theme].map((field) => field.name));

  const preserved = Object.fromEntries(
    Object.entries(existing).filter(([key]) => !formManaged.has(key)),
  );

  return validateMeta(theme, { ...preserved, ...formMeta });
}

/**
 * 검색 결과로 다시 저장할 때 meta 를 합친다.
 *
 * 같은 곡/책/장소를 다시 고르면 API 가 준 값으로 갱신하는데,
 * 그때 손으로 적어둔 값(음악의 유튜브 링크 같은 것)까지 덮어쓰면 안 된다.
 * API 가 주는 칸만 새 값으로 바꾸고 나머지는 그대로 둔다.
 */
export function mergeApiMeta<K extends ThemeKey>(
  theme: K,
  existingMetaJson: string | null,
  apiMeta: Record<string, unknown>,
): string | null {
  const existing = parseMeta(theme, existingMetaJson) as Record<string, unknown>;

  // API 가 값을 주지 않은 칸(undefined)은 기존 값을 지우지 않는다.
  const incoming = Object.fromEntries(
    Object.entries(apiMeta).filter(([, value]) => value !== undefined && value !== null),
  );

  return validateMeta(theme, { ...existing, ...incoming });
}
