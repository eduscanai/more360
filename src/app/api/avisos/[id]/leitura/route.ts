import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

// Marca o aviso como lido pelo usuário atual (upsert — idempotente, pode
// chamar de novo sem duplicar linha graças ao unique(announcement_id, user_id)).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  const { id } = await params;

  const [row] = await query<{ read_at: string }>(
    `insert into announcement_reads (announcement_id, user_id)
     values ($1, $2)
     on conflict (announcement_id, user_id) do update set read_at = now()
     returning read_at`,
    [id, session.sub]
  );
  return NextResponse.json({ read_at: row.read_at });
}
