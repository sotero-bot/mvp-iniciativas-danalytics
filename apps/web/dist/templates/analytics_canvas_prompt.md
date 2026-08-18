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

1. Clasifica el valor potencial por tipo, usando solo las categorías que apliquen:
   - Reducción de costos
   - Ahorro de tiempo operativo
   - Incremento de ingresos
   - Reducción de riesgo
   - Mejora en calidad de decisiones

2. **OBLIGATORIO: para cada categoría que apliques, entrega una estimación cuantificada concreta.** No se aceptan frases genéricas como "mejorará la eficiencia" o "habrá ahorro significativo". Cada categoría debe incluir al menos una métrica con número, rango porcentual o magnitud específica. Formato esperado por categoría:
   - **Métrica**: nombre claro (ej. "horas/mes ahorradas por analista", "% reducción en tiempo de cierre de mes")
   - **Estimación**: número o rango (ej. "15-25%", "8-12 horas/persona/semana", "reducción de 5 a 2 días")
   - **Base del cálculo**: referencia al Bloque 3 (datos disponibles), benchmark de industria similar, o supuesto razonable explícito

3. **Realismo**: si el participante no aportó cifras propias, usa rangos amplios apoyados en benchmarks típicos del sector ({{empresa.sector}}). Prefiere rangos conservadores ("15-25%") antes que números puntuales sin sustento ("23,7%"). Si un dato no se puede estimar razonablemente, dilo explícitamente en vez de inventarlo.

4. Estima el horizonte de impacto por categoría: corto plazo (menos de 3 meses), mediano plazo (3 a 12 meses) o largo plazo (más de 12 meses).

5. Cierra con 2 o 3 indicadores específicos (con su unidad y meta numérica) para evidenciar el valor generado. Ejemplo: "Tiempo promedio de respuesta a solicitudes: meta < 24h".
