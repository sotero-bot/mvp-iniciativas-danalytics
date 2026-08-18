# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **danalytics_admin**: equipo de DAnalytics. Configura Empresas, Iniciativas, Actividades, Pasos, formularios y dependencias; genera instancias; supervisa resultados; descarga el producto formal en PDF.
- **facilitador**: acompaña la ejecución de talleres en vivo; consulta asistencia y resultados de su grupo; acceso de solo lectura tras vencer la gracia (ver historial de commits reciente); no matricula usuarios.
- **cliente**: contacto de la Empresa contratante; consume resultados/reportes de su Iniciativa.
- **estudiante / participante**: accede a través de matrícula (no autoregistro), ejecuta actividades y formularios estructurados (diagnóstico inicial de IA generativa, bitácora y plantilla del proyecto de un reto con IA), responde en "Mi grupo" cuando la actividad es grupal.

## Product Purpose

Plataforma que ejecuta y da soporte a un servicio de consultoría/capacitación de DAnalytics: programas guiados ("Iniciativas") compuestos por Actividades y Pasos metodológicos, con diagnóstico de uso de IA generativa y un reto práctico con IA, dirigidos a empresas cliente. El sistema es la herramienta operativa del servicio, no un producto SaaS de autoservicio.

## Positioning

No es una herramienta genérica de encuestas/formularios (tipo Google Forms/Typeform). El valor está en la metodología estructurada propia de DAnalytics: secuencias de actividades con dependencias, diagnóstico y reto de IA generativa versionados por programa (snapshot inmutable al activar), seguimiento por facilitador, y un producto formal en PDF que el admin supervisa y entrega a la empresa cliente al cierre del servicio de consultoría.

## Operating Context

- Acceso de estudiante/participante vía matrícula hecha por danalytics_admin (nunca autoregistro ni magic link para crear usuarios).
- Ejecución de actividades en instancias (`InstanciaActividad`), con estado y respuestas por paso/pregunta.
- Formularios con snapshot inmutable por programa al activarse (RF-46): diagnóstico inicial, bitácora del proyecto, plantilla del proyecto.
- Facilitador con ventana de gracia; tras vencer pasa a acceso de solo lectura con resumen de asistencia.
- Multiempresa (single-tenant global): varias Empresas conviven en la misma instancia con separación lógica.
- Soporta español y portugués (`es`/`pt`) vía `react-i18next`.

## Capabilities and Constraints

- Backend NestJS + Prisma + PostgreSQL; frontend React + Vite + TypeScript; storage S3 para archivos y templates; IA vía OpenAI para prompts/diagnóstico.
- Deploy: Vercel (frontend) + backend independiente; sincronización de esquema en prod vía `prisma db push` (no `migrate deploy`).
- No hay autoregistro de usuarios: el registro y la matrícula son exclusivos de danalytics_admin.
- El producto formal en PDF sólo es visible/descargable por el Administrador (el participante no lo ve).

## Brand Commitments

Design system sobrio de estilo navy ya documentado (reglas en `.claude/rules/frontend`, `index.css`). Tipografía de marca: Poppins (cuerpo y títulos), nunca serif. Esta identidad visual ya definida se preserva; no se reabre en este documento.

## Evidence on Hand

- `Descripcion_sistema.md` y `Backlog (User Stories).md` documentan el modelo funcional original (algunas secciones desactualizadas respecto al MVP actual con roles/formularios ampliados — usar el código como fuente de verdad para el estado actual).
- Sin testimonios, casos de estudio ni benchmarks públicos: no inventar evidencia social en el diseño.

## Product Principles

- La interfaz sirve una consultoría guiada, no un producto de autoservicio: prioriza claridad de dónde está el usuario dentro del programa sobre exploración libre.
- Los tres roles (admin, facilitador, estudiante) tienen necesidades y cargas cognitivas distintas; no diseñar una sola pantalla para los tres.
- El producto formal en PDF es el entregable de valor del servicio: la supervisión del admin y la trazabilidad de resultados no se sacrifican por estética.
- Preservar la identidad visual navy/Poppins ya establecida; mejorar dentro de ese sistema, no reemplazarlo.
