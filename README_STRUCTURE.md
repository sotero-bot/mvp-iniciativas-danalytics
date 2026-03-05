# Estructura del Proyecto Monorepo (MVP)

Este proyecto sigue una arquitectura de Monolito Modular con Frontend y Backend en el mismo repositorio.

## Estructura de Carpetas

### Backend (apps/api)
La API está organizada en módulos funcionales, cada uno siguiendo Clean Architecture (Domain, Application, Infrastructure).

- **modules/organization**: Gestión de Empresas e Iniciativas.
- **modules/methodology**: Configuración de Actividades y Pasos.
- **modules/execution**: Core del negocio. Instancias, Intentos y ciclo de vida.
- **modules/product**: Generación de entregables (PDF) y reporte.
- **shared**: Código compartido (Kernel), errores de dominio, utilidades.

### Frontend (apps/web)
Aplicación React organizada por features verticales.

- **features/organization**: Vistas de administración de empresas.
- **features/execution**: El "Runner" de actividades para el usuario final.
- **features/methodology**: Editores de configuración.
