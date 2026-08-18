export type EstadoPrograma = 'borrador' | 'activo' | 'finalizado' | 'cancelado';

export interface EmpresaLite { id: string; nombre: string; }
export interface FacilitadorLite { id: string; nombre: string; email: string | null; }

export interface Programa {
  id: string;
  nombre: string;
  descripcion: string | null;
  empresaId: string;
  estado: EstadoPrograma;
  timezone: string;
  diasGracia: number;
  totalSesionesEsperadas: number | null; // RF-01
  presentacionDesdeSesion: number | null; // RF-32
  fechaInicio: string | null;
  fechaFin: string | null;
  activo: boolean;
  bitacoraHabilitadaEn: string | null; // O-01
  createdAt: string;
  updatedAt: string;
  empresa: { id: string; nombre: string } | null;
  // C-01: N:M — un programa puede tener varios facilitadores.
  facilitadores: { id: string; nombre: string; email: string | null }[];
  _count: { sesiones: number; participantes: number };
}

export interface TraduccionCampos {
  nombre: string;
  descripcion: string;
}

export interface PlantillaGlobalLite {
  id: string;
  tipoFormulario: string;
  nombre: string;
  version: number;
  activa: boolean;
}

// Tipos de formulario que se congelan en el snapshot del programa (RF-46), en orden.
export const TIPOS_SNAPSHOT = ['diagnostico_inicial', 'diagnostico_final', 'feedback', 'bitacora', 'plantilla_proyecto'];

export interface FormState {
  nombre: string;
  descripcion: string;
  empresaId: string;
  facilitadorIds: string[];
  estado: EstadoPrograma;
  timezone: string;
  diasGracia: number;
  totalSesionesEsperadas: string; // RF-01 ('' = sin definir)
  presentacionDesdeSesion: string; // RF-32 ('' = sin gate de sesión)
  fechaInicio: string;
  fechaFin: string;
  traduccionesPt: TraduccionCampos;
  // RF-46: plantilla global elegida por tipo (''=ninguna). Solo aplica al crear.
  plantillaSeleccion: Record<string, string>;
}

export interface Sesion {
  id: string;
  programaId: string;
  numeroSesion: number;
  titulo: string;
  descripcion: string | null;
  fechaProgramada: string;
  materialArchivoKey: string | null;
  urlPresentacion: string | null;
  presentacionArchivoKey: string | null;
  urlGrabacion: string | null;
  materialDesbloqueoEn: string | null;
  estado: 'pendiente' | 'completada';
}

export interface GrupoMiembro {
  id: string;
  usuarioId: string;
  usuario: { id: string; nombre: string; email: string | null };
}

export interface Grupo {
  id: string;
  programaId: string;
  nombre: string;
  orden: number;
  miembros: GrupoMiembro[];
}
