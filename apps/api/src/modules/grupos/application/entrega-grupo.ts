/**
 * HU-23: "entregó todo en la fase 3" = presentación final entregada + bitácora y plantilla del
 * proyecto con respuesta. Es la condición para finalizar un grupo y para que cuente como
 * "listo para revisar". Función pura: la consulta la hace quien la llama con `ENTREGA_SELECT`.
 */
import type { Prisma } from '@prisma/client';

/** Fragmento de `select` de Grupo que necesita `entregaCompleta`. */
export const ENTREGA_SELECT = {
  presentacionFinal: { select: { entregadoEn: true } },
  respuestasFormulario: {
    where: { plantilla: { is: { tipoFormulario: { in: ['bitacora', 'plantilla_proyecto'] }, activa: true } } },
    select: { plantilla: { select: { tipoFormulario: true } } },
  },
} satisfies Prisma.GrupoSelect;

export interface GrupoParaEntrega {
  presentacionFinal?: { entregadoEn?: Date | null } | null;
  respuestasFormulario?: { plantilla: { tipoFormulario: string } }[];
}

export function faltanteEntrega(g: GrupoParaEntrega) {
  const tipos = new Set((g.respuestasFormulario ?? []).map((r) => r.plantilla.tipoFormulario));
  return {
    presentacion: !g.presentacionFinal?.entregadoEn,
    bitacora: !tipos.has('bitacora'),
    plantillaProyecto: !tipos.has('plantilla_proyecto'),
  };
}

export function entregaCompleta(g: GrupoParaEntrega): boolean {
  const f = faltanteEntrega(g);
  return !f.presentacion && !f.bitacora && !f.plantillaProyecto;
}
