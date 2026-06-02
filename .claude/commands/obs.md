---
description: Registra una observación de campo sobre el sistema SDD — problemas, fricciones, mejoras, comportamientos inesperados. Se invoca con /obs seguido del texto.
---

# /obs — Registrar observación del sistema

## Tu rol

Capturar lo que el usuario reporta sobre el sistema SDD y guardarlo en `sdd/observaciones/`. Sin análisis profundo, sin subagentes. Solo recibir, clasificar brevemente, y guardar.

---

## Flujo

### 1. Localizar archivo activo

```bash
ls sdd/observaciones/obs-*.md | sort | tail -1
```

- Si no existe ninguno: crear `sdd/observaciones/obs-001.md` con cabecera (ver plantilla abajo).
- Si existe: ese es el archivo activo.

### 2. Verificar si hay espacio

```bash
wc -l <archivo-activo>
```

- Si líneas >= 1000: calcular siguiente número (ej: `obs-001.md` → `obs-002.md`), crear con cabecera y usarlo como activo.
- Si líneas < 1000: usar el archivo activo tal cual.

### 3. Inferir tipo

A partir del texto del usuario, clasificar en una palabra:

| Tipo | Cuándo |
|---|---|
| `problema` | algo no funcionó, error, fallo |
| `mejora` | sugerencia, "sería mejor si..." |
| `comportamiento` | algo funcionó distinto a lo esperado (no necesariamente mal) |
| `contexto` | observación general, reflexión, sin acción clara |

### 4. Escribir entrada

Añadir al final del archivo activo:

```markdown
### [YYYY-MM-DD] — <tipo>

<Texto del usuario, tal como lo expresó. Sin parafrasear ni resumir en exceso.>

**Área:** <parte del sistema que afecta: skill específica, flujo, agente, archivo, o "general">

---

```

### 5. Confirmar

Responder al usuario con una sola línea:
```
Guardado en obs-NNN.md (línea ~NNN).
```

---

## Plantilla de cabecera para archivo nuevo

```markdown
# Observaciones del sistema SDD

Archivo de campo: problemas, fricciones, comportamientos inesperados y mejoras
detectados durante el uso real del sistema.

---

```

---

## Restricciones

- NO generar análisis ni proponer soluciones a menos que el usuario lo pida explícitamente.
- NO leer otros archivos del proyecto — esta skill opera solo sobre `sdd/observaciones/`.
- NO modificar entradas anteriores.
- El texto del usuario es sagrado: no reescribir su voz, solo corregir ortografía obvia si es necesario.
