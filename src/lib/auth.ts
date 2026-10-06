import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";
import { query } from "./db";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE,
  SessionPayload,
  signSessionToken,
  verifySessionToken,
} from "./session";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// O atributo `Secure` só faz sentido quando o app é servido por HTTPS de
// verdade — navegadores (e o curl) descartam cookies `Secure` em conexão
// HTTP pura pra qualquer host que não seja localhost/127.0.0.1. Amarrar
// isso a NODE_ENV==="production" quebraria o login assim que o app fosse
// publicado num IP público sem TLS (exatamente o caso aqui: produção, mas
// ainda sem HTTPS). Em vez disso, deriva de NEXT_PUBLIC_APP_URL — quando
// tiver domínio + Let's Encrypt configurado, basta trocar a URL pra https://
// que o cookie passa a ser Secure automaticamente, sem mexer em código.
const COOKIE_SECURE = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");

/** Cria a sessão (JWT) e grava o cookie httpOnly. Chamar em API routes (Node runtime). */
export async function createSessionCookie(payload: SessionPayload) {
  const token = await signSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Lê e valida a sessão atual a partir do cookie (server components / route handlers). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Defesa em profundidade: o middleware já bloqueia /api sem sessão, mas cada
 * route handler valida de novo — evita depender só do matcher do middleware.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AuthError("Não autenticado.");
  }
  return session;
}

export class AuthError extends Error {}

/** Igual requireSession(), mas exige role 'owner' — usado no módulo de Controle de Acesso. */
export async function requireOwnerSession(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "owner") {
    throw new AuthError("Só o owner pode gerenciar usuários.");
  }
  return session;
}

// ------------------------------------------------------------------
// Reset de senha — token opaco de 32 bytes; guardamos só o hash (sha256)
// no banco, e devolvemos o valor bruto pra compor o link (equivalente ao
// que um e-mail transacional enviaria).
// ------------------------------------------------------------------

const RESET_TOKEN_TTL_MS = 1000 * 60 * 30; // 30 minutos

export function generateResetToken() {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export async function createPasswordResetToken(userId: string) {
  const { raw, hash } = generateResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await query(
    `insert into password_reset_tokens (user_id, token_hash, expires_at)
     values ($1, $2, $3)`,
    [userId, hash, expiresAt]
  );
  return raw;
}

export async function consumePasswordResetToken(rawToken: string) {
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const rows = await query<{
    id: string;
    user_id: string;
    expires_at: string;
    used_at: string | null;
  }>(
    `select id, user_id, expires_at, used_at
     from password_reset_tokens
     where token_hash = $1`,
    [hash]
  );
  const record = rows[0];
  if (!record) return { ok: false as const, reason: "not_found" as const };
  if (record.used_at) return { ok: false as const, reason: "used" as const };
  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { ok: false as const, reason: "expired" as const };
  }
  await query(`update password_reset_tokens set used_at = now() where id = $1`, [
    record.id,
  ]);
  return { ok: true as const, userId: record.user_id };
}
