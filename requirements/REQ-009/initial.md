---
id: REQ-009
title: Generación de entregables (PDF, Excel, ZIP)
status: current
created: 2026-06-02
source: reverse-engineered
---

# Generación de entregables (PDF, Excel, ZIP)

## Contexto

El entregable es el principal valor de cierre del taller: un documento PDF profesional que el consultor puede presentar al cliente final sin trabajo manual. El sistema también permite exportar archivos puntuales (Excel de un paso, archivos respuesta originales) y un ZIP que empaqueta todo: el PDF resumen más los archivos originales subidos por los participantes.

## Objetivo

Generar dinámicamente los entregables del taller a partir de los datos de una instancia, sin trabajo de consolidación manual del consultor.

## Alcance actual

### Funcionalidades implementadas

**PDF detalle de instancia (`GET /admin/instancias/:id/pdf`)**:
- Genera un PDF con PDFKit que incluye empresa, iniciativa, actividad, usuario, todos los pasos en orden con sus preguntas, las respuestas del usuario y las respuestas IA.
- Renderiza markdown dentro del PDF (negrita, italic, listas, headings, tablas, código) vía `pdfMarkdownRenderer.ts`.
- Nombre de archivo amigable: `<empresa>_<actividad>_<area>.pdf` (slugificado).

**Excel por paso (`GET /admin/instancias/:id/excel/:pasoId`)**:
- Toma el contenido o `contenidoArchivo` de la `Interaccion` del paso.
- Parsea la tabla markdown (`parseTableFromContent`) y construye un Excel con encabezados estilizados (fondo azul `#1F4E79`, blanco bold, wrapText, alto de filas configurado para columnas de texto largo).
- Aplica anchos diferenciados por tipo de columna (text-cols vs métricas).
- Nombre amigable: `<empresa>_<actividad>_<area>_<paso>.xlsx`.

**ZIP completo (`GET /admin/instancias/:id/zip`)**:
- Empaqueta el PDF + todos los archivos en S3 referenciados por `Respuesta.archivoKey` + archivos legacy reconstruidos como Excel desde `Interaccion.contenidoArchivo`.
- Usa `archiver` con `zlib level 9`.
- Resuelve colisiones de nombre añadiendo sufijos `_2`, `_3`, etc.
- Nombre amigable: `<empresa>_<actividad>_<area>.zip`.

**Descarga del archivo original (`GET /admin/instancias/:id/respuestas/:preguntaId/archivo-url`)**:
- Devuelve una presigned GET URL del archivo subido por el participante con `Content-Disposition: attachment` y nombre amigable.

**Plantilla pre-rellenada con respuesta IA (`POST /execution/:token/plantilla-prefilled/:pasoId`)**:
- Lee el Excel base `apps/web/public/templates/plantilla-priorizacion-mapa-oportunidades.xlsx`.
- Escribe las filas que generó la IA en las columnas 1-14 (las restantes 15-27 se dejan al equipo).
- Soporta override por respuesta IA pasada en el body o leída desde la última interacción.

### Entidades de base de datos

Consume:
- `InstanciaActividad` con `actividad`, `iniciativa`, `empresa`, `usuario`.
- `Interaccion` con `contenido`, `contenidoArchivo`, `archivoNombre`.
- `Respuesta` con `respuestaUsuario`, `respuestaIa`, `archivoNombre`, `archivoKey`.
- `PreguntaActividad` para conocer `orden` y `paso`.

No tiene entidades propias.

### Interfaz expuesta

Backend:
- `GET /admin/instancias/:id/pdf`
- `GET /admin/instancias/:id/excel/:pasoId`
- `GET /admin/instancias/:id/zip`
- `GET /admin/instancias/:id/respuestas/:preguntaId/archivo-url`
- `POST /execution/:token/plantilla-prefilled/:pasoId`

Frontend:
- Botones "Descargar PDF" y "Descargar ZIP" en `InstanciasPage`/`InstanciaDetallePage`.
- Botón "Descargar Excel del paso" en `InstanciaDetallePage`.
- Botón "Descargar plantilla pre-rellenada" dentro de `RunnerPage` para el taller Mapa de Oportunidades.

## Restricciones conocidas

- El parser de tablas (`parseTableFromContent`) asume formato markdown con `|`; tablas en otros formatos no se procesan.
- Los anchos y nombres de columnas del Excel están hardcodeados a las del taller "Mapa de Oportunidades" — no es genérico para otros talleres.
- La generación de PDF es síncrona y se hace en memoria por request; instancias muy grandes pueden tardar varios segundos.
- El ZIP descarga uno a uno los buffers de S3; con muchos archivos puede agotar el límite de respuesta de Vercel.
- El renderer de markdown de PDFKit (`pdfMarkdownRenderer.ts`) implementa un subset; sintaxis exótica de markdown puede no renderizar correctamente.
