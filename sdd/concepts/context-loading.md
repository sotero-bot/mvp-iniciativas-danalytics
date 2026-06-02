# Estrategia de carga de contexto

> **Required reading:** [`principles.md`](principles.md).
>
> **Quién la aplica:** todos los agentes (planner, reviewer, implementer, auditor) y la sesión principal de Claude Code.

A medida que un proyecto acumula REQs, changes y errores, leer "todo" en cada operación llenaría rápidamente la ventana de contexto y, peor aún, mezclaría estados históricos ya superados con el estado vigente. Esta sección define cómo los agentes cargan información de forma disciplinada.

## 1. Principios de carga

1. **`INDEX.md` es la única fuente de verdad del estado actual.** Los agentes NUNCA reconstruyen el estado vigente leyendo `initial.md + change-001 + change-002 + …`. Leen el "Estado consolidado actual" del `INDEX.md` y punto. Ver [`../templates/INDEX.md`](../templates/INDEX.md).
2. **Los `change-NNN.md` son deltas inmutables de auditoría.** Se leen bajo demanda (rollback, investigación forense, audit profundo). NUNCA en el flujo normal de un cambio nuevo.
3. **Los changes superados se marcan explícitamente** (`status: superseded`, `superseded_by` y banner ⚠️) para que ni humanos ni agentes los confundan con verdad viva. Ver [`../templates/change.md`](../templates/change.md).
4. **Subagentes con contexto aislado.** La sesión principal nunca acumula los escaneos completos: los subagentes hacen el trabajo y devuelven solo el resultado estructurado y compacto.

## 2. Tiers de carga

| Tier | Qué carga | Cuándo |
|---|---|---|
| **0** | `ledger.md` global (1 línea por cambio) + `docs/` completos | Siempre — punto de partida de cualquier operación |
| **1** | `INDEX.md` de TODOS los REQs (frontmatter + "Estado consolidado actual" + dependencias) | `/change-req` fase 1 (planner) y `/audit` |
| **2** | `manifest.md` + `INDEX.md` detallado SOLO de REQs marcados como impactados en tier 1 | Bajo demanda tras detectar impacto |
| **3** | `change-NNN.md` históricos, `ERR-NNN.md` antiguos, `initial.md` | Solo en `/rollback`, `/audit` profundo, o si el reviewer pide verificar un histórico |

**Regla práctica:**
- El **planner** se mueve en tier 0–1 y profundiza a tier 2 solo donde detectó impacto.
- El **reviewer** arranca con el grafo del planner (compacto) y sube a tier 1–2 solo si necesita verificar.
- El **implementer** trabaja exclusivamente en tier 2 sobre los REQs afectados, sin ver el plan original ni la discusión.

## 3. Aislamiento por subagente

Cada fase de [`/change-req`](../workflows/change-req.md) corre como subagente con su propio contexto. Esto es **crítico** para no saturar la sesión principal:

- **Planner** recibe: descripción del cambio en lenguaje natural + acceso a tiers 0–1. Devuelve: grafo de impacto estructurado, borradores de Delta Specs por REQ afectado, lista de archivos de código candidatos.
- **Reviewer** recibe SOLO el grafo de impacto del planner (NO los `INDEX.md` crudos). Si necesita verificar algo, sube a tier 1 por su cuenta. Devuelve: veredicto + observaciones.
- **Implementer** recibe SOLO los Delta Specs aprobados + los `manifest.md` de los REQs afectados (tier 2 acotado). Devuelve: diff de código + tests + checklist humano + output del smoke test.

La sesión principal (donde interactúa el usuario) **nunca** acumula el tier 1 completo. Solo ve los productos compactos de cada subagente.

## 4. Compactación periódica (opcional)

Cuando un REQ acumula muchos changes históricos (recomendación: más de 10), ejecutar [`/compact-req REQ-XXX`](../workflows/compact-req.md):

1. El agente lee todos los `change-NNN.md` históricos del REQ.
2. Genera `requirements/<dominio>/REQ-XXX/archive/consolidated-<fecha>.md` resumiendo qué cambió entre el `initial.md` y el último change marcado para compactación.
3. Mueve los `change-NNN.md` compactados a `requirements/<dominio>/REQ-XXX/archive/`.
4. Deja en la raíz del REQ solo: `initial.md` (intocable), changes desde el corte hacia adelante, `INDEX.md` actualizado con referencia al archive, `manifest.md`, `ledger.md`, `errors/`.

El `archive/` queda en git para auditoría histórica pero **no se carga en ningún tier por defecto**. Solo se consulta explícitamente cuando alguien pregunta "¿cómo era este REQ hace 6 meses?".

## 5. Si el `INDEX.md` se desactualiza

Si el `INDEX.md` deja de reflejar el estado vigente (humano olvidó actualizarlo, agente falló a mitad de operación, merge conflict mal resuelto), TODA la metodología se rompe: el planner verá un estado falso, el reviewer no detectará impactos reales, el implementer tocará código equivocado.

**Mitigaciones:**

- **Obligatoriedad en `/change-req`.** El paso 7 del flujo exige reescribir el "Estado consolidado actual" del `INDEX.md` ANTES del checkpoint 2. Es bloqueante.
- **`/audit` detecta inconsistencias.** Si `INDEX.md` dice `current_state: change-002` pero existe un `change-003` sin marcar como vigente, o un `change-002` con `status: implementado` pero sin reflejarse en el "Estado consolidado actual" → reporta.
- **Recuperación con [`/rebuild-index REQ-XXX`](../workflows/rebuild-index.md).** El agente reconstruye el INDEX leyendo `initial.md` + todos los `change-NNN.md` en orden, consolidando. Es costoso (lee tier 3 entero del REQ) pero salvavidas para recuperarse de un INDEX corrupto.

## 6. Resumen visual del flujo de carga

```
Usuario: "/change-req: la sesión debe durar 30 min"
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Sesión principal                                            │
│ (solo ve productos compactos de subagentes)                 │
└─────────────────────────────────────────────────────────────┘
        │
        ▼ invoca
┌─────────────────────────────────────────────────────────────┐
│ Planner (subagente, contexto aislado)                       │
│ Lee: tier 0 + tier 1 + tier 2 acotado                       │
│ Devuelve: grafo de impacto + Delta Specs borrador           │
└─────────────────────────────────────────────────────────────┘
        │
        ▼ pasa grafo a
┌─────────────────────────────────────────────────────────────┐
│ Reviewer (subagente, contexto limpio)                       │
│ Recibe: SOLO el grafo del planner                           │
│ Lee bajo demanda: tier 1 si necesita verificar              │
│ Devuelve: veredicto + observaciones                         │
└─────────────────────────────────────────────────────────────┘
        │
        ▼ CHECKPOINT 1 humano → INDEX.md y changes actualizados
        ▼ invoca
┌─────────────────────────────────────────────────────────────┐
│ Implementer (subagente, contexto limpio)                    │
│ Recibe: SOLO Delta Specs aprobados + manifests              │
│ Lee: tier 2 acotado a REQs afectados                        │
│ Devuelve: diff + tests + checklist humano                   │
└─────────────────────────────────────────────────────────────┘
        │
        ▼ CHECKPOINT 2 humano → commit
```
