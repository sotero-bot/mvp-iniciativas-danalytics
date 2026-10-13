import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Breadcrumb, PageHeader, Loading, EmptyState, StatusBadge, DataTable, ProgressBar } from '../../components/ui';
import type { StatusVariant, DataTableColumn } from '../../components/ui';
import { formatFechaHora } from '../../shared/formatDate';
import { toast } from '../../components/toast-store';
import { ProgramaFaseStepper } from '../../components/ProgramaFaseStepper';
import { GrupoIntegrantes } from './GrupoIntegrantes';
import { GrupoRecursosEstado } from './GrupoRecursosEstado';
import type { MiGrupo } from './GrupoRecursosEstado';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Sesion {
  id: string;
  numeroSesion: number;
  titulo: string;
  fechaProgramada: string;
  urlPresentacion: string | null;
  presentacionArchivoUrl: string | null;
  urlGrabacion: string | null;
  facilitadores: { id: string; nombre: string }[];
  timezone: string;
  bloqueada: boolean;
  desbloqueaEn: string;
}

interface Docente {
  id: string;
  nombre: string;
  // Usuario.email es nullable en BD.
  email: string | null;
}

// HU-03 (RN-07): el estudiante ve solo el ESTADO de entrega; el servidor no manda enlaces.
interface RetoGrupo {
  id: string;
  nombre: string;
  miembros: number;
  entregada: boolean;
  entregadoEn: string | null;
  esMiGrupo: boolean;
}

interface ProgramaResumen {
  nombre: string;
  retos: { totalGrupos: number; entregados: number; grupos: RetoGrupo[] };
  timezone: string;
  facilitadores: Docente[];
  sesionesTotal: number;
  sesionesRealizadas: number;
}

interface FormularioDisponible {
  id: string;
  programaId: string | null;
  programa: { id: string; nombre: string } | null;
  tipoFormulario: string;
  nombre: string;
  descripcion: string | null;
  estado: 'pendiente' | 'en_progreso' | 'enviado';
  enviadoEn: string | null;
  // HU-13: sesiones del programa a las que está ligado (N:M).
  sesiones: { numeroSesion: number; titulo: string }[];
}

interface FasePrograma {
  fase: 1 | 2 | 3;
  clave: 'entendimiento' | 'sesiones' | 'presentacion_final';
  completada?: true;
}

const ESTADO_VARIANT: Record<string, StatusVariant> = {
  pendiente: 'warning',
  en_progreso: 'info',
  enviado: 'success',
};

