import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const updateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  content: z.string().trim().min(1).optional(),
  display_mode: z.enum(["feed", "banner", "modal"]).optional(),
  audience: z.enum(["todos", "owner", "member"]).optional(),
  pinned: z.boolean().optional(),
  active: z.boolean().optional(),
});

async function guard() {
  try {
    return await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return null;
    throw e;
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const d = parsed.data;

  const [row] = await query(
    `update announcements set
       title = coalesce($1, title),
       content = coalesce($2, content),
       display_mode = coalesce($3, display_mode),
       audience = coalesce($4, audience),
       pinned = coalesce($5, pinned),
       active = coalesce($6, active)
     where id = $7
     returning id, title, content, display_mode, audience, pinned, active, created_at, updated_at`,
    [d.title, d.content, d.display_mode, d.audience, d.pinned, d.active, id]
  );
  if (!row) return NextResponse.json({ error: "Aviso não encontrado." }, { status: 404 });
  return NextResponse.json({ item: row });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  await query("delete from announcements where id = $1", [id]);
  return NextResponse.json({ ok: true });
}
