# Principios fundamentales

> **Cargar este archivo en TODA operación SDD.** Es la guía operativa mínima.

## Los 7 principios

1. **La especificación es la única fuente de verdad.** El código es un subproducto. Si el código y el spec discrepan, manda el spec.

2. **Actualizar el spec ANTES que el código.** Ningún cambio funcional toca código sin haber actualizado el requisito correspondiente. Si descubres a mitad de implementación que el spec no contemplaba algo → vuelve a fase de spec, no improvises.

3. **Cambios atómicos versionados, nunca destructivos.** Los requisitos no se reescriben en sitio. Cada cambio es un archivo nuevo (`change-NNN.md`) que apunta al estado anterior. La historia es navegable y auditable.

4. **Los errores son aprendizaje institucional, no vergüenzas.** Cada error de la IA o del humano se documenta con causa raíz, prompt detonante (si fue IA) y acción preventiva en el spec. Los errores alimentan los requisitos.

5. **La IA propone, el humano decide.** Los agentes detectan impacto y proponen planes; el humano aprueba en dos checkpoints (papel → implementación). Nunca commit automático sin aprobación.

6. **Trazabilidad bidireccional.** Cada REQ tiene un `manifest.md` con los archivos de código que lo implementan. Cada ADR enlaza los REQs que motivan o afecta. Cero código huérfano.

7. **Cambio de requisito ≠ corrección de error.** Cambio de requisito → versiona el REQ (`change-NNN.md`). Corrección de error → entra en log de errores (`ERR-NNN.md`), no versiona el REQ (salvo que revele ambigüedad → entonces ambos).

## Reglas duras derivadas

1. `initial.md` **jamás** se modifica.
2. `change-*.md` solo se modifican para marcar superseded (frontmatter + banner ⚠️). Su contenido ADDED/MODIFIED/REMOVED es inmutable. Ver [`../templates/change.md`](../templates/change.md).
3. `INDEX.md` "Estado consolidado actual" es la única fuente de verdad del estado vigente. Ver [`../templates/INDEX.md`](../templates/INDEX.md).
4. `database/diagram.mmd` es autogenerado, no editar a mano.
5. Antes de tocar código de un REQ, leer su `manifest.md`.
6. Toda migración pasa por el sistema definido en `docs/tech-stack.md`. Ver [`../reference/migrations-by-framework.md`](../reference/migrations-by-framework.md).

## Cómo aplicar en la duda

- **"¿esto rompe la promesa que le hicimos al usuario?"** → si quieres cambiar la promesa = cambio de requisito; si la promesa sigue válida = error.
- **"¿el spec es ambiguo aquí?"** → si sí, primero clarifica el spec con un Delta Spec, luego implementa.
- **"¿este cambio afecta a otros REQs?"** → si no estás 100% seguro, invoca el agente planner antes de tocar nada. Ver [`../workflows/change-req.md`](../workflows/change-req.md).
- **"¿debería leer este `change-NNN.md` histórico?"** → casi nunca. El `INDEX.md` tiene el estado vigente. Solo entra a changes históricos en `/rollback`, `/audit` profundo o investigación forense. Ver [`context-loading.md`](context-loading.md).
