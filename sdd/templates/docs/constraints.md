# Plantilla: `docs/constraints.md`

> Define las restricciones no negociables del proyecto: compliance, presupuesto, deadlines, técnicas heredadas.
>
> Sin este archivo rellenado, [`/new-req`](../../workflows/new-req.md) se rechaza.
>
> **Importante:** este archivo se enriquece con lecciones aprendidas de errores categoría `alucinacion_ia` o `spec_ambiguo` (ver [`../../concepts/error-management.md`](../../concepts/error-management.md)).

## Plantilla

```markdown
# Restricciones

## Compliance
- <GDPR / HIPAA / SOC 2 / ninguno>

## Presupuesto
- <Límite de coste mensual de infraestructura>

## Deadlines
- <Fechas duras conocidas>

## Restricciones técnicas heredadas
- <Asumir cookies de terceros bloqueadas (lección de ERR-001)>
- <...>
```

## Cómo rellenar

- **Compliance** — Regulaciones que el sistema debe cumplir. Pueden disparar requisitos enteros (consentimiento explícito, derecho al olvido, encriptación en reposo, etc.).
- **Presupuesto** — Cuánto puede gastar el proyecto. Marca el techo de elecciones de infra. Si es flexible, anotar el rango.
- **Deadlines** — Fechas duras (lanzamiento, fin de contrato, hito legal). El planner las considera al priorizar.
- **Restricciones técnicas heredadas** — Limitaciones del entorno: assumptions que la IA NO debe contradecir. Este es el campo más valioso a largo plazo: se va llenando con cada error de tipo `alucinacion_ia` o `spec_ambiguo` que enseña al equipo algo nuevo.

## Para qué la usa la IA

- **Planner de `/change-req`** la consulta para no proponer cambios que violen las restricciones.
- **Implementer** la lee para evitar implementaciones que rompen una restricción heredada.
- **Errores categoría `alucinacion_ia`** suelen aterrizar aquí como acción preventiva: "asumir siempre que cookies de terceros pueden estar bloqueadas".

## Cuándo actualizarla

- Cuando cambia un requisito legal/compliance.
- Cuando aparece una restricción de presupuesto.
- **Cada vez que se resuelve un error con acción preventiva que aplica a futuros prompts.** Este es el caso más frecuente. Ver [`../../concepts/error-management.md`](../../concepts/error-management.md) §5.

Cambios en compliance/presupuesto suelen merecer un ADR. Cambios en restricciones técnicas heredadas no — vienen directamente de errores resueltos.
