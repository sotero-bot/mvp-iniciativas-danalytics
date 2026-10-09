import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../shared/api/fetchWithErrorMapping';
import { Modal, Field, Button } from './ui';
import { toast } from './toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface GrupoDestino {
  id: string;
  nombre: string;
  miembros: { usuarioId: string; usuario: { nombre: string } }[];
}

// HU-21: mover a un integrante a otro grupo del mismo programa o, opcionalmente,
// intercambiarlo con un integrante del grupo destino. Compartido entre facilitador y admin.
export function MoverMiembroModal({
  endpointBase, grupoId, grupoNombre, miembro, grupos, onClose, onSaved,
}: {
  endpointBase: 'admin' | 'facilitador';
  grupoId: string;
  grupoNombre: string;
  miembro: { usuarioId: string; nombre: string };
  /** Todos los grupos del programa; el de origen se excluye aquí. */
  grupos: GrupoDestino[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(['facilitador', 'common']);
  const [destinoId, setDestinoId] = useState('');
  const [conUsuarioId, setConUsuarioId] = useState('');
  const [saving, setSaving] = useState(false);

  const destinos = grupos.filter((g) => g.id !== grupoId);
  const destino = destinos.find((g) => g.id === destinoId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinoId || saving) return;
    setSaving(true);
    try {
      const intercambia = !!conUsuarioId;
      await fetchWithErrorMapping(
        `${API_URL}/${endpointBase}/grupos/${grupoId}/miembros/${intercambia ? 'intercambiar' : 'mover'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            intercambia
              ? { usuarioId: miembro.usuarioId, conUsuarioId }
              : { usuarioId: miembro.usuarioId, destinoGrupoId: destinoId },
          ),
        },
      );
      toast.success(t(intercambia ? 'facilitador:grupos.intercambiado' : 'facilitador:grupos.movido'));
      onSaved();
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={t('facilitador:grupos.mover_title')} maxWidth={440}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label={t('facilitador:grupos.mover_integrante')}>
          <input className="input" value={`${miembro.nombre} (${grupoNombre})`} readOnly disabled />
        </Field>
        {destinos.length === 0 ? (
          <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
            {t('facilitador:grupos.sin_destinos')}
          </div>
        ) : (
          <Field label={t('facilitador:grupos.mover_destino')} required>
            <select
              className="input"
              value={destinoId}
              onChange={(e) => { setDestinoId(e.target.value); setConUsuarioId(''); }}
              required
              autoFocus
            >
              <option value="">{t('facilitador:grupos.mover_elegir_destino')}</option>
              {destinos.map((g) => (
                <option key={g.id} value={g.id}>{g.nombre} ({g.miembros.length})</option>
              ))}
            </select>
          </Field>
        )}
        {destino && destino.miembros.length > 0 && (
          <Field label={t('facilitador:grupos.mover_intercambiar_con')} hint={t('facilitador:grupos.mover_intercambiar_hint')}>
            <select className="input" value={conUsuarioId} onChange={(e) => setConUsuarioId(e.target.value)}>
              <option value="">{t('facilitador:grupos.mover_sin_intercambio')}</option>
              {destino.miembros.map((m) => (
                <option key={m.usuarioId} value={m.usuarioId}>{m.usuario.nombre}</option>
              ))}
            </select>
          </Field>
        )}
        <div className="form-footer">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t('common:buttons.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={saving || !destinoId}>
            {saving ? t('common:actions.saving') : t(conUsuarioId ? 'facilitador:grupos.intercambiar' : 'facilitador:grupos.mover')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
