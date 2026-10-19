/**
 * 액션에서 사용자에게 보여줄 오류들.
 *
 * 의존성이 없는 별도 파일로 둔 이유: 이걸 lib/auth.ts(next/headers)나
 * lib/storage.ts(sharp)에 두면, 오류 타입 하나를 참조하려던 클라이언트 컴포넌트가
 * 서버 전용 패키지까지 번들에 끌고 들어온다.
 */

export class AuthError extends Error {
  constructor(message = "로그인이 필요하다.") {
    super(message);
    this.name = "AuthError";
  }
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}
