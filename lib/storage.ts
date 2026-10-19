import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { UploadError } from "./errors";

/**
 * 사진 저장.
 *
 * 저장 위치를 인터페이스 뒤에 숨겨서, 나중에 S3/R2/Vercel Blob 으로 바꿀 때
 * 호출하는 쪽(서버 액션, 화면)을 고치지 않아도 되게 했다.
 * Photo 레코드에는 key 만 들고 있고 URL 은 photoUrl(key) 로 만든다.
 *
 * 업로드된 파일은 항상 sharp 를 거친다. 그래서
 *  - 아이폰 HEIC 를 JPEG 로 바꾼다
 *  - EXIF 회전 정보를 실제 픽셀에 적용한다
 *  - 긴 변을 2400px 로 줄여 원본 용량을 그대로 쌓지 않는다
 *  - EXIF 를 떼어내 촬영 위치가 링크로 새어나가지 않게 한다 (sharp 의 기본 동작)
 */

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB. HEIC 원본도 들어올 수 있어 넉넉히 둔다.
const MAX_LONG_EDGE = 2400;
const JPEG_QUALITY = 85;

/** 업로드를 받아들이는 형식. 아이폰 HEIC 를 포함한다. */
const ACCEPTED_INPUT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

export { UploadError } from "./errors";

export type StoredPhoto = {
  key: string;
  width: number;
  height: number;
};

function uploadRoot(): string {
  /*
    경로를 정적으로 고정한다.
    process.env 로 조립한 경로를 쓰면 Turbopack 이 어디까지 읽힐지 알 수 없다고 보고
    프로젝트 전체를 배포 산출물에 넣어버린다.
    다른 디스크에 쌓고 싶으면 이 폴더를 심볼릭 링크로 걸거나,
    클라우드 스토리지로 옮길 때 이 함수를 쓰는 세 함수만 교체하면 된다.
  */
  return path.join(process.cwd(), "uploads");
}

/** 저장 키는 연/월로 나눠 한 폴더에 파일이 몰리지 않게 한다. */
function buildKey(extension: string): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${randomUUID()}.${extension}`;
}

/** 서빙 라우트가 받은 키를 그대로 파일 경로로 쓰지 않도록 형식을 제한한다. */
const KEY_PATTERN = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|gif)$/;

export function isValidKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

export function photoUrl(key: string): string {
  return `/api/photos/${key}`;
}

/**
 * 이미지를 저장하고 키와 실제 크기를 돌려준다.
 * 크기를 함께 저장해야 next/image 가 레이아웃 흔들림 없이 그릴 수 있다.
 */
export async function putPhoto(file: File): Promise<StoredPhoto> {
  if (file.size === 0) {
    throw new UploadError("빈 파일이다.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      `사진 한 장은 ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB 까지 올릴 수 있다.`,
    );
  }
  if (file.type && !ACCEPTED_INPUT_MIME.has(file.type)) {
    throw new UploadError(`지원하지 않는 형식이다: ${file.type}`);
  }

  const input = Buffer.from(await file.arrayBuffer());

  // 확장자나 Content-Type 은 믿지 않고 sharp 가 실제로 읽히는지로 판단한다.
  let image = sharp(input, { failOn: "error" });
  let metadata;
  try {
    metadata = await image.metadata();
  } catch {
    throw new UploadError("이미지로 읽을 수 없는 파일이다.");
  }

  // 움직이는 GIF 는 리사이즈하면 애니메이션이 깨지므로 원본을 그대로 둔다.
  const isAnimatedGif = metadata.format === "gif" && (metadata.pages ?? 1) > 1;

  let output: Buffer;
  let extension: string;

  if (isAnimatedGif) {
    output = input;
    extension = "gif";
  } else {
    const longEdge = Math.max(metadata.width ?? 0, metadata.height ?? 0);
    image = image.rotate(); // EXIF 회전을 픽셀에 적용
    if (longEdge > MAX_LONG_EDGE) {
      image = image.resize({
        width: MAX_LONG_EDGE,
        height: MAX_LONG_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    // HEIC 든 PNG 든 전부 JPEG 로 통일한다. 브라우저는 next/image 가 만든
    // webp/avif 변형을 받으므로 저장 형식은 호환성만 보면 된다.
    output = await image.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
    extension = "jpg";
  }

  // 회전/리사이즈 후의 최종 크기를 다시 읽는다.
  const finalMeta = await sharp(output).metadata();
  const width = finalMeta.width ?? 0;
  const height = finalMeta.height ?? 0;
  if (!width || !height) {
    throw new UploadError("이미지 크기를 읽을 수 없다.");
  }

  const key = buildKey(extension);
  const target = path.join(uploadRoot(), key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, output);

  return { key, width, height };
}

export async function readPhoto(key: string): Promise<Buffer | null> {
  if (!isValidKey(key)) return null;
  try {
    return await readFile(path.join(uploadRoot(), key));
  } catch {
    return null;
  }
}

export async function deletePhoto(key: string): Promise<void> {
  if (!isValidKey(key)) return;
  try {
    await unlink(path.join(uploadRoot(), key));
  } catch {
    // 파일이 이미 없으면 그대로 넘어간다. DB 레코드 삭제가 더 중요하다.
  }
}

export function contentTypeForKey(key: string): string {
  return key.endsWith(".gif") ? "image/gif" : "image/jpeg";
}
