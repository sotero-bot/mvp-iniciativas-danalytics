# <!--

# MAPEO DE VARIABLES DEL SISTEMA

Constantes en todos los bloques:
{{empresa.nombre}} → nombre de la organización
{{empresa.sector}} → sector
{{empresa.tipoOrganizacion}} → tipo de organización
{{idenForm.area}} → área del participante
{{idenForm.cargo}} → cargo del participante

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

Con base en el problema, la solución y los usuarios descritos:

1. Cuestiona si los entregables propuestos cubren realmente las necesidades del negocio o si son demasiado genéricos.
2. Sugiere tipos de entregables concretos que podrían agregar valor para este caso (dashboard interactivo, modelo predictivo, API de scoring, reporte automatizado, sistema de alertas, herramienta de simulación, etc.).
3. Para cada entregable relevante, indica: formato, frecuencia de actualización y qué decisión específica habilita.
4. Señala si algún entregable propuesto es difícil de consumir por los usuarios descritos y propón cómo hacerlo más accionable.

---

# Bloque 7 — KPIs de éxito

El participante ha descrito cómo mediría el éxito de esta solución.

Contexto del proyecto:

- Bloque 1 — Problema o reto actual: {{paso_1}}
- Bloque 2 — Solución propuesta: {{paso_2}}
- Bloque 3 — Datos y fuentes disponibles: {{paso_3}}
- Bloque 4 — Usuarios del resultado: {{paso_4}}
- Bloque 5 — Entregables esperados: {{paso_5}}
- Bloque 6 — Actores principales y equipo responsable: {{paso_6}}

Con base en el problema y la solución:

1. Evalúa si los KPIs propuestos son realmente medibles o si son demasiado genéricos (ej. "mejorar la eficiencia" no es un KPI, "reducir el tiempo de cierre de mes de 5 días a 2 días" sí lo es).
2. Sugiere de 3 a 5 KPIs concretos que reflejen impacto real en tiempo, costo, precisión o satisfacción. Para cada uno especifica: nombre, fórmula de cálculo, frecuencia de medición y valor objetivo o rango esperado.
3. Distingue entre indicadores de proceso (miden la adopción o uso del modelo) e indicadores de resultado (miden el impacto en el negocio). Incluye al menos uno de cada tipo.
4. Señala qué fuente de datos alimentaría cada KPI y si esa fuente ya está disponible según lo descrito en el Bloque 3.

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
- Bloque 9 — Potencial de valor estratégico: {{paso_9}}

Con base en todo el contexto del proyecto:

1. Cuestiona si los beneficios descritos están suficientemente conectados con los objetivos estratégicos de la organización o si son demasiado generales.
2. Clasifica el valor potencial por tipo: reducción de costos, ahorro de tiempo operativo, incremento de ingresos, reducción de riesgo, mejora en calidad de decisiones. Usa solo las categorías que apliquen.
3. Para cada categoría aplicable, fuerza una estimación cuantificable: rangos porcentuales, horas/personas ahorradas, frecuencia de errores evitados u otra métrica concreta. Apóyate en benchmarks de industria similares si el participante no tiene datos propios.
4. Estima el horizonte de impacto: corto plazo (menos de 3 meses), mediano plazo (3 a 12 meses) o largo plazo (más de 12 meses).
5. Propón 2 o 3 indicadores o métricas específicas que la organización podría usar para evidenciar el valor generado una vez implementado el proyecto.
