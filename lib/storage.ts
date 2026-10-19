import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { UploadError } from "./errors";

export { UploadError } from "./errors";

/**
 * 사진 저장.
 *
 * 바이트를 어디에 두는지는 드라이버 뒤에 숨긴다.
 *  - 로컬 디스크: 개발용. 클라우드 계정 없이 바로 쓸 수 있다.
 *  - S3 호환: 운영용. Cloudflare R2 를 쓰지만 S3 호환이면 어디든 된다.
 *
 * Vercel 같은 서버리스는 파일시스템이 휘발성이라 운영에서 로컬 디스크를 쓰면
 * 사진이 조용히 사라진다. 그래서 production 에서 S3 설정이 없으면 아예 막는다.
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

export type StoredPhoto = {
  key: string;
  width: number;
  height: number;
};

// --- 드라이버 선택 -----------------------------------------------------------

type S3Config = {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function readS3Config(): S3Config | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    // R2 는 리전 개념이 없어 "auto" 를 쓴다.
    region: process.env.S3_REGION?.trim() || "auto",
  };
}

export function isCloudStorageConfigured(): boolean {
  return readS3Config() !== null;
}

/**
 * 사진 업로드를 화면에 보여줄지.
 *
 * 운영에서 클라우드 저장소가 없으면 업로드가 거부되므로 버튼 자체를 숨긴다.
 * 눌러봐야 실패하는 버튼을 두는 것보다 낫다.
 * 개발에서는 로컬 디스크로 동작하니 그대로 보여준다.
 */
export function isPhotoUploadAvailable(): boolean {
  return isCloudStorageConfigured() || process.env.NODE_ENV !== "production";
}

let cachedClient: { config: S3Config; client: S3Client } | null = null;

function s3(): { client: S3Client; bucket: string } {
  const config = readS3Config();
  if (!config) {
    throw new UploadError("사진 저장소(S3) 설정이 없다. .env.example 을 참고한다.");
  }
  // 설정이 그대로면 클라이언트를 재사용한다. 요청마다 새로 만들 이유가 없다.
  if (!cachedClient || cachedClient.config.endpoint !== config.endpoint) {
    cachedClient = {
      config,
      client: new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      }),
    };
  }
  return { client: cachedClient.client, bucket: config.bucket };
}

function uploadRoot(): string {
  /*
    경로를 정적으로 고정한다.
    process.env 로 조립한 경로를 쓰면 Turbopack 이 어디까지 읽힐지 알 수 없다고 보고
    프로젝트 전체를 배포 산출물에 넣어버린다.
  */
  return path.join(process.cwd(), "uploads");
}

/** 운영에서 로컬 디스크로 떨어지면 사진이 사라지므로 미리 막는다. */
function assertStorageUsable(): void {
  if (process.env.NODE_ENV === "production" && !isCloudStorageConfigured()) {
    throw new UploadError(
      "운영 환경에는 S3 저장소 설정이 필요하다. 로컬 디스크는 배포 후 사라진다.",
    );
  }
}

// --- 키와 주소 ---------------------------------------------------------------

/** 저장 키는 연/월로 나눠 한 폴더에 파일이 몰리지 않게 한다. */
function buildKey(extension: string): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${randomUUID()}.${extension}`;
}

/** 서빙 라우트가 받은 키를 그대로 경로로 쓰지 않도록 형식을 제한한다. */
const KEY_PATTERN = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|gif)$/;

export function isValidKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

/**
 * 사진 주소.
 *
 * 공개 주소(R2 공개 버킷이나 연결한 도메인)가 있으면 그쪽을 바로 가리킨다.
 * 그러면 이미지 요청이 서버 함수를 거치지 않아 빠르고, R2 는 이그레스가 무료다.
 * 없으면 /api/photos 라우트가 대신 읽어서 내려준다.
 */
export function photoUrl(key: string): string {
  const base = process.env.PHOTO_PUBLIC_BASE_URL?.trim();
  if (base) return `${base.replace(/\/+$/, "")}/${key}`;
  return `/api/photos/${key}`;
}

export function contentTypeForKey(key: string): string {
  return key.endsWith(".gif") ? "image/gif" : "image/jpeg";
}

// --- 읽기 / 쓰기 / 지우기 ----------------------------------------------------

/**
 * 이미지를 저장하고 키와 실제 크기를 돌려준다.
 * 크기를 함께 저장해야 next/image 가 레이아웃 흔들림 없이 그릴 수 있다.
 */
export async function putPhoto(file: File): Promise<StoredPhoto> {
  assertStorageUsable();

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

  if (isCloudStorageConfigured()) {
    const { client, bucket } = s3();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: output,
        ContentType: contentTypeForKey(key),
        // 키에 uuid 가 들어가 내용이 바뀌면 키도 바뀐다. 길게 캐시해도 안전하다.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } else {
    const target = path.join(uploadRoot(), key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, output);
  }

  return { key, width, height };
}

export async function readPhoto(key: string): Promise<Buffer | null> {
  if (!isValidKey(key)) return null;

  if (isCloudStorageConfigured()) {
    try {
      const { client, bucket } = s3();
      const result = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      const bytes = await result.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch {
      return null;
    }
  }

  try {
    return await readFile(path.join(uploadRoot(), key));
  } catch {
    return null;
  }
}

export async function deletePhoto(key: string): Promise<void> {
  if (!isValidKey(key)) return;

  if (isCloudStorageConfigured()) {
    try {
      const { client, bucket } = s3();
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch {
      // 파일이 이미 없으면 그대로 넘어간다. DB 레코드 삭제가 더 중요하다.
    }
    return;
  }

  try {
    await unlink(path.join(uploadRoot(), key));
  } catch {
    // 같은 이유로 무시한다.
  }
}
