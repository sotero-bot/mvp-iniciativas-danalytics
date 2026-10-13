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

// HU-04: lo que el estudiante debe completar para avanzar (encuesta de inicio y confirmación de
// matrícula). Es solo señal visual: el servidor no lo hace cumplir.
export function esBloqueante(p: Pendiente): boolean {
  return p.tipo === 'encuesta_inicio' || p.tipo === 'matricula';
}

const ORDEN_TIPO: Record<PendienteTipo, number> = {
  encuesta_inicio: 0,
  matricula: 1,
  entregable: 2,
  formulario: 3,
};

// Sesión más temprana del pendiente; sin sesión → al final de su grupo.
const primeraSesion = (p: Pendiente): number =>
  p.sesiones.length === 0 ? Infinity : Math.min(...p.sesiones.map((s) => s.numeroSesion));

// HU-04: encuesta_inicio → matricula → entregable → formulario; dentro de cada tipo, por la sesión
// más temprana (hoy solo los formularios tienen sesiones). Copia estable: no muta la entrada.
export function ordenarPendientes(items: Pendiente[]): Pendiente[] {
  return items
    .map((p, i) => ({ p, i }))
    .sort(
      (a, b) =>
        ORDEN_TIPO[a.p.tipo] - ORDEN_TIPO[b.p.tipo] ||
        (primeraSesion(a.p) === primeraSesion(b.p) ? 0 : primeraSesion(a.p) < primeraSesion(b.p) ? -1 : 1) ||
        a.i - b.i,
    )
    .map(({ p }) => p);
}

// Destino de "Ver todos": con un solo programa, su vista de pendientes; con varios (o ninguno),
// el listado de programas.
export function destinoVerTodos(programas: { id: string }[]): string {
  return programas.length === 1
    ? `/estudiante/programas/${programas[0].id}/pendientes`
    : '/estudiante/programas';
}

// Argumentos de i18n para decir de qué sesión(es) es un pendiente (null si no tiene).
export function etiquetaSesiones(p: Pendiente): { count: number; lista: string } | null {
  if (p.sesiones.length === 0) return null;
  const numeros = p.sesiones.map((s) => s.numeroSesion).sort((a, b) => a - b);
  return { count: numeros.length, lista: numeros.join(', ') };
}
