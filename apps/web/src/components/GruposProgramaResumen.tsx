import { useTranslation } from 'react-i18next';
import { desglosarResumen } from '../features/facilitador/revisionGrupos';
import type { GruposResumen } from '../features/facilitador/revisionGrupos';

/** Siempre renderiza la misma estructura (también con 0 grupos) para que las tarjetas de una fila
 *  queden alineadas. Mini-sección "Grupos" de la tarjeta del programa (HU-23): barra segmentada por estado
 *  + leyenda con el significado y la cantidad de cada uno. De dominio, no una primitiva de ui/. */
export function GruposProgramaResumen({ resumen }: { resumen: GruposResumen }) {
  const { t } = useTranslation('facilitador');
  const d = desglosarResumen(resumen);

  const filas = [
    { clave: 'finalizados', n: d.finalizados, mod: 'finalizado' },
    { clave: 'listos', n: d.listos, mod: 'listo' },
    { clave: 'en_curso', n: d.enCurso, mod: 'en-curso' },
  ] as const;

  return (
    <div className="grupos-resumen">
      <div className="grupos-resumen-cabecera">
        <span className="grupos-resumen-titulo">{t('programas.grupos_resumen.titulo')}</span>
        <span className="grupos-resumen-progreso">
          {d.total === 0
            ? t('programas.grupos_resumen.ninguno')
            : t('programas.grupos_resumen.progreso', { finalizados: d.finalizados, total: d.total })}
        </span>
      </div>
      <div
        className="grupos-resumen-barra"
        role="img"
        aria-label={filas.map((f) => `${f.n} ${t(`programas.grupos_resumen.${f.clave}`)}`).join(', ')}
      >
        {d.total === 0 ? (
          <span className="grupos-resumen-seg grupos-resumen-seg--en-curso" style={{ flexGrow: 1 }} />
        ) : (
          filas.filter((f) => f.n > 0).map((f) => (
            <span key={f.clave} className={`grupos-resumen-seg grupos-resumen-seg--${f.mod}`} style={{ flexGrow: f.n }} />
          ))
        )}
      </div>
      <ul className="grupos-resumen-leyenda">
        {filas.map((f) => (
          <li key={f.clave} className={f.n === 0 ? 'grupos-resumen-fila grupos-resumen-fila--cero' : 'grupos-resumen-fila'}>
            <span className={`grupos-resumen-punto grupos-resumen-seg--${f.mod}`} aria-hidden="true" />
            <span className="grupos-resumen-etiqueta">{t(`programas.grupos_resumen.${f.clave}`)}</span>
            <span className="grupos-resumen-n">{f.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
