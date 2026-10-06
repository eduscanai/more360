#!/bin/bash
# Cria o banco local (se não existir) e aplica o schema.
# Requer Postgres local rodando (brew services start postgresql@15).
set -euo pipefail

DB_NAME="more360_lite"
DB_USER="${USER}"
PSQL="/opt/homebrew/opt/postgresql@15/bin/psql"
[ -x "$PSQL" ] || PSQL="psql"

if ! "$PSQL" -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  echo "Criando banco ${DB_NAME}..."
  "$PSQL" -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME};"
else
  echo "Banco ${DB_NAME} já existe."
fi

echo "Aplicando schema..."
"$PSQL" -U "$DB_USER" -d "$DB_NAME" -f "$(dirname "$0")/../db/schema.sql"

echo "OK — banco ${DB_NAME} pronto."
