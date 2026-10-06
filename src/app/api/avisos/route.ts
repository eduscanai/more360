import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const createSchema = z.object({
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  display_mode: z.enum(["feed", "banner", "modal"]).optional(),
  audience: z.enum(["todos", "owner", "member"]).optional(),
  pinned: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  // Só mostra avisos pra audiência "todos" ou que bate com o role de quem
  // pede — já traz `read_at` do usuário atual via left join (não precisa de
  // 2ª requisição pra saber o que já foi lido).
  const rows = await query(
    `select a.id, a.title, a.content, a.display_mode, a.audience, a.pinned, a.active,
            a.created_at, a.updated_at, r.read_at
     from announcements a
     left join announcement_reads r on r.announcement_id = a.id and r.user_id = $1
     where a.audience = 'todos' or a.audience = $2
     order by a.pinned desc, a.created_at desc`,
    [session.sub, session.role]
  );
  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const d = parsed.data;

  const [row] = await query<Record<string, unknown>>(
    `insert into announcements (title, content, display_mode, audience, pinned, active, created_by)
     values ($1, $2, coalesce($3, 'feed'), coalesce($4, 'todos'), coalesce($5, false), coalesce($6, true), $7)
     returning id, title, content, display_mode, audience, pinned, active, created_at, updated_at`,
    [d.title, d.content, d.display_mode, d.audience, d.pinned, d.active, session.sub]
  );
  return NextResponse.json({ item: { ...row, read_at: null } }, { status: 201 });
}
