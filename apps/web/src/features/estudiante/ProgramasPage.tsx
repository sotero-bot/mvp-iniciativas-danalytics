import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, Breadcrumb, Button, Loading, EmptyState } from '../../components/ui';
import { toast } from '../../components/toast-store';
import { ProgramaFaseStepper } from '../../components/ProgramaFaseStepper';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Programa {
  id: string;
  nombre: string;
}

interface FasePrograma {
  fase: 1 | 2 | 3;
  clave: 'entendimiento' | 'sesiones' | 'presentacion_final';
  completada?: true;
}

export function EstudianteProgramasPage() {
  const { t } = useTranslation(['estudiante', 'common', 'admin']);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [pendientes, setPendientes] = useState<Programa[]>([]);
  const [fases, setFases] = useState<Record<string, FasePrograma>>({});
  const [aceptado, setAceptado] = useState<Record<string, boolean>>({});
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchWithErrorMapping(`${API_URL}/programas`).then((res) => res.json()),
      fetchWithErrorMapping(`${API_URL}/programas/pendientes`).then((res) => res.json()),
      // La fase del estudiante sale de /estudiante/resumen (considera la entrega de SU grupo).
      fetchWithErrorMapping(`${API_URL}/estudiante/resumen`).then((res) => res.json()),
    ])
      .then(([confirmados, sinConfirmar, resumen]) => {
        setProgramas(confirmados);
        setPendientes(sinConfirmar);
        setFases(Object.fromEntries(
          (resumen.programas as (Programa & { fase: FasePrograma })[]).map((p) => [p.id, p.fase]),
        ));
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
            {fases[p.id] && <ProgramaFaseStepper compact fase={fases[p.id].fase} clave={fases[p.id].clave} completada={!!fases[p.id].completada} />}
          </Link>
        ))}
      </div>
    </div>
  );
}
