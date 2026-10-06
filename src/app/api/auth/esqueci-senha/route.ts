import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { createPasswordResetToken } from "@/lib/auth";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }
  const { email } = parsed.data;

  const rows = await query<{ id: string }>("select id from users where email = $1", [email]);
  const user = rows[0];

  // Não revela se o email existe ou não (resposta genérica em ambos os casos).
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const rawToken = await createPasswordResetToken(user.id);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3010";
  const resetLink = `${appUrl}/redefinir-senha?token=${rawToken}`;

  // IMPORTANTE: não devolver o link na resposta da API. Sem isso, qualquer
  // pessoa que soubesse o e-mail de alguém conseguiria "resetar" a senha
  // dela sozinha — vira sequestro de conta assim que o app sai do
  // localhost. Sem provedor de e-mail configurado, o link só vai pro log
  // do servidor (acessível só por quem tem acesso à máquina/SSH). Pra
  // plugar e-mail de verdade depois: trocar este console.log por um envio
  // real (Resend, SMTP, etc).
  console.log(`[esqueci-senha] link de redefinição para ${email}: ${resetLink}`);

  return NextResponse.json({ ok: true });
}
