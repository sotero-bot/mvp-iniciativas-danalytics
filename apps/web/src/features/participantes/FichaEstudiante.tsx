import { useTranslation } from 'react-i18next';

import { DataTable, ProgressBar, StatusBadge } from '../../components/ui';
import type { DataTableColumn, StatusVariant } from '../../components/ui';
import { ProgramaFaseStepper } from '../../components/ProgramaFaseStepper';

// HU-16. RN-06/RN-07: la ficha solo trae ESTADO de los formularios (nunca contenido ni scores,
// y sin feedback) y el entregable del reto únicamente para `variant="facilitador"`.

type EstadoFormulario = 'pendiente' | 'borrador' | 'enviado';
type EstadoReto = 'sin_grupo' | 'bloqueado' | 'sin_iniciar' | 'en_progreso' | 'entregado' | 'finalizado';

export interface FichaEstudianteData {
  usuario: { id: string; nombre: string; email: string | null; cargo: string | null; area: { id: string; nombre: string } | null };
  programa: { id: string; nombre: string; fase: { fase: 1 | 2 | 3; clave: 'entendimiento' | 'sesiones' | 'presentacion_final'; completada?: true } };
  matricula: { activo: boolean; confirmadoEn: string | null };
  asistencia: {
    sesiones: { numeroSesion: number; titulo: string; fechaProgramada: string; presente: boolean | null }[];
    presentes: number;
    total: number;
    porcentaje: number | null;
  };
  formularios: {
    plantillaId: string;
    nombre: string;
    tipoFormulario: string;
    numeroSesion: number | null;
    estado: EstadoFormulario;
    enviadoEn: string | null;
  }[];
  grupo: { id: string; nombre: string; miembros: { id: string; nombre: string }[] } | null;
  reto: { estado: EstadoReto; entregadoEn: string | null; urlPresentacion?: string | null; conArchivo?: boolean };
}

interface Props {
  ficha: FichaEstudianteData;
  variant: 'facilitador' | 'cliente';
}

const FORM_VARIANT: Record<EstadoFormulario, StatusVariant> = { pendiente: 'neutral', borrador: 'warning', enviado: 'success' };
const RETO_VARIANT: Record<EstadoReto, StatusVariant> = {
  sin_grupo: 'neutral',
  bloqueado: 'neutral',
  sin_iniciar: 'warning',
  en_progreso: 'info',
  entregado: 'success',
  finalizado: 'success',
};

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

type SesionFila = FichaEstudianteData['asistencia']['sesiones'][number];
type FormularioFila = FichaEstudianteData['formularios'][number];

