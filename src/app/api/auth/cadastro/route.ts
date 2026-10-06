import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { createSessionCookie, hashPassword } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(120),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(8, "Senha precisa ter pelo menos 8 caracteres"),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }
  const { name, email, password } = parsed.data;

  const existing = await query<{ id: string }>(
    "select id from users where email = $1",
    [email]
  );
  if (existing.length > 0) {
    return NextResponse.json({ error: "Já existe uma conta com esse email." }, { status: 409 });
  }

  // Primeiro usuário cadastrado vira owner; os demais entram como member.
  const [{ count }] = await query<{ count: string }>("select count(*)::int as count from users");
  const role = Number(count) === 0 ? "owner" : "member";

  const passwordHash = await hashPassword(password);
  const [user] = await query<{ id: string; name: string; email: string; role: string }>(
    `insert into users (name, email, password_hash, role)
     values ($1, $2, $3, $4)
     returning id, name, email, role`,
    [name, email, passwordHash, role]
  );

  await createSessionCookie({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "owner" | "member",
  });

  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
