# Plantilla: `docs/vision.md`

> Define el norte del producto. Es la **base obligatoria** que alimenta a la IA cuando genera nuevos requisitos.
>
> Sin este archivo rellenado, [`/new-req`](../../workflows/new-req.md) se rechaza.

## Plantilla

```markdown
# Visión del producto

## Problema que resuelve
<1–3 párrafos. Qué dolor del usuario atacamos.>

## Objetivos del producto
- Objetivo 1: <medible>
- Objetivo 2: <medible>

## Métricas de éxito
- <KPI 1>
- <KPI 2>

## Out of scope
- <Lo que explícitamente NO haremos en esta fase.>
```

## Cómo rellenar cada sección

- **Problema que resuelve** — Sé concreto. Quién sufre el problema, en qué contexto, qué intentan hoy sin éxito. Evitar generalidades del tipo "ayudamos a la productividad".
- **Objetivos del producto** — Listables y medibles. "Reducir tiempo de onboarding de N minutos a M" es bueno; "ser el mejor" no es objetivo.
- **Métricas de éxito** — Cómo sabremos si funciona. KPIs cuantitativos siempre que sea posible.
- **Out of scope** — Lo que NO haremos. Tan importante como lo que sí. Evita que la IA proponga features fuera de alcance.

## Para qué la usa la IA

- **`/init-project`** la lee para entender el dominio del producto al sugerir los primeros REQs candidatos.
- **`/new-req`** la consulta para validar que el REQ propuesto está alineado con el objetivo del producto.
- **Planner de `/change-req`** la consulta cuando un cambio parece estar fuera de alcance: levanta una advertencia al humano.
