---
name: s3-key-naming
description: Convención del proyecto para construir keys de S3. Úsalo cada vez que generes una key S3 (uploads de ejemplos, plantillas, respuestas, evidencias, etc.) o expongas un prefijo nuevo. Aplica a todo código que invoque `S3Service.generateKey`, `getPresignedPutUrl`, o construya `Key` para `PutObjectCommand`.
---

# Convención de nombres en S3

## Regla

Cada segmento de un path S3 (lo que está entre `/`) debe ser:

- **minúsculas**
- **sin tildes ni diacríticos** (`á → a`, `ñ → n`)
- **espacios y cualquier caracter no `[a-z0-9]` → `_`**
- **sin `_` duplicados ni al inicio/fin**

Los `/` se usan únicamente como separadores de "carpeta", nunca dentro de un segmento.

## Cómo aplicarla

Usar siempre el helper `S3Service.slugifyPathSegment` (en `apps/api/src/modules/storage/S3Service.ts`). No re-implementar el regex en cada controlador.

```ts
import { S3Service } from '../../storage/S3Service';

const empresa = S3Service.slugifyPathSegment(empresaNombre) || 'empresa';
const actividad = S3Service.slugifyPathSegment(actividadNombre) || 'actividad';
const prefix = `${empresa}/${actividad}/paso_${paso.orden}/ejemplo`;
const key = this.s3.generateKey(prefix, body.filename);
```

Slugifica por segmento, nunca el path completo (los `/` se romperían).

Si el slug resulta vacío (ej. nombre de empresa solo con caracteres especiales), usar un fallback razonable (`'empresa'`, `'actividad'`, etc.) para evitar `//` en la key.

## Convención de paths

Las keys S3 se organizan por tipo de archivo:

### Archivo de ejemplo (admin sube por paso)

`<empresa>/<actividad>/paso_<orden>/ejemplo/<archivo>`

Usa el nombre de la **actividad** (ese flujo siempre está sobre una actividad concreta, no sobre una plantilla).

Ejemplo: `acme_corp/mapa_de_oportunidades/paso_3/ejemplo/1716928000-845.xlsx`

### Respuesta de usuario (file uploaded en el runner)

`<empresa>/<plantilla|actividad>/respuesta/<archivo>`

- Si la actividad viene de una plantilla (`plantillaOrigen`), usar el nombre de la **plantilla**.
- Si no, usar el nombre de la **actividad**.

Notas:
- **No** incluye iniciativa.
- **No** incluye paso, área, ni preguntaId. Todas las respuestas de la actividad/plantilla van bajo el mismo `respuesta/` y se distinguen por el sufijo único de `generateKey`.

Ejemplo: `metrocali/taller_mapa_oportunidades_analiticas/respuesta/1716928200-12345.xlsx`

## Qué NO va por este flujo

- IDs/tokens (UUIDs, `accessToken`): no slugifies, son únicos por construcción.
- Nombres de archivo (`filename` del usuario): `generateKey` ya les añade un sufijo único y solo conserva la extensión, así que no necesitan slug aparte.
- Prefijos literales en código (`'ejemplos/plantillas'`): si son fijos, escríbelos directamente en lowercase con `_`.

## Por qué

- Compatibilidad: algunos clientes S3 son case-sensitive y los espacios complican URLs/CLI.
- Visibilidad: paths legibles al navegar el bucket desde consola.
- Idempotencia: dos nombres "Acme" y "ACME" no deben crear carpetas distintas.
