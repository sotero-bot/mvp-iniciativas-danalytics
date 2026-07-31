import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Button, ProgressBar } from '../../components/ui';
import { toast } from '../../components/toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface DashboardItem {
  id: string;
  nombre: string;
  sesionesCompletadas: number;
  totalSesiones: number;
  participantesActivos: number;
  asistenciaPromedio: number | null; // fracción 0..1
}

// RF-04: resumen de programas activos (sesiones, participantes, asistencia promedio).
export function ProgramasDashboardPanel() {
  const { t } = useTranslation(['admin', 'common']);
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchWithErrorMapping(`${API_URL}/admin/programas/dashboard`)
      .then(res => res.json())
      .then((data: DashboardItem[]) => { if (!cancelled) setItems(data); })
      .catch(err => { if (!cancelled) toast.error(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;
  if (!loading && items.length === 0) return null;

  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{t('admin:dashboard_programas.title')}</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
          · {t('admin:dashboard_programas.activos', { count: items.length })}
        </span>
        <Button
          variant="link"
          size="sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => setOpen(o => !o)}
        >
          {open ? t('admin:dashboard_programas.ocultar') : t('admin:dashboard_programas.mostrar')}
        </Button>
      </div>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
          {items.map(it => {
            const pctSesiones = it.totalSesiones > 0 ? Math.round((it.sesionesCompletadas / it.totalSesiones) * 100) : 0;
            return (
              <Link
                key={it.id}
                to={`/admin/programas/${it.id}/asistencia`}
                className="card"
                style={{ padding: 'var(--space-4)', textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: 'var(--space-3)' }}>{it.nombre}</div>

                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                  {t('admin:dashboard_programas.sesiones')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                  <div style={{ flex: 1 }}>
                    <ProgressBar
                      value={pctSesiones}
                      color="var(--color-success)"
                      label={t('admin:dashboard_programas.sesiones')}
                    />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {it.sesionesCompletadas}/{it.totalSesiones}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{t('admin:dashboard_programas.participantes')}: </span>
                    <strong>{it.participantesActivos}</strong>
                  </span>
                  <span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{t('admin:dashboard_programas.asistencia')}: </span>
                    <strong>{it.asistenciaPromedio === null ? '—' : `${Math.round(it.asistenciaPromedio * 100)}%`}</strong>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
