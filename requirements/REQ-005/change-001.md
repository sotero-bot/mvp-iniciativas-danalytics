---
id: REQ-005
change: change-001
supersedes: initial
superseded_by: null
status: implementado
owner: santiago-otero
created: 2026-06-02
reason: |
  Mejorar la experiencia de supervisión en /admin/instancias permitiendo
  filtrar instancias y enlaces por empresa y actividad. Reduce ruido visual
  en proyectos con múltiples iniciativas.
---

# REQ-005 — change-001: Filtros globales de empresa y actividad

## Delta Spec

### ADDED

**Sección de filtros globales** en `/admin/instancias`, posicionada ANTES de "Generar Enlace":

- Combo/select de **Empresa** con opciones únicas derivadas de `actividad.iniciativa.empresa.nombre` de ambas tablas (Enlaces Activos + Ejecuciones Individuales).
- Combo/select de **Actividad** con opciones únicas derivadas de `actividad.nombre` de ambas tablas.
- Botón "Limpiar filtros" que aparece cuando al menos un filtro está activo. Ambos filtros son **independientes**.

**Lógica de filtrado bidireccional:**

- Tabla "Enlaces Activos": muestra solo `filteredEnlaces` según empresa/actividad seleccionadas.
- Tabla "Ejecuciones Individuales": muestra solo instancias filtradas por empresa/actividad seleccionadas.
- Mensajes vacíos apropiados cuando los filtros no retornan datos en cada tabla.

**Estados de componente (frontend):**

- `filterEmpresa: string` (vacío = "todas las empresas")
- `filterActividad: string` (vacío = "todas las actividades")
- Memos: `empresaOptions`, `actividadOptions`, `filteredEnlaces`

### MODIFIED

**Tabla "Enlaces Activos":** pasa de `{enlaces.map}` a `{filteredEnlaces.map}`. Badge de conteo ahora muestra `filteredEnlaces.length` en lugar de `enlaces.length`.

**Tabla "Ejecuciones Individuales":** el `filtered` ya incluye lógica de empresa/actividad (`matchEmpresa` y `matchActividad` adicionales). Mensaje de "sin resultados" ahora contempla los nuevos filtros.

**Componente `InstanciasPage.tsx`:**

- Dos nuevos estado: `filterEmpresa`, `filterActividad`.
- Tres memos nuevos: `empresaOptions`, `actividadOptions`, `filteredEnlaces`.
- Lógica de filtrado: `filtered` memo ahora filtra por empresa y actividad.
- Handlers: `setFilterEmpresa`, `setFilterActividad` resetean página a 1.
- UI: nueva sección de filtros antes de "Generar Enlace".

### REMOVED

Nada.

## Impacto

**BD:** Sin cambios de schema.

**Backend:** Sin cambios (los datos ya cargan con la relación `actividad → iniciativa → empresa`).

**Frontend:** `InstanciasPage.tsx` — única modificación.

## Riesgos mitigados

1. **Rendimiento:** Uso de `useMemo` con dependencias explícitas evita recálculos innecesarios.
2. **Validez de datos:** Se asume que `actividad.iniciativa.empresa.nombre` siempre existe (validado en backend). Fallback seguro con `|| ''` en comparaciones.
3. **UX:** Botón "Limpiar filtros" siempre visible cuando algún filtro esté activo. Mensajes vacíos claros por tabla.
4. **Cascada de filtros:** Implementación simple (independiente) — si usuario selecciona Empresa A + Actividad de Empresa B, tabla vacía con mensaje claro.
