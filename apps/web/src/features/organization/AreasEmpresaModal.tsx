import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Modal, Field, Button, FormListLayout, DataTable, EmptyState, Loading } from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { toast } from '../../components/toast-store';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface AreaEmpresa {
  id: string;
  nombre: string;
  _count: { usuarios: number };
}

// HU-14: catálogo de áreas de una empresa (alta, renombrar, desactivar).
export function AreasEmpresaModal({
  empresa,
  onClose,
}: {
  empresa: { id: string; nombre: string } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation(['organization', 'common']);
  const [areas, setAreas] = useState<AreaEmpresa[]>([]);
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [editando, setEditando] = useState<AreaEmpresa | null>(null);
  const [saving, setSaving] = useState(false);
  const [aDesactivar, setADesactivar] = useState<AreaEmpresa | null>(null);

  const base = empresa ? `${API_URL}/organization/empresas/${empresa.id}/areas` : '';

  const load = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      const res = await fetchWithErrorMapping(base);
      setAreas(await res.json());
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    setNombre('');
    setEditando(null);
    setAreas([]);
    load();
  }, [load]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      await fetchWithErrorMapping(editando ? `${base}/${editando.id}` : base, {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      });
      toast.success(t(editando ? 'organization:areas.renombrada' : 'organization:areas.creada'));
      setNombre('');
      setEditando(null);
      await load();
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  const desactivar = async () => {
    if (!aDesactivar) return;
    try {
      await fetchWithErrorMapping(`${base}/${aDesactivar.id}`, { method: 'DELETE' });
      toast.success(t('organization:areas.desactivada'));
      setADesactivar(null);
      await load();
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const empezarEdicion = (area: AreaEmpresa) => {
    setEditando(area);
    setNombre(area.nombre);
  };

  const cancelarEdicion = () => {
    setEditando(null);
    setNombre('');
  };

  const columns: DataTableColumn<AreaEmpresa>[] = [
    {
      key: 'nombre',
      header: t('organization:areas.nombre'),
      render: (a) => <span style={{ fontWeight: 500 }}>{a.nombre}</span>,
    },
    {
      key: 'usuarios',
      header: t('organization:areas.usuarios_count'),
      render: (a) => a._count.usuarios,
    },
    {
      key: 'actions',
      header: t('common:labels.actions'),
      align: 'right',
      render: (a) => (
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <Button variant="secondary" size="sm" onClick={() => empezarEdicion(a)}>
            {t('organization:areas.renombrar')}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setADesactivar(a)}>
            {t('organization:areas.desactivar')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Modal
        isOpen={!!empresa}
        onClose={onClose}
        title={t('organization:areas.title', { empresa: empresa?.nombre ?? '' })}
        maxWidth={960}
      >
        <FormListLayout
          form={
            <form className="card" onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <h3 style={{ margin: 0 }}>
                {t(editando ? 'organization:areas.editar_title' : 'organization:areas.crear')}
              </h3>
              <Field label={t('organization:areas.nombre')} required>
                <input
                  className="input"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder={t('organization:areas.nombre_placeholder')}
                  required
                />
              </Field>
              <div className="form-footer">
                {editando && (
                  <Button type="button" variant="secondary" onClick={cancelarEdicion}>
                    {t('common:buttons.cancel')}
                  </Button>
                )}
                <Button type="submit" variant="primary" disabled={saving || !nombre.trim()}>
                  {saving
                    ? t('common:buttons.saving_short')
                    : t(editando ? 'common:buttons.save_changes' : 'organization:areas.crear')}
                </Button>
              </div>
            </form>
          }
          list={
            <div className="section-card">
              <div className="section-card-header">
                <span className="section-card-title">{t('organization:areas.list_title')}</span>
                <span className="count-badge">{areas.length}</span>
              </div>
              {loading && <Loading />}
              {!loading && areas.length === 0 && (
                <EmptyState
                  title={t('organization:areas.empty')}
                  description={t('organization:areas.empty_desc')}
                />
              )}
              {!loading && areas.length > 0 && (
                <DataTable columns={columns} rows={areas} rowKey={(a) => a.id} />
              )}
            </div>
          }
        />
      </Modal>

      <ConfirmModal
        isOpen={!!aDesactivar}
        title={t('organization:areas.desactivar_title')}
        message={t('organization:areas.desactivar_confirm', {
          nombre: aDesactivar?.nombre ?? '',
          count: aDesactivar?._count.usuarios ?? 0,
        })}
        confirmLabel={t('organization:areas.desactivar')}
        onConfirm={desactivar}
        onCancel={() => setADesactivar(null)}
      />
    </>
  );
}
