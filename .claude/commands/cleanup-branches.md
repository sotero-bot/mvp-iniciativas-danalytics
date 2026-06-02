---
description: Borra ramas locales cuyo PR está mergeado. Solo aplica en proyectos versionados con git.
---

# /cleanup-branches — Borrar ramas locales con PR mergeado

## Carga obligatoria

1. `CLAUDE.md`
2. `sdd/workflows/cleanup-branches.md` (manual completo)
3. `sdd/reference/commit-conventions.md` (naming de ramas)

## Tu rol

Detectar ramas locales (`req/`, `err/`, `rollback/`) cuyo PR ya está mergeado y borrarlas tras aprobación del usuario.

## Flujo

Sigue estrictamente los pasos 1-5 de `sdd/workflows/cleanup-branches.md`:

1. Detectar si `gh` CLI está disponible.
2. Listar ramas candidatas:
   - Con `gh`: cruzar `gh pr list --state merged` con ramas locales que siguen la convención.
   - Sin `gh`: usar `git branch --merged origin/main` con filtro de prefijo. Advertir que no detecta squash-merge.
3. Presentar al usuario lista agrupada por confianza:
   - 🟢 **Seguras** (PR mergeado + rama merged en git local) → borrar con `-d`.
   - 🟡 **Squash-merge probable** (PR mergeado pero rama no merged en git) → requiere `-D` tras confirmar.
4. Aplicar el borrado tras aprobación explícita.
5. Reportar resultado.

## Si NO hay git en el proyecto

Reportar al usuario:
```
Este proyecto no está versionado con git. /cleanup-branches no aplica.
```
Salir sin error.

## Modo de operación

- Operación de mantenimiento. Output limpio y compacto.
- Si el usuario tipea sin argumentos, ofrecer "Borrar todas las verdes + preguntar amarillas una por una" como acción por defecto.
- Si tipea con `--all`, borrar todas (verdes con -d, amarillas con -D) sin preguntar una por una — pero seguir confirmando antes de ejecutar.

## Restricciones

- **Nunca `git branch -D` sin confirmación humana.**
- **Nunca tocar ramas que no siguen la convención** (`req/`, `err/`, `rollback/`).
- **Nunca tocar el remoto.** Solo local.
- **Nunca borrar `main`, `master`, ni ramas con cambios sin commitear.**
