---
description: Ingeniería inversa de un proyecto consolidado. Explora el código existente y genera REQs SDD que documentan lo que ya está implementado.
---

# /reverse-engineer — Ingeniería inversa de requisitos

## Tu rol

Explorar el proyecto existente, identificar dominios funcionales, y generar los archivos SDD que documentan el estado **actual** del código. No inventes funcionalidad — documenta lo que ya existe.

## Flujo

### Fase 0 — Verificar entorno

1. Comprobar si el proyecto está versionado con git (`git rev-parse --git-dir`).
   - Si SÍ hay git: crear rama `req/reverse-engineer-<YYYY-MM-DD>` antes de tocar nada.
   - Si NO hay git: continuar sin flujo de ramas.

2. Verificar que existe la estructura SDD mínima. Si alguno de estos elementos no existe, crearlo ahora sin preguntar:
   - `requirements/` → crear directorio vacío.
   - `ledger.md` → crear con cabecera completa:
     ```
     # Ledger global
     | Fecha | REQ | Operación | Change | Commit | Descripción |
     |-------|-----|-----------|--------|--------|-------------|
     ```
   - `docs/` → crear directorio vacío (se puede rellenar después con `/init-project`).
   - `CLAUDE.md` → si no existe, copiar el template base desde `sdd/` si está disponible; si no, crear uno mínimo con las secciones `## Stack del proyecto` y `## Sistema de migraciones` vacías.

3. Detectar el siguiente ID disponible en `requirements/`:
   - Listar carpetas existentes con patrón `REQ-NNN` y tomar el siguiente número.
   - Si `requirements/` está vacío: empezar desde `REQ-001`.
   - Guardar este contador para usarlo en Fase 3 sin duplicar IDs.

   Reportar brevemente qué se creó antes de continuar. **No detenerse.**

### Fase 1 — Exploración del código

Lee en este orden (detente en cada nivel si ya tienes suficiente contexto):

1. **Raíz del proyecto:** `package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, `pom.xml`, `composer.json` — lo que aplique. Extrae nombre, descripción, dependencias principales.
2. **Estructura de directorios** (máximo 3 niveles): `find . -type d -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/vendor/*' -not -path '*/__pycache__/*' -not -path '*/dist/*' -not -path '*/build/*'`
3. **Schema de base de datos** si existe: `database/schema.sql`, `prisma/schema.prisma`, `**/models.py`, `**/schema.rb`, o similar.
4. **Rutas y controladores:** archivos de rutas (Express `routes/`, Django `urls.py`, FastAPI `routers/`, Rails `routes.rb`).
5. **Archivos principales de cada directorio** de dominio (no leer todo, solo los archivos índice o de mayor tamaño).

### Fase 2 — Identificación de dominios

Agrupa el código en **entre 3 y 10 dominios funcionales** siguiendo estos criterios:

- Un dominio = una responsabilidad cohesiva (ej: autenticación, facturación, notificaciones).
- No fuerces granularidad artificial: si algo es pequeño, agrúpalo con otro dominio relacionado.
- Infiere el dominio del nombre de los directorios, rutas, y modelos de BD.

Por cada dominio construye mentalmente:

- **Título:** nombre corto del dominio.
- **Descripción:** qué problema resuelve (máximo 2 líneas).
- **Archivos que lo implementan:** lista de paths reales del proyecto.
- **Entidades de BD:** tablas o modelos que maneja.
- **Interfaz expuesta:** endpoints REST, páginas UI, eventos, o CLI commands.
- **Dependencias internas:** qué otros dominios requiere.

### Fase 3 — Generación de REQs

Para cada dominio, crear los 3 archivos SDD:

#### `requirements/<REQ-ID>/initial.md`

Usa el template:

```markdown
---
id: <REQ-ID>
title: <Título del dominio>
status: current
created: <fecha de hoy>
source: reverse-engineered
---

# <Título>

## Contexto

