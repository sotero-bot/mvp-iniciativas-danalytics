import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Loading, EmptyState, StatusBadge } from '../../components/ui';
import type { StatusVariant } from '../../components/ui';
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

// Icono y destino de cada pendiente según su tipo. Cada uno enlaza a su acción
// real (el formulario concreto, la confirmación del programa, el reto del grupo),
// no a un listado genérico.
const PENDIENTE_ICON: Record<PendienteTipo, string> = {
  encuesta_inicio: '📝',
  matricula: '✋',
  formulario: '📋',
  entregable: '📓',
};

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

// Dashboard de inicio del estudiante: próxima sesión (entre todos sus programas),
// pendientes de acción y resumen por programa. Todo llega pre-agregado de
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Pendientes de acción: cada uno enlaza a su acción real (formulario concreto,
          confirmación del programa, reto del grupo) y muestra el programa al que pertenece. */}
      {data.pendientes.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 0.75rem' }}>{t('pendientes_title')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.pendientes.map((p, i) => (
              <Link
                key={`${p.tipo}-${p.plantillaId ?? p.programaId ?? i}`}
                to={pendienteTo(p)}
                className="card"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1rem',
                  textDecoration: 'none', color: 'var(--color-text-main)',
                  borderLeft: '4px solid var(--color-warning, #d97706)',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{PENDIENTE_ICON[p.tipo]}</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{etiquetaPendiente(p)}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)' }}>›</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Próxima sesión: la más cercana en el futuro, entre todos los programas. */}
      <div>
        <h3 style={{ margin: '0 0 0.75rem' }}>{t('proxima_title')}</h3>
        {data.proximaSesion ? (
          <ProximaSesionCard sesion={data.proximaSesion} lang={i18n.language} t={t} />
        ) : (
          <EmptyState title={t('proxima_empty')} />
        )}
      </div>

      {/* Resumen por programa con progreso de sesiones, grupo y estado del reto. */}
      <div>
        <h3 style={{ margin: '0 0 0.75rem' }}>{t('programas_title')}</h3>
        {data.programas.length === 0 ? (
          <EmptyState title={t('programas_empty')} />
        ) : (
          <div className="card-grid">
            {data.programas.map((prog) => (
              <ProgramaCard key={prog.id} programa={prog} t={t} />
            ))}
          </div>
        )}
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
    <Link
      to={`/estudiante/programas/${s.programaId}/sesiones`}
      className="card"
      style={{
        display: 'block', padding: '1.25rem', textDecoration: 'none',
        color: 'var(--color-text-main)', borderLeft: '4px solid #38BDF8',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{s.programaNombre}</div>
        <StatusBadge variant="info">{capitalizar(formatDiasRelativos(s.fechaProgramada, lang))}</StatusBadge>
      </div>
      <div style={{ fontWeight: 700, fontSize: '1.15rem', margin: '6px 0 4px' }}>
        {t('proxima_sesion_num', { numero: s.numeroSesion })} — {s.titulo}
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
        📅 {formatFechaHora(s.fechaProgramada, s.timezone, lang)}
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 8 }}>
        {!s.bloqueada && s.tieneRecursos
          ? `🎥 ${t('proxima_recursos')}`
          : `🔒 ${t('proxima_bloqueada', { fecha: formatFechaHora(s.desbloqueaEn, s.timezone, lang) })}`}
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
    <Link
      to={`/estudiante/programas/${prog.id}/sesiones`}
      className="card"
      style={{ display: 'block', padding: '1rem', textDecoration: 'none', color: 'var(--color-text-main)' }}
    >
      <div style={{ fontWeight: 600 }}>{prog.nombre}</div>
      {prog.empresa && (
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{prog.empresa.nombre}</div>
      )}

      {/* Progreso de sesiones */}
      <div style={{ margin: '0.75rem 0 0.3rem', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
        {t('sesiones_progreso', { hechas: prog.sesionesRealizadas, total: prog.sesionesTotal })}
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--color-bg-subtle, #e5e7eb)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#38BDF8' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <StatusBadge variant={RETO_VARIANT[prog.reto]}>{t(`reto.${prog.reto}`)}</StatusBadge>
        {prog.grupo && (
          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            👥 {prog.grupo.nombre} · {prog.grupo.miembros}
          </span>
        )}
      </div>
    </Link>
  );
}

function capitalizar(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
