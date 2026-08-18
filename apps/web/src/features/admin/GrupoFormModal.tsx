import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Modal, Field } from '../../components/ui';
import { toast } from '../../components/toast-store';
import type { Grupo } from './programas.types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// ─────────────────────────────────────────────────────────────
// Modal para crear / renombrar grupo (RF-14, solo danalytics_admin)
// ─────────────────────────────────────────────────────────────
export function GrupoFormModal({
  programaId, editing, onClose, onSaved,
}: {
  programaId: string;
  editing: Grupo | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState(editing?.nombre ?? '');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await fetchWithErrorMapping(`${API_URL}/admin/grupos/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre }),
        });
        toast.success(t('admin:programas.toast.group_updated'));
      } else {
        await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/grupos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre }),
        });
        toast.success(t('admin:programas.toast.group_created'));
      }
      onSaved();
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing ? t('admin:programas.grupos.modal.title_edit') : t('admin:programas.grupos.modal.title_create')}
      maxWidth={440}
    >
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label={t('admin:programas.grupos.fields.nombre')} required>
            <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} required autoFocus />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>{t('common:buttons.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !nombre.trim()}>
              {saving ? t('common:actions.saving') : t('common:buttons.save')}
            </button>
          </div>
        </form>
    </Modal>
  );
}
