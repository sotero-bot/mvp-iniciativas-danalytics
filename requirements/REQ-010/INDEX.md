---
req_id: REQ-010
title: Dashboard e ingreso administrativo
status: current
last_change: initial
---

# REQ-010 — Dashboard e ingreso administrativo: Estado consolidado actual

## Descripción

Capa de navegación y vista de inicio del consultor. Sidebar fijo con el flujo numerado (Empresas → Iniciativas → Actividades → Ejecuciones), dashboard con contadores agregados y bloqueo visual de pasos que requieren completar el anterior.

## Estado de implementación

**Implementado completamente.** Documentado por ingeniería inversa el 2026-06-02.

## Funcionalidades vigentes

- Layout administrativo con sidebar persistente.
- Dashboard `/admin/inicio` con tarjetas por paso del flujo y contadores en vivo.
- Footer global con disclaimer de IA.
- Componentes UI reutilizables (`Toast`, `ConfirmModal`, `WysiwygEditor`, `PromptTemplateField`).
- Redirecciones de root y `/admin` a `/admin/inicio`.

## Entidades de BD vigentes

Sin entidades propias. Consume contadores de `Empresa`, `Iniciativa`, `Actividad`, `InstanciaActividad`.

## Interfaz vigente

Frontend:
- `/admin/inicio`
- `/` (redirect)
- `/admin` (redirect)
- Sidebar y `Layout` envolviendo todas las páginas `/admin/*`.

Backend:
- Sin endpoints propios — el dashboard consume listados existentes.

## Historial de cambios

| Change  | Descripción                                  | Estado  |
| ------- | -------------------------------------------- | ------- |
| initial | Documentación inicial por ingeniería inversa | current |
