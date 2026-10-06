import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";

const updateSchema = z.object({
  role: z.enum(["owner", "member"]).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Só o owner pode gerenciar usuários." }, { status: 403 });
  }

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const d = parsed.data;

  const current = await query<{ role: string; active: boolean }>(
    "select role, active from users where id = $1",
    [id]
  );
  if (current.length === 0) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  // Trava de segurança: não deixa remover o último owner ativo — senão
  // ninguém mais consegue gerenciar usuários (nem reverter o próprio erro).
  const willLoseOwner =
    current[0].role === "owner" &&
    ((d.role !== undefined && d.role !== "owner") || (d.active !== undefined && !d.active));
  if (willLoseOwner) {
    const [{ count }] = await query<{ count: string }>(
      `select count(*)::int as count from users where role = 'owner' and active = true and id <> $1`,
      [id]
    );
    if (Number(count) === 0) {
      return NextResponse.json(
        { error: "Não é possível remover o último owner ativo do sistema." },
        { status: 400 }
      );
    }
  }

  const [row] = await query(
    `update users set
       role = coalesce($1, role),
       active = coalesce($2, active)
     where id = $3
     returning id, name, email, role, active, created_at`,
    [d.role, d.active, id]
  );
  return NextResponse.json({ item: row });
}
