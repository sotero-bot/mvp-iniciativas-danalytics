# Historias de Usuario - MVP

## Registrar Empresa

- Specific
Como Administrador, quiero crear una Empresa con nombre y estado, para organizar las iniciativas y usuarios asociados.

- Measurable
    - Permite registrar nombre obligatorio.

    - Se almacena con fecha de creación automática.

    - Se asigna estado activo por defecto.

    - Se visualiza en listado de empresas.

- Achievable
Sí, CRUD con formulario web.

- Relevant
Permite estructurar el sistema organizacionalmente.

- Time-bound
Listo en 0.5 hrs de ejecución por parte de agentes IA.


## Registrar Iniciativas por Empresa

- Specific
Como Administrador, quiero crear una Iniciativa asociada a una Empresa, para agrupar actividades bajo un objetivo común.

- Measurable
    - Nombre obligatorio.
    - Asociación obligatoria a Empresa.
    - Registro de timestamps.
    - Listado filtrado por Empresa
  
- Achievable
Sí, CRUD con formulario web.

- Relevant
Organiza Actividades por grupos y por Empresa.

- Time-bound
0.5 horas de ejecución por parte de agentes IA.


## Registrar Actividades

- Specific
Como Administrador, quiero crear una Actividad con configuración JSON editable, para definir la estructura metodológica que ejecutará el Usuario.

- Measurable
    - Permite registrar nombre y descripción.
    - Permite guardar JSON válido en config.
    - Valida formato JSON antes de persistir.
    - Permite cambiar estado (activo/inactivo).

- Achievable
Sí. Formulario web y CRUD

- Relevant
Define la estructura dinámica de la actividad.

- Time-bound
0.5 horas de ejecución por parte de agentes IA.


## Configurar Pasos de una Actividad

- Specific
Como Administrador, quiero definir los pasos de una Actividad con orden secuencial, para estructurar el flujo que seguirá el Usuario.

- Measurable
    - Permite crear múltiples pasos.
    - Cada paso tiene orden único por actividad.
    - No permite duplicar orden.
    - Permite edición antes de activar la actividad.

- Achievable
Sí.

- Relevant
Define la secuencia metodológica de la Actividad.

- Time-bound
1 hora de ejecución por parte de agentes IA.


## Registrar dependencias de una Actividad con otras Actividades

- Specific
Como Administrador, quiero definir que una Actividad dependa de la finalización previa de otra Actividad dentro de la misma Iniciativa, para asegurar que los Usuarios sigan una secuencia metodológica predefinida.

- Measurable
    - Permite seleccionar una Actividad origen (dependiente).

    Permite seleccionar una o más Actividades requeridas (prerrequisito).

    Solo permite dependencias dentro de la misma Iniciativa.

    No permite crear dependencias circulares.

    Permite visualizar las dependencias registradas.
    Permite eliminar una dependencia existente.

- Achievable
Sí. 

- Relevant
Garantiza coherencia metodológica entre Actividades y ejecución ordenada por parte del Usuario.

- Time-bound
0.75 horas de ejecución.


## Generar Instancia de Actividad y Enlace Seguro

- Specific
Como Administrador, quiero generar una Instancia de Actividad para un Usuario, para permitirle ejecutar la actividad mediante un enlace seguro.

- Measurable
    - Crea Usuario si no existe.
    - Crea InstanciaActividad en estado "generado".
    - Genera enlace con token determinista basado en instancia_id y SECRET_KEY.
    - Devuelve URL lista para compartir.
    - Valida que las dependencias estén cumplidas (InstanciaActividad previa en estado finalizado para el mismo Usuario).

- Achievable
Sí.

- Relevant
Permite ejecución individual controlada.

- Time-bound
1 hora de ejecución por agente IA (incluye validaciones de seguridad).


## Acceso a Actividad mediante Enlace

- Specific
Como Usuario, quiero acceder a la Actividad mediante el enlace recibido, para iniciar el proceso sin autenticación tradicional.

