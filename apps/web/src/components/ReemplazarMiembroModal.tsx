import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../shared/api/fetchWithErrorMapping';
import { Modal, Field, Button } from './ui';
import { toast } from './toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface CandidatoReemplazo {
  usuarioId: string;
  nombre: string;
  email?: string | null;
}

// HU-21: reemplazo atómico saliente → entrante dentro de un grupo. Compartido entre
// el portal del facilitador y el drawer del admin (`endpointBase`).
export function ReemplazarMiembroModal({
  endpointBase, grupoId, grupoNombre, saliente, candidatos, onClose, onSaved,
}: {
  endpointBase: 'admin' | 'facilitador';
  grupoId: string;
  grupoNombre: string;
  saliente: { usuarioId: string; nombre: string };
  /** Participantes sin grupo (RN-04). */
  candidatos: CandidatoReemplazo[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(['facilitador', 'common']);
  const [entranteId, setEntranteId] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entranteId || saving) return;
    setSaving(true);
    try {
      await fetchWithErrorMapping(`${API_URL}/${endpointBase}/grupos/${grupoId}/miembros/reemplazar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salienteId: saliente.usuarioId, entranteId }),
      });
      toast.success(t('facilitador:grupos.reemplazado'));
      onSaved();
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  const entrante = candidatos.find((c) => c.usuarioId === entranteId);

  return (
    <Modal isOpen onClose={onClose} title={t('facilitador:grupos.reemplazar_title')} maxWidth={440}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{grupoNombre}</div>
        <Field label={t('facilitador:grupos.reemplazar_saliente')}>
          <input className="input" value={saliente.nombre} readOnly disabled />
        </Field>
        {candidatos.length === 0 ? (
          <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
            {t('facilitador:grupos.sin_candidatos')}
          </div>
        ) : (
          <Field label={t('facilitador:grupos.reemplazar_entrante')} required>
            <select className="input" value={entranteId} onChange={(e) => setEntranteId(e.target.value)} required autoFocus>
              <option value="">{t('facilitador:grupos.asignar')}</option>
              {candidatos.map((c) => (
                <option key={c.usuarioId} value={c.usuarioId}>
                  {c.nombre}{c.email ? ` — ${c.email}` : ''}
                </option>
              ))}
            </select>
          </Field>
        )}
        {entrante && (
          <div style={{ fontSize: '0.9rem', color: 'var(--color-text-heading)' }}>
            {saliente.nombre} → {entrante.nombre}
          </div>
        )}
        <div className="form-footer">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t('common:buttons.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={saving || !entranteId}>
            {saving ? t('common:actions.saving') : t('facilitador:grupos.reemplazar')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
