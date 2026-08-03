import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Breadcrumb, PageHeader, Button, Field, Alert, Loading, EmptyState, DataTable } from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { ConfirmModal } from '../../components/ConfirmModal';
import { toast } from '../../components/toast-store';

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
  const navigate = useNavigate();
  const { t } = useTranslation(['facilitador', 'common', 'admin']);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [programaId, setProgramaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [observacion, setObservacion] = useState('');
  const [enviandoObs, setEnviandoObs] = useState(false);
  const [confirmarCorreo, setConfirmarCorreo] = useState(false);
  // Nombre del programa para el breadcrumb/eyebrow (dónde está el usuario).
  const [programaNombre, setProgramaNombre] = useState('');

  const load = () => {
    setLoading(true);
    setErrorCode(null);
    fetchWithErrorMapping(`${API_URL}/facilitador/sesiones/${sesionId}/asistencia`)
      .then((res) => res.json())
      .then((data) => {
        // Tolerante al formato: array antiguo o { registros, observacionGeneral }.
        setRegistros(Array.isArray(data) ? data : data?.registros ?? []);
        setObservacion(Array.isArray(data) ? '' : data?.observacionGeneral ?? '');
        setProgramaId(Array.isArray(data) ? null : data?.programaId ?? null);
      })
      .catch((err) => setErrorCode(err?.code ?? null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [sesionId]);

  useEffect(() => {
    if (!programaId) return;
    fetchWithErrorMapping(`${API_URL}/programas`)
      .then((res) => res.json())
      .then((data: { id: string; nombre: string }[]) => {
        const p = data.find((x) => x.id === programaId);
        if (p) setProgramaNombre(p.nombre);
      })
      .catch(() => {});
  }, [programaId]);

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
          observacionGeneral: observacion,
        }),
      });
      toast.success(t('facilitador:asistencia.saved'));
      // Al guardar, regresar al listado de sesiones del programa.
      if (programaId) {
        navigate(`/facilitador/programas/${programaId}/sesiones`);
      } else {
        navigate(-1);
      }
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  const enviarObservacion = async () => {
    const texto = observacion.trim();
    if (!texto) {
      toast.error(t('facilitador:asistencia.obs_general_empty'));
      return;
    }
    setEnviandoObs(true);
    try {
      await fetchWithErrorMapping(`${API_URL}/facilitador/sesiones/${sesionId}/observacion-general`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      toast.success(t('facilitador:asistencia.obs_general_sent'));
      setObservacion('');
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setEnviandoObs(false);
    }
  };

  const columns: DataTableColumn<Registro>[] = [
    { key: 'nombre', header: t('facilitador:asistencia.participante'), render: (r) => r.nombre },
    {
      key: 'presente',
      header: t('facilitador:asistencia.presente'),
      align: 'center',
      render: (r) => (
        <input
          type="checkbox"
          checked={r.presente}
          onChange={() => togglePresente(r.usuarioId)}
          aria-label={`${t('facilitador:asistencia.presente')} — ${r.nombre}`}
        />
      ),
    },
    {
      key: 'nota',
      header: t('facilitador:asistencia.nota'),
      render: (r) => (
        <input
          className="input"
          value={r.nota ?? ''}
          onChange={(e) => setNota(r.usuarioId, e.target.value)}
          aria-label={`${t('facilitador:asistencia.nota')} — ${r.nombre}`}
        />
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/inicio' },
          { label: t('facilitador:programas.title'), to: '/facilitador/programas' },
          { label: programaNombre || '—', to: programaId ? `/facilitador/programas/${programaId}/sesiones` : undefined },
          { label: t('facilitador:asistencia.title') },
        ]}
      />
      <PageHeader
        eyebrow={programaNombre || undefined}
        title={t('facilitador:asistencia.title')}
      />
      {errorCode === 'SESION_FUTURA' && <Alert variant="warning">{t('facilitador:asistencia.future_banner')}</Alert>}
      {errorCode === 'ASISTENCIA_FUERA_DE_PLAZO' && <Alert variant="warning">{t('facilitador:asistencia.locked_banner')}</Alert>}
      {loading && <Loading label={t('common:loading')} />}
      {!loading && !errorCode && registros.length === 0 && <EmptyState title={t('facilitador:asistencia.empty')} />}

      {!loading && !errorCode && registros.length > 0 && (
        <DataTable columns={columns} rows={registros} rowKey={(r) => r.usuarioId} />
      )}

      {!loading && !errorCode && (
        <div className="card" style={{ padding: 'var(--space-4)', marginTop: 'var(--space-5)' }}>
          <Field label={t('facilitador:asistencia.obs_general_title')}>
            <textarea
              className="textarea"
              rows={4}
              value={observacion}
              placeholder={t('facilitador:asistencia.obs_general_placeholder')}
              onChange={(e) => setObservacion(e.target.value)}
            />
          </Field>
          <div className="form-footer">
            <Button
              variant="secondary"
              disabled={enviandoObs || observacion.trim().length === 0}
              onClick={() => setConfirmarCorreo(true)}
            >
              {enviandoObs
                ? t('facilitador:asistencia.obs_general_sending')
                : t('facilitador:asistencia.obs_general_send')}
            </Button>
            <Button variant="primary" disabled={saving} onClick={guardar}>
              {saving ? t('common:loading') : t('facilitador:asistencia.save')}
            </Button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmarCorreo}
        danger={false}
        title={t('facilitador:asistencia.obs_general_modal_title')}
        message={t('facilitador:asistencia.obs_general_modal_message')}
        confirmLabel={t('facilitador:asistencia.obs_general_modal_confirm')}
        onCancel={() => setConfirmarCorreo(false)}
        onConfirm={() => {
          setConfirmarCorreo(false);
          enviarObservacion();
        }}
      />
    </div>
  );
}
