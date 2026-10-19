import { contentTypeForKey, isValidKey, readPhoto } from "@/lib/storage";

/**
 * 업로드된 사진을 내려준다.
 *
 * public/ 에 바로 쓰지 않고 이 라우트를 거치는 이유:
 * 저장 위치를 lib/storage.ts 뒤에 숨겨 두면 나중에 S3/R2 로 옮길 때
 * 이 파일만 리다이렉트로 바꾸면 되고 사진 URL 은 그대로 유지된다.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key } = await context.params;
  const storageKey = key.join("/");

  if (!isValidKey(storageKey)) {
    return new Response("Not found", { status: 404 });
  }

  const file = await readPhoto(storageKey);
  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": contentTypeForKey(storageKey),
      // 키에 uuid 가 들어가 내용이 바뀌면 키도 바뀐다. 그래서 길게 캐시해도 안전하다.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
