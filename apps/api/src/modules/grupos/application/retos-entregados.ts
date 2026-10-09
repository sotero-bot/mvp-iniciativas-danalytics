/**
 * HU-03: retos entregados por grupo. RN-07: el estudiante ve el ESTADO de entrega de los demás
 * grupos, nunca su trabajo; el facilitador ve además el enlace y si hay archivo. Un shaper
 * explícito por rol (en vez de `if` dispersos) para que un campo no se escape entre grupos.
 * `archivoKey` NO sale nunca: solo se expone `conArchivo`.
 */
import type { Prisma } from '@prisma/client';

/** Fragmento de `select` de Grupo que necesitan los shapers. `miembros` filtra al propio actor. */
export function retosGrupoSelect(usuarioId: string) {
  return {
    id: true,
    nombre: true,
    orden: true,
    _count: { select: { miembros: true } },
    miembros: { where: { usuarioId }, select: { id: true } },
    presentacionFinal: { select: { entregadoEn: true, urlPresentacion: true, archivoKey: true } },
  } satisfies Prisma.GrupoSelect;
}

export interface GrupoParaRetos {
  id: string;
  nombre: string;
  _count: { miembros: number };
  miembros?: { id: string }[];
  presentacionFinal: {
    entregadoEn: Date | null;
    urlPresentacion: string | null;
    archivoKey: string | null;
  } | null;
}

interface RetoGrupoBase {
  id: string;
  nombre: string;
  miembros: number;
  entregada: boolean;
  entregadoEn: Date | null;
  esMiGrupo: boolean;
}

export interface RetoGrupoEstudiante extends RetoGrupoBase {}
export interface RetoGrupoFacilitador extends RetoGrupoBase {
  urlPresentacion: string | null;
  conArchivo: boolean;
}

function base(g: GrupoParaRetos, esMiGrupo: boolean): RetoGrupoBase {
  return {
    id: g.id,
    nombre: g.nombre,
    miembros: g._count.miembros,
    entregada: g.presentacionFinal != null,
    entregadoEn: g.presentacionFinal?.entregadoEn ?? null,
    esMiGrupo,
  };
}

// Whitelist: se construye campo a campo, jamás con spread del grupo de BD.
export function retoGrupoParaEstudiante(g: GrupoParaRetos): RetoGrupoEstudiante {
  return base(g, (g.miembros?.length ?? 0) > 0);
}

export function retoGrupoParaFacilitador(g: GrupoParaRetos): RetoGrupoFacilitador {
  return {
    ...base(g, false),
    urlPresentacion: g.presentacionFinal?.urlPresentacion ?? null,
    conArchivo: !!g.presentacionFinal?.archivoKey,
  };
}

function conteo<T>(grupos: GrupoParaRetos[], shape: (g: GrupoParaRetos) => T) {
  return {
    totalGrupos: grupos.length,
    entregados: grupos.filter((g) => g.presentacionFinal != null).length,
    grupos: grupos.map(shape),
  };
}

export const retosParaEstudiante = (grupos: GrupoParaRetos[]) => conteo(grupos, retoGrupoParaEstudiante);
export const retosParaFacilitador = (grupos: GrupoParaRetos[]) => conteo(grupos, retoGrupoParaFacilitador);
