# Descripción del Sistema – MVP

## 1. Visión General

El sistema es una **WebApp de ejecución de actividades metodológicas guiadas**, orientada a Empresas cuyos Usuarios realizan actividades estructuradas a través de un enlace seguro generado por la plataforma.

Cada actividad ejecutada produce un **Producto formal en formato PDF**, el cual puede ser revisado y descargado exclusivamente por el Administrador.

El sistema opera bajo un modelo **single-tenant global**, donde múltiples Empresas coexisten en la misma instancia, con separación lógica de información.

---

## 2. Objetivo del Sistema

Permitir que:

- Un **Administrador** configure metodologías estructuradas (Actividades).
- Los **Usuarios** ejecuten dichas actividades mediante un enlace seguro sin autenticación tradicional.
- El sistema consolide las respuestas registradas.
- El Administrador supervise resultados y genere el producto formal en PDF.

---

## 3. Actores del Sistema

### 3.1 Administrador

Tiene control total sobre:

- Empresas
- Iniciativas
- Actividades
- Pasos de actividades
- Dependencias entre actividades
- Generación de instancias
- Visualización de resultados
- Generación y descarga de productos en PDF

---

### 3.2 Usuario

- Accede únicamente mediante enlace seguro.
- Ejecuta una actividad específica.
- Registra respuestas por paso.
- Finaliza la actividad.
- No puede visualizar ni descargar el producto generado.

---

## 4. Estructura Funcional

### 4.1 Gestión Organizacional

El sistema permite:

- Registrar Empresas.
- Registrar Iniciativas asociadas a Empresas.
- Registrar Actividades dentro de Iniciativas.
- Configurar Pasos de cada Actividad.
- Definir dependencias entre Actividades dentro de la misma Iniciativa.

---

### 4.2 Configuración Metodológica

Cada Actividad:

- Tiene nombre, descripción y estado.
- Contiene configuración dinámica en formato JSON.
- Está compuesta por múltiples Pasos ordenados secuencialmente.
- Puede depender de la finalización de otras Actividades.

Los Pasos definen:

- Título
- Objetivo
- Instrucciones
- Prompt informativo
- Orden de ejecución.

---

### 4.3 Ejecución de Actividades

Flujo de ejecución:

1. El Administrador genera una **InstanciaActividad** para un Usuario.
2. El sistema genera un enlace seguro basado en:
   - `instancia_id`
   - `user_id`
   - `SECRET_KEY`
3. El Usuario accede mediante el enlace.
4. El sistema valida token y estado.
5. El Usuario registra respuestas por cada Paso.
6. El Usuario finaliza la actividad.
7. El estado cambia a `finalizado`.

Cada ejecución queda registrada como una instancia independiente.

---

### 4.4 Registro de Interacciones

Las respuestas del Usuario se almacenan en:

- Tabla `Interaccion`
- Asociadas a:
  - `InstanciaActividad`
  - `PasoActividad`
- Con timestamp de registro.

En el MVP no se almacenan respuestas del sistema ni de IA.

---

### 4.5 Supervisión y Resultados

El Administrador puede:

- Listar Actividades por Empresa e Iniciativa.
- Listar Instancias por Actividad.
- Visualizar estado de cada Instancia:
  - `generado`
  - `iniciado`
  - `finalizado`
  - `cancelado`.

Para instancias finalizadas puede:

- Ver el detalle consolidado de respuestas.
- Generar y descargar el Producto en PDF.

---

### 4.6 Generación del Producto

El Producto:

- Se genera únicamente para instancias en estado `finalizado`.
- Consolida las respuestas ordenadas por Paso.
- Incluye:
  - Empresa
  - Iniciativa
  - Actividad
  - Usuario
  - Fechas relevantes
  - Respuestas estructuradas.
- Se guarda en almacenamiento persistente.
- Se registra en la tabla `Producto`.

El PDF representa el entregable formal de la actividad realizada.

---

## 5. Reglas de Negocio Principales

1. Las dependencias entre Actividades aplican por Usuario.
2. No se pueden generar dependencias circulares.
3. Una Actividad dependiente solo puede ejecutarse si sus prerrequisitos están finalizados.
4. El Usuario solo puede editar respuestas mientras el estado sea `iniciado`.
5. Una Instancia finalizada no puede modificarse.
6. Solo el Administrador puede visualizar y descargar el Producto.
7. El enlace de acceso es determinista y validado mediante clave secreta.

---

## 6. Estados del Ciclo de Vida

### InstanciaActividad

- `generado`
- `iniciado`
- `finalizado`
- `cancelado`

### Transiciones válidas

- `generado → iniciado`
- `iniciado → finalizado`
- `generado → cancelado`
- `iniciado → cancelado`

No existen transiciones desde `finalizado`.

---

## 7. Arquitectura Conceptual

El sistema se compone de tres capas principales:

1. **Capa de Configuración (Administrativa)**
2. **Capa de Ejecución (Usuario)**
3. **Capa de Supervisión y Producto (Administrador)**

El modelo relacional soporta separación clara entre:

- Definición estructural (`Actividad`, `PasoActividad`)
- Ejecución (`InstanciaActividad`, `Interaccion`)
- Artefacto derivado (`Producto`)

---

## 8. Alcance del MVP

### Incluye

- Configuración completa de metodologías.
- Gestión de dependencias.
- Generación de instancias.
- Ejecución por enlace seguro.
- Registro estructurado de respuestas.
- Supervisión administrativa.
- Generación manual de PDF.

### No incluye

- Autenticación tradicional de Usuarios.
- Visualización de producto por parte del Usuario.
- Versionamiento de productos.
- Interacción con IA al responder.
- Multi-tenant
- Permisos granulares adicionales.

---

# Conclusión

El sistema es una plataforma estructurada de ejecución metodológica controlada, que permite transformar la interacción guiada de un Usuario en un Producto formal supervisado por un Administrador, garantizando:

- Trazabilidad
- Control de flujo
- Cumplimiento de dependencias
- Consolidación estructurada de información
- Generación de entregables formales.
