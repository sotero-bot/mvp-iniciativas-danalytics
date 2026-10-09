#!/usr/bin/env bash
# Sincroniza la BD (schema + seeds) SOLO si cambiaron prisma/schema.prisma o algún seed.
#
# Objetivo: que un deploy de cambios solo-frontend NO se conecte a la base de datos.
# Así un hipo del pooler de Supabase (o el provisioning de la integración) no puede
# tumbar un build que ni siquiera toca el schema. Cuando SÍ cambia el schema/seeds,
# se sincroniza automáticamente (prisma db push + seeds).
#
# Para forzar la sincronización a mano en cualquier momento: `npm run db:sync`.
set -uo pipefail

PATTERN='^prisma/schema\.prisma$|^scripts/seed-.*\.ts$'

should_sync() {
  if ! command -v git >/dev/null 2>&1 || [ ! -e .git ]; then
    echo "[db-sync] git no disponible → sincronizo por seguridad"
    return 0
  fi
  if ! git rev-parse HEAD~1 >/dev/null 2>&1; then
    echo "[db-sync] sin commit previo en el clone → sincronizo por seguridad"
    return 0
  fi
  local changed
  changed="$(git diff --name-only HEAD~1 HEAD 2>/dev/null || true)"
  if printf '%s\n' "$changed" | grep -qE "$PATTERN"; then
    echo "[db-sync] cambios detectados en schema/seeds:"
    printf '%s\n' "$changed" | grep -E "$PATTERN"
    return 0
  fi
  echo "[db-sync] sin cambios de schema/seeds en este commit"
  return 1
}

if should_sync; then
  echo "[db-sync] → prisma db push + seeds"
  npm run db:sync
else
  echo "[db-sync] → omito db push y seeds (deploy solo-frontend)"
fi
