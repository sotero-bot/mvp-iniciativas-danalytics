---
id: REQ-010
title: Dashboard e ingreso administrativo
status: current
created: 2026-06-02
source: reverse-engineered
---

# Dashboard e ingreso administrativo

## Contexto

Cuando el consultor entra a la plataforma, necesita una vista de inicio que le muestre el estado de su trabajo y lo guíe linealmente por el flujo natural (Empresas → Iniciativas → Actividades → Ejecuciones). El layout administrativo le da una sidebar permanente con los pasos numerados, identidad visual de la marca y un footer global con disclaimer de IA.

## Objetivo

Ofrecer un punto de entrada claro al consultor con (a) sidebar persistente con la navegación del flujo de trabajo, (b) un dashboard con métricas resumen y enlaces a cada sección, y (c) bloqueo visual de pasos que requieren completar pasos anteriores (ej: no se puede ir a Iniciativas sin tener al menos una Empresa).

## Alcance actual

### Funcionalidades implementadas

- Layout administrativo con sidebar fija a la izquierda (componente `Layout` en `App.tsx`):
  - Logo Danalytics + texto "Decisión IA".
  - Enlace "Inicio".
  - Sección "Flujo de trabajo" con pasos numerados: 1. Empresas, 2. Iniciativas, 3. Actividades, 4. Ejecuciones.
  - Enlace transversal "Plantillas".
  - Botón "Cerrar sesión" en el footer del sidebar.
- Dashboard (`/admin/inicio`) con tarjetas para cada paso del flujo:
  - Cuenta agregada de empresas, iniciativas, actividades, instancias.
  - Indicador "Bloqueado" cuando el paso anterior no tiene registros (ej: Iniciativas bloqueado si `empresas === 0`).
  - Enlace directo a la página correspondiente.
- Footer global `AiDisclaimerFooter` visible en todas las páginas (con "el asistente usa IA y puede cometer errores").
- Componentes reutilizables de UI:
  - `Toast` para feedback de operaciones.
  - `ConfirmModal` para confirmaciones destructivas.
  - `WysiwygEditor` para editores de texto enriquecido (objetivos, instrucciones).
  - `PromptTemplateField` para uploads de prompt-templates.

### Entidades de base de datos

Sin entidades propias. El dashboard consume contadores de `Empresa`, `Iniciativa`, `Actividad`, `InstanciaActividad` vía las APIs de listado existentes.

### Interfaz expuesta

Frontend:
- `/admin/inicio` — dashboard
- `/` — redirige a `/admin/inicio` (si hay token) o `/login`
- `/admin` — redirige a `/admin/inicio`
- Sidebar y layout disponibles en todas las páginas `/admin/*`

Backend:
- No expone endpoints propios. El dashboard hace `fetch` paralelo a:
  - `GET /organization/empresas`
  - `GET /organization/iniciativas`
  - `GET /methodology/actividades`
  - `GET /admin/instancias`

## Restricciones conocidas

- La cuenta de instancias no se filtra por `estado`; muestra el total activo.
- El "bloqueo" del flujo es solo visual: el botón está deshabilitado, pero un usuario que conoce la URL puede saltarse el paso.
- Sin personalización por consultor: todos ven el mismo dashboard.
