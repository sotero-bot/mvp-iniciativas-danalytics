import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Breadcrumb, Button, DataTable, EmptyState, Field, FilterToolbar, Loading, PageHeader, StatusBadge } from '../../components/ui';
import type { DataTableColumn, StatusVariant } from '../../components/ui';
import { toast } from '../../components/toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const ESTADOS = ['pendiente', 'enviada', 'fallida'] as const;
// Solo estos tipos admiten reenvío hoy (el backend responde VALIDATION_ERROR para el resto).
const REENVIABLES = new Set(['observacion_normal', 'observacion_urgente']);

interface Notificacion {
  id: string;
  tipo: string;
  destinatario: string;
  asunto: string;
  estado: string;
  error: string | null;
  intentos: number;
  createdAt: string;
  enviadoEn: string | null;
}

const ESTADO_VARIANT: Record<string, StatusVariant> = {
  enviada: 'success',
  pendiente: 'warning',
  fallida: 'danger',
};

// RNF-12: bitácora de emails transaccionales con reenvío manual.
export function AdminNotificacionesPage() {
  const { t } = useTranslation(['admin', 'common']);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [estado, setEstado] = useState('');
  const [loading, setLoading] = useState(false);
  const [reenviando, setReenviando] = useState<string | null>(null);

  const loadNotificaciones = useCallback(() => {
    setLoading(true);
    const qs = estado ? `?estado=${estado}` : '';
    fetchWithErrorMapping(`${API_URL}/admin/notificaciones${qs}`)
      .then(res => res.json())
      .then((data: Notificacion[]) => setNotificaciones(data))
      .catch(err => toast.error(translateError(err)))
      .finally(() => setLoading(false));
  }, [estado]);

  useEffect(() => { loadNotificaciones(); }, [loadNotificaciones]);

  const reenviar = async (id: string) => {
    setReenviando(id);
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/notificaciones/${id}/reenviar`, { method: 'POST' });
      toast.success(t('admin:notificaciones.reenviado'));
      loadNotificaciones();
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setReenviando(null);
    }
  };

  const columns: DataTableColumn<Notificacion>[] = [
    {
      key: 'fecha',
      header: t('admin:notificaciones.fecha'),
      render: n => <span style={{ whiteSpace: 'nowrap' }}>{new Date(n.createdAt).toLocaleString()}</span>,
    },
    {
      key: 'tipo',
      header: t('admin:notificaciones.tipo'),
      render: n => n.tipo,
    },
    {
      key: 'destinatario',
      header: t('admin:notificaciones.destinatario'),
      render: n => n.destinatario,
    },
    {
      key: 'asunto',
      header: t('admin:notificaciones.asunto'),
      render: n => (
        <span title={n.error ?? undefined}>
          {n.asunto}
          {n.error && <div style={{ fontSize: '0.75rem', color: 'var(--color-danger-strong)' }}>{n.error}</div>}
        </span>
      ),
    },
    {
      key: 'estado',
      header: t('admin:notificaciones.estado'),
      align: 'center',
      render: n => (
        <StatusBadge variant={ESTADO_VARIANT[n.estado] ?? 'neutral'}>
          {t(`admin:notificaciones.estados.${n.estado}`, { defaultValue: n.estado })}
        </StatusBadge>
      ),
    },
    {
      key: 'acciones',
      header: '',
      align: 'right',
      render: n =>
        REENVIABLES.has(n.tipo) ? (
          <Button variant="secondary" size="sm" disabled={reenviando === n.id} onClick={() => reenviar(n.id)}>
            ↻ {t('admin:notificaciones.reenviar')}
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/admin/inicio' },
          { label: t('admin:sidebar.notificaciones') },
        ]}
      />
      <PageHeader
        title={t('admin:notificaciones.title')}
        description={t('admin:notificaciones.subtitle')}
      />

      <div className="section-card home-panel" style={{ marginTop: 'var(--space-4)' }}>
        <div className="section-card-header">
          <span className="section-card-title">{t('admin:notificaciones.bitacora_title')}</span>
          <span className="count-badge">{notificaciones.length}</span>
        </div>
        <div className="home-filter-strip">
          <FilterToolbar>
            <Field label={t('admin:notificaciones.estado')}>
              <select className="input" value={estado} onChange={e => setEstado(e.target.value)}>
                <option value="">{t('admin:notificaciones.todos')}</option>
                {ESTADOS.map(es => <option key={es} value={es}>{t(`admin:notificaciones.estados.${es}`)}</option>)}
              </select>
            </Field>
          </FilterToolbar>
        </div>
        {loading && <Loading label={t('common:loading')} />}
        {!loading && notificaciones.length === 0 && (
          <EmptyState title={t('admin:notificaciones.bitacora_empty')} />
        )}
        {!loading && notificaciones.length > 0 && (
          <DataTable columns={columns} rows={notificaciones} rowKey={n => n.id} />
        )}
      </div>
    </>
  );
}
