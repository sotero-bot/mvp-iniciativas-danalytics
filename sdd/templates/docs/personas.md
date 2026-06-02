# Plantilla: `docs/personas.md`

> Define los usuarios objetivo y sus casos de uso clave.
>
> Sin este archivo rellenado, [`/new-req`](../../workflows/new-req.md) se rechaza.

## Plantilla

```markdown
# Personas y casos de uso

## Persona 1: <Nombre arquetipo>
- **Rol:** <freelancer, admin, etc.>
- **Objetivo principal:** ...
- **Dolor actual:** ...
- **Casos de uso clave:**
  - <Caso 1>
  - <Caso 2>

## Persona 2: <Otro arquetipo>
- **Rol:** ...
- **Objetivo principal:** ...
- **Dolor actual:** ...
- **Casos de uso clave:**
  - ...
```

## Cómo rellenar

- **Una sección por persona arquetipo.** Suele haber 2–5 personas en un producto. Si necesitas más, probablemente el producto está mal enfocado.
- **Rol** — Cargo o relación con el sistema. No es un puesto exacto sino un arquetipo (ej. "admin de tienda online", no "Juan Pérez").
- **Objetivo principal** — Qué quiere lograr esta persona usando el producto. Una frase.
- **Dolor actual** — Qué hace hoy (sin tu producto) y por qué es insuficiente. Concreto.
- **Casos de uso clave** — Las 3–6 cosas más importantes que esta persona hace en el producto. Son la base para priorizar y validar REQs.

## Para qué la usa la IA

- **`/init-project`** la lee para esbozar los primeros REQs candidatos a partir de los casos de uso de cada persona.
- **`/new-req`** consulta a qué persona sirve el REQ propuesto. Si ninguno encaja con personas existentes → advertencia (¿persona nueva? ¿REQ fuera de alcance?).
- **Planner de `/change-req`** la considera para validar si un cambio aún sirve a la persona objetivo.

## Cuándo actualizarla

- Cuando se descubre una persona nueva no contemplada (después de feedback de usuarios reales).
- Cuando una persona evoluciona (sus casos de uso cambian con el tiempo).

Cambios en este archivo NO requieren ADR, pero conviene mencionar el cambio en el `ledger.md` global con tipo `docs`.
