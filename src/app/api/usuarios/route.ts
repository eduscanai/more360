import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET é liberado pra qualquer usuário autenticado (só consulta), mas devolve
// a lista de logs de acesso só quando quem pede é owner — evita vazar
// e-mails/tentativas de login de outras contas pra um member comum.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const users = await query(
    `select id, name, email, role, active, created_at from users order by created_at`
  );

  if (session.role !== "owner") {
    return NextResponse.json({ items: users, logs: [] });
  }

  const logs = await query(
    `select a.id, a.event_type, a.email_tried, a.created_at, u.name as user_name
     from access_logs a
     left join users u on u.id = a.user_id
     order by a.created_at desc
     limit 20`
  );
  return NextResponse.json({ items: users, logs });
}
