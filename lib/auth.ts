import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";
import { AuthError } from "./errors";

export { hashPassword, verifyPassword } from "./password";
export { AuthError } from "./errors";

/**
 * 두 사람만 쓰는 사이트라 인증은 최소한으로 둔다.
 * - 읽기는 로그인 없이 누구나 (링크를 아는 사람은 볼 수 있다)
 * - 쓰기는 로그인 필요
 * 세션은 서명된 JWT 를 httpOnly 쿠키에 담는 무상태 방식이라 세션 테이블이 없다.
 */

const SESSION_COOKIE = "ola_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30일

function sessionSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET 이 없거나 너무 짧아요. .env 를 확인해 주세요.");
  }
  return new TextEncoder().encode(secret);
}

// --- 세션 ------------------------------------------------------------------

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(sessionSecret());

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
};

/** 한 요청 안에서 여러 번 불러도 쿠키 검증과 조회는 한 번만 일어난다. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (typeof payload.sub !== "string") return null;

    return await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, slug: true, displayName: true, avatarUrl: true },
    });
  } catch {
    // 만료되거나 서명이 안 맞는 쿠키는 그냥 로그아웃 상태로 본다.
    return null;
  }
});

/** 서버 액션에서 쓴다. 로그인 안 되어 있으면 AuthError 를 던진다. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  return user;
}

/** 두 사람 모두를 가져온다. 평점/감상평을 나란히 보여줄 때 쓴다. */
export const getBothUsers = cache(async (): Promise<SessionUser[]> => {
  return prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true, displayName: true, avatarUrl: true },
  });
});
