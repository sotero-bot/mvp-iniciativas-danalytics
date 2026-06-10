import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type Plantilla = { id: string; nombre: string; descripcion?: string; orden?: number | null; _count: { pasos: number } };
type PlantillaJson = { nombre: string; descripcion?: string; orden?: number; pasos?: { titulo: string; objetivo?: string; usarIa?: boolean }[] };

export function PlantillasPage() {
  const { t } = useTranslation(['methodology', 'common']);
  const [list, setList] = useState<Plantilla[]>([]);
  const [form, setForm] = useState({ nombre: '', descripcion: '', orden: '' });
  const [wasValidated, setWasValidated] = useState(false);
  const [editModal, setEditModal] = useState<Plantilla | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '', descripcion: '', orden: '' });
  const [editWasValidated, setEditWasValidated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string; nombre: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/plantillas`);
      setList(await res.json());
    } catch (err) {
      showToast(translateError(err));
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
      showToast(t('methodology:plantillas.toast.created'));
    } catch (err) {
      showToast(translateError(err) || t('methodology:plantillas.toast.create_error'));
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
      showToast(t('methodology:plantillas.toast.updated'));
    } catch (err) {
      showToast(translateError(err) || t('methodology:plantillas.toast.update_error'));
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
      showToast(t('methodology:plantillas.toast.deleted'));
    } catch (err) {
      showToast(translateError(err));
    }
  };

  return (
    <div>
      {toast && <div className="toast">{toast}</div>}

      <ConfirmModal
        isOpen={!!deleteModal}
        title={t('methodology:plantillas.delete_modal.title')}
        message={t('methodology:plantillas.delete_modal.message', { nombre: deleteModal?.nombre ?? '' })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(null)}
      />

      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>{t('methodology:plantillas.edit_modal_title')}</h3>
              <button onClick={() => setEditModal(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '1.25rem', color: 'var(--color-text-secondary)', lineHeight: 1, padding: 4,
              }}>×</button>
            </div>
            <form
              className={editWasValidated ? 'was-validated' : ''}
              onSubmit={handleEdit}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              noValidate
            >
              <div>
                <label className="required-label" style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>{t('methodology:plantillas.fields.nombre')}</label>
                <input className="input" required value={editForm.nombre}
                  onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} />
                <div className="invalid-feedback">{t('methodology:plantillas.validation.nombre_required')}</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>{t('methodology:plantillas.fields.descripcion')}</label>
                <textarea className="input" rows={4} value={editForm.descripcion}
                  onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>
                  {t('methodology:plantillas.fields.orden_label')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{t('methodology:plantillas.optional_label')}</span>
                </label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  placeholder={t('methodology:plantillas.placeholders.orden')}
                  value={editForm.orden}
                  onChange={e => setEditForm({ ...editForm, orden: e.target.value })}
                  style={{ maxWidth: 160 }}
                />
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--color-text-tertiary)' }}>
                  {t('methodology:plantillas.orden_help')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditModal(null)}>{t('common:buttons.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? t('common:buttons.saving_short') : t('common:buttons.save_changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="modal-overlay" onClick={() => setImportOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>{t('methodology:plantillas.import.title')}</h3>
              <button onClick={() => setImportOpen(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '1.25rem', color: 'var(--color-text-secondary)', lineHeight: 1, padding: 4,
              }}>×</button>
            </div>

            {!importPreview && !importResult && (
              <div
                onDragOver={e => { e.preventDefault(); setImportDragging(true); }}
                onDragLeave={() => setImportDragging(false)}
                onDrop={e => { e.preventDefault(); setImportDragging(false); const f = e.dataTransfer.files[0]; if (f) parseImportFile(f); }}
                onClick={() => importInputRef.current?.click()}
                style={{
                  border: `2px dashed ${importDragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: 8, padding: '40px 24px', textAlign: 'center', cursor: 'pointer',
                  background: importDragging ? 'var(--color-primary-light, #f0f7ff)' : 'var(--color-bg-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>📂</div>
                <p style={{ margin: 0, fontWeight: 500, color: 'var(--color-text-main)' }}>
                  {importFileName || t('methodology:plantillas.import.drop_zone')}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                  {t('methodology:plantillas.import.drop_zone_hint')}
                </p>
                <input ref={importInputRef} type="file" accept=".json" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) parseImportFile(f); }} />
              </div>
            )}

            {importError && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: '0.875rem' }}>
                {importError}
              </div>
            )}

            {importPreview && (
              <div style={{ marginTop: 16 }}>
                <p style={{ margin: '0 0 10px', fontWeight: 500, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  {t('methodology:plantillas.import.preview', { count: importPreview.length })}
                </p>
                <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {importPreview.map((p, i) => (
                    <div key={i} style={{ background: 'var(--color-bg-secondary)', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {p.orden != null && (
                          <span style={{ fontSize: '0.7rem', background: '#e0e7ff', color: '#3730a3', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>
                            #{p.orden}
                          </span>
                        )}
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.nombre}</div>
                      </div>
                      {p.descripcion && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>{p.descripcion}</div>}
                      {p.pasos && p.pasos.length > 0 && (
                        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {p.pasos.map((paso, j) => (
                            <li key={j} style={{ fontSize: '0.8rem', color: 'var(--color-text-main)' }}>
                              {paso.titulo}
                              {paso.usarIa && <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#dbeafe', color: '#1d4ed8', borderRadius: 4, padding: '1px 5px' }}>{t('methodology:plantillas.import.ia_badge')}</span>}
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
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button className="btn btn-secondary" onClick={() => { setImportPreview(null); setImportFileName(''); }}>{t('methodology:plantillas.import.change_file')}</button>
                  <button className="btn btn-primary" disabled={importLoading} onClick={handleImport}>
                    {importLoading ? t('methodology:plantillas.import.importing') : t('methodology:plantillas.import.import', { count: importPreview.length })}
                  </button>
                </div>
              </div>
            )}

            {importResult && (
              <div style={{ marginTop: 16 }}>
                <div style={{ padding: '14px 16px', borderRadius: 8, background: '#dcfce7', color: '#15803d', marginBottom: 14 }}>
                  <strong>{t('methodology:plantillas.import.success')}</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.875rem' }}>
                    {t('methodology:plantillas.import.result_plantillas', { count: importResult.plantillasCreadas })} · {t('methodology:plantillas.import.result_pasos', { count: importResult.pasosCreados })}
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={() => setImportOpen(false)}>{t('common:buttons.close')}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>{t('methodology:plantillas.page_title')}</h1>
          <p className="page-description">
            {t('methodology:plantillas.page_description')}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={openImport}>{t('methodology:plantillas.import_button')}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>

        {/* Formulario crear */}
        <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: '20px' }}>
          <h3 style={{ margin: '0 0 4px' }}>{t('methodology:plantillas.create_section_title')}</h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.8125rem' }}>
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
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            noValidate
          >
            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 5 }}>{t('methodology:plantillas.fields.nombre')}</label>
              <input className="input" required placeholder={t('methodology:plantillas.placeholders.nombre')}
                value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
              <div className="invalid-feedback">{t('methodology:plantillas.validation.nombre_required')}</div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>{t('methodology:plantillas.fields.descripcion')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{t('methodology:plantillas.optional_label')}</span></label>
              <textarea className="input" placeholder={t('methodology:plantillas.placeholders.descripcion')}
                value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                rows={3} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>
                {t('methodology:plantillas.fields.orden_label')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{t('methodology:plantillas.optional_label')}</span>
              </label>
              <input
                className="input"
                type="number"
                min="1"
                placeholder={t('methodology:plantillas.placeholders.orden')}
                value={form.orden}
                onChange={e => setForm({ ...form, orden: e.target.value })}
              />
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--color-text-tertiary)' }}>
                {t('methodology:plantillas.orden_help_alt')}
              </p>
            </div>
            <button type="submit" className="btn btn-primary">{t('methodology:plantillas.create_submit')}</button>
          </form>
        </div>

        {/* Lista */}
        <div>
          {loaded && list.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <p className="empty-state-title">{t('methodology:plantillas.empty.title')}</p>
                <p className="empty-state-desc">
                  {t('methodology:plantillas.empty.description')}
                </p>
              </div>
            </div>
          ) : (
            list.map(p => (
              <div key={p.id} className="card" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {p.orden != null && (
                        <span style={{
                          fontSize: '0.7rem', background: '#e0e7ff', color: '#3730a3',
                          borderRadius: 4, padding: '2px 8px', fontWeight: 700,
                        }}>
                          {t('methodology:plantillas.step_badge', { num: p.orden })}
                        </span>
                      )}
                      {p._count.pasos > 0 ? (
                        <span className="status-badge status-info" style={{ fontSize: '0.7rem' }}>
                          {t('methodology:plantillas.pasos_count', { count: p._count.pasos })}
                        </span>
                      ) : (
                        <span className="status-badge status-warning" style={{ fontSize: '0.7rem' }}>{t('methodology:plantillas.no_pasos')}</span>
                      )}
                    </div>
                    <h3 style={{ margin: '0 0 4px', color: 'var(--color-text-main)', fontSize: '1rem' }}>{p.nombre}</h3>
                    {p.descripcion && (
                      <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.8125rem', lineHeight: 1.5 }}>
                        {p.descripcion}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '0.82rem' }}
                      onClick={() => openEdit(p)}>
                      {t('common:buttons.edit')}
                    </button>
                    <Link to={`/admin/plantillas/${p.id}/pasos`} className="btn btn-primary"
                      style={{ padding: '5px 12px', fontSize: '0.82rem', textDecoration: 'none' }}>
                      {t('methodology:plantillas.configure_pasos')}
                    </Link>
                    <button className="btn btn-danger" style={{ padding: '5px 8px', fontSize: '0.875rem' }}
                      onClick={() => setDeleteModal({ id: p.id, nombre: p.nombre })} title={t('common:buttons.delete')}>
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
