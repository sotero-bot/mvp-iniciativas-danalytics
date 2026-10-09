import { useTranslation } from 'react-i18next';
import { progresoEntrega } from '../features/facilitador/revisionGrupos';
import type { FaltanteEntrega } from '../features/facilitador/revisionGrupos';

/** Barra de 3 segmentos con los entregables de la fase 3 de un grupo (bitácora, plantilla del
 *  proyecto, presentación final) y la lista de cuáles lleva, para revisar sin entrar al grupo. */
export function GrupoEntregaProgreso({ faltante }: { faltante: FaltanteEntrega | undefined }) {
  const { t } = useTranslation('facilitador');
  const p = progresoEntrega(faltante);
  const nombre = (c: string) => t(`grupos.entregables.${c}`);

  return (
    <div className="grupo-entrega">
      <div className="grupos-resumen-cabecera">
        <span className="grupos-resumen-titulo">{t('grupos.entregables.titulo')}</span>
        <span className="grupos-resumen-progreso">{t('grupos.entregables.progreso', { hechos: p.hechos, total: p.total })}</span>
      </div>
      <div
        className="grupos-resumen-barra"
        role="img"
        aria-label={p.items.map((i) => `${nombre(i.clave)}: ${t(i.hecho ? 'grupos.entregables.entregado' : 'grupos.entregables.pendiente')}`).join(', ')}
      >
        {p.items.map((i) => (
          <span
            key={i.clave}
            className={`grupos-resumen-seg ${i.hecho ? 'grupos-resumen-seg--finalizado' : 'grupos-resumen-seg--en-curso'}`}
            style={{ flexGrow: 1 }}
          />
        ))}
      </div>
      <ul className="grupos-resumen-leyenda">
        {p.items.map((i) => (
          <li key={i.clave} className={i.hecho ? 'grupos-resumen-fila' : 'grupos-resumen-fila grupos-resumen-fila--cero'}>
            <span
              className={`grupos-resumen-punto ${i.hecho ? 'grupos-resumen-seg--finalizado' : 'grupos-resumen-seg--en-curso'}`}
              aria-hidden="true"
            />
            <span className="grupos-resumen-etiqueta">{nombre(i.clave)}</span>
            <span className="grupos-resumen-n">{t(i.hecho ? 'grupos.entregables.entregado' : 'grupos.entregables.pendiente')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
