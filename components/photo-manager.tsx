"use client";

import Image from "next/image";
import { useActionState, useRef } from "react";
import { removePhoto, uploadPhotos } from "@/app/actions/entries";
import { ACTION_IDLE } from "@/lib/action-result";
import { SubmitButton } from "./submit-button";

export type PhotoRow = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  caption: string | null;
};

/**
 * 사진 목록과 업로드.
 * 아이폰 HEIC 도 받는다. 서버(lib/storage.ts)에서 JPEG 로 바꾸고 크기를 줄인다.
 */
export function PhotoManager({
  entryId,
  photos,
  canEdit,
}: {
  entryId: string;
  photos: PhotoRow[];
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(uploadPhotos, ACTION_IDLE);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  if (!photos.length && !canEdit) return null;

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink-muted">사진</h2>

      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.id} className="group relative">
              <Image
                src={photo.url}
                alt={photo.caption ?? ""}
                width={photo.width ?? 800}
                height={photo.height ?? 800}
                sizes="(max-width: 640px) 50vw, 240px"
                className="aspect-square w-full rounded-lg object-cover"
              />
              {canEdit && (
                <form action={removePhoto} className="absolute top-1 right-1">
                  <input type="hidden" name="photoId" value={photo.id} />
                  <button
                    type="submit"
                    aria-label="사진 지우기"
                    className="rounded-full bg-black/55 px-2 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  >
                    ✕
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form ref={formRef} action={formAction} className="mt-3">
          <input type="hidden" name="entryId" value={entryId} />
          <input
            ref={inputRef}
            type="file"
            name="photos"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            // 파일을 고르면 바로 올린다. 한 단계 줄인다.
            onChange={() => formRef.current?.requestSubmit()}
            className="hidden"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            >
              사진 추가
            </button>
            <SubmitButton variant="subtle" className="sr-only">
              올리기
            </SubmitButton>
            {!state.ok && <span className="text-sm text-accent">{state.error}</span>}
            {state.ok && state.message && (
              <span className="text-sm text-ink-muted">{state.message}</span>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
