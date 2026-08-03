import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, Breadcrumb, Loading, EmptyState, StatusBadge } from '../../components/ui';
import type { StatusVariant } from '../../components/ui';
import { toast } from '../../components/toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type EstadoPrograma = 'borrador' | 'activo' | 'finalizado' | 'cancelado';

const ESTADO_VARIANTS: Record<EstadoPrograma, StatusVariant> = {
  borrador: 'neutral',
  activo: 'success',
  finalizado: 'info',
  cancelado: 'danger',
};

interface ProgramaIaEnAccion {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: EstadoPrograma;
  fechaInicio: string | null;
  fechaFin: string | null;
  facilitadores: string[];
  participantes: number;
  sesiones: number;
}

interface IniciativaDecisionIa {
  id: string;
  nombre: string;
  descripcion: string | null;
  actividades: number;
  instanciasTotal: number;
  instanciasFinalizadas: number;
}

// RF-42: lista unificada (Decisión IA + IA en Acción) de la empresa del actor,
// SOLO lectura. El backend acota por empresaId del JWT (RN-09).
export function PortalProgramasPage() {
  const { t } = useTranslation(['portal', 'common', 'admin']);
  const [iaEnAccion, setIaEnAccion] = useState<ProgramaIaEnAccion[]>([]);
  const [decisionIa, setDecisionIa] = useState<IniciativaDecisionIa[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/portal/programas`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        setIaEnAccion(data.iaEnAccion ?? []);
        setDecisionIa(data.decisionIa ?? []);
      })
      .catch(err => { if (!cancelled) toast.error(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const fecha = (v: string | null) => (v ? new Date(v).toLocaleDateString() : '—');

  return (
    <div className="page-wide">
      <Breadcrumb items={[{ label: t('admin:sidebar.home'), to: '/inicio' }, { label: t('portal:programas.title') }]} />
      <PageHeader title={t('portal:programas.title')} description={t('portal:programas.subtitle')} />
      {loading && <Loading label={t('common:loading')} />}

      <h2 style={{ marginBottom: 'var(--space-3)' }}>{t('portal:programas.ia_en_accion')}</h2>
      {!loading && iaEnAccion.length === 0 && (
        <EmptyState title={t('portal:programas.empty')} />
      )}
      <div className="card-grid" style={{ marginBottom: 'var(--space-6)' }}>
        {iaEnAccion.map(p => (
          <Link key={p.id} to={`/portal/programas/${p.id}`} className="card" style={{ padding: 'var(--space-4)', textDecoration: 'none', display: 'block' }}>
            <div style={{ fontWeight: 600, marginBottom: 'var(--space-1)', color: 'var(--color-text-main)' }}>{p.nombre}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <StatusBadge variant={ESTADO_VARIANTS[p.estado]}>{t(`portal:programas.estado.${p.estado}`)}</StatusBadge>
              <span>{fecha(p.fechaInicio)} – {fecha(p.fechaFin)}</span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              {p.facilitadores.length > 0 && <>{t('portal:programas.facilitador')}: {p.facilitadores.join(', ')} · </>}
              {p.participantes} {t('portal:programas.participantes')} · {p.sesiones} {t('portal:programas.sesiones')}
            </div>
          </Link>
        ))}
      </div>

      <h2 style={{ marginBottom: 'var(--space-3)' }}>{t('portal:programas.decision_ia')}</h2>
      {!loading && decisionIa.length === 0 && (
        <EmptyState title={t('portal:programas.empty')} />
      )}
      <div className="card-grid">
        {decisionIa.map(i => (
          <div key={i.id} className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>{i.nombre}</div>
            {i.descripcion && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>{i.descripcion}</div>
            )}
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              {i.actividades} {t('portal:programas.actividades')} · {i.instanciasFinalizadas}/{i.instanciasTotal} {t('portal:programas.instancias_finalizadas')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
