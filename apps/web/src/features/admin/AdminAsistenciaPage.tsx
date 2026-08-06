import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Breadcrumb, PageHeader, Button, Loading, EmptyState, StatusBadge } from '../../components/ui';
import { toast } from '../../components/toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface SesionCol {
  id: string;
  numeroSesion: number;
  titulo: string;
  fechaProgramada: string;
}

interface Fila {
  usuarioId: string;
  nombre: string;
  email: string;
  porSesion: Record<string, boolean>;
  porcentaje: number; // fracción 0..1
}

interface Resumen {
  sesiones: SesionCol[];
  filas: Fila[];
}

// RF-20/RF-21 / RN-07: resumen (matriz sesión × participante) y export SOLO admin.
export function AdminAsistenciaPage() {
  const { id: programaId = '' } = useParams();
  const { t } = useTranslation(['admin', 'common']);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Nombre del programa para el breadcrumb/eyebrow (dónde está el usuario).
  const [programaNombre, setProgramaNombre] = useState('');

  useEffect(() => {
    fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}`)
      .then(res => res.json())
      .then((p: { nombre: string }) => setProgramaNombre(p.nombre))
      .catch(() => {});
  }, [programaId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/asistencia/resumen`);
      setResumen(await res.json());
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setLoading(false);
    }
  }, [programaId]);

  useEffect(() => { load(); }, [load]);

  const exportar = async () => {
    setExporting(true);
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/asistencia/export`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'asistencia.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setExporting(false);
    }
  };

  const pct = (fraccion: number) => `${Math.round(fraccion * 100)}%`;
  const pctColor = (fraccion: number) =>
    fraccion >= 0.8 ? 'var(--color-success-strong)' : fraccion >= 0.5 ? 'var(--color-warning-strong)' : 'var(--color-danger-strong)';

  return (
    <div>
      <Breadcrumb
        items={[
          { label: t('admin:programas.page_title'), to: '/admin/programas' },
          { label: programaNombre || '—' },
          { label: t('admin:asistencia.title') },
        ]}
      />
      <PageHeader
        eyebrow={programaNombre || undefined}
        title={t('admin:asistencia.title')}
        actions={
          <Button variant="primary" onClick={exportar} disabled={exporting || !resumen || resumen.filas.length === 0}>
            {exporting ? t('common:loading') : t('admin:asistencia.export')}
          </Button>
        }
      />
      {loading && <Loading label={t('common:loading')} />}

      {!loading && resumen && resumen.filas.length === 0 && (
        <EmptyState title={t('admin:asistencia.empty')} />
      )}

      {!loading && resumen && resumen.filas.length > 0 && (
        <>
          <div className="table-container">
          <table style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: 'var(--color-bg-card)' }}>
                  {t('admin:asistencia.participante')}
                </th>
                {resumen.sesiones.map(s => (
                  <th key={s.id} style={{ textAlign: 'center', whiteSpace: 'nowrap', minWidth: 140 }}>
                    <div>{t('admin:asistencia.sesion_n', { n: s.numeroSesion })} · {s.titulo}</div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--color-text-tertiary)' }}>
                      {new Date(s.fechaProgramada).toLocaleDateString()}
                    </div>
                  </th>
                ))}
                <th style={{ textAlign: 'center' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {resumen.filas.map(f => (
                <tr key={f.usuarioId}>
                  <td style={{ position: 'sticky', left: 0, background: 'var(--color-bg-card)' }}>
                    {f.nombre}
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>{f.email}</div>
                  </td>
                  {resumen.sesiones.map(s => {
                    const registrado = s.id in f.porSesion;
                    return (
                      <td key={s.id} style={{ textAlign: 'center' }}>
                        {!registrado ? (
                          <StatusBadge variant="neutral">{t('admin:asistencia.no_registrado_corto')}</StatusBadge>
                        ) : f.porSesion[s.id] ? (
                          <StatusBadge variant="success">{t('admin:asistencia.presente')}</StatusBadge>
                        ) : (
                          <StatusBadge variant="danger">{t('admin:asistencia.ausente')}</StatusBadge>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'center', fontWeight: 700, color: pctColor(f.porcentaje) }}>
                    {pct(f.porcentaje)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
