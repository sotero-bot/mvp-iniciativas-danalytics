---
description: Crea un nuevo requisito desde una descripción en lenguaje natural. Detecta automáticamente dominio, entidades de BD, componentes UI y dependencias.
---

# /new-req — Crear requisito

## Tu rol

Recibir una descripción en lenguaje natural y generar la carpeta completa del REQ sin pedir aprobación previa. El comando SIEMPRE termina con archivos creados en disco.

---

## PASO 0 — Setup de git (OBLIGATORIO antes de tocar archivos)

```bash
git rev-parse --git-dir 2>/dev/null
```

- **Si falla** → no hay git. Ir directo al Paso 1.
- **Si tiene éxito** → ejecutar en orden:

```bash
git status --porcelain
```

Si hay cambios sin commitear, preguntar al usuario (stash / abortar / continuar).

```bash
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'
```

Si no devuelve nada, usar `git branch --show-current`. Guardar ese valor como `<rama-base>`.

```bash
git checkout <rama-base>
```

> La rama del REQ se crea en el Paso 4, cuando ya se tiene el ID calculado.

---

## PASO 1 — Inferir información del REQ

A partir de la descripción del usuario, inferir:

- **Dominio:** una palabra que agrupe el REQ (ej: `auth`, `billing`, `notifications`). Si hay carpetas existentes en `requirements/`, usar ese naming. Si no, inferirlo del contexto.
- **Título:** nombre corto descriptivo (máximo 5 palabras).
- **Descripción funcional:** qué necesidad del usuario resuelve este REQ.
- **Criterios de aceptación:** mínimo 1. Inferirlos de la descripción — no pedir al usuario a menos que sea completamente imposible deducirlos.

**Preguntar solo si no puedes inferir el dominio ni el título.** Todo lo demás se infiere.

---

## PASO 2 — Calcular ID del REQ

1. Listar carpetas en `requirements/<dominio>/` (si el dominio no existe, será la primera).
2. Buscar el patrón `REQ-<DOMINIO>-<NNN>` y tomar el siguiente número disponible.
3. Si la carpeta de dominio no existe o está vacía → empezar desde `001`.
4. Formato del ID: `REQ-<DOMINIO-EN-MAYÚSCULAS>-<NNN>` (ej: `REQ-AUTH-001`).
5. Formato del slug: título en minúsculas con guiones (ej: `login-google`).
6. Nombre completo de la carpeta: `REQ-<DOMINIO>-<NNN>-<slug>` (ej: `REQ-AUTH-001-login-google`).

---

## PASO 3 — Detectar entidades, componentes y dependencias

**Entidades de BD candidatas:**

- Si existe `database/schema.sql` o `prisma/schema.prisma`, leerlo y cruzar con el dominio del REQ.
- Si no existe schema, inferir entidades del título y descripción.

**Componentes UI candidatos:**

- Buscar en `src/` o `app/` archivos con nombres relacionados al dominio.
- Si no hay frontend, omitir esta sección.

**Dependencias con otros REQs:**

- Listar los `INDEX.md` existentes en `requirements/` y buscar solapamiento de entidades o funcionalidades.
- Si hay dependencia clara, anotarla. Si no, dejar vacío.

---

## PASO 4 — Crear rama git (solo si hay git)

```bash
git checkout -b req/<REQ-ID>-<slug>
```

Ejemplo: `git checkout -b req/REQ-AUTH-001-login-google`

Si la rama ya existe: preguntar al usuario (¿continuar en ella o abortar?).

---

## PASO 5 — Crear estructura del REQ

Crear la carpeta y archivos:

```
requirements/<dominio>/REQ-<DOMINIO>-<NNN>-<slug>/
├── initial.md
├── INDEX.md
├── ledger.md
├── manifest.md
└── errors/
```

### `initial.md`

```markdown
---
id: <REQ-ID>
title: <Título>
status: draft
created: <fecha-hoy>
---

# <Título>

## Descripción

<Descripción funcional inferida de la solicitud del usuario.>

## Criterios de aceptación

- <Criterio 1>
- <Criterio 2>

## Entidades de BD candidatas

- <entidad>: <campos principales inferidos>

## Componentes UI candidatos

- <Componente>

## Dependencias

- needs: [<REQ-IDs que este REQ requiere, o vacío>]
- needed_by: []
```

