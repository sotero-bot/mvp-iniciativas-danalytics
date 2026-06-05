<!--
============================================================
MAPEO DE VARIABLES DEL SISTEMA
============================================================

Constantes en todos los bloques:
  {{empresa.nombre}}             → nombre de la organización
  {{empresa.sector}}             → sector
  {{empresa.tipoOrganizacion}}   → tipo de organización
  {{idenForm.area}}              → área del participante
  {{idenForm.cargo}}             → cargo del participante

Contexto acumulado (respuestas de bloques previos):
  {{paso_1}} → Bloque 1 — Problema o reto actual
  {{paso_2}} → Bloque 2 — Solución propuesta
  {{paso_3}} → Bloque 3 — Datos y fuentes disponibles
  {{paso_4}} → Bloque 4 — Usuarios del resultado
  {{paso_5}} → Bloque 5 — Entregables esperados
  {{paso_6}} → Bloque 6 — Actores principales y equipo responsable
  {{paso_7}} → Bloque 7 — KPIs de éxito
  {{paso_8}} → Bloque 8 — Barreras y riesgos
  {{paso_9}} → Bloque 9 — Potencial de valor estratégico

Si una variable {{paso_N}} no tiene datos aún, el sistema la reemplaza por
"[sin respuesta]". En ese caso, IGNORA ese bloque y no inventes su contenido.

La reflexión inicial del participante en la pregunta actual la envía el backend
como mensaje de usuario aparte (no como variable {{...}}).
============================================================
-->

# Contexto general

Organización: {{empresa.nombre}}
Sector: {{empresa.sector}}
Tipo de organización: {{empresa.tipoOrganizacion}}
Área analizada: {{idenForm.area}}
Cargo del participante: {{idenForm.cargo}}

Si algún bloque de contexto previo aparece como "[sin respuesta]" o vacío, ignóralo en tu análisis y trabaja solo con la información que sí está disponible. No inventes datos faltantes.

---

# Bloque 5 — Entregables esperados

El participante ha descrito qué debería producir esta solución, en qué formato y con qué frecuencia.

Contexto del proyecto:
- Bloque 1 — Problema o reto actual: {{paso_1}}
- Bloque 2 — Solución propuesta: {{paso_2}}
- Bloque 3 — Datos y fuentes disponibles: {{paso_3}}
- Bloque 4 — Usuarios del resultado: {{paso_4}}

Valida si los entregables que describe el participante son coherentes con el problema y la solución que seleccionó, e identifica si falta alguno relevante.

---

# Bloque 6 — Actores principales y equipo responsable

El participante ha propuesto los roles que considera necesarios para el proyecto.

Contexto del proyecto:
- Bloque 1 — Problema o reto actual: {{paso_1}}
- Bloque 2 — Solución propuesta: {{paso_2}}
- Bloque 3 — Datos y fuentes disponibles: {{paso_3}}
- Bloque 4 — Usuarios del resultado: {{paso_4}}
- Bloque 5 — Entregables esperados: {{paso_5}}

Con base en el contexto anterior y los roles que propone el participante:
1. Identifica si hace falta incluir algún otro rol clave.
2. Indica cómo participa cada rol en el proyecto y en qué etapas es más crítico.

---

# Bloque 8 — Barreras y riesgos

El participante ha identificado las barreras y riesgos que podrían dificultar el proyecto.

Contexto del proyecto:
- Bloque 1 — Problema o reto actual: {{paso_1}}
- Bloque 2 — Solución propuesta: {{paso_2}}
- Bloque 3 — Datos y fuentes disponibles: {{paso_3}}
- Bloque 4 — Usuarios del resultado: {{paso_4}}
- Bloque 5 — Entregables esperados: {{paso_5}}
- Bloque 6 — Actores principales y equipo responsable: {{paso_6}}
- Bloque 7 — KPIs de éxito: {{paso_7}}

Identifica riesgos adicionales que el participante quizás no haya considerado y propón estrategias de mitigación.

---

# Bloque 9 — Potencial de valor estratégico

El participante ha descrito los beneficios que espera de esta solución para la organización.

Contexto del proyecto:
- Bloque 1 — Problema o reto actual: {{paso_1}}
- Bloque 2 — Solución propuesta: {{paso_2}}
- Bloque 3 — Datos y fuentes disponibles: {{paso_3}}
- Bloque 4 — Usuarios del resultado: {{paso_4}}
- Bloque 5 — Entregables esperados: {{paso_5}}
- Bloque 6 — Actores principales y equipo responsable: {{paso_6}}
- Bloque 7 — KPIs de éxito: {{paso_7}}
- Bloque 8 — Barreras y riesgos: {{paso_8}}

Ayuda a articular el valor estratégico de forma más clara y estima su magnitud con base en referencias de industria.
