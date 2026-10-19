import { z } from "zod";
import { AuthError, UploadError } from "@/lib/errors";
import type { ActionResult } from "@/lib/action-result";

export type { ActionResult };

function isUniqueViolation(error: unknown): boolean {
  // Prisma 의 고유 제약 위반. 같은 외부 항목을 두 번 등록했을 때 주로 발생한다.
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * 액션 본문을 감싸 예외를 사용자에게 보여줄 메시지로 바꾼다.
 * 예상 못 한 오류는 메시지를 노출하지 않고 서버 로그에만 남긴다.
 */
export async function runAction(fn: () => Promise<void | string>): Promise<ActionResult> {
  try {
    const message = await fn();
    return typeof message === "string" ? { ok: true, message } : { ok: true };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    if (error instanceof UploadError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "입력한 내용을 확인해 주세요." };
    }
    if (isUniqueViolation(error)) {
      return { ok: false, error: "이미 등록된 항목이에요." };
    }
    console.error("[action]", error);
    return { ok: false, error: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
}
