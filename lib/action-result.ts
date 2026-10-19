/**
 * 서버 액션의 반환 모양.
 *
 * 클라이언트 컴포넌트가 useActionState 의 초기값으로 ACTION_IDLE 을 쓰기 때문에
 * 이 파일은 의존성이 하나도 없어야 한다. 실제 처리 로직은 app/actions/result.ts 에 있다.
 */
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export const ACTION_IDLE: ActionResult = { ok: true };
