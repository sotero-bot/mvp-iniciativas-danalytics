// HU-14: área a mostrar de un usuario. El catálogo manda; `area` (texto libre, deprecado)
// solo se usa de respaldo para usuarios que el backfill no pudo migrar.
export function areaDeUsuario(u: { areaCatalogo: { nombre: string } | null; area: string | null }): string {
  return u.areaCatalogo?.nombre ?? (u.area ?? '').trim();
}
