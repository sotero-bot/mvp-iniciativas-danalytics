---
id: change-001
req_id: REQ-008
title: S3_ROOT_PREFIX y key de prompt de plantilla por ID
status: implementado
created: 2026-06-04
supersedes: initial
---

# change-001 — S3_ROOT_PREFIX y key de prompt de plantilla por ID

## Contexto

El proyecto usa el mismo bucket S3 para desarrollo y producción. Se necesita una carpeta raíz por entorno para aislar los archivos. Adicionalmente, la key de los prompts subidos a plantillas usaba el nombre slugificado de la plantilla, lo que era frágil ante renombrados.

## ADDED

- **Variable de entorno `S3_ROOT_PREFIX`** — si está definida, `S3Service.generateKey` la antepone a todas las keys generadas. Ej: `S3_ROOT_PREFIX=dev` produce `dev/empresa/actividad/...`. Backward-compatible: keys antiguas en BD sin prefijo siguen funcionando porque los métodos de lectura/escritura los reciben tal cual.

## MODIFIED

- **Key de prompt por pregunta de plantilla** (`admin-plantilla-pasos.controller.ts`) — el prefijo cambia de `plantillas/{plantillaSlug}/paso_N/pregunta_N/prompt` a `plantillas/{plantilla.id}/paso_N/pregunta_N/prompt`. Usar el ID garantiza estabilidad ante renombrados de la plantilla.

## Convención de paths resultante

| Tipo | Path |
|------|------|
| Ejemplo por paso (actividad) | `{prefix}/{empresa}/{actividad}/paso_N/ejemplo/{archivo}` |
| Prompt por pregunta (actividad) | `{prefix}/{empresa}/{actividad}/paso_N/pregunta_N/prompt/{archivo}` |
| Prompt por pregunta (plantilla) | `{prefix}/plantillas/{plantilla.id}/paso_N/pregunta_N/prompt/{archivo}` |
| Respuesta de usuario | `{prefix}/{empresa}/{plantilla\|actividad}/respuesta/{archivo}` |

Donde `{prefix}` = `S3_ROOT_PREFIX` si está definido, vacío si no.