- Measurable
    - Valida instancia_id y token.
    - Si estado = generado → cambia a iniciado.
    - Registra fecha_hora_inicio.
    - Bloquea acceso si estado es cancelado o finalizado.

- Achievable
Sí.

- Relevant
Permite acceso seguro sin login para un Usuario a las Actividades asignadas.

- Time-bound
1,5 horas de ejecución por agente IA


## Registrar Respuestas por Paso

- Specific
Como Usuario, quiero registrar mis respuestas en cada paso, para completar la actividad de manera estructurada.

- Measurable
    - Guarda respuesta asociada a instancia y paso.
    - Permite edición mientras estado = iniciado.

- Achievable
Sí. 

- Relevant
Sí. Es el núcleo funcional del sistema.

- Time-bound
1 hora de ejecución por agente IA


## Finalizar Instancia de Actividad

- Specific
Como Usuario, quiero finalizar la Actividad una vez completadas mis respuestas, para registrar formalmente su cierre.

- Measurable
    - Solo permite finalizar si estado = iniciado.
    - Cambia estado a “finalizado”.
    - Registra fecha_hora_fin.
    - Impide edición posterior de respuestas.

- Achievable
Sí

- Relevant
Sí, identifica la realización completa de una Actividad por parte de un Usuario.

- Time-bound
0.25 horas de ejecución por agente IA.


## Listar Resultados como Administrador

- Specific
Como Administrador, quiero visualizar los productos generados por los Usuarios, para revisar resultados por Empresa, Iniciativa o Actividad.

Measurable

    Listado de Actividades, filtrado por por Empresa e Iniciativa.

    Listado de Instancias por Actividad.

    Mostrar Estado de cada Instancia de Actividad (indicador de color también).

Achievable
Sí

Relevant
Permite supervisión y evaluación de las Actividades y su realización por parte de los Usuarios.

Time-bound
2 horas de ejecución por agente IA.


## Ver Detalles de una Instancia de Actividad Finalizada

Specific
Como Administrador, quiero visualizar el detalle completo de una Instancia de Actividad finalizada, para revisar el contenido consolidado de las respuestas registradas por el Usuario.

Measurable

    Solo permite acceder al detalle si el estado de la Instancia es “finalizado”.

    Muestra información contextual:

        Empresa

        Iniciativa

        Actividad

        Nombre del Usuario

        Cargo

        Fecha de inicio

        Fecha de finalización

    Muestra las respuestas ordenadas según el orden de los PasoActividad 

    No permite edición del contenido.

    Si la instancia no está finalizada, muestra mensaje informativo y bloquea el acceso al detalle consolidado.

Achievable
Consulta relacional (JOIN entre InstanciaActividad, Usuario, Actividad, Iniciativa, Empresa, Interaccion y PasoActividad) + renderizado HTML estructurado.

Relevant
Permite revisión de los resultados y productos para continuar con el apoyo y servicio brindado a los clientes.

Time-bound
1.25 horas de ejecución por agente IA.


## Generar y Descargar Producto en PDF

Specific
Como Administrador, quiero generar y descargar el PDF correspondiente a una Instancia de Actividad finalizada, para conservar o compartir formalmente el resultado generado.

Measurable

    Solo permite generar PDF si la Instancia está en estado “finalizado”.

    Genera PDF a partir del contenido consolidado mostrado en el detalle.

    El PDF incluye:

        Datos de Empresa

        Iniciativa

        Actividad

        Usuario

        Fechas

        Respuestas ordenadas por paso

    Guarda el archivo en almacenamiento persistente.

    Crea registro en tabla Producto.

    Permite descargar el archivo generado.

    Si el PDF ya existe, permite descarga directa sin regeneración.

Achievable
Sí. Conversión de plantilla HTML estructurada a PDF mediante librería estándar + persistencia en tabla Producto.

Relevant
Formaliza el Producto de la Actividad y permite su distribución externa a Usuarios o cliente.

Time-bound
0.5 horas de ejecución por agente IA.
