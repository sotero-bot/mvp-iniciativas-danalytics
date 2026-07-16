import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, Alert, Loading, EmptyState } from '../../components/ui';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Registro {
  usuarioId: string;
  nombre: string;
  email: string;
  presente: boolean;
  nota: string | null;
  registrado: boolean;
}

export function FacilitadorAsistenciaPage() {
  const { id: sesionId = '' } = useParams();
  const { t } = useTranslation(['facilitador', 'common']);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErrorCode(null);
    fetchWithErrorMapping(`${API_URL}/facilitador/sesiones/${sesionId}/asistencia`)
      .then((res) => res.json())
      .then(setRegistros)
      .catch((err) => setErrorCode(err?.code ?? null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [sesionId]);

  const togglePresente = (usuarioId: string) => {
    setRegistros((prev) =>
      prev.map((r) => (r.usuarioId === usuarioId ? { ...r, presente: !r.presente } : r)),
    );
  };

  const setNota = (usuarioId: string, nota: string) => {
    setRegistros((prev) => prev.map((r) => (r.usuarioId === usuarioId ? { ...r, nota } : r)));
  };

  const guardar = async () => {
    setSaving(true);
    try {
      await fetchWithErrorMapping(`${API_URL}/facilitador/sesiones/${sesionId}/asistencia`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registros: registros.map((r) => ({ usuarioId: r.usuarioId, presente: r.presente, nota: r.nota })),
        }),
      });
      setToast(t('facilitador:asistencia.saved'));
      load();
    } catch (err) {
      setToast(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader title={t('facilitador:asistencia.title')} />
      {toast && <div className="toast">{toast}</div>}
      {errorCode === 'SESION_FUTURA' && <Alert variant="warning">{t('facilitador:asistencia.future_banner')}</Alert>}
      {errorCode === 'ASISTENCIA_FUERA_DE_PLAZO' && <Alert variant="warning">{t('facilitador:asistencia.locked_banner')}</Alert>}
      {loading && <Loading label={t('common:loading')} />}
      {!loading && !errorCode && registros.length === 0 && <EmptyState title={t('facilitador:asistencia.empty')} />}

      {!loading && !errorCode && registros.length > 0 && (
        <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>{t('facilitador:asistencia.participante')}</th>
                  <th style={{ textAlign: 'center' }}>{t('facilitador:asistencia.presente')}</th>
                  <th>{t('facilitador:asistencia.nota')}</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.usuarioId}>
                    <td>{r.nombre}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={r.presente}
                        onChange={() => togglePresente(r.usuarioId)}
                        aria-label={`${t('facilitador:asistencia.presente')} — ${r.nombre}`}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        value={r.nota ?? ''}
                        onChange={(e) => setNota(r.usuarioId, e.target.value)}
                        aria-label={`${t('facilitador:asistencia.nota')} — ${r.nombre}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={saving} onClick={guardar}>
            {t('facilitador:asistencia.save')}
          </button>
        </>
      )}
    </div>
  );
}
