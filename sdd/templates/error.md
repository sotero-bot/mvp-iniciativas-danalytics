# Plantilla: `ERR-NNN-<slug>.md` (registro de error)

> Vive en `requirements/<dominio>/REQ-<PRINCIPAL>/errors/`.
>
> **Required reading antes de crear un error:** [`../concepts/error-management.md`](../concepts/error-management.md).

## Plantilla

```markdown
---
id: ERR-001
req_principal: REQ-AUTH-001
reqs_afectados: [REQ-AUTH-001, REQ-AUTH-002]
categoria: alucinacion_ia               # alucinacion_ia | spec_ambiguo | regresion | bug_humano
estado: resuelto                        # detectado | en_investigacion | resuelto | aceptado
detectado: 2026-06-10
resuelto: 2026-06-11
detectado_por: sotero
resuelto_por: claude-code + sotero
---

# ERR-001 — Loop infinito en redirect cuando cookies bloqueadas

## Síntoma
Cuando el navegador del usuario tiene cookies de terceros bloqueadas, el callback
de Google entra en loop entre `/auth/callback/google` y `/login` indefinidamente.

## Causa raíz
La IA generó código que dependía de una cookie `oauth_state` para validar el
callback, pero no verificó si la cookie estaba disponible antes de intentar leerla.
Cuando la cookie no existía, redirigía a `/login` sin limpiar el state, y `/login`
detectaba el state en URL y reintentaba el callback.

## Solución aplicada
1. Validar existencia de cookie antes de leerla en `src/auth/google_oauth.ts:45`.
2. Si la cookie no está, mostrar mensaje claro al usuario y NO redirigir.
3. Limpiar parámetros de URL al llegar a `/login` por flujo de error.

Commit: `a1b2c3d`

## ¿Era un cambio de requisito o un error?
**Error.** El requisito (REQ-AUTH-001) implícitamente esperaba el camino feliz
con cookies habilitadas. La IA produjo código frágil ante un escenario válido
no contemplado. NO se versionó el REQ por esto, pero SÍ se actualizó el spec
(ver "Acción preventiva").

## Prompt original que disparó el error (si aplica)
```
"Implementa el flujo de OAuth con Google para REQ-AUTH-001. Usa cookies
para el state."
```
La instrucción no contemplaba el caso de cookies bloqueadas. La IA asumió
camino feliz.

## Acción preventiva en el spec
- En `REQ-AUTH-001/change-001.md` (ADDED): "El sistema DEBE manejar el caso de
  cookies bloqueadas mostrando un mensaje informativo, sin entrar en loop."
- En `docs/constraints.md`: añadida nota "Asumir siempre que cookies de terceros
  pueden estar bloqueadas; diseñar fallbacks explícitos."

## Lecciones para futuros prompts a la IA
- Al pedir flujos OAuth, especificar explícitamente el manejo de cookies
  bloqueadas y modo incógnito.
- Pedir tests de propiedades para flujos con dependencias del browser.
```

## Semántica de los campos

| Campo | Significado |
|---|---|
| `id` | `ERR-NNN`. Numeración **local al REQ principal**, no global. |
| `req_principal` | REQ donde vive este archivo. El más afectado por el error. |
| `reqs_afectados` | Todos los REQs tocados. Si solo es uno, lista de 1 elemento. |
| `categoria` | Una de: `alucinacion_ia`, `spec_ambiguo`, `regresion`, `bug_humano`. Ver [`../concepts/error-management.md`](../concepts/error-management.md). |
| `estado` | Ciclo de vida del error. |
| `detectado` / `resuelto` | Fechas ISO. |
| `detectado_por` / `resuelto_por` | Quién hizo cada parte. |

## Secciones obligatorias

- **Síntoma** — Qué se observó. Comportamiento visible.
- **Causa raíz** — Por qué ocurrió. Explicación técnica.
- **Solución aplicada** — Qué se hizo para resolverlo. Incluir commit hash.
- **¿Era un cambio de requisito o un error?** — Justificar la clasificación. Es la pregunta clave.
- **Prompt original** — Solo si la categoría es `alucinacion_ia` o si la causa raíz involucró a la IA. Pegar el prompt EXACTO.
- **Acción preventiva en el spec** — Si la categoría es `spec_ambiguo` o `alucinacion_ia`, qué se actualizó en el spec o en `CLAUDE.md` para evitar recurrencia.
- **Lecciones para futuros prompts a la IA** — (opcional) Patrones a evitar al promptear similares en el futuro.

## Cuándo crear un ERR vs cuándo crear un change

Ver tabla completa en [`../concepts/error-management.md`](../concepts/error-management.md). Resumen:

- "¿La promesa al usuario sigue válida y esto es código incorrecto?" → **error**, va aquí.
- "¿La promesa al usuario cambia?" → **cambio de requisito**, va a [`change.md`](change.md).
- A veces se necesitan AMBOS: el error reveló ambigüedad → primero `ERR-NNN.md`, luego invocar [`/change-req`](../workflows/change-req.md) con la acción preventiva.

## Errores multi-REQ

Si el error afecta a varios REQs, vive en el REQ "principal" y los demás referencian con `[[ERR-NNN del REQ-PRINCIPAL]]` en la sección "Errores relacionados en otros REQs" de su `INDEX.md`. NO duplicar el archivo. Ver [`../concepts/error-management.md`](../concepts/error-management.md) §3.
