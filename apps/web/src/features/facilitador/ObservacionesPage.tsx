import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import {
  Breadcrumb,
  PageHeader,
  Field,
  Button,
  FormListLayout,
  DataTable,
  Loading,
  Alert,
} from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { toast } from '../../components/toast-store';

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
  const { t } = useTranslation(['facilitador', 'common', 'admin', 'errors']);
  const [observaciones, setObservaciones] = useState<Observacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [tipo, setTipo] = useState<string>(TIPOS[0]);
  const [urgencia, setUrgencia] = useState<string>(URGENCIAS[0]);
  const [texto, setTexto] = useState('');
  // Nombre del programa para el breadcrumb/eyebrow (dónde está el usuario).
  const [programaNombre, setProgramaNombre] = useState('');
  // RF-03/RN-03: gracia vencida → el facilitador solo consulta, sin acciones de escritura.
  const [soloLectura, setSoloLectura] = useState(false);

  const load = () => {
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/facilitador/programas/${programaId}/observaciones`)
      .then((res) => res.json())
      .then(setObservaciones)
      .catch((err) => toast.error(translateError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [programaId]);

  useEffect(() => {
    fetchWithErrorMapping(`${API_URL}/programas`)
      .then((res) => res.json())
      .then((data: { id: string; nombre: string; soloLectura?: boolean }[]) => {
        const p = data.find((x) => x.id === programaId);
        if (p) {
          setProgramaNombre(p.nombre);
          setSoloLectura(!!p.soloLectura);
        }
      })
      .catch(() => {});
  }, [programaId]);

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
      toast.success(t('facilitador:observaciones.sent'));
      load();
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setSending(false);
    }
  };

  const columns: DataTableColumn<Observacion>[] = [
    {
      key: 'tipo',
      header: t('facilitador:observaciones.tipo'),
      render: (o) => t(`facilitador:observaciones.tipos.${o.tipo}`),
    },
    {
      key: 'urgencia',
      header: t('facilitador:observaciones.urgencia'),
      render: (o) => t(`facilitador:observaciones.urgencias.${o.urgencia}`),
    },
    {
      key: 'fecha',
      header: t('common:labels.created_at'),
      render: (o) => new Date(o.createdAt).toLocaleString(),
    },
    {
      key: 'texto',
      header: t('facilitador:observaciones.texto'),
      render: (o) => o.texto,
    },
  ];

  const historial = (
    <div className="section-card home-panel">
      <div className="section-card-header">
        <span className="section-card-title">{t('facilitador:observaciones.history')}</span>
        <span className="count-badge">{observaciones.length}</span>
      </div>
      {loading && <Loading label={t('common:loading')} />}
      {!loading && (
        <DataTable
          columns={columns}
          rows={observaciones}
          rowKey={(o) => o.id}
          emptyMessage={t('facilitador:observaciones.empty')}
        />
      )}
    </div>
  );

  return (
    <div>
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/inicio' },
          { label: t('facilitador:programas.title'), to: '/facilitador/programas' },
          { label: programaNombre || '—' },
          { label: t('facilitador:observaciones.title') },
        ]}
      />
      <PageHeader
        eyebrow={programaNombre || undefined}
        title={t('facilitador:observaciones.title')}
      />
      {soloLectura && <Alert variant="warning">{t('errors:PROGRAMA_GRACIA_VENCIDA')}</Alert>}

      {soloLectura ? historial : (
        <FormListLayout
          form={
            <form onSubmit={enviar} className="card" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>{t('facilitador:observaciones.new')}</div>
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
              <div className="form-footer">
                <Button type="submit" variant="primary" disabled={sending}>
                  {sending ? t('common:loading') : t('facilitador:observaciones.send')}
                </Button>
              </div>
            </form>
          }
          list={historial}
        />
      )}
    </div>
  );
}
