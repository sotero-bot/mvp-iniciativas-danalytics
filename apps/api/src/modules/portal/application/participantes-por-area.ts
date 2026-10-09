// HU-14: participantes de un programa agregados por área del catálogo.

export interface ParticipantesPorArea {
  /** `null` = participantes sin área (el frontend lo traduce como "Sin área"). */
  areaId: string | null;
  nombre: string | null;
  participantes: number;
}

export function contarParticipantesPorArea(
  participantes: { usuario: { areaCatalogo: { id: string; nombre: string } | null } }[],
): ParticipantesPorArea[] {
  const porArea = new Map<string, ParticipantesPorArea>();
  let sinArea = 0;
  for (const { usuario } of participantes) {
    const area = usuario.areaCatalogo;
    if (!area) {
      sinArea++;
      continue;
    }
    const fila = porArea.get(area.id) ?? { areaId: area.id, nombre: area.nombre, participantes: 0 };
    fila.participantes++;
    porArea.set(area.id, fila);
  }
  const filas = [...porArea.values()].sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
  if (sinArea > 0) filas.push({ areaId: null, nombre: null, participantes: sinArea });
  return filas;
}
