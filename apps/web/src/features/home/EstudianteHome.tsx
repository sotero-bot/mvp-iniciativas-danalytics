import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Loading, EmptyState, StatusBadge, ProgressBar, StatCard } from '../../components/ui';
import type { StatusVariant } from '../../components/ui';
import { SidebarIcon } from '../../components/SidebarIcon';
import { formatFechaHora, formatDiasRelativos } from '../../shared/formatDate';
import { toast } from '../../components/toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type RetoEstado = 'sin_grupo' | 'bloqueado' | 'entregado' | 'en_progreso' | 'sin_iniciar';

interface ProximaSesion {
  programaId: string;
  programaNombre: string;
  numeroSesion: number;
  titulo: string;
  fechaProgramada: string;
  timezone: string;
  bloqueada: boolean;
  desbloqueaEn: string;
  tieneRecursos: boolean;
}

interface ProgramaResumen {
  id: string;
  nombre: string;
  empresa: { id: string; nombre: string } | null;
  sesionesTotal: number;
  sesionesRealizadas: number;
  grupo: { nombre: string; miembros: number } | null;
  reto: RetoEstado;
}

type PendienteTipo = 'encuesta_inicio' | 'matricula' | 'entregable' | 'formulario';

interface Pendiente {
  tipo: PendienteTipo;
  plantillaId: string | null;
  programaId: string | null;
  programaNombre: string | null;
  nombre: string | null;
}

interface Resumen {
  proximaSesion: ProximaSesion | null;
  pendientes: Pendiente[];
  programas: ProgramaResumen[];
}

const HOME = '/inicio';

// Destino de cada pendiente según su tipo. Cada uno enlaza a su acción real
// (el formulario concreto, la confirmación del programa, el reto del grupo),
// no a un listado genérico.
function pendienteTo(p: Pendiente): string {
  switch (p.tipo) {
    case 'encuesta_inicio':
      return `/estudiante/formularios/${p.plantillaId}?from=${encodeURIComponent(HOME)}`;
    case 'formulario': {
      const from = `/estudiante/programas/${p.programaId}/sesiones`;
      return `/estudiante/formularios/${p.plantillaId}?from=${encodeURIComponent(from)}`;
    }
    case 'entregable':
      return `/estudiante/programas/${p.programaId}/sesiones`;
    case 'matricula':
      return '/estudiante/programas';
  }
}

const RETO_VARIANT: Record<RetoEstado, StatusVariant> = {
  sin_grupo: 'neutral',
  bloqueado: 'neutral',
  sin_iniciar: 'warning',
  en_progreso: 'info',
  entregado: 'success',
};

