#!/bin/bash
# Sobe o more360-lite em modo produção (next start). Pensado pra ser chamado
# pelo LaunchAgent (install/com.more360lite.app.plist) — por isso resolve
# tudo por caminho absoluto, sem depender do PATH/perfil do shell que o
# launchd não carrega.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# launchd/systemd não carregam o PATH do seu shell — por isso resolve node e
# pg_isready por caminho absoluto, tentando os locais mais comuns antes de
# cair pro PATH. Ajuste NODE_BIN se o seu `which node` apontar pra outro
# lugar (ex: nvm instala em ~/.nvm/versions/node/<versão>/bin/node).
NODE_BIN=""
for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
  if [ -x "$candidate" ]; then NODE_BIN="$candidate"; break; fi
done
[ -n "$NODE_BIN" ] || NODE_BIN="$(command -v node)"

NEXT_BIN="$PROJECT_DIR/node_modules/.bin/next"

PSQL=""
for candidate in /opt/homebrew/opt/postgresql@15/bin/pg_isready /opt/homebrew/bin/pg_isready /usr/bin/pg_isready /usr/local/bin/pg_isready; do
  if [ -x "$candidate" ]; then PSQL="$candidate"; break; fi
done
[ -n "$PSQL" ] || PSQL="$(command -v pg_isready || echo pg_isready)"

# Espera o Postgres responder antes de subir o Next — evita a corrida de
# boot onde o app sobe 1s antes do banco e a 1ª request cai em erro de
# conexão. Timeout de 30s é generoso; em uso normal o Postgres já está de
# pé (é outro LaunchAgent/brew service, roda continuamente).
for i in $(seq 1 30); do
  if "$PSQL" -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
    break
  fi
  sleep 1
done

exec "$NODE_BIN" "$NEXT_BIN" start -p 3010
