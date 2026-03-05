# Modelo de Datos, Relacional

- Admin {
    id: PK,
    username: varchar,
    nombre: varchar,
    password: encypted_string,
    fecha_hora_creacion: timestamp,
    fecha_hora_modificacion: timestamp,
    estado: varchar
  }

- Empresa {
    id: PK,
    nombre: varchar,
    fecha_hora_creacion: timestamp,
    fecha_hora_modificacion: timestamp,
    estado
  }

- Usuario {
    id: PK,
    nombre: varchar,
    cargo: varchar,
    empresa_id: FK,
    fecha_hora_creacion: timestamp,
    fecha_hora_modificacion: timestamp,
    estado: varchar
  }

- Iniciativa {
    id: PK,
    nombre: varchar,
    descripcion: varchar,
    empresa_id: FK,
    fecha_hora_creacion: timestamp,
    fecha_hora_modificacion: timestamp,
    estado: varchar
  }

- Actividad {
    id: PK,
    iniciativa_id: FK,
    nombre: varchar,
    descripcion: varchar,
    config: JSON
    fecha_hora_creacion: timestamp,
    fecha_hora_modificacion: timestamp,
    estado: varchar
  }

- PasoActividad {
    id: PK_,
    actividad_id: FK,
    titulo: varchar,
    objetivo: varchar,
    instrucciones: varchar,
    prompt_ia: varchar,
    orden: int
  }

// Enlace generado como un token(instancia_id,user_id,SECRET_KEY)
- InstanciaActividad {
    instancia_actividad_id: PK,
    actividad_id: FK,
    user_id: FK,
    estado: varchar opts=[generado, iniciado, finalizado, cancelado],
    fecha_hora_creacion: timestamp,
    fecha_hora_inicio: timestamp,
    fecha_hora_fin: timestamp
  }

- Interaccion {
    interaccion_id: PK,
    actividad_instancia_id: FK,
    paso_actividad_id: FK,
    contenido: text,
    fecha_hora: timestamp
  }

- Producto {
    producto_id PK,
    instancia_actividad_id FK,
    file_path: url,
    nombre_archivo: varchar,
    fecha_hora_generado: timestamp
  }