export function FichaEstudiante({ ficha, variant }: Props) {
  const { t } = useTranslation('participantes');
  const { usuario, matricula, asistencia, formularios, grupo, reto } = ficha;
  const pct = asistencia.porcentaje === null ? 0 : Math.round(asistencia.porcentaje * 100);

  const columnasAsistencia: DataTableColumn<SesionFila>[] = [
    { key: 'sesion', header: t('col_sesion'), render: (s) => `${t('sesion_n', { n: s.numeroSesion })} · ${s.titulo}` },
    { key: 'fecha', header: t('col_fecha'), render: (s) => fecha(s.fechaProgramada) },
    {
      key: 'estado',
      header: t('col_estado'),
      render: (s) =>
        // Tres estados: "sin registro" (null) no es lo mismo que "ausente" (false).
        s.presente === null ? (
          <StatusBadge variant="neutral">{t('asistencia_sin_registro')}</StatusBadge>
        ) : s.presente ? (
          <StatusBadge variant="success">{t('asistencia_presente')}</StatusBadge>
        ) : (
          <StatusBadge variant="danger">{t('asistencia_ausente')}</StatusBadge>
        ),
    },
  ];

  const columnasFormularios: DataTableColumn<FormularioFila>[] = [
    { key: 'nombre', header: t('col_formulario'), render: (f) => f.nombre },
    { key: 'sesion', header: t('col_sesion'), render: (f) => (f.numeroSesion === null ? '—' : t('sesion_n', { n: f.numeroSesion })) },
    {
      key: 'estado',
      header: t('col_estado'),
      render: (f) => <StatusBadge variant={FORM_VARIANT[f.estado]}>{t(`formulario_estado.${f.estado}`)}</StatusBadge>,
    },
    { key: 'fecha', header: t('col_fecha'), render: (f) => fecha(f.enviadoEn) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="section-card home-panel">
        <div className="section-card-header"><span className="section-card-title">{t('identidad_title')}</span></div>
        <div className="section-card-body">
          <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{usuario.nombre}</div>
          {usuario.email && <a href={`mailto:${usuario.email}`}>{usuario.email}</a>}
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
            {t('cargo')}: {usuario.cargo ?? '—'} · {t('area')}: {usuario.area?.nombre ?? t('sin_area')}
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <StatusBadge variant={!matricula.activo ? 'danger' : matricula.confirmadoEn ? 'success' : 'warning'}>
              {!matricula.activo ? t('matricula_inactiva') : matricula.confirmadoEn ? t('matricula_confirmada') : t('matricula_pendiente')}
            </StatusBadge>
          </div>
        </div>
      </div>

      <div className="section-card home-panel">
        <div className="section-card-header"><span className="section-card-title">{t('avance_title')}</span></div>
        <div className="section-card-body">
          <ProgramaFaseStepper fase={ficha.programa.fase.fase} clave={ficha.programa.fase.clave} completada={ficha.programa.fase.completada} />
          <div style={{ fontSize: '0.85rem', margin: 'var(--space-3) 0 var(--space-2)' }}>
            {asistencia.porcentaje === null
              ? '—'
              : t('asistencia_porcentaje', { presentes: asistencia.presentes, total: asistencia.total, pct })}
          </div>
          <ProgressBar value={pct} label={t('asistencia_title')} />
        </div>
      </div>

      <div className="section-card home-panel">
        <div className="section-card-header">
          <span className="section-card-title">{t('asistencia_title')}</span>
          <span className="count-badge">{asistencia.sesiones.length}</span>
        </div>
        <div className="section-card-body">
          <DataTable columns={columnasAsistencia} rows={asistencia.sesiones} rowKey={(s) => String(s.numeroSesion)} emptyMessage={t('asistencia_sin_registro')} />
        </div>
      </div>

      <div className="section-card home-panel">
        <div className="section-card-header">
          <span className="section-card-title">{t('formularios_title')}</span>
          <span className="count-badge">{formularios.length}</span>
        </div>
        <div className="section-card-body">
          {/* Sin enlaces al contenido de las respuestas: solo estado y fecha. */}
          <DataTable columns={columnasFormularios} rows={formularios} rowKey={(f) => f.plantillaId} emptyMessage={t('formularios_empty')} />
        </div>
      </div>

      <div className="section-card home-panel">
        <div className="section-card-header"><span className="section-card-title">{t('grupo_title')} · {t('reto_title')}</span></div>
        <div className="section-card-body">
          {grupo ? (
            <>
              <div style={{ fontWeight: 600 }}>{grupo.nombre}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                {t('companeros')}: {grupo.miembros.map((m) => m.nombre).join(', ')}
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--color-text-secondary)' }}>{t('sin_grupo')}</div>
          )}
          <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusBadge variant={RETO_VARIANT[reto.estado]}>{t(`reto_estado.${reto.estado}`)}</StatusBadge>
            {reto.entregadoEn && <span style={{ fontSize: '0.82rem' }}>{fecha(reto.entregadoEn)}</span>}
            {/* RN-07: el entregable solo se muestra al facilitador (el cliente ni lo recibe). */}
            {variant === 'facilitador' && reto.urlPresentacion && (
              <a href={reto.urlPresentacion} target="_blank" rel="noreferrer">{t('entregable_enlace')}</a>
            )}
            {variant === 'facilitador' && reto.conArchivo && <StatusBadge variant="info">{t('entregable_archivo')}</StatusBadge>}
          </div>
        </div>
      </div>
    </div>
  );
}
