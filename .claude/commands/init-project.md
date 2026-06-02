---
description: Bootstrap del proyecto. Crea estructura, configura migraciones y diagrama ER, esboza primeros REQs a partir de docs/.
---

# /init-project — Bootstrap del proyecto

## Carga obligatoria

1. `CLAUDE.md`
2. `sdd/README.md`
3. `sdd/workflows/init-project.md` (el manual completo, pasos 1-11)
4. `sdd/reference/migrations-by-framework.md` (para detectar sistema de migraciones)

## Tu rol

Ejecutar el bootstrap del proyecto siguiendo estrictamente `sdd/workflows/init-project.md`.

## Flujo

### Fase 1 — Verificar `docs/`

- Si `docs/` no existe o alguno de los 4 archivos obligatorios (`vision.md`, `tech-stack.md`, `personas.md`, `constraints.md`) está vacío/sin rellenar:
  - Crear `docs/` con las plantillas de `sdd/templates/docs/*` copiadas.
  - **DETENTE.** Reporta al usuario:
    > `docs/` creada con plantillas vacías. Rellena los 4 archivos antes de continuar.
    > Vuelve a ejecutar `/init-project` cuando termines.
  - NO continúes a fase 2.

### Fase 2 — Configurar el proyecto

Una vez `docs/` está poblada:

1. **Preguntar idioma** de la documentación generada (REQs, errores, ledger). Default: español. Opciones: ES / EN / otro.

2. **Detectar sistema de migraciones** cruzando `docs/tech-stack.md` con la tabla de `sdd/reference/migrations-by-framework.md`. Si no hay match, preguntar al usuario ofreciendo opciones similares a Django.

3. **Crear estructura:**
   - `requirements/`
   - `database/schema.sql` (vacío o con esquema inicial si el usuario lo tiene)
   - `database/migrations/` (vacío)
   - `brand/` con plantillas (colors.md, typography.md, voice-tone.md, logos/)
   - `decisions/` (vacío)
   - `ledger.md` (cabecera, sin filas)
   - `.github/workflows/sync-schema.yml` (ver `sdd/reference/github-actions.md`, elegir Opción 1 Prisma u Opción 2 SQL plano según stack)

4. **Generar `CLAUDE.md` específico del proyecto** a partir del template (este archivo en la raíz). Reemplazar `{{nombre-del-proyecto}}` y rellenar las secciones "Stack del proyecto" y "Sistema de migraciones" con los datos detectados.

### Fase 3 — Entrevista para primeros REQs

5. Lee `docs/vision.md` y `docs/personas.md`.
6. Propón al usuario los primeros REQs candidatos a partir de los casos de uso de cada persona. Para cada uno:
   - ID (dominio + número).
   - Título.
   - Entidades de BD esperadas (cruzar con `database/schema.sql` si tiene contenido).
   - Componentes UI esperados.
   - Dependencias.
7. Usuario aprueba, ajusta, descarta o añade.
8. Por cada REQ aprobado, invocar el flujo `/new-req` con la info recopilada.

## Modo de operación

El usuario espera autonomía dentro del flujo. Pregúntale ESTRICTAMENTE lo necesario:
- Idioma de la doc (1 pregunta).
- Sistema de migraciones si no se detecta automáticamente (1 pregunta).
- Aprobación de cada REQ candidato propuesto (1 pregunta por REQ, en bloque).

Todo lo demás se ejecuta sin pedir confirmación intermedia.

## Output al terminar

- Estructura completa creada y verificada.
- `CLAUDE.md` específico generado.
- GitHub Action de diagrama ER configurada.
- N REQs iniciales en estado `draft`.
- Fila `init` en `ledger.md` global.
- Reporte resumen al usuario con próximos pasos sugeridos.
