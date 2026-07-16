# Gestor Actividades para Iniciativas - DAnalytics

MVP plataforma para realizar y gestionar las Actividades configuradas para una Iniciativa de una Empresa, como parte de la oferta de Servicios de DAnalytics.

## Tecnologías Principales
- **Backend**: NestJS, Prisma (PostgreSQL), Passport (JWT).
- **Frontend**: React (Vite), React Router, Vanilla CSS.
- **Monolito Modular**: Arquitectura limpia basada en DDD.

## Requisitos Previos
- **Node.js**: v20 o superior.
- **PostgreSQL**: Instancia local o remota corriendo.

## Guía de Inicio Rápido

### 1. Clonar y Configurar Entorno

En tu instancia de PostgreSQL, crea una base de datos con el nombre `activity_platform_db`. Dale permisos al usuario que vas a usar para acceder a la base de datos.


Crea un archivo `.env` en la raíz del proyecto basado en el siguiente ejemplo:
```env
# Database Configuration (Local)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=activity_platform_db
POSTGRES_PRISMA_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}?schema=public"
POSTGRES_URL_NON_POOLING="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}?schema=public"

# App Config
PORT=3000
NODE_ENV=development

# OpenAI
OPENAI_API_KEY=sk-...

# AWS S3 — Storage de archivos (opcional en local; requerido en prod)
AWS_REGION=us-west-2
AWS_S3_BUCKET=nombre-del-bucket
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

### 2. Instalación de Dependencias
```bash
npm install
```

### 3. Preparar Base de Datos
Sincroniza el esquema de Prisma con tu base de datos y genera el cliente:
```bash
npx prisma db push
```

### 4. Crear Usuario Administrador Base
Para acceder al panel admin, ejecuta este script para crear el primer usuario:
```bash
npm run seed:admin
```
*(Crea el usuario `admin` con contraseña `dax1973*`)*


### 5. Seed del Diagnóstico Inicial (IA en Acción, opcional)
Crea el template global del formulario "Encuesta de inicio sobre el Uso de IA Generativa"
(réplica del Google Form real) en el form builder:
```bash
npm run seed:diagnostico-inicial
```
- Es **idempotente**: si ya existe un template global activo de tipo `diagnostico_inicial`, aborta sin tocar nada (edítalo o duplícalo desde `/admin/formularios`).
- Al **activar** un programa, este template se copia automáticamente como snapshot inmutable del programa (RF-46).
- Por defecto omite las preguntas de correo/nombre/cargo (la respuesta ya queda ligada al usuario autenticado). Para la réplica literal del Google Form:
  ```bash
  npm run seed:diagnostico-inicial -- --con-datos-personales
  ```

### 6. Seed de los Formularios del Reto con IA (opcional)
Crea los templates globales grupales de la Fase 3 — "Bitácora del proyecto con IA" y
"Plantilla del proyecto con IA" (réplica de los documentos de `_tareas_realizar/formularios/`):
```bash
npm run seed:formularios-reto
```
- Es **idempotente por tipo**: si ya existe un template global activo de `bitacora` o `plantilla_proyecto`, ese tipo se salta sin tocar nada.
- Al **activar** un programa se snapshotean automáticamente (RF-46) y los grupos los responden desde el portal estudiante ("Mi grupo").

### 7. Borrar y Recargar Datos de Prueba
Para limpiar toda la data (instancias, respuestas, usuarios, empresas, etc.) y volver al estado inicial con los seeds:
```bash
npm run reset-data
```
> ⚠️ Borra **todo** excepto el usuario admin. Útil para demo o desarrollo.

### 8. Ejecutar la Aplicación
Inicia tanto la API como el Frontend concurrentemente:
```bash
npm run start:dev
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3000](http://localhost:3000)

## Arquitectura de Carpetas
- `apps/api`: Servidor NestJS.
- `apps/web`: Aplicación React.
- `prisma`: Esquema de base de datos.
- `src/modules`: Lógica de negocio dividida en dominios (Methodology, Execution, Organization, Auth).

