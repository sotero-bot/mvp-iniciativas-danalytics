import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, Loading, EmptyState } from '../../components/ui';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface ProgramaIaEnAccion {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: 'borrador' | 'activo' | 'finalizado' | 'cancelado';
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
  const { t } = useTranslation(['portal', 'common']);
  const [iaEnAccion, setIaEnAccion] = useState<ProgramaIaEnAccion[]>([]);
  const [decisionIa, setDecisionIa] = useState<IniciativaDecisionIa[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
      .catch(err => { if (!cancelled) setToast(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const fecha = (v: string | null) => (v ? new Date(v).toLocaleDateString() : '—');

  return (
    <div className="page">
      <PageHeader title={t('portal:programas.title')} description={t('portal:programas.subtitle')} />
      {toast && <div className="toast">{toast}</div>}
      {loading && <Loading label={t('common:loading')} />}

      <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.75rem' }}>{t('portal:programas.ia_en_accion')}</h2>
      {!loading && iaEnAccion.length === 0 && (
        <EmptyState title={t('portal:programas.empty')} />
      )}
      <div className="card-grid" style={{ marginBottom: '1.75rem' }}>
        {iaEnAccion.map(p => (
          <Link key={p.id} to={`/portal/programas/${p.id}`} className="card" style={{ padding: '1rem', textDecoration: 'none', display: 'block' }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--color-text-main)' }}>{p.nombre}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              {t(`portal:programas.estado.${p.estado}`)} · {fecha(p.fechaInicio)} – {fecha(p.fechaFin)}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              {p.facilitadores.length > 0 && <>{t('portal:programas.facilitador')}: {p.facilitadores.join(', ')} · </>}
              {p.participantes} {t('portal:programas.participantes')} · {p.sesiones} {t('portal:programas.sesiones')}
            </div>
          </Link>
        ))}
      </div>

      <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.75rem' }}>{t('portal:programas.decision_ia')}</h2>
      {!loading && decisionIa.length === 0 && (
        <EmptyState title={t('portal:programas.empty')} />
      )}
      <div className="card-grid">
        {decisionIa.map(i => (
          <div key={i.id} className="card" style={{ padding: '1rem' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{i.nombre}</div>
            {i.descripcion && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>{i.descripcion}</div>
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
