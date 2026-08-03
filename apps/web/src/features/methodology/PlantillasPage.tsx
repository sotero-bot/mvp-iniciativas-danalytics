import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Modal, Field, Alert, EmptyState, Breadcrumb, PageHeader, Button, StatusBadge, FormListLayout, DataTable, Pagination } from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { toast } from '../../components/toast-store';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const PAGE_SIZE = 8;

type Plantilla = { id: string; nombre: string; descripcion?: string; orden?: number | null; _count: { pasos: number } };
type PlantillaJson = { nombre: string; descripcion?: string; orden?: number; pasos?: { titulo: string; objetivo?: string; usarIa?: boolean }[] };

export function PlantillasPage() {
  const { t } = useTranslation(['methodology', 'admin', 'common']);
  const [list, setList] = useState<Plantilla[]>([]);
  const [form, setForm] = useState({ nombre: '', descripcion: '', orden: '' });
  const [wasValidated, setWasValidated] = useState(false);
  const [editModal, setEditModal] = useState<Plantilla | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '', descripcion: '', orden: '' });
  const [editWasValidated, setEditWasValidated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string; nombre: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);

  const importInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<PlantillaJson[] | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importError, setImportError] = useState('');
  const [importDragging, setImportDragging] = useState(false);

  const openImport = () => { setImportOpen(true); setImportPreview(null); setImportFileName(''); setImportResult(null); setImportError(''); };

  const parseImportFile = (file: File) => {
    setImportResult(null); setImportError(''); setImportFileName(file.name);
    if (!file.name.endsWith('.json')) { setImportError(t('methodology:plantillas.import.error_invalid_extension')); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        const items: PlantillaJson[] = Array.isArray(parsed) ? parsed : [parsed];
        if (!items[0]?.nombre) { setImportError(t('methodology:plantillas.import.error_missing_name')); return; }
        setImportPreview(items);
        setImportError('');
      } catch { setImportError(t('methodology:plantillas.import.error_invalid_json')); }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importPreview) return;
    setImportLoading(true); setImportError('');
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/plantillas/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantillas: importPreview }),
      });
      const data = await res.json();
      setImportResult(data);
      setImportPreview(null);
      load();
    } catch (err) {
      setImportError(translateError(err));
    } finally {
      setImportLoading(false);
    }
  };

  const load = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/plantillas`);
      setList(await res.json());
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  useEffect(() => {
    load().then(() => setLoaded(true));
  }, []);

  const handleCreate = async () => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/plantillas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          descripcion: form.descripcion || undefined,
          orden: form.orden ? parseInt(form.orden) : undefined,
        }),
      });
      load();
      setForm({ nombre: '', descripcion: '', orden: '' });
      setWasValidated(false);
      toast.success(t('methodology:plantillas.toast.created'));
    } catch (err) {
      toast.error(translateError(err) || t('methodology:plantillas.toast.create_error'));
    }
  };

  const openEdit = (p: Plantilla) => {
    setEditModal(p);
    setEditForm({ nombre: p.nombre, descripcion: p.descripcion || '', orden: p.orden != null ? String(p.orden) : '' });
    setEditWasValidated(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formEl = e.currentTarget as HTMLFormElement;
    setEditWasValidated(true);
    if (!formEl.checkValidity()) return;
    setSaving(true);
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/plantillas/${editModal!.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: editForm.nombre,
          descripcion: editForm.descripcion || undefined,
          orden: editForm.orden ? parseInt(editForm.orden) : null,
        }),
      });
      load();
      setEditModal(null);
      toast.success(t('methodology:plantillas.toast.updated'));
    } catch (err) {
      toast.error(translateError(err) || t('methodology:plantillas.toast.update_error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/plantillas/${deleteModal.id}`, { method: 'DELETE' });
      setDeleteModal(null);
      load();
      toast.success(t('methodology:plantillas.toast.deleted'));
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [list, currentPage],
  );

  const columns: DataTableColumn<Plantilla>[] = [
    {
      key: 'paso',
      header: t('methodology:plantillas.table.paso'),
      render: (p) => p.orden != null ? <StatusBadge variant="neutral">{t('methodology:plantillas.step_badge', { num: p.orden })}</StatusBadge> : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>,
    },
    {
      key: 'nombre',
      header: t('methodology:plantillas.table.nombre'),
      render: (p) => (
        <div>
          <strong>{p.nombre}</strong>
          {p.descripcion && (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem', marginTop: 2 }}>{p.descripcion}</div>
          )}
        </div>
      ),
    },
    {
      key: 'pasos',
      header: t('methodology:plantillas.table.pasos'),
      render: (p) => p._count.pasos > 0
        ? <StatusBadge variant="info">{t('methodology:plantillas.pasos_count', { count: p._count.pasos })}</StatusBadge>
        : <StatusBadge variant="warning">{t('methodology:plantillas.no_pasos')}</StatusBadge>,
    },
    {
      key: 'actions',
      header: t('methodology:plantillas.table.actions'),
      align: 'right',
      render: (p) => (
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>
            {t('common:buttons.edit')}
          </Button>
          <Link to={`/admin/plantillas/${p.id}/pasos`} className="btn btn-primary btn-sm">
            {t('methodology:plantillas.configure_pasos')}
          </Link>
          <Button variant="danger" size="sm" onClick={() => setDeleteModal({ id: p.id, nombre: p.nombre })}
            title={t('common:buttons.delete')} aria-label={t('common:buttons.delete')}>
            🗑️
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <ConfirmModal
        isOpen={!!deleteModal}
        title={t('methodology:plantillas.delete_modal.title')}
        message={t('methodology:plantillas.delete_modal.message', { nombre: deleteModal?.nombre ?? '' })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(null)}
      />

      <Modal
        isOpen={!!editModal}
        onClose={() => setEditModal(null)}
        title={t('methodology:plantillas.edit_modal_title')}
        maxWidth={520}
      >
        <form
          className={editWasValidated ? 'was-validated' : ''}
          onSubmit={handleEdit}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          noValidate
        >
          <Field label={t('methodology:plantillas.fields.nombre')} required htmlFor="edit-plantilla-nombre">
            <>
              <input id="edit-plantilla-nombre" className="input" required value={editForm.nombre}
                onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} />
              <div className="invalid-feedback">{t('methodology:plantillas.validation.nombre_required')}</div>
            </>
          </Field>
          <Field label={t('methodology:plantillas.fields.descripcion')}>
            <textarea className="input" rows={4} value={editForm.descripcion}
              onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} />
          </Field>
          <Field
            label={<>{t('methodology:plantillas.fields.orden_label')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{t('methodology:plantillas.optional_label')}</span></>}
            hint={t('methodology:plantillas.orden_help')}
          >
            <input
              className="input"
              type="number"
              min="1"
              placeholder={t('methodology:plantillas.placeholders.orden')}
              value={editForm.orden}
              onChange={e => setEditForm({ ...editForm, orden: e.target.value })}
              style={{ maxWidth: 160 }}
            />
          </Field>
          <div className="form-footer">
            <Button type="button" variant="secondary" onClick={() => setEditModal(null)}>{t('common:buttons.cancel')}</Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? t('common:buttons.saving_short') : t('common:buttons.save_changes')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title={t('methodology:plantillas.import.title')}
        maxWidth={580}
      >
        {!importPreview && !importResult && (
          <div
            onDragOver={e => { e.preventDefault(); setImportDragging(true); }}
            onDragLeave={() => setImportDragging(false)}
            onDrop={e => { e.preventDefault(); setImportDragging(false); const f = e.dataTransfer.files[0]; if (f) parseImportFile(f); }}
            onClick={() => importInputRef.current?.click()}
            style={{
              border: `2px dashed ${importDragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
              padding: 'var(--space-6) var(--space-5)', textAlign: 'center', cursor: 'pointer',
              background: importDragging ? 'var(--color-primary-light)' : 'var(--color-bg-subtle)',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>📂</div>
            <p style={{ margin: 0, fontWeight: 500, color: 'var(--color-text-main)' }}>
              {importFileName || t('methodology:plantillas.import.drop_zone')}
            </p>
            <p style={{ margin: 'var(--space-2) 0 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              {t('methodology:plantillas.import.drop_zone_hint')}
            </p>
            <input ref={importInputRef} type="file" accept=".json" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) parseImportFile(f); }} />
          </div>
        )}

        {importError && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Alert variant="danger">{importError}</Alert>
          </div>
        )}

        {importPreview && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <p style={{ margin: '0 0 var(--space-2)', fontWeight: 500, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              {t('methodology:plantillas.import.preview', { count: importPreview.length })}
            </p>
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {importPreview.map((p, i) => (
                <div key={i} style={{ background: 'var(--color-bg-subtle)', padding: 'var(--space-3) var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                    {p.orden != null && <span className="chip">#{p.orden}</span>}
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.nombre}</div>
                  </div>
                  {p.descripcion && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>{p.descripcion}</div>}
                  {p.pasos && p.pasos.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {p.pasos.map((paso, j) => (
                        <li key={j} style={{ fontSize: '0.8rem', color: 'var(--color-text-main)' }}>
                          {paso.titulo}
                          {paso.usarIa && (
                            <span style={{ marginLeft: 'var(--space-2)', fontSize: '0.7rem', background: 'var(--color-primary-muted)', color: 'var(--color-primary-hover)', padding: '1px 5px' }}>
                              {t('methodology:plantillas.import.ia_badge')}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {(!p.pasos || p.pasos.length === 0) && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-tertiary)' }}>{t('methodology:plantillas.import.no_pasos')}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="form-footer" style={{ marginTop: 'var(--space-4)' }}>
              <Button variant="secondary" onClick={() => { setImportPreview(null); setImportFileName(''); }}>{t('methodology:plantillas.import.change_file')}</Button>
              <Button variant="primary" disabled={importLoading} onClick={handleImport}>
                {importLoading ? t('methodology:plantillas.import.importing') : t('methodology:plantillas.import.import', { count: importPreview.length })}
              </Button>
            </div>
          </div>
        )}

        {importResult && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Alert variant="success" title={t('methodology:plantillas.import.success')}>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>
                {t('methodology:plantillas.import.result_plantillas', { count: importResult.plantillasCreadas })} · {t('methodology:plantillas.import.result_pasos', { count: importResult.pasosCreados })}
              </p>
            </Alert>
            <div className="form-footer" style={{ marginTop: 'var(--space-4)' }}>
              <Button variant="primary" onClick={() => setImportOpen(false)}>{t('common:buttons.close')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/admin/inicio' },
          { label: t('admin:sidebar.plantillas') },
        ]}
      />

      <PageHeader
        title={t('methodology:plantillas.page_title')}
        description={<><strong>{t('admin:sidebar.decision_ia_label')}</strong> — {t('methodology:plantillas.page_description')}</>}
        actions={<Button variant="secondary" onClick={openImport}>{t('methodology:plantillas.import_button')}</Button>}
      />

      <FormListLayout
        form={
          <div className="card" style={{ position: 'sticky', top: 'var(--space-5)' }}>
            <h3 style={{ margin: '0 0 var(--space-1)' }}>{t('methodology:plantillas.create_section_title')}</h3>
            <p style={{ margin: '0 0 var(--space-4)', fontSize: '0.8125rem' }}>
              {t('methodology:plantillas.create_section_subtitle')}
            </p>
            <form
              className={wasValidated ? 'was-validated' : ''}
              onSubmit={(e) => {
                e.preventDefault();
                const formEl = e.currentTarget;
                setWasValidated(true);
                if (formEl.checkValidity()) handleCreate();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
              noValidate
            >
              <Field label={t('methodology:plantillas.fields.nombre')} required htmlFor="new-plantilla-nombre">
                <>
                  <input id="new-plantilla-nombre" className="input" required placeholder={t('methodology:plantillas.placeholders.nombre')}
                    value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                  <div className="invalid-feedback">{t('methodology:plantillas.validation.nombre_required')}</div>
                </>
              </Field>
              <Field label={<>{t('methodology:plantillas.fields.descripcion')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{t('methodology:plantillas.optional_label')}</span></>}>
                <textarea className="input" placeholder={t('methodology:plantillas.placeholders.descripcion')}
                  value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  rows={3} />
              </Field>
              <Field
                label={<>{t('methodology:plantillas.fields.orden_label')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{t('methodology:plantillas.optional_label')}</span></>}
                hint={t('methodology:plantillas.orden_help_alt')}
              >
                <input
                  className="input"
                  type="number"
                  min="1"
                  placeholder={t('methodology:plantillas.placeholders.orden')}
                  value={form.orden}
                  onChange={e => setForm({ ...form, orden: e.target.value })}
                />
              </Field>
              <Button type="submit" variant="primary" block>{t('methodology:plantillas.create_submit')}</Button>
            </form>
          </div>
        }
        list={
          loaded && list.length === 0 ? (
            <div className="card">
              <EmptyState
                icon="📋"
                title={t('methodology:plantillas.empty.title')}
                description={t('methodology:plantillas.empty.description')}
              />
            </div>
          ) : (
            <div className="section-card">
              <div className="section-card-header">
                <span className="section-card-title">{t('methodology:plantillas.table.header_title')}</span>
                <span className="count-badge">{list.length}</span>
              </div>
              <DataTable columns={columns} rows={pageRows} rowKey={p => p.id} />
              <Pagination
                page={currentPage}
                pageCount={totalPages}
                onPageChange={setPage}
                prevLabel={t('common:buttons.previous')}
                nextLabel={t('common:buttons.next')}
                info={t('methodology:plantillas.table.showing', {
                  from: (currentPage - 1) * PAGE_SIZE + 1,
                  to: Math.min(currentPage * PAGE_SIZE, list.length),
                  total: list.length,
                })}
              />
            </div>
          )
        }
      />
    </div>
  );
}
