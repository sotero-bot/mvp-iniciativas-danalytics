import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Breadcrumb, PageHeader, Loading, EmptyState, StatusBadge, DataTable } from '../../components/ui';
import type { StatusVariant, DataTableColumn } from '../../components/ui';
import { formatFechaHora } from '../../shared/formatDate';
import { toast } from '../../components/toast-store';
import { ProgramaFaseStepper } from '../../components/ProgramaFaseStepper';

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

interface ProgramaResumen {
  nombre: string;
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
}

interface FasePrograma {
  fase: 1 | 2 | 3;
  clave: 'entendimiento' | 'sesiones' | 'presentacion_final';
  completada?: true;
}

interface RecursoEstado {
  iniciada: boolean;
  entregada: boolean;
  ultimaEdicionEn: string | null;
}

interface MiGrupo {
  id: string;
  nombre: string;
  orden: number;
  finalizado: boolean;
  programa: { id: string; nombre: string; estado: string };
  miembros: { id: string; nombre: string }[];
  recursos: {
    bitacora: RecursoEstado & { habilitada: boolean };
    plantillaProyecto: RecursoEstado;
    presentacionFinal: { entregada: boolean; entregadoEn: string | null };
  };
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
export function EstudianteSesionesPage() {
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
                      <SesionCard key={s.id} sesion={s} lang={i18n.language} t={t} />
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
                      <GrupoCard key={g.id} grupo={g} from={from} />
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

function GrupoCard({ grupo: g, from }: { grupo: MiGrupo; from: string }) {
  const { t } = useTranslation(['formularios']);
  const fromQ = `?from=${encodeURIComponent(from)}`;

  const badge = (activo: boolean, textoActivo: string, textoInactivo: string) => (
    <StatusBadge variant={activo ? 'info' : 'neutral'}>{activo ? textoActivo : textoInactivo}</StatusBadge>
  );
  const recursoBadge = (rec: RecursoEstado) =>
    rec.entregada ? (
      <StatusBadge variant="success">{t('formularios:grupo.estado_entregado')}</StatusBadge>
    ) : (
      badge(rec.iniciada, t('formularios:grupo.estado_en_progreso'), t('formularios:grupo.estado_sin_iniciar'))
    );

  // O-01: el gate de la bitácora bloquea toda la sección del reto.
  const bloqueada = !g.recursos.bitacora.habilitada;

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
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
          {t('formularios:grupo.miembros')}: {g.miembros.map((m) => m.nombre).join(', ') || '—'}
        </div>
      </div>

      {/* O-01: la habilitación de la bitácora es el gate de TODA la sección del
          reto. Sin habilitar, los tres recursos quedan bloqueados. */}
      {!g.recursos.bitacora.habilitada && (
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
          🔒 {t('formularios:grupo.bitacora_bloqueada')}
        </div>
      )}

      {/* Recursos del reto en fila: aprovecha el ancho completo de la tarjeta. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        <RecursoTile icon="📓" titulo={t('formularios:tipos.bitacora')} bloqueada={bloqueada}>
          {recursoBadge(g.recursos.bitacora)}
          <Link className="btn" to={`/estudiante/grupos/${g.id}/bitacora${fromQ}`}>{t('formularios:grupo.abrir')}</Link>
        </RecursoTile>

        <RecursoTile icon="📐" titulo={t('formularios:tipos.plantilla_proyecto')} bloqueada={bloqueada}>
          {recursoBadge(g.recursos.plantillaProyecto)}
          <Link className="btn" to={`/estudiante/grupos/${g.id}/plantilla-proyecto${fromQ}`}>{t('formularios:grupo.abrir')}</Link>
        </RecursoTile>

        <RecursoTile icon="🎤" titulo={t('formularios:presentacion.title')} bloqueada={bloqueada}>
          {g.recursos.presentacionFinal.entregada ? (
            <StatusBadge variant="success">{t('formularios:presentacion.entregada')}</StatusBadge>
          ) : (
            badge(false, '', t('formularios:grupo.estado_sin_iniciar'))
          )}
          <Link className="btn" to={`/estudiante/grupos/${g.id}/presentacion${fromQ}`}>{t('formularios:grupo.abrir')}</Link>
        </RecursoTile>
      </div>
    </div>
  );
}

// Recuadro de un recurso del reto (bitácora / plantilla / presentación) para el
// layout horizontal: título arriba, estado + acción abajo. Cuando la sección
// está bloqueada (bitácora no habilitada) se atenúa y no permite interacción.
function RecursoTile({
  icon,
  titulo,
  bloqueada,
  children,
}: {
  icon: string;
  titulo: string;
  bloqueada?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-disabled={bloqueada}
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        opacity: bloqueada ? 0.5 : 1,
        pointerEvents: bloqueada ? 'none' : 'auto',
      }}
    >
      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{icon} {titulo}</span>
      <span style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>{children}</span>
    </div>
  );
}

function FormularioCard({ formulario: f, from }: { formulario: FormularioDisponible; from: string }) {
  const { t } = useTranslation(['formularios']);
  return (
    <div className="card" style={{ padding: 'var(--space-4)' }}>
      <div className="eyebrow">{t(`formularios:tipos.${f.tipoFormulario}`)}</div>
      <div style={{ fontWeight: 600, margin: 'var(--space-1) 0 var(--space-3)' }}>{f.nombre}</div>
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
}: {
  sesion: Sesion;
  lang: string;
  t: ReturnType<typeof useTranslation>['t'];
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
    </div>
  );
}
