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
  {{paso_2}} → Bloque 2 — Datos y fuentes disponibles
  {{paso_3}} → Bloque 3 — Indicadores o KPIs de éxito
  {{paso_4}} → Bloque 4 — Modelo analítico / tipo de analítica
  {{paso_5}} → Bloque 5 — Usuarios del modelo
  {{paso_6}} → Bloque 6 — Actores principales y equipo responsable
  {{paso_7}} → Bloque 7 — Entregables y uso esperado
  {{paso_8}} → Bloque 8 — Barreras y riesgos

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

# Bloque 1 — Problema o reto actual

Actúa como consultor senior en analítica de datos y ayúdame a construir un Analytics Canvas.

Voy a darte el contexto de mi proyecto:
- Área o proceso: {{idenForm.area}}
- Problema inicial, datos disponibles y tipo de analítica que creo necesitar (Diagnóstica / Predictiva / Prescriptiva): los describe el participante en su mensaje.

Con base en esto:
1. Ayúdame a formular el problema de forma clara y accionable.
2. Identifica si hay supuestos implícitos que deba validar.
3. Sugiere si el alcance es adecuado o si debería acotarse.

---

# Bloque 3 — Indicadores o KPIs de éxito

Necesito definir los indicadores clave de éxito de mi proyecto analítico.

El contexto del proyecto es:
- Bloque 1 — Problema y objetivo: {{paso_1}}
- Bloque 2 — Datos y fuentes disponibles: {{paso_2}}

Sugiere de 3 a 5 KPIs medibles que reflejen impacto real en tiempo, costo, precisión o satisfacción, y explícame por qué son útiles para este caso.

---

# Bloque 5 — Usuarios del modelo

Necesito identificar los usuarios clave del modelo analítico de mi proyecto.

Contexto del proyecto:
- Bloque 1 — Problema y objetivo: {{paso_1}}
- Bloque 2 — Datos y fuentes disponibles: {{paso_2}}
- Bloque 3 — KPIs de éxito: {{paso_3}}
- Bloque 4 — Tipo de analítica y enfoque técnico: {{paso_4}}

El participante enviará en su mensaje los usuarios o roles que considera principales.

Propón una lista de usuarios principales, explica brevemente cómo se beneficiaría cada uno del modelo o visualización, y enumera al menos 3 elementos clave que se deben tener en cuenta para que puedan darle un buen uso.

---

# Bloque 6 — Actores principales y equipo responsable

Ayúdame a estructurar el equipo de trabajo ideal para mi proyecto analítico.

Contexto del proyecto:
- Bloque 1 — Problema y objetivo: {{paso_1}}
- Bloque 2 — Datos y fuentes disponibles: {{paso_2}}
- Bloque 3 — KPIs de éxito: {{paso_3}}
- Bloque 4 — Tipo de analítica y enfoque técnico: {{paso_4}}
- Bloque 5 — Usuarios del modelo: {{paso_5}}

El participante enviará en su mensaje los roles que propone para el equipo.

Identifica si hace falta incluir algún otro rol e indica cómo participa cada uno en el proyecto.

---

# Bloque 7 — Entregables y uso esperado

Necesito definir los entregables y su uso esperado para mi proyecto analítico.

Contexto del proyecto:
- Bloque 1 — Problema y objetivo: {{paso_1}}
- Bloque 2 — Datos y fuentes disponibles: {{paso_2}}
- Bloque 3 — KPIs de éxito: {{paso_3}}
- Bloque 4 — Tipo de analítica y enfoque técnico: {{paso_4}}
- Bloque 5 — Usuarios del modelo: {{paso_5}}
- Bloque 6 — Equipo responsable: {{paso_6}}

El participante enviará en su mensaje los entregables que propone.

Cuestióname si los entregables cubren adecuadamente las necesidades del negocio, sugiere qué otros tipos de resultados o visualizaciones podrían agregar valor, y ayúdame a afinar la descripción de su utilidad práctica para los usuarios o áreas involucradas.

---

# Bloque 8 — Barreras y riesgos

Necesito identificar las principales barreras y riesgos para mi proyecto analítico.

Contexto del proyecto:
- Bloque 1 — Problema y objetivo: {{paso_1}}
- Bloque 2 — Datos y fuentes disponibles: {{paso_2}}
- Bloque 3 — KPIs de éxito: {{paso_3}}
- Bloque 4 — Tipo de analítica y enfoque técnico: {{paso_4}}
- Bloque 5 — Usuarios del modelo: {{paso_5}}
- Bloque 6 — Equipo responsable: {{paso_6}}
- Bloque 7 — Entregables y uso esperado: {{paso_7}}

El participante enviará en su mensaje los riesgos o barreras que ha identificado.

Cuestióname si estoy dejando por fuera otros riesgos comunes en proyectos similares, ayúdame a identificar sus causas raíz y propón formas prácticas de mitigarlos o reducir su impacto.

---

# Bloque 10 — Potencial de valor para la organización

Quiero definir el valor potencial de mi proyecto analítico para la organización.

Contexto del proyecto:
- Bloque 1 — Problema y objetivo: {{paso_1}}
- Bloque 2 — Datos y fuentes disponibles: {{paso_2}}
- Bloque 3 — KPIs de éxito: {{paso_3}}
- Bloque 4 — Tipo de analítica y enfoque técnico: {{paso_4}}
- Bloque 5 — Usuarios del modelo: {{paso_5}}
- Bloque 6 — Equipo responsable: {{paso_6}}
- Bloque 7 — Entregables y uso esperado: {{paso_7}}
- Bloque 8 — Barreras y riesgos: {{paso_8}}

El participante enviará en su mensaje los beneficios o impactos esperados que ya ha identificado.

Cuestióname si los beneficios están suficientemente conectados con los objetivos estratégicos de la organización, ayúdame a estimar su magnitud o plazo de impacto, y sugiere posibles indicadores o métricas para evidenciar el valor generado.
