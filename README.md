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
# Database Configuration
DB_USER=tu_usuario
DB_PASSWORD=tu_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=activity_platform_db
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"

# App Config
PORT=3000
NODE_ENV=development
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


### 5. Ejecutar la Aplicación
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

