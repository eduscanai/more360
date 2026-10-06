import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { consumePasswordResetToken, hashPassword } from "@/lib/auth";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { token, password } = parsed.data;

  const result = await consumePasswordResetToken(token);
  if (!result.ok) {
    return NextResponse.json({ error: "Link inválido ou expirado.", reason: result.reason }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await query("update users set password_hash = $1 where id = $2", [passwordHash, result.userId]);

  return NextResponse.json({ ok: true });
}
