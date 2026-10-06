import { NextResponse } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST() {
  const session = await getSession();
  if (session) {
    await query("insert into access_logs (user_id, event_type, email_tried) values ($1, 'logout', $2)", [
      session.sub,
      session.email,
    ]);
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
