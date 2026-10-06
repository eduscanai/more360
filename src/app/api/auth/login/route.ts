import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { comparePassword, createSessionCookie } from "@/lib/auth";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

async function logAccess(userId: string | null, eventType: "login_success" | "login_failed", email: string) {
  await query(
    "insert into access_logs (user_id, event_type, email_tried) values ($1, $2, $3)",
    [userId, eventType, email]
  );
}

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email ou senha inválidos." }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const rows = await query<{
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role: string;
    active: boolean;
  }>("select id, name, email, password_hash, role, active from users where email = $1", [email]);

  const user = rows[0];
  if (!user || !(await comparePassword(password, user.password_hash))) {
    await logAccess(user?.id ?? null, "login_failed", email);
    return NextResponse.json({ error: "Email ou senha incorretos." }, { status: 401 });
  }

  if (!user.active) {
    await logAccess(user.id, "login_failed", email);
    return NextResponse.json({ error: "Conta desativada. Fale com o administrador." }, { status: 403 });
  }

  await logAccess(user.id, "login_success", email);

  await createSessionCookie({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "owner" | "member",
  });

  return NextResponse.json({ ok: true });
}
