import { useTranslation } from 'react-i18next';

type FaseClave = 'entendimiento' | 'sesiones' | 'presentacion_final';

interface Props {
  fase: 1 | 2 | 3;
  clave: FaseClave;
  /** HU-23: el grupo está finalizado: la fase indicada está cumplida (verde, no azul). */
  completada?: boolean;
  /** `compact`: solo barra + una línea de texto (tarjetas de listado). */
  compact?: boolean;
}

const PASOS: { n: 1 | 2 | 3; clave: FaseClave }[] = [
  { n: 1, clave: 'entendimiento' },
  { n: 2, clave: 'sesiones' },
  { n: 3, clave: 'presentacion_final' },
];

/** Fase pedagógica del programa (HU-02). Es de dominio, no una primitiva de ui/. */
export function ProgramaFaseStepper({ fase, clave, completada = false, compact = false }: Props) {
  const { t } = useTranslation('programa');
  const estadoDe = (n: number) => (n === fase ? (completada ? 'pasada' : 'activa') : n < fase ? 'pasada' : 'futura');
  if (compact) {
    return (
      <div className="fase-compact" aria-label={t('fase.label')}>
        <ol className="fase-bar">
          {PASOS.map((p) => (
            <li
              key={p.n}
              className={`fase-seg${estadoDe(p.n) === 'activa' ? ' fase-seg--activa' : estadoDe(p.n) === 'pasada' ? ' fase-seg--pasada' : ''}`}
              aria-current={estadoDe(p.n) === 'activa' ? 'step' : undefined}
            />
          ))}
        </ol>
        <span className="fase-compact-texto">
          {t('fase.paso', { n: fase })} · {t(`fase.${clave}`)}
        </span>
      </div>
    );
  }
  return (
    <nav aria-label={t('fase.label')} className="fase-stepper-wrap">
      <ol className="fase-stepper">
        {PASOS.map((p) => {
          const estado = estadoDe(p.n);
          return (
            <li
              key={p.n}
              className={`fase-step${estado === 'activa' ? ' fase-step--activa' : estado === 'pasada' ? ' fase-step--pasada' : ''}`}
              aria-current={estado === 'activa' ? 'step' : undefined}
            >
              <span className="fase-step-n">{t('fase.paso', { n: p.n })}</span>
              <span className="fase-step-nombre">{t(`fase.${p.clave}`)}</span>
            </li>
          );
        })}
      </ol>
      <p className="fase-stepper-desc">{t(`fase.${clave}_desc`)}</p>
    </nav>
  );
}
