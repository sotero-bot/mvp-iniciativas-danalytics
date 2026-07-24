import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, StatusBadge } from '../../components/ui';
import type { StatusVariant } from '../../components/ui';
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

  return (
    <div style={{ padding: '2rem', maxWidth: 1100 }}>
      <PageHeader
        title={t('admin:notificaciones.title')}
        description={t('admin:notificaciones.subtitle')}
      />

      {/* Bitácora de envíos (RNF-12) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{t('admin:notificaciones.bitacora_title')}</h2>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem' }}>
          {t('admin:notificaciones.estado')}
          <select value={estado} onChange={e => setEstado(e.target.value)}>
            <option value="">{t('admin:notificaciones.todos')}</option>
            {ESTADOS.map(es => <option key={es} value={es}>{t(`admin:notificaciones.estados.${es}`)}</option>)}
          </select>
        </label>
      </div>

      {loading && <p>{t('common:loading')}</p>}
      {!loading && notificaciones.length === 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{t('admin:notificaciones.bitacora_empty')}</p>
      )}
      {notificaciones.length > 0 && (
        <div className="card" style={{ padding: '1rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)', color: '#64748B' }}>
                <th style={{ padding: '6px 8px' }}>{t('admin:notificaciones.fecha')}</th>
                <th style={{ padding: '6px 8px' }}>{t('admin:notificaciones.tipo')}</th>
                <th style={{ padding: '6px 8px' }}>{t('admin:notificaciones.destinatario')}</th>
                <th style={{ padding: '6px 8px' }}>{t('admin:notificaciones.asunto')}</th>
                <th style={{ padding: '6px 8px', textAlign: 'center' }}>{t('admin:notificaciones.estado')}</th>
                <th style={{ padding: '6px 8px' }} />
              </tr>
            </thead>
            <tbody>
              {notificaciones.map(n => {
                return (
                  <tr key={n.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{new Date(n.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '6px 8px' }}>{n.tipo}</td>
                    <td style={{ padding: '6px 8px' }}>{n.destinatario}</td>
                    <td style={{ padding: '6px 8px' }} title={n.error ?? undefined}>
                      {n.asunto}
                      {n.error && <div style={{ fontSize: '0.7rem', color: 'var(--color-danger-strong)' }}>{n.error}</div>}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <StatusBadge variant={ESTADO_VARIANT[n.estado] ?? 'neutral'}>
                        {t(`admin:notificaciones.estados.${n.estado}`, { defaultValue: n.estado })}
                      </StatusBadge>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {REENVIABLES.has(n.tipo) && (
                        <button className="btn btn-secondary btn-sm" disabled={reenviando === n.id} onClick={() => reenviar(n.id)}>
                          ↻ {t('admin:notificaciones.reenviar')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