### `INDEX.md`

```markdown
---
req_id: <REQ-ID>
title: <Título>
status: draft
current_state: initial
---

# <REQ-ID> — <Título>: Estado consolidado actual

## Descripción

<Descripción funcional.>

## Estado de implementación

**Borrador.** Pendiente de aprobación e implementación.

## Funcionalidades previstas

<Lista de lo que hará este REQ cuando esté implementado.>

## Entidades de BD

<Lista de entidades.>

## Historial de cambios

| Change  | Descripción      | Estado |
| ------- | ---------------- | ------ |
| initial | Creación del REQ | draft  |
```

### `ledger.md`

```markdown
# Ledger REQ — <REQ-ID>

| Fecha | Operación | Change | Commit | Descripción |
| ----- | --------- | ------ | ------ | ----------- |
```

### `manifest.md`

```markdown
---
req_id: <REQ-ID>
title: <Título>
---

# Manifest — <REQ-ID>

> Pendiente de implementación. Rellenar tras `/change-req`.
```

---

## PASO 6 — Actualizar dependencias bidireccionales

Si `initial.md` tiene `needs: [REQ-X, REQ-Y]`:

- Abrir el `INDEX.md` de REQ-X y REQ-Y.
- Añadir `<REQ-ID>` a su campo `needed_by`.

---

## PASO 7 — Actualizar `ledger.md` global

Añadir fila al `ledger.md` en la raíz del proyecto:

```
| <fecha-hoy> | <REQ-ID> | new-req | initial | — | Creación del requisito: <Título> |
```

(Si no existe `ledger.md`, crearlo con cabecera: `| Fecha | REQ | Operación | Change | Commit | Descripción |`)

---

## PASO 8 — Commit inicial (solo si hay git)

```bash
git add requirements/ ledger.md
git commit -m "feat(<REQ-ID>): crear requisito <slug>"
```

Actualizar la columna Commit del `ledger.md` con el hash corto del commit:

```bash
git rev-parse --short HEAD
```

Hacer segundo commit:

```bash
git add ledger.md
git commit -m "docs(<REQ-ID>): update ledger with commit hash"
```

---

## CHECKLIST DE COMPLETITUD

Antes de reportar al usuario, verificar que se completaron todos los pasos:

- [ ] Rama git creada (si aplica)
- [ ] Carpeta `requirements/<dominio>/<REQ-ID>-<slug>/` existe
- [ ] `initial.md` creado y rellenado con datos reales (no placeholders)
- [ ] `INDEX.md` creado
- [ ] `ledger.md` del REQ creado
- [ ] `manifest.md` creado
- [ ] `errors/` creado
- [ ] Dependencias bidireccionales actualizadas (si las hay)
- [ ] `ledger.md` global actualizado
- [ ] Commit(s) creados (si aplica)

Si algún ítem está pendiente, completarlo antes de continuar.

---

## Output al terminar

```
Creado REQ-AUTH-001 en requirements/auth/REQ-AUTH-001-login-google/

Status: draft
Entidades BD: users, sessions, oauth_accounts
Componentes UI: LoginPage, OAuthButton
Dependencias: ninguna

(Si hay git) Rama: req/REQ-AUTH-001-login-google — 2 commits creados.

Próximos pasos:
- Revisar initial.md y ajustar criterios de aceptación si es necesario.
- Cuando esté listo: /change-req REQ-AUTH-001 implementar
- (Si hay git) git push -u origin req/REQ-AUTH-001-login-google y abrir PR.
```

---

## Restricciones

- **No implementes código.** Solo documentación del REQ.
- **No marques `status: implementado`.** Siempre empieza en `draft`.
- **No dejes placeholders sin rellenar** en `initial.md`. Infiere o pregunta, pero no entregues `<texto de ejemplo>`.
- **Si el usuario ya hizo cambios en código sin REQ previo:** crea el REQ igualmente documentando lo que ya existe. No debatas, documenta.