<Descripción del problema que resuelve este módulo, inferida del código.>

## Objetivo

<Qué logra este módulo tal como está implementado hoy.>

## Alcance actual

### Funcionalidades implementadas

<Lista de funcionalidades reales encontradas en el código. Una por línea con "-".>

### Entidades de base de datos

<Lista de tablas/modelos con sus campos principales.>

### Interfaz expuesta

<Endpoints, páginas, eventos o comandos que expone este módulo.>

## Restricciones conocidas

<Limitaciones o deuda técnica observable en el código. Si no hay ninguna obvia, omitir sección.>
```

#### `requirements/<REQ-ID>/INDEX.md`

Estado consolidado actual = lo que está implementado hoy:

```markdown
---
req_id: <REQ-ID>
title: <Título>
status: current
last_change: initial
---

# <REQ-ID> — <Título>: Estado consolidado actual

## Descripción

<Descripción corta — 1 párrafo.>

## Estado de implementación

**Implementado completamente.** Documentado por ingeniería inversa el <fecha>.

## Funcionalidades vigentes

<Lista de funcionalidades — copia de initial.md con posibles ajustes.>

## Entidades de BD vigentes

<Lista de entidades.>

## Interfaz vigente

<Endpoints/páginas/eventos.>

## Historial de cambios

| Change  | Descripción                                  | Estado  |
| ------- | -------------------------------------------- | ------- |
| initial | Documentación inicial por ingeniería inversa | current |
```

#### `requirements/<REQ-ID>/manifest.md`

```markdown
---
req_id: <REQ-ID>
title: <Título>
---

# Manifest — <REQ-ID>

## Archivos que implementan este REQ

<Lista de paths reales del proyecto, agrupados por tipo:>

### Backend / Lógica

- `path/al/archivo.ext`

### Frontend / UI

- `path/al/componente.ext`

### Base de datos

- `path/al/modelo_o_migracion.ext`

### Tests

- `path/al/test.ext`

### Configuración

- `path/al/config.ext`

> Omitir secciones vacías.
```

### Fase 4 — Actualizar archivos globales

1. **`CLAUDE.md`** — Rellenar (o actualizar) las secciones:
   - `## Stack del proyecto` con el stack detectado.
   - `## Sistema de migraciones` con el sistema detectado.
   - `{{nombre-del-proyecto}}` con el nombre real del proyecto.
   - Si `CLAUDE.md` no existe (fue creado en Fase 0 como mínimo), rellenar todas las secciones que se puedan inferir del código.

2. **`ledger.md`** — Añadir una fila por cada REQ generado:
   ```
   | <fecha> | <REQ-ID> | reverse-engineer | initial | — | Documentación inicial por ingeniería inversa |
   ```
   (columna Commit = `—` porque aún no hay commit en este punto)

### Fase 5 — Reporte final

Mostrar al usuario:

```
## Ingeniería inversa completada

### REQs generados

| ID | Título | Archivos | Entidades BD |
|----|--------|----------|--------------|
| REQ-001 | ... | N | M |
...

### Stack detectado
- Lenguaje: ...
- Framework: ...
- BD: ...
- Migraciones: ...

### Advertencias
- <Lista de dominios donde la cobertura es ambigua o incompleta>
- <Archivos sin dominio asignado, si los hay>

### Próximos pasos sugeridos
1. Revisar cada `initial.md` y corregir imprecisiones.
2. Completar secciones omitidas en los `manifest.md`.
3. Ejecutar `/audit` para detectar drift entre spec y código actual.
```

### Fase 6 — Commit final (solo si hay git)

Si se creó rama en Fase 0:

1. Hacer staging de todos los archivos generados:
   - `requirements/`
   - `ledger.md`
   - `CLAUDE.md`
   - `docs/` (si se creó)

2. Crear commit:

   ```
   docs(sdd): reverse-engineer initial REQs from existing codebase

   Generated N REQs covering existing implementation.
   Source: /reverse-engineer command.
   ```

