import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, Breadcrumb, Button, Loading, EmptyState } from '../../components/ui';
import { toast } from '../../components/toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Programa {
  id: string;
  nombre: string;
}

export function EstudianteProgramasPage() {
  const { t } = useTranslation(['estudiante', 'common', 'admin']);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [pendientes, setPendientes] = useState<Programa[]>([]);
  const [aceptado, setAceptado] = useState<Record<string, boolean>>({});
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchWithErrorMapping(`${API_URL}/programas`).then((res) => res.json()),
      fetchWithErrorMapping(`${API_URL}/programas/pendientes`).then((res) => res.json()),
    ])
      .then(([confirmados, sinConfirmar]) => {
        setProgramas(confirmados);
        setPendientes(sinConfirmar);
      })
      .catch((err) => toast.error(translateError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const confirmar = (programaId: string) => {
    setConfirmando(programaId);
    fetchWithErrorMapping(`${API_URL}/programas/${programaId}/confirmar`, { method: 'POST' })
      .then(() => {
        toast.success(t('estudiante:programas.confirmado_toast'));
        cargar();
      })
      .catch((err) => toast.error(translateError(err)))
      .finally(() => setConfirmando(null));
  };

  return (
    <div className="page-wide">
      <Breadcrumb items={[{ label: t('admin:sidebar.home'), to: '/inicio' }, { label: t('estudiante:programas.title') }]} />
      <PageHeader title={t('estudiante:programas.title')} />
      {loading && <Loading label={t('common:loading')} />}

      {!loading && pendientes.length > 0 && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <h3 style={{ marginBottom: 'var(--space-3)' }}>{t('estudiante:programas.pendientes_title')}</h3>
          <div className="card-grid">
            {pendientes.map((p) => (
              <div key={p.id} className="card card-accent" style={{ borderLeftColor: 'var(--color-warning)' }}>
                <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 'var(--space-2) 0' }}>
                  {t('estudiante:programas.pendiente_desc')}
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={!!aceptado[p.id]}
                    onChange={(e) => setAceptado((prev) => ({ ...prev, [p.id]: e.target.checked }))}
                  />
                  <span>{t('estudiante:programas.confirmar_check')}</span>
                </label>
                <Button
                  variant="primary"
                  style={{ marginTop: 'var(--space-3)' }}
                  disabled={!aceptado[p.id] || confirmando === p.id}
                  onClick={() => confirmar(p.id)}
                >
                  {t('estudiante:programas.confirmar_boton')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && programas.length === 0 && pendientes.length === 0 && (
        <EmptyState title={t('estudiante:programas.empty')} />
      )}
      <div className="card-grid">
        {programas.map((p) => (
          <Link
            key={p.id}
            to={`/estudiante/programas/${p.id}/sesiones`}
            className="card"
            style={{ display: 'block', textDecoration: 'none' }}
          >
            <div style={{ fontWeight: 600 }}>{p.nombre}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
              {t('estudiante:sesiones.title')}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
