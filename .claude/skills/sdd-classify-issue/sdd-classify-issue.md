---
name: sdd-classify-issue
description: Ayuda a clasificar si un problema reportado es una corrección de error o un cambio de requisito ANTES de derivar al flujo correcto. Dispárate cuando el usuario reporte un bug, comportamiento inesperado, algo que no funciona, error en producción, falla, o cualquier descripción de algo que está roto. Skill de GUÍA — no ejecuta cambios, ayuda a decidir.
---

# Skill: sdd-classify-issue

## Carga obligatoria

1. `CLAUDE.md`
2. `sdd/concepts/error-management.md` (CRÍTICO: la distinción cambio vs error vive aquí)
3. `sdd/concepts/principles.md`
4. `sdd/templates/error.md` (por si hay que crear un ERR)

## Tu rol

El usuario reporta un problema. Tu trabajo es **clasificarlo correctamente** antes de derivar al flujo adecuado:

- **Error:** la promesa al usuario sigue válida, el código está mal. → Crear `ERR-NNN.md`.
- **Cambio de requisito:** la promesa al usuario cambia. → Derivar a `/change-req`.
- **Ambos:** el error reveló ambigüedad en el spec. → Primero ERR, luego `/change-req` con la acción preventiva.

## Pregunta guía clave

> **"¿La promesa que le hicimos al usuario sigue válida?"**

- Si sí, y esto es código incorrecto → **ERROR**.
- Si no, y queremos cambiar la promesa → **CAMBIO DE REQUISITO**.
- Si reveló que la promesa era ambigua → **AMBOS**.

## Flujo

1. Lee la descripción del usuario.
2. Identifica el o los REQs afectados (cruzar con `requirements/`).
3. Aplica la pregunta guía. Si es ambiguo, **PREGUNTA al usuario explícitamente** — no asumas.
4. Para errores, sugiere categoría:
   - `alucinacion_ia` — La IA inventó/asumió algo no especificado.
   - `spec_ambiguo` — El spec permitía múltiples interpretaciones.
   - `regresion` — Un cambio rompió comportamiento de otro REQ.
   - `bug_humano` — Código modificado a mano fuera del flujo.

## Output

```markdown
## Clasificación
**[ERROR | CAMBIO DE REQUISITO | AMBOS]**

## REQ(s) afectado(s)
- [[REQ-XXX]] — [por qué afectado]

## Justificación
[2-3 frases aplicando la pregunta guía.]

## Si es ERROR — categoría sugerida
- `alucinacion_ia` | `spec_ambiguo` | `regresion` | `bug_humano`
- Razón: [breve]

## Acción recomendada
- ✅ Crear `ERR-NNN.md` en `requirements/<dominio>/REQ-XXX/errors/`. ¿Lo creo desde la plantilla? [Sí / No]
- ✅ (Opcional, solo si la categoría es `spec_ambiguo` o `alucinacion_ia`) Invocar `/change-req` para cerrar la ambigüedad en el spec. ¿Lo hago después de crear el ERR? [Sí / No]
```

## Cuándo dispararte

Triggers (descripciones del usuario):

- "Hay un bug en X"
- "Esto no funciona"
- "El código hace Y pero debería hacer Z"
- "Falla cuando..."
- "Encontré un problema"
- "Error en producción..."
- "Comportamiento raro en..."
- "Se rompió X"
- "X dejó de funcionar"
- "Algo está mal con..."

**Importante:** NO dispararte si el usuario describe claramente un cambio intencional ("quiero que la sesión dure 30 min"). Eso va directo a `/change-req`.

## Restricciones

- **Eres una GUÍA, no ejecutas cambios destructivos.** Solo creas `ERR-NNN.md` si el usuario aprueba.
- **No derives a `/change-req`** sin confirmar primero con el usuario que es cambio de requisito (no error).
- **En casos ambiguos PREGUNTA.** "Esto suena como X — ¿es eso?" es mejor que asumir.
- **No alteres el spec sin pasar por `/change-req`.** Si la clasificación implica actualizar el spec, eso es responsabilidad de `/change-req`, no tuya.
