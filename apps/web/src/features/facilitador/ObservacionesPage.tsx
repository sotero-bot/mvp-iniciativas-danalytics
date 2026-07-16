import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, Field, Loading, EmptyState } from '../../components/ui';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const TIPOS = ['baja_participacion', 'falta_atencion', 'problema_tecnico', 'dificultades_estudiante', 'otro'] as const;
const URGENCIAS = ['normal', 'urgente'] as const;

interface Observacion {
  id: string;
  tipo: string;
  urgencia: string;
  texto: string;
  createdAt: string;
}

export function FacilitadorObservacionesPage() {
  const { id: programaId = '' } = useParams();
  const { t } = useTranslation(['facilitador', 'common']);
  const [observaciones, setObservaciones] = useState<Observacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [tipo, setTipo] = useState<string>(TIPOS[0]);
  const [urgencia, setUrgencia] = useState<string>(URGENCIAS[0]);
  const [texto, setTexto] = useState('');

  const load = () => {
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/facilitador/programas/${programaId}/observaciones`)
      .then((res) => res.json())
      .then(setObservaciones)
      .catch((err) => setToast(translateError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [programaId]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setSending(true);
    try {
      await fetchWithErrorMapping(`${API_URL}/facilitador/programas/${programaId}/observaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, urgencia, texto }),
      });
      setTexto('');
      setToast(t('facilitador:observaciones.sent'));
      load();
    } catch (err) {
      setToast(translateError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        back={{ to: '/facilitador/programas', label: t('facilitador:sesiones.back') }}
        title={t('facilitador:observaciones.title')}
      />
      {toast && <div className="toast">{toast}</div>}

      <form onSubmit={enviar} className="card" style={{ marginBottom: '1.5rem', maxWidth: 480 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>{t('facilitador:observaciones.new')}</div>
        <Field label={t('facilitador:observaciones.tipo')}>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((tp) => (
              <option key={tp} value={tp}>{t(`facilitador:observaciones.tipos.${tp}`)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('facilitador:observaciones.urgencia')}>
          <select className="input" value={urgencia} onChange={(e) => setUrgencia(e.target.value)}>
            {URGENCIAS.map((u) => (
              <option key={u} value={u}>{t(`facilitador:observaciones.urgencias.${u}`)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('facilitador:observaciones.texto')}>
          <textarea
            className="textarea"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
          />
        </Field>
        <button className="btn btn-primary" type="submit" disabled={sending}>
          {t('facilitador:observaciones.send')}
        </button>
      </form>

      <div style={{ fontWeight: 600, marginBottom: 10 }}>{t('facilitador:observaciones.history')}</div>
      {loading && <Loading label={t('common:loading')} />}
      {!loading && observaciones.length === 0 && <EmptyState title={t('facilitador:observaciones.empty')} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {observaciones.map((o) => (
          <div key={o.id} className="card" style={{ padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              {t(`facilitador:observaciones.tipos.${o.tipo}`)} · {t(`facilitador:observaciones.urgencias.${o.urgencia}`)} ·{' '}
              {new Date(o.createdAt).toLocaleString()}
            </div>
            <div>{o.texto}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
