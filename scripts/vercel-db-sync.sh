#!/usr/bin/env bash
# Corre en TODOS los deploys de Vercel (cualquier rama) vía `vercel-build`.
# Sincroniza la BD (schema + seeds) SOLO si el schema de la BD difiere de prisma/schema.prisma
# o si cambió algún seed en el último commit.
#
# Detección de schema: `prisma migrate diff` compara la BD real contra el schema (solo lectura).
# Así no importa cuántos commits traiga el push ni en cuál esté el cambio de schema: si la BD
# está desfasada, se sincroniza. (Antes se miraba solo `git diff HEAD~1 HEAD`, y un push de
# varios commits con el cambio de schema en uno intermedio dejaba la BD sin actualizar.)
#
# Protección: todas las ramas no-main comparten la BD de Preview. Una rama desactualizada
# tiene un schema viejo y `db push --accept-data-loss` borraría tablas/columnas que otras ramas
# ya usan. Si el diff es destructivo (DROP TABLE/COLUMN/TYPE o cambio de tipo), el build FALLA
# en vez de sincronizar. Para aplicar un borrado intencional: ALLOW_DESTRUCTIVE_DB_SYNC=1.
#
# Si la BD no responde (hipo del pooler de Supabase), se cae a la heurística por git para que
# un deploy solo-frontend no se tumbe por eso.
#
# Para forzar la sincronización: FORCE_DB_SYNC=1, o a mano `npm run db:sync`.
set -uo pipefail

SEED_PATTERN='^scripts/seed-.*\.ts$'
GIT_PATTERN='^prisma/schema\.prisma$|^scripts/seed-.*\.ts$'
DESTRUCTIVE_PATTERN='DROP TABLE|DROP COLUMN|DROP TYPE|SET DATA TYPE'

changed_in_last_commit() {
  local pattern="$1"
  if ! command -v git >/dev/null 2>&1 || [ ! -e .git ] || ! git rev-parse HEAD~1 >/dev/null 2>&1; then
    return 0
  fi
  git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -qE "$pattern"
}

# Devuelve 0 si hay que sincronizar, 1 si no. Sale del script con error si el diff es destructivo.
should_sync() {
  if [ "${FORCE_DB_SYNC:-}" = "1" ]; then
    echo "[db-sync] FORCE_DB_SYNC=1 → sincronizo"
    return 0
  fi

  local diff_sql code
  diff_sql="$(npx prisma migrate diff \
    --from-schema-datasource prisma/schema.prisma \
    --to-schema-datamodel prisma/schema.prisma \
    --script --exit-code 2>/dev/null)"
  code=$?

  case "$code" in
    2)
      echo "[db-sync] la BD difiere de prisma/schema.prisma"
      if printf '%s\n' "$diff_sql" | grep -qE "$DESTRUCTIVE_PATTERN"; then
        echo "[db-sync] el diff es DESTRUCTIVO:"
        printf '%s\n' "$diff_sql" | grep -E "$DESTRUCTIVE_PATTERN" | sed 's/^/[db-sync]   /'
        if [ "${ALLOW_DESTRUCTIVE_DB_SYNC:-}" = "1" ]; then
          echo "[db-sync] ALLOW_DESTRUCTIVE_DB_SYNC=1 → sincronizo igualmente"
          return 0
        fi
        echo "[db-sync] ✗ Aborto el build para no borrar datos de la BD compartida."
        echo "[db-sync]   Si la rama está desactualizada: actualízala (merge/rebase) con la rama base."
        echo "[db-sync]   Si el borrado es intencional: define ALLOW_DESTRUCTIVE_DB_SYNC=1 y redeploy."
        exit 1
      fi
      return 0
      ;;
    0)
      if changed_in_last_commit "$SEED_PATTERN"; then
        echo "[db-sync] schema al día, pero cambiaron seeds en este commit"
        return 0
      fi
      echo "[db-sync] schema de la BD al día y sin cambios de seeds"
      return 1
      ;;
    *)
      echo "[db-sync] no pude comparar contra la BD (exit $code) → uso heurística por git"
      if changed_in_last_commit "$GIT_PATTERN"; then
        return 0
      fi
      return 1
      ;;
  esac
}

if should_sync; then
  echo "[db-sync] → prisma db push + seeds"
  npm run db:sync
else
  echo "[db-sync] → omito db push y seeds"
fi
