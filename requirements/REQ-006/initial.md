---
id: REQ-006
title: Runner del participante
status: current
created: 2026-06-02
source: reverse-engineered
---

# Runner del participante

## Contexto

Es el corazón del producto desde el punto de vista del cliente: la página pública (sin auth) por la que cada participante (área de la empresa) ejecuta el taller paso a paso, ve las instrucciones, responde preguntas, sube archivos, consulta a la IA y finaliza. El consultor distribuye el enlace (instancia 1-a-1 o enlace multi-persona — REQ-005) y el participante entra a una URL que cargá la actividad guiada.

## Objetivo

Servir al participante una experiencia de taller guiada en navegador, con identificación opcional (nombre, email, cargo, área), avance por pasos y preguntas, captura de respuestas escritas, subida de archivos por pregunta, integración con asistente IA (REQ-007), continuidad entre talleres (cargar respuestas de la plantilla anterior si existe) y finalización del taller.

## Alcance actual

### Funcionalidades implementadas

**Acceso:**
- URL pública `/runner/:token` carga la instancia por `accessToken`.
- URL pública `/runner/enlace/:token` resuelve el enlace permanente generando una nueva instancia y redirige al runner.
- URL pública `/runner/:token/resultados` muestra el resumen final tras finalizar.
- Identificación opcional del participante (`POST /execution/:token/identificar`): nombre, email, cargo, área. Si el email ya existe en la empresa, se asocia al usuario existente.
- Búsqueda de usuario existente por email (`GET /execution/:token/usuario`).

**Flujo del taller:**
- Carga inicial con `GET /execution/:token`: estado, pasos en orden con preguntas, datos de empresa, usuario, interacciones previas, respuestas previas y respuestas de la plantilla anterior.
- Inicio del taller (`POST /execution/:token/iniciar`): registra `fechaInicio` y cambia estado a `iniciado`.
- Registro de respuesta por paso o por pregunta (`POST /execution/:token/responder`), con soporte para texto y archivo subido (multipart): el archivo se convierte a texto (Excel→Markdown, PDF/Word→texto plano) y se almacena `archivoNombre` + `contenidoArchivo`; si la pregunta tiene `subirArchivoS3: true`, el binario original se sube a S3 (REQ-008).
- Consulta a IA por paso (`POST /execution/:token/ia`) con respuesta del usuario y `customPrompt` opcional (REQ-007).
- Generación on-the-fly de plantilla Excel pre-rellenada con la respuesta de la IA (`POST /execution/:token/plantilla-prefilled/:pasoId`): toma el Excel base `apps/web/public/templates/plantilla-priorizacion-mapa-oportunidades.xlsx`, escribe en él las filas que la IA generó y devuelve el archivo descargable.
- Finalización (`POST /execution/:token/finalizar`): registra `fechaFin` y cambia estado a `finalizado`.

**Continuidad entre talleres:**
- Si la actividad viene de una plantilla con `orden > 1`, el runner busca la plantilla `orden - 1` y trae las respuestas del mismo participante (por email) en la misma empresa, para mostrar en pantalla el contexto del taller anterior.
- Si no existe instancia anterior, simplemente no se carga; ya no bloquea el avance (ver commit reciente `0953627`).

**Archivos:**
- Subida de archivo en `POST /execution/:token/responder` con extracción de texto (xlsx, pdf, docx).
- Subida a S3 condicionada al flag `subirArchivoS3` en la pregunta.
- Descarga del archivo de ejemplo del paso (`GET /execution/:token/pasos/:pasoId/ejemplo-url`).
- Descarga del archivo de respuesta de una pregunta (`GET /execution/:token/respuestas/:preguntaId/archivo-url`).
- Presigned PUT URL para archivo de ejemplo (`POST /execution/:token/presign-ejemplo`).

**UI:**
- Página `RunnerPage` con sidebar de pasos, área principal por paso, formulario por pregunta, soporte WYSIWYG/Markdown, panel de IA y banner de plantilla anterior cuando aplica.
- Página `EnlaceRunnerPage` que resuelve el enlace y redirige.
- Página `RunnerResultsPage` con el resumen final (renderizado por `buildResumenHtml.ts`).
- Footer global con disclaimer de IA.

### Entidades de base de datos

- `InstanciaActividad` (consume)
- `Interaccion(id, instanciaId, pasoId, contenido, respuestaUsuario?, respuestaIa?, archivoNombre?, contenidoArchivo?, fecha, updatedAt)` — granularidad por paso (modelo legacy).
- `Respuesta(id, instanciaId, preguntaId, contenido?, respuestaUsuario?, respuestaIa?, archivoNombre?, contenidoArchivo?, archivoKey?, fecha, updatedAt)` — granularidad por pregunta (modelo nuevo).
- `Usuario` (creado/asociado al identificar).

### Interfaz expuesta

Backend (`/execution/*`):
- `GET /execution/:token` — carga inicial completa.
- `POST /execution/enlace/:token/sesion` — resuelve enlace → nueva instancia (compartido con REQ-005).
- `POST /execution/:token/iniciar`, `POST /execution/:token/finalizar`.
- `POST /execution/:token/responder` (multipart, opcional `archivo`).
- `POST /execution/:token/ia` (multipart, opcional `archivo` — REQ-007).
- `POST /execution/:token/identificar`, `GET /execution/:token/usuario`.
- `POST /execution/:token/plantilla-prefilled/:pasoId` — Excel pre-rellenado con respuesta IA.
- `POST /execution/:token/presign-ejemplo`, `GET /execution/:token/pasos/:pasoId/ejemplo-url`.
- `GET /execution/:token/respuestas/:preguntaId/archivo-url`.

Frontend:
- `/runner/:token`
- `/runner/enlace/:token`
- `/runner/:token/resultados`

## Restricciones conocidas

- Modelo dual de respuestas: existen `Interaccion` (legacy, por paso) y `Respuesta` (nuevo, por pregunta). El runner y los entregables leen ambas (priorizan `Respuesta`); el código tiene fallbacks explícitos.
- El archivo subido pasa siempre por extracción de texto en backend; archivos >10 MB son rechazados por `multer`.
- La consulta IA por pregunta NO está implementada todavía — el endpoint `/ia` recibe `pasoId` y el `ConsultarIaPorTokenUseCase` lee el prompt del paso. Hay `TODO(IA-por-pregunta)` en el código.
- El Excel pre-rellenado tiene los headers/columnas hardcodeados (14 columnas del Mapa de Oportunidades); no es genérico para otras plantillas.
- La continuidad entre talleres requiere que el email coincida exactamente (`emailReferencia` de la instancia o `usuario.email`).
