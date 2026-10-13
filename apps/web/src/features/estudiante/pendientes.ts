// Pendientes del estudiante: tipos y destino de cada uno. Compartido por el inicio
// (EstudianteHome) y la vista por sesión (PendientesPage) para que los destinos no se
// desincronicen cuando se añada un tipo de pendiente (HU-13).

export type PendienteTipo = 'encuesta_inicio' | 'matricula' | 'entregable' | 'formulario';

export interface PendienteSesion {
  numeroSesion: number;
  titulo: string;
  fechaProgramada: string;
}

export interface Pendiente {
  tipo: PendienteTipo;
  plantillaId: string | null;
  programaId: string | null;
  programaNombre: string | null;
  nombre: string | null;
  // N:M: sesiones del programa a las que está ligado el formulario (vacío = ninguna).
  sesiones: PendienteSesion[];
}

export interface PendientesAgrupados {
  total: number;
  porSesion: (PendienteSesion & { realizada: boolean; items: Pendiente[] })[];
  generales: Pendiente[];
}

const HOME = '/inicio';

// Destino de cada pendiente según su tipo. Cada uno enlaza a su acción real
// (el formulario concreto, la confirmación del programa, el reto del grupo),
// no a un listado genérico.
export function pendienteTo(p: Pendiente): string {
  switch (p.tipo) {
    case 'encuesta_inicio':
      return `/estudiante/formularios/${p.plantillaId}?from=${encodeURIComponent(HOME)}`;
    case 'formulario': {
      const from = `/estudiante/programas/${p.programaId}/sesiones`;
      return `/estudiante/formularios/${p.plantillaId}?from=${encodeURIComponent(from)}`;
    }
    case 'entregable':
      return `/estudiante/programas/${p.programaId}/sesiones`;
    case 'matricula':
      return '/estudiante/programas';
  }
}

// Argumentos de i18n para decir de qué sesión(es) es un pendiente (null si no tiene).
export function etiquetaSesiones(p: Pendiente): { count: number; lista: string } | null {
  if (p.sesiones.length === 0) return null;
  const numeros = p.sesiones.map((s) => s.numeroSesion).sort((a, b) => a - b);
  return { count: numeros.length, lista: numeros.join(', ') };
}