// Vista única del programa para el estudiante: engloba la encuesta de inicio
// (global, gate), su grupo con los recursos del reto, los formularios del
// programa y las sesiones. Si la encuesta de inicio (diagnóstico global) no está
// enviada, aparece de primera y el resto queda bloqueado hasta completarla.
export function EstudianteSesionesPage({ userId }: { userId: string }) {
  const { id: programaId = '' } = useParams();
  const { t, i18n } = useTranslation(['estudiante', 'formularios', 'common', 'admin']);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [formularios, setFormularios] = useState<FormularioDisponible[]>([]);
  const [grupos, setGrupos] = useState<MiGrupo[]>([]);
  const [fase, setFase] = useState<FasePrograma | null>(null);
  const [resumenPrograma, setResumenPrograma] = useState<ProgramaResumen | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchWithErrorMapping(`${API_URL}/programas/${programaId}/sesiones`).then((r) => r.json()),
      fetchWithErrorMapping(`${API_URL}/formularios/disponibles`).then((r) => r.json()),
      fetchWithErrorMapping(`${API_URL}/grupos/mios`).then((r) => r.json()),
      // La fase del estudiante sale de /estudiante/resumen (considera la entrega de SU grupo).
      fetchWithErrorMapping(`${API_URL}/estudiante/resumen`).then((r) => r.json()),
      // HU-12: el nombre del programa llega resuelto del servidor, no se deduce por rebote.
      fetchWithErrorMapping(`${API_URL}/programas/${programaId}/resumen`).then((r) => r.json()),
    ])
      .then(([ses, forms, grps, resumen, prog]: [Sesion[], FormularioDisponible[], MiGrupo[], { programas: { id: string; fase: FasePrograma }[] }, ProgramaResumen]) => {
        if (cancelled) return;
        setResumenPrograma(prog);
        setFase(resumen.programas.find((p) => p.id === programaId)?.fase ?? null);
        setSesiones(ses);
        setFormularios(forms);
        setGrupos(grps);
      })
      .catch((err) => { if (!cancelled) toast.error(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [programaId]);

  // Encuesta de inicio: diagnóstico inicial GLOBAL (programaId=null). Es el gate.
  const encuestaInicio = formularios.find(
    (f) => f.programaId === null && f.tipoFormulario === 'diagnostico_inicial',
  );
  const gateActivo = !!encuestaInicio && encuestaInicio.estado !== 'enviado';

  const misGrupos = grupos.filter((g) => g.programa.id === programaId);
  // Formularios propios del programa (feedback, diagnóstico final). El diagnóstico
  // inicial se excluye: es la encuesta de inicio GLOBAL que ya vive en el gate, no
  // un formulario del programa.
  const formulariosPrograma = formularios.filter(
    (f) => f.programaId === programaId && f.tipoFormulario !== 'diagnostico_inicial',
  );
  const programaNombre =
    resumenPrograma?.nombre ??
    formulariosPrograma[0]?.programa?.nombre ??
    misGrupos[0]?.programa.nombre ??
    t('estudiante:sesiones.title');

  const from = `/estudiante/programas/${programaId}/sesiones`;

  const docenteColumns: DataTableColumn<Docente>[] = [
    { key: 'nombre', header: t('estudiante:programa.docente_nombre'), render: (d) => d.nombre, align: 'left', width: '280px' },
    {
      key: 'correo',
      header: t('estudiante:programa.docente_correo'),
      align: 'left',
      // Texto plano (sin mailto:); sin correo, texto de respaldo.
      render: (d) => (d.email
        ?? <span style={{ color: 'var(--color-text-tertiary)' }}>{t('estudiante:programa.sin_correo')}</span>),
    },
  ];

  const retoColumns: DataTableColumn<RetoGrupo>[] = [
    {
      key: 'grupo',
      header: t('estudiante:programa.retos_col_grupo'),
      align: 'left',
      render: (g) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {g.nombre}
          {g.esMiGrupo && <StatusBadge variant="info">{t('estudiante:programa.mi_grupo')}</StatusBadge>}
        </span>
      ),
    },
    { key: 'integrantes', header: t('estudiante:programa.retos_col_integrantes'), align: 'left', render: (g) => g.miembros },
    {
      key: 'estado',
      header: t('estudiante:programa.retos_col_estado'),
      align: 'left',
      render: (g) => (
        <StatusBadge variant={g.entregada ? 'success' : 'warning'}>
          {g.entregada ? t('estudiante:programa.reto_entregado') : t('estudiante:programa.reto_pendiente')}
        </StatusBadge>
      ),
    },
    {
      key: 'fecha',
      header: t('estudiante:programa.retos_col_fecha'),
      align: 'left',
      render: (g) => (g.entregadoEn ? formatFechaHora(g.entregadoEn, resumenPrograma?.timezone ?? 'UTC', i18n.language) : '—'),
    },
  ];

  return (
    <div>
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/inicio' },
          { label: t('estudiante:programas.title'), to: '/estudiante/programas' },
          { label: programaNombre },
        ]}
      />
      <PageHeader eyebrow={t('estudiante:programas.title')} title={programaNombre} />
      {loading && <Loading label={t('common:loading')} />}

      {!loading && encuestaInicio && (
        <EncuestaInicioCard encuesta={encuestaInicio} gateActivo={gateActivo} from={from} />
      )}

      {/* Fuera del contenedor atenuado por gateActivo: saber en qué fase estás no se bloquea. */}
      {!loading && fase && <ProgramaFaseStepper fase={fase.fase} clave={fase.clave} completada={!!fase.completada} />}

      {/* HU-12: contacto de los docentes. Fuera del contenedor atenuado: poder escribirles
          no se bloquea por la encuesta de inicio. */}
      {!loading && resumenPrograma && (
        <div className="section-card home-panel" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="section-card-header">
            <span className="section-card-title">{t('estudiante:programa.docentes_title')}</span>
            <span className="count-badge">{resumenPrograma.facilitadores.length}</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.85rem' }}>
              {t('estudiante:programa.sesiones_avance', {
                hechas: resumenPrograma.sesionesRealizadas,
                total: resumenPrograma.sesionesTotal,
              })}
            </span>
          </div>
          <div className="section-card-body">
            {resumenPrograma.facilitadores.length === 0 ? (
              <EmptyState title={t('estudiante:programa.docentes_empty')} />
            ) : (
              <DataTable columns={docenteColumns} rows={resumenPrograma.facilitadores} rowKey={(d) => d.id} />
            )}
          </div>
        </div>
      )}

      {/* HU-03: contador de retos entregados. Sin enlaces a presentaciones ajenas (RN-07). */}
      {!loading && resumenPrograma && (
        <div className="section-card home-panel" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="section-card-header">
            <span className="section-card-title">{t('estudiante:programa.retos_title')}</span>
            <span className="count-badge">{resumenPrograma.retos.entregados}</span>
          </div>
          <div className="section-card-body">
            {resumenPrograma.retos.totalGrupos === 0 ? (
              <EmptyState title={t('estudiante:programa.retos_empty')} />
            ) : (
              <>
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div style={{ fontSize: '0.85rem', marginBottom: 'var(--space-2)' }}>
                    {t('estudiante:programa.retos_progreso', {
                      entregados: resumenPrograma.retos.entregados,
                      total: resumenPrograma.retos.totalGrupos,
                    })}
                  </div>
                  <ProgressBar
                    value={(resumenPrograma.retos.entregados / resumenPrograma.retos.totalGrupos) * 100}
                    label={t('estudiante:programa.retos_title')}
                  />
                </div>
                <DataTable columns={retoColumns} rows={resumenPrograma.retos.grupos} rowKey={(g) => g.id} />
              </>
            )}
          </div>
        </div>
      )}

      {!loading && (
        <div
          aria-hidden={gateActivo}
          style={{
            opacity: gateActivo ? 0.45 : 1,
            pointerEvents: gateActivo ? 'none' : 'auto',
            filter: gateActivo ? 'grayscale(0.4)' : 'none',
            userSelect: gateActivo ? 'none' : 'auto',
          }}
        >
          <div className="home-stack">
            {/* Sesiones */}
            <div className="section-card home-panel">
              <div className="section-card-header">
                <span className="section-card-title">{t('estudiante:programa.sesiones_title')}</span>
                <span className="count-badge">{sesiones.length}</span>
              </div>
              <div className="section-card-body">
                {sesiones.length === 0 ? (
                  <EmptyState title={t('estudiante:sesiones.empty')} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {sesiones.map((s) => (
                      <SesionCard
                        key={s.id}
                        sesion={s}
                        lang={i18n.language}
                        t={t}
                        formularios={formulariosPrograma.filter((f) => f.sesiones.some((x) => x.numeroSesion === s.numeroSesion))}
                        from={from}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Mi grupo (incluye bitácora, plantilla y presentación del reto) */}
            <div className="section-card home-panel">
              <div className="section-card-header">
                <span className="section-card-title">{t('estudiante:programa.grupo_title')}</span>
                <span className="count-badge">{misGrupos.length}</span>
              </div>
              <div className="section-card-body">
                {misGrupos.length === 0 ? (
                  <EmptyState title={t('estudiante:programa.sin_grupo')} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {misGrupos.map((g) => (
                      <GrupoCard key={g.id} grupo={g} from={from} userId={userId} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Formularios propios del programa (feedback / diagnóstico final).
                Se oculta por completo si no hay ninguno. */}
            {formulariosPrograma.length > 0 && (
              <div className="section-card home-panel">
                <div className="section-card-header">
                  <span className="section-card-title">{t('estudiante:programa.formularios_title')}</span>
                  <span className="count-badge">{formulariosPrograma.length}</span>
                </div>
                <div className="section-card-body">
                  <div className="card-grid">
                    {formulariosPrograma.map((f) => (
                      <FormularioCard key={f.id} formulario={f} from={from} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Gate: encuesta de inicio global. Si está pendiente/en progreso se resalta y
// bloquea el resto; si ya está enviada se muestra como completada (discreta).
function EncuestaInicioCard({
  encuesta,
  gateActivo,
  from,
}: {
  encuesta: FormularioDisponible;
  gateActivo: boolean;
  from: string;
}) {
  const { t } = useTranslation(['estudiante', 'formularios']);

  if (!gateActivo) {
    return (
      <div
        className="card"
        style={{
          padding: 'var(--space-3) var(--space-4)',
          marginBottom: 'var(--space-4)',
          borderLeft: '4px solid var(--color-success)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <span>✅</span>
        <span style={{ fontSize: '0.9rem' }}>{t('estudiante:programa.encuesta_inicio_hecha')}</span>
      </div>
    );
  }

  return (
    <div
      className="card"
      style={{
        padding: 'var(--space-5)',
        marginBottom: 'var(--space-5)',
        borderLeft: '4px solid var(--color-warning)',
      }}
    >
      <div className="eyebrow">{t('formularios:tipos.diagnostico_inicial')}</div>
      <div style={{ fontWeight: 600, fontSize: '1.1rem', margin: 'var(--space-1) 0 var(--space-2)' }}>
        {t('estudiante:programa.encuesta_inicio_title')}
      </div>
      <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
        {t('estudiante:programa.encuesta_inicio_desc')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" to={`/estudiante/formularios/${encuesta.id}?from=${encodeURIComponent(from)}`}>
          {encuesta.estado === 'en_progreso'
            ? t('formularios:estudiante.continuar')
            : t('formularios:estudiante.responder')}
        </Link>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          🔒 {t('estudiante:programa.encuesta_inicio_gate')}
        </span>
      </div>
    </div>
  );
}

function GrupoCard({ grupo: g, from, userId }: { grupo: MiGrupo; from: string; userId: string }) {
  const { t } = useTranslation(['formularios']);

  return (
    <div className="card" style={{ padding: 'var(--space-5)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {g.nombre}
          {/* HU-23: el revisor finalizó el grupo; sus recursos quedan de solo lectura. */}
          {g.finalizado && <StatusBadge variant="success">{t('formularios:grupo.finalizado')}</StatusBadge>}
        </div>
      </div>

      {/* HU-11: integrantes con su correo, directamente en la tarjeta del grupo. */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <GrupoIntegrantes miembros={g.miembros} userId={userId} />
      </div>

      <GrupoRecursosEstado grupo={g} from={from} />
    </div>
  );
}

function FormularioCard({ formulario: f, from }: { formulario: FormularioDisponible; from: string }) {
  const { t } = useTranslation(['formularios', 'estudiante']);
  return (
    <div className="card" style={{ padding: 'var(--space-4)' }}>
      <div className="eyebrow">{t(`formularios:tipos.${f.tipoFormulario}`)}</div>
      <div style={{ fontWeight: 600, margin: 'var(--space-1) 0 var(--space-3)' }}>{f.nombre}</div>
      {f.sesiones.length > 0 && (
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-3)' }}>
          {t('estudiante:pendientes.de_sesion', {
            count: f.sesiones.length,
            lista: f.sesiones.map((x) => x.numeroSesion).join(', '),
          })}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <StatusBadge variant={ESTADO_VARIANT[f.estado] ?? 'neutral'}>
          {t(`formularios:estudiante.estado.${f.estado}`)}
        </StatusBadge>
        <Link className="btn" to={`/estudiante/formularios/${f.id}?from=${encodeURIComponent(from)}`}>
          {f.estado === 'pendiente'
            ? t('formularios:estudiante.responder')
            : f.estado === 'en_progreso'
              ? t('formularios:estudiante.continuar')
              : t('formularios:estudiante.ver_estado')}
        </Link>
      </div>
    </div>
  );
}

function SesionCard({
  sesion: s,
  lang,
  t,
  formularios,
  from,
}: {
  sesion: Sesion;
  lang: string;
  t: ReturnType<typeof useTranslation>['t'];
  formularios: FormularioDisponible[];
  from: string;
}) {
  return (
    <div className="card" style={{ padding: 'var(--space-4)', opacity: s.bloqueada ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ fontWeight: 600 }}>
            {t('estudiante:sesiones.numero', { numero: s.numeroSesion })} — {s.titulo}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            {formatFechaHora(s.fechaProgramada, s.timezone, lang)}
          </div>
          {s.facilitadores.length > 0 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
              {t('estudiante:sesiones.facilitador')}: {s.facilitadores.map((f) => f.nombre).join(', ')}
            </div>
          )}
        </div>
        {s.bloqueada ? (
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            🔒 {t('estudiante:sesiones.se_desbloquea', {
              fecha: formatFechaHora(s.desbloqueaEn, s.timezone, lang),
            })}
          </span>
        ) : s.urlPresentacion || s.presentacionArchivoUrl || s.urlGrabacion ? (
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {/* Prioridad: si hay archivo subido se ofrece la descarga; si no, el enlace. */}
            {s.presentacionArchivoUrl ? (
              <a className="btn" href={s.presentacionArchivoUrl} target="_blank" rel="noreferrer">
                📎 {t('estudiante:sesiones.presentacion_archivo')}
              </a>
            ) : s.urlPresentacion ? (
              <a className="btn" href={s.urlPresentacion} target="_blank" rel="noreferrer">
                🖥️ {t('estudiante:sesiones.presentacion')}
              </a>
            ) : null}
            {s.urlGrabacion && (
              <a className="btn" href={s.urlGrabacion} target="_blank" rel="noreferrer">
                🎥 {t('estudiante:sesiones.grabacion')}
              </a>
            )}
          </div>
        ) : (
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            {t('estudiante:sesiones.sin_recursos')}
          </span>
        )}
      </div>
      {/* HU-13: formularios que el estudiante responde tras esta sesión. */}
      {formularios.length > 0 && (
        <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
          <div className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>{t('estudiante:sesiones.formularios_sesion')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {formularios.map((f) => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.9rem' }}>{f.nombre}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <StatusBadge variant={ESTADO_VARIANT[f.estado] ?? 'neutral'}>
                    {t(`formularios:estudiante.estado.${f.estado}`)}
                  </StatusBadge>
                  <Link className="btn" to={`/estudiante/formularios/${f.id}?from=${encodeURIComponent(from)}`}>
                    {f.estado === 'pendiente'
                      ? t('formularios:estudiante.responder')
                      : f.estado === 'en_progreso'
                        ? t('formularios:estudiante.continuar')
                        : t('formularios:estudiante.ver_estado')}
                  </Link>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
