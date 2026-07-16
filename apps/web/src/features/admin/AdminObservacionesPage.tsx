import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, Field, Loading, EmptyState, StatusBadge } from '../../components/ui';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const TIPOS = ['baja_participacion', 'falta_atencion', 'problema_tecnico', 'dificultades_estudiante', 'otro'] as const;
const URGENCIAS = ['normal', 'urgente'] as const;

interface Observacion {
  id: string;
  programaId: string;
  sesionId: string | null;
  usuarioId: string | null;
  grupoId: string | null;
  autorId: string;
  tipo: string;
  urgencia: string;
  texto: string;
  notificadoEn: string | null;
  createdAt: string;
}

interface ProgramaLite {
  id: string;
  nombre: string;
}

// RF-41: historial completo de observaciones (solo admin) con filtros programa/urgencia/tipo.
export function AdminObservacionesPage() {
  const { t } = useTranslation(['admin', 'facilitador', 'common']);
  const [observaciones, setObservaciones] = useState<Observacion[]>([]);
  const [programas, setProgramas] = useState<ProgramaLite[]>([]);
  const [programaId, setProgramaId] = useState('');
  const [urgencia, setUrgencia] = useState('');
  const [tipo, setTipo] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchWithErrorMapping(`${API_URL}/admin/programas`)
      .then(res => res.json())
      .then((data: ProgramaLite[]) => setProgramas(data))
      .catch(() => { /* filtro degradado a solo-id si falla */ });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (programaId) params.set('programaId', programaId);
    if (urgencia) params.set('urgencia', urgencia);
    if (tipo) params.set('tipo', tipo);
    const qs = params.toString();
    fetchWithErrorMapping(`${API_URL}/admin/observaciones${qs ? `?${qs}` : ''}`)
      .then(res => res.json())
      .then((data: Observacion[]) => { if (!cancelled) setObservaciones(data); })
      .catch(err => { if (!cancelled) setToast(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [programaId, urgencia, tipo]);

  const nombrePrograma = useMemo(() => {
    const map = new Map(programas.map(p => [p.id, p.nombre]));
    return (id: string) => map.get(id) ?? id;
  }, [programas]);

  return (
    <div style={{ padding: '2rem', maxWidth: 1000 }}>
      <PageHeader
        title={t('admin:observaciones.title')}
        description={t('admin:observaciones.subtitle')}
      />
      {toast && <div className="toast">{toast}</div>}

      <div className="toolbar">
        <Field label={t('admin:observaciones.programa')}>
          <select className="input" value={programaId} onChange={e => setProgramaId(e.target.value)}>
            <option value="">{t('admin:observaciones.todos')}</option>
            {programas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Field>
        <Field label={t('admin:observaciones.urgencia')}>
          <select className="input" value={urgencia} onChange={e => setUrgencia(e.target.value)}>
            <option value="">{t('admin:observaciones.todos')}</option>
            {URGENCIAS.map(u => <option key={u} value={u}>{t(`facilitador:observaciones.urgencias.${u}`)}</option>)}
          </select>
        </Field>
        <Field label={t('admin:observaciones.tipo')}>
          <select className="input" value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="">{t('admin:observaciones.todos')}</option>
            {TIPOS.map(tp => <option key={tp} value={tp}>{t(`facilitador:observaciones.tipos.${tp}`)}</option>)}
          </select>
        </Field>
      </div>

      {loading && <Loading label={t('common:loading')} />}
      {!loading && observaciones.length === 0 && (
        <EmptyState title={t('admin:observaciones.empty')} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {observaciones.map(o => (
          <div key={o.id} className="card" style={{ padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
              <StatusBadge variant={o.urgencia === 'urgente' ? 'danger' : 'neutral'}>
                {o.urgencia === 'urgente' ? '⚠ ' : ''}{t(`facilitador:observaciones.urgencias.${o.urgencia}`)}
              </StatusBadge>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{t(`facilitador:observaciones.tipos.${o.tipo}`)}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>· {nombrePrograma(o.programaId)}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>
                {new Date(o.createdAt).toLocaleString()}
              </span>
            </div>
            <div style={{ fontSize: '0.9rem' }}>{o.texto}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
              {o.notificadoEn
                ? t('admin:observaciones.notificado', { fecha: new Date(o.notificadoEn).toLocaleString() })
                : t('admin:observaciones.no_notificado')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