3. Actualizar `ledger.md` reemplazando `—` en columna Commit con el hash corto del commit recién creado.

4. Hacer un segundo commit con el ledger actualizado:

   ```
   docs(sdd): update ledger with commit hash
   ```

5. Informar al usuario: rama lista, puede hacer `git push` y abrir PR cuando quiera.

## Cuándo preguntar al usuario

Preguntar **solo cuando no puedas inferir con confianza**. Una pregunta por bloqueo, nunca un interrogatorio. Agrupar preguntas pendientes y hacerlas todas juntas antes de empezar a escribir archivos.

### Situaciones que requieren pregunta obligatoria

| Situación                                                                                                  | Qué preguntar                                                                                  |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| El proyecto no tiene nombre claro en ningún archivo de configuración                                       | "¿Cuál es el nombre del proyecto?"                                                             |
| Hay múltiples sistemas de BD (ej: PostgreSQL + Redis + MongoDB)                                            | "¿Cuál es la BD principal que quieres documentar como fuente de verdad?"                       |
| El sistema de migraciones no es detectable (no hay carpeta migrations/, ni Prisma, ni Alembic, ni similar) | "¿Usan algún sistema de migraciones? Si sí, ¿cuál?"                                            |
| Dos o más directorios parecen implementar el mismo dominio sin distinción clara                            | "Los directorios X e Y parecen parte del mismo dominio. ¿Los uno en un solo REQ o los separo?" |
| Un directorio grande (>20 archivos) no tiene nombre autoexplicativo y los archivos tampoco ayudan          | "El directorio `<nombre>` no me queda claro. ¿Puedes describirlo en una línea?"                |
| Hay código que parece legacy o deprecado (carpetas `old/`, `backup/`, `v1/`, comentarios `// deprecated`)  | "¿El código en `<ruta>` sigue activo o lo ignoro en la documentación?"                         |
| Ya existen REQs en `requirements/` y no está claro si el código nuevo solapa con ellos                     | "Ya existe REQ-00X que cubre `<área>`. ¿Lo amplío o creo uno nuevo?"                           |

### Situaciones donde NO preguntar — infiere y sigue

- El nombre del dominio no es perfecto pero es razonable → usa el que tienes.
- No encuentras tests para un módulo → documenta el módulo igual, sin sección Tests en el manifest.
- Un archivo podría pertenecer a dos dominios → asígnalo al dominio con más archivos relacionados.
- La descripción de una funcionalidad es ambigua → describe lo que el código hace literalmente.
- No encuentras restricciones conocidas → omite esa sección del `initial.md`.
- El stack usa una librería poco común → documenta con el nombre que aparece en el package manager.

### Formato de las preguntas

Cuando debas preguntar, hazlo así — antes de escribir cualquier archivo:

```
Antes de generar los REQs necesito aclarar N punto(s):

1. [pregunta concreta]
   Contexto: [por qué no pude inferirlo]

2. [pregunta concreta]
   Contexto: [por qué no pude inferirlo]
```

Espera respuesta. Luego continúa sin más interrupciones.

## Reglas duras

- **NO inventes funcionalidad.** Si no está en el código, no va en el spec.
- **NO modifies código fuente** del proyecto — solo crea archivos en `requirements/`.
- **NO leas `node_modules/`, `vendor/`, `dist/`, `build/`, `.git/`.**
- **IDs secuenciales** desde el siguiente disponible en `requirements/` (si ya hay REQs, continuar la numeración).
- **`initial.md` es inmutable** una vez creado — redáctalo bien desde el principio.
- **`status: current`** en todos los INDEX.md generados (ya está implementado).

## Modo de operación

Ejecutar todas las fases sin interrupciones salvo las preguntas agrupadas de la sección anterior. La única otra pausa permitida es el checkpoint de git (Fase 0) si aplica. Reportar al terminar con el resumen de Fase 5.
