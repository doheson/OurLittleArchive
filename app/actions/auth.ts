"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import { runAction, type ActionResult } from "./result";

const loginSchema = z.object({
  slug: z.string().min(1, "누구인지 선택한다."),
  password: z.string().min(1, "비밀번호를 입력한다."),
});

export async function login(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const { slug, password } = loginSchema.parse({
      slug: formData.get("slug"),
      password: formData.get("password"),
    });

    const user = await prisma.user.findUnique({ where: { slug } });

    // 계정이 없을 때도 같은 메시지를 주어 어느 쪽이 틀렸는지 알려주지 않는다.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new z.ZodError([
        { code: "custom", path: ["password"], message: "비밀번호가 맞지 않다.", input: password },
      ]);
    }

    await createSession(user.id);
  });

  if (result.ok) redirect("/");
  return result;
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}
