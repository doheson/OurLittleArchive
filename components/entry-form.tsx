"use client";

import { useActionState, useState } from "react";
import { createEntry, updateEntry } from "@/app/actions/entries";
import { ACTION_IDLE } from "@/lib/action-result";
import { SUBTITLE_LABELS, THEME_META_FIELDS, type MetaField } from "@/lib/theme-fields";
import type { EntryStatus, ThemeConfig } from "@/lib/themes";
import { CoverPicker } from "./cover-picker";
import { SubmitButton } from "./submit-button";

export type EntryFormDefaults = {
  id?: string;
  status: EntryStatus;
  subCategory: string | null;
  title: string;
  subtitle: string | null;
  note: string | null;
  coverImageUrl: string | null;
  /** yyyy-MM-dd */
  experiencedOn: string | null;
  locationName: string | null;
  address: string | null;
  meta: Record<string, unknown>;
  participantIds: string[];
};

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

/**
 * 등록/수정 폼. 테마 설정을 읽어 보여줄 칸을 정하므로 테마가 늘어도 이 파일은 그대로다.
 * 외부 API 검색(음악/책/장소)은 이 폼의 제목·부제·커버 칸을 채워주는 형태로 나중에 붙인다.
 */
export function EntryForm({
  theme,
  people,
  defaults,
}: {
  theme: ThemeConfig;
  people: { id: string; displayName: string }[];
  defaults?: EntryFormDefaults;
}) {
  const isEdit = Boolean(defaults?.id);
  const [state, formAction] = useActionState(isEdit ? updateEntry : createEntry, ACTION_IDLE);
  const metaFields = THEME_META_FIELDS[theme.key];

  // 커버를 검색으로 고를 수 있게 하려면 제목과 주소를 모두 state 로 들고 있어야 한다.
  // 제목은 검색어 기본값으로, 주소는 고른 결과를 채워 넣는 칸으로 쓴다.
  const [title, setTitle] = useState(defaults?.title ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(defaults?.coverImageUrl ?? "");
  const [pickingCover, setPickingCover] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="theme" value={theme.key} />
      {defaults?.id && <input type="hidden" name="entryId" value={defaults.id} />}

      {/* 했음 / 하고싶음 — 테마 어휘로 보여준다 */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-muted">상태</legend>
        <div className="flex gap-2">
          {(["DONE", "WISHLIST"] as const).map((status) => (
            <label
              key={status}
              className="flex-1 cursor-pointer rounded-lg border border-border px-3 py-2 text-center text-sm has-checked:border-accent has-checked:bg-accent-soft"
            >
              <input
                type="radio"
                name="status"
                value={status}
                defaultChecked={(defaults?.status ?? "DONE") === status}
                className="sr-only"
              />
              {theme.statusLabels[status]}
            </label>
          ))}
        </div>
      </fieldset>

      {theme.subCategories && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-muted">분류</legend>
          <div className="flex gap-2">
            {theme.subCategories.map((value) => (
              <label
                key={value}
                className="flex-1 cursor-pointer rounded-lg border border-border px-3 py-2 text-center text-sm has-checked:border-accent has-checked:bg-accent-soft"
              >
                <input
                  type="radio"
                  name="subCategory"
                  value={value}
                  defaultChecked={(defaults?.subCategory ?? theme.subCategories?.[0]) === value}
                  className="sr-only"
                />
                {theme.subCategoryLabels?.[value] ?? value}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <Field label="제목" required>
        <input
          name="title"
          required
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={fieldClass}
        />
      </Field>

      <Field label={SUBTITLE_LABELS[theme.key]}>
        <input
          name="subtitle"
          maxLength={200}
          defaultValue={defaults?.subtitle ?? ""}
          className={fieldClass}
        />
      </Field>

      {theme.hasDate && (
        <Field label="날짜">
          <input
            type="date"
            name="experiencedOn"
            defaultValue={defaults?.experiencedOn ?? ""}
            className={fieldClass}
          />
        </Field>
      )}

      {theme.hasLocation && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="장소 이름">
            <input
              name="locationName"
              maxLength={200}
              defaultValue={defaults?.locationName ?? ""}
              className={fieldClass}
            />
          </Field>
          <Field label="주소">
            <input
              name="address"
              maxLength={300}
              defaultValue={defaults?.address ?? ""}
              className={fieldClass}
            />
          </Field>
        </div>
      )}

      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-ink-muted">커버 이미지</span>
          <button
            type="button"
            onClick={() => setPickingCover((open) => !open)}
            className="text-sm text-accent hover:underline"
          >
            {pickingCover ? "검색 닫기" : "이미지 찾기"}
          </button>
        </div>

        <div className="flex items-start gap-3">
          {coverImageUrl && (
            // 고른 이미지를 바로 확인할 수 있게 한다. 호스트가 제각각이라 일반 img 를 쓴다.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImageUrl}
              alt=""
              className="size-16 shrink-0 rounded-lg border border-border bg-surface-muted object-cover"
            />
          )}
          <input
            name="coverImageUrl"
            type="url"
            value={coverImageUrl}
            onChange={(event) => setCoverImageUrl(event.target.value)}
            placeholder="주소를 직접 넣어도 돼요"
            className={fieldClass}
          />
        </div>

        <span className="mt-1 block text-xs text-ink-muted">
          음악과 책은 검색으로 등록하면 자동으로 채워져요.
        </span>

        {pickingCover && (
          <CoverPicker
            defaultTerm={[title, theme.label].filter(Boolean).join(" ")}
            onPick={(url) => {
              setCoverImageUrl(url);
              setPickingCover(false);
            }}
            onClose={() => setPickingCover(false)}
          />
        )}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-muted">
          {theme.tracksPerPerson ? "누가 했는지" : "함께한 사람"}
        </legend>
        <div className="flex flex-wrap gap-2">
          {people.map((person) => (
            <label
              key={person.id}
              className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-sm has-checked:border-accent has-checked:bg-accent-soft"
            >
              <input
                type="checkbox"
                name="participantIds"
                value={person.id}
                defaultChecked={defaults ? defaults.participantIds.includes(person.id) : true}
                className="sr-only"
              />
              {person.displayName}
            </label>
          ))}
        </div>
      </fieldset>

      {metaFields.length > 0 && (
        <fieldset className="card rounded-xl p-4">
          <legend className="px-1 text-sm font-semibold text-ink-muted">
            {theme.label} 정보
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {metaFields.map((field) => (
              <MetaInput key={field.name} field={field} value={defaults?.meta[field.name]} />
            ))}
          </div>
        </fieldset>
      )}

      <Field label="메모" hint="둘이 함께 보는 메모예요. 각자의 감상평은 상세 화면에서 따로 남겨요">
        <textarea
          name="note"
          rows={3}
          maxLength={5000}
          defaultValue={defaults?.note ?? ""}
          className={fieldClass}
        />
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="저장 중…">{isEdit ? "저장" : "등록"}</SubmitButton>
        {!state.ok && <p className="text-sm text-accent">{state.error}</p>}
        {state.ok && state.message && <p className="text-sm text-ink-muted">{state.message}</p>}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink-muted">
        {label}
        {required && <span className="ml-1 text-accent">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

function MetaInput({ field, value }: { field: MetaField; value: unknown }) {
  const name = `meta.${field.name}`;

  if (field.type === "boolean") {
    // 체크박스는 "체크 안 함" 과 "아니오" 를 구분할 수 없어서 select 로 둔다.
    // 방탈출의 탈출 성공 여부에서는 그 차이가 의미가 있다.
    const current = value === true ? "true" : value === false ? "false" : "";
    return (
      <Field label={field.label} hint={field.hint}>
        <select name={name} defaultValue={current} className={fieldClass}>
          <option value="">기록 안 함</option>
          <option value="true">예</option>
          <option value="false">아니오</option>
        </select>
      </Field>
    );
  }

  const defaultValue =
    field.type === "list" && Array.isArray(value)
      ? value.join(", ")
      : value == null
        ? ""
        : String(value);

  return (
    <Field label={field.label} hint={field.hint}>
      <input
        name={name}
        type={field.type === "number" ? "number" : "text"}
        placeholder={field.placeholder}
        defaultValue={defaultValue}
        min={field.min}
        max={field.max}
        step={field.step}
        className={fieldClass}
      />
    </Field>
  );
}
