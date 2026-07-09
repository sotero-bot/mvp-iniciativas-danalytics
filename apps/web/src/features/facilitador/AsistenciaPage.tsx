import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

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
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '1.4rem', marginBottom: '1.25rem' }}>{t('facilitador:asistencia.title')}</h1>
      {toast && <div className="toast">{toast}</div>}
      {errorCode === 'SESION_FUTURA' && <p>{t('facilitador:asistencia.future_banner')}</p>}
      {errorCode === 'ASISTENCIA_FUERA_DE_PLAZO' && <p>{t('facilitador:asistencia.locked_banner')}</p>}
      {loading && <p>{t('common:loading')}</p>}
      {!loading && !errorCode && registros.length === 0 && <p>{t('facilitador:asistencia.empty')}</p>}

      {!loading && !errorCode && registros.length > 0 && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Participante</th>
                <th style={{ textAlign: 'center', padding: '0.5rem' }}>{t('facilitador:asistencia.presente')}</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>{t('facilitador:asistencia.nota')}</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.usuarioId}>
                  <td style={{ padding: '0.5rem' }}>{r.nombre}</td>
                  <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                    <input type="checkbox" checked={r.presente} onChange={() => togglePresente(r.usuarioId)} />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input
                      className="input"
                      value={r.nota ?? ''}
                      onChange={(e) => setNota(r.usuarioId, e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={saving} onClick={guardar}>
            {t('facilitador:asistencia.save')}
          </button>
        </>
      )}
    </div>
  );
}
