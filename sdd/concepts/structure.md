# Estructura del proyecto

> **Required reading:** [`principles.md`](principles.md).

Todo proyecto que adopte esta metodología parte de la siguiente estructura. Las carpetas marcadas como **OBLIGATORIAS** deben existir antes de generar el primer requisito.

## Árbol de carpetas

```
project-root/
├── docs/                              [OBLIGATORIO antes de requisitos]
│   ├── vision.md                      Qué problema resuelve + objetivos
│   ├── tech-stack.md                  Framework, BD, hosting, integraciones
│   ├── personas.md                    Usuarios objetivo + casos de uso
│   └── constraints.md                 Límites: compliance, presupuesto, deadlines
│
├── requirements/                      Requisitos versionados, organizados por dominio
│   ├── auth/
│   │   ├── REQ-AUTH-001-login-google/
│   │   │   ├── initial.md             Primer estado (creado con /new-req)
│   │   │   ├── change-001.md          Primer cambio (Delta Spec)
│   │   │   ├── change-002.md          Segundo cambio
│   │   │   ├── INDEX.md               Estado consolidado actual + historial
│   │   │   ├── ledger.md              Refactor Ledger detallado de este REQ
│   │   │   ├── manifest.md            Archivos de código que implementan este REQ
│   │   │   └── errors/
│   │   │       ├── ERR-001-loop-redirect.md
│   │   │       └── ERR-002-token-no-expira.md
│   │   └── REQ-AUTH-002-mfa/
│   └── payments/
│       └── REQ-PAY-001-checkout/
│
├── database/
│   ├── schema.sql                     Fuente de verdad de la BD
│   ├── diagram.mmd                    Mermaid ER autogenerado (NO editar)
│   └── migrations/                    Generadas por el framework
│
├── brand/                             Identidad visual y de marca
│   ├── colors.md                      Paleta + uso semántico
│   ├── typography.md                  Familias, jerarquía, tamaños
│   ├── voice-tone.md                  Cómo escribe la marca
│   └── logos/                         SVG/PNG con guía de uso
│
├── decisions/                         ADRs (Architecture Decision Records)
│   ├── ADR-001-elegir-framework.md
│   └── ADR-002-estrategia-cache.md
│
├── ledger.md                          Refactor Ledger GLOBAL (1 fila por cambio)
├── CLAUDE.md                          Instrucciones para Claude Code en este proyecto
├── sdd/                               Esta metodología modular (clonada del template)
└── .claude/
    ├── agents/                        planner, reviewer, implementer, auditor
    └── commands/                      Slash commands del proyecto
```

## Qué versionar en Git

**Todo** lo anterior va al repositorio del producto, en el MISMO repo del código fuente. La metodología SDD se rompe si el spec vive en otro sitio (Notion, Linear, etc.):
- Pierdes atomicidad spec + código en un único commit.
- Los agentes necesitarían integraciones externas y credenciales rotables.
- `/audit` no podría cruzar manifests con `git log`.
- Onboarding de devs nuevos requiere accesos a 5 herramientas.

### Excepciones (lo que NO se sube)

- `.env` y secretos reales — nunca.
- Datos personales en `ERR-NNN.md` — sanitizar emails, IDs reales, stack traces con tokens antes de commitear.
- En repos **públicos** (OSS): `docs/constraints.md` y `errors/` pueden contener info sensible de negocio o de clientes. En ese caso, considerar repo privado.

## Para qué sirve cada carpeta

- **`docs/`** — Base que alimenta a la IA al generar requisitos. Sin las 4 plantillas rellenas, [`/new-req`](../workflows/new-req.md) se rechaza.
- **`requirements/`** — Una carpeta por REQ, organizada por dominio. Ver [`conventions.md`](conventions.md) para naming.
- **`database/`** — `schema.sql` (o `schema.prisma`) es la fuente de verdad. El diagrama se autogenera vía GitHub Action ([`../reference/github-actions.md`](../reference/github-actions.md)).
- **`brand/`** — Identidad visual y de voz. Cambios siguen el flujo de [`/change-req`](../workflows/change-req.md) si afectan UI (los REQs cuyo `ui_components` se tocan).
- **`decisions/`** — ADRs (MADR + link a REQs). Ver [`../templates/adr.md`](../templates/adr.md).
- **`ledger.md`** (global) — Resumen cronológico de TODOS los cambios del proyecto. Ver [`../templates/ledger-global.md`](../templates/ledger-global.md).
- **`CLAUDE.md`** — Reglas duras del proyecto + stack + errores conocidos recurrentes. Punto de entrada para Claude Code.
- **`sdd/`** — Esta metodología misma. Vive en el repo del proyecto, forma parte de su fuente de verdad.
- **`.claude/`** — Agentes (planner, reviewer, implementer, auditor) y slash commands específicos del proyecto.
