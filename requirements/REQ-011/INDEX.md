---
req_id: REQ-011
title: Vista resumen y descarga del Canvas
status: draft
current_state: initial
---

# REQ-011 — Vista resumen y descarga del Canvas: Estado consolidado actual

## Descripción

Al finalizar el taller de Analytics Canvas, el participante puede ver todos los bloques (B1–B10) diligenciados en un layout visual tipo grid. Un botón "Descargar Canvas" exporta un archivo HTML autocontenido con el contenido completo, prompts de IA embebidos listos para copiar, y soporte para edición, impresión y compartir sin conexión.

## Estado de implementación

**Borrador.** Pendiente de aprobación e implementación.

## Funcionalidades previstas

- Layout grid visual de los bloques B1–B10 en la página de resultados del runner.
- Colores por grupo temático (entradas azul, análisis violeta, personas cyan, entregables verde, riesgos ámbar, valor rojo).
- Botón "Descargar Canvas" en la página de resultados.
- Generación del HTML standalone autocontenido en el frontend (sin llamada al backend).
- HTML descargado con prompts de IA contextualizados (inyectan respuestas del participante) por bloque.
- HTML descargado con autoguardado en `localStorage` del navegador.
- HTML descargado con exportación a `.txt`.
- La vista y descarga solo se activan para actividades de tipo Analytics Canvas; el resto de actividades usa la página de resultados existente sin cambios.

## Entidades de BD

- `Respuesta` (consumida — lectura)
- `InstanciaActividad` (consumida — metadatos)
- `Actividad` (consumida — detectar tipo canvas)
- `PasoActividad` (consumido — título y orden de bloques)

## Historial de cambios

| Change  | Descripción      | Estado |
| ------- | ---------------- | ------ |
| initial | Creación del REQ | draft  |
