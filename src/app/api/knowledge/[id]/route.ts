import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const updateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  type: z.enum(["link", "nota", "aprendizado"]).optional(),
  url: z.string().trim().optional().nullable(),
  content: z.string().trim().optional().nullable(),
  tags: z.string().trim().optional().nullable(),
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
    `update knowledge_entries set
       title = coalesce($1, title),
       type = coalesce($2, type),
       url = coalesce($3, url),
       content = coalesce($4, content),
       tags = coalesce($5, tags)
     where id = $6
     returning id, title, type, url, content, tags, created_at, updated_at`,
    [d.title, d.type, d.url, d.content, d.tags, id]
  );
  if (!row) return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  return NextResponse.json({ item: row });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  await query("delete from knowledge_entries where id = $1", [id]);
  return NextResponse.json({ ok: true });
}