// Dashboard de inicio del estudiante: KPIs, pendientes de acción, próxima sesión
// (entre todos sus programas) y resumen por programa. Todo llega pre-agregado de
// GET /estudiante/resumen para no hacer N peticiones ni calcular fechas en cliente.
export function EstudianteHome() {
  const { t, i18n } = useTranslation('estudiante', { keyPrefix: 'home' });
  const [data, setData] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/estudiante/resumen`)
      .then((r) => r.json())
      .then((res: Resumen) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) toast.error(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Loading label={t('cargando', { defaultValue: 'Cargando…' })} />;
  if (!data) return null;

  const etiquetaPendiente = (p: Pendiente): string => {
    switch (p.tipo) {
      case 'encuesta_inicio':
        return t('pendiente_encuesta');
      case 'matricula':
        return t('pendiente_matricula', { programa: p.programaNombre });
      case 'entregable':
        return t('pendiente_entregable', { programa: p.programaNombre });
      case 'formulario':
        return t('pendiente_formulario', { programa: p.programaNombre, nombre: p.nombre });
    }
  };

  const sesionesHechas = data.programas.reduce((acc, p) => acc + p.sesionesRealizadas, 0);
  const sesionesTotal = data.programas.reduce((acc, p) => acc + p.sesionesTotal, 0);
  const retosEntregados = data.programas.filter((p) => p.reto === 'entregado').length;

  return (
    <div className="home-stack">
      {/* KPIs: lectura de un vistazo de programas, avance de sesiones y pendientes. */}
      <div className="section-card home-panel">
        <div className="section-card-header">
          <span className="section-card-title">{t('resumen_title')}</span>
        </div>
        <div className="section-card-body">
          <div className="home-kpi-grid">
            <StatCard
              label={t('kpi_programas')}
              value={data.programas.length}
              hint={t('kpi_programas_hint', { count: retosEntregados })}
              icon={<SidebarIcon name="programas" size={18} />}
              accent="#38BDF8"
              to="/estudiante/programas"
            />
            <StatCard
              label={t('kpi_sesiones')}
              value={`${sesionesHechas}/${sesionesTotal}`}
              hint={t('kpi_sesiones_hint')}
              icon={<SidebarIcon name="formularios" size={18} />}
              accent="#155BA0"
            />
            <StatCard
              label={t('kpi_pendientes')}
              value={data.pendientes.length}
              hint={t('kpi_pendientes_hint')}
              icon={<SidebarIcon name="observaciones" size={18} />}
              accent="#F59E0B"
            />
          </div>
        </div>
      </div>

      {/* Pendientes de acción: cada uno enlaza a su acción real y muestra el programa. */}
      {data.pendientes.length > 0 && (
        <div className="section-card home-panel">
          <div className="section-card-header">
            <span className="section-card-title">{t('pendientes_title')}</span>
            <span className="count-badge">{data.pendientes.length}</span>
          </div>
          <div className="home-list">
            {data.pendientes.map((p, i) => (
              <Link
                key={`${p.tipo}-${p.plantillaId ?? p.programaId ?? i}`}
                to={pendienteTo(p)}
                className="home-list-row"
              >
                <span className="home-list-row-dot" aria-hidden="true" />
                <span className="home-list-row-text">{etiquetaPendiente(p)}</span>
                <span className="home-list-row-arrow" aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Próxima sesión: la más cercana en el futuro, entre todos los programas. */}
      <div className="section-card home-panel">
        <div className="section-card-header">
          <span className="section-card-title">{t('proxima_title')}</span>
        </div>
        <div className="section-card-body">
          {data.proximaSesion ? (
            <ProximaSesionCard sesion={data.proximaSesion} lang={i18n.language} t={t} />
          ) : (
            <EmptyState title={t('proxima_empty')} />
          )}
        </div>
      </div>

      {/* Resumen por programa con progreso de sesiones, grupo y estado del reto. */}
      <div className="section-card home-panel">
        <div className="section-card-header">
          <span className="section-card-title">{t('programas_title')}</span>
          <span className="count-badge">{data.programas.length}</span>
        </div>
        <div className="section-card-body">
          {data.programas.length === 0 ? (
            <EmptyState title={t('programas_empty')} />
          ) : (
            <div className="home-nav-grid">
              {data.programas.map((prog) => (
                <ProgramaCard key={prog.id} programa={prog} t={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProximaSesionCard({
  sesion: s,
  lang,
  t,
}: {
  sesion: ProximaSesion;
  lang: string;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  return (
    <Link to={`/estudiante/programas/${s.programaId}/sesiones`} className="home-next">
      <div className="home-next-top">
        <span className="home-next-program">{s.programaNombre}</span>
        <StatusBadge variant="info">{capitalizar(formatDiasRelativos(s.fechaProgramada, lang))}</StatusBadge>
      </div>
      <div className="home-next-title">
        {t('proxima_sesion_num', { numero: s.numeroSesion })} — {s.titulo}
      </div>
      <div className="home-next-meta">{formatFechaHora(s.fechaProgramada, s.timezone, lang)}</div>
      <div className="home-next-meta">
        {!s.bloqueada && s.tieneRecursos
          ? t('proxima_recursos')
          : t('proxima_bloqueada', { fecha: formatFechaHora(s.desbloqueaEn, s.timezone, lang) })}
      </div>
    </Link>
  );
}

function ProgramaCard({
  programa: prog,
  t,
}: {
  programa: ProgramaResumen;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const pct = prog.sesionesTotal > 0 ? Math.round((prog.sesionesRealizadas / prog.sesionesTotal) * 100) : 0;
  return (
    <Link to={`/estudiante/programas/${prog.id}/sesiones`} className="home-prog-card">
      <div>
        <div className="home-prog-name">{prog.nombre}</div>
        {prog.empresa && <div className="home-prog-empresa">{prog.empresa.nombre}</div>}
      </div>

      <div>
        <div className="home-prog-progress-label">
          <span>{t('sesiones_progreso', { hechas: prog.sesionesRealizadas, total: prog.sesionesTotal })}</span>
          <span>{pct}%</span>
        </div>
        <ProgressBar
          value={pct}
          color="var(--color-accent)"
          label={t('sesiones_progreso', { hechas: prog.sesionesRealizadas, total: prog.sesionesTotal })}
        />
      </div>

      <div className="home-prog-foot">
        <StatusBadge variant={RETO_VARIANT[prog.reto]}>{t(`reto.${prog.reto}`)}</StatusBadge>
        {prog.grupo && (
          <span className="home-prog-grupo">
            <SidebarIcon name="usuarios" size={14} />
            {prog.grupo.nombre} · {prog.grupo.miembros}
          </span>
        )}
      </div>
    </Link>
  );
}

function capitalizar(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
