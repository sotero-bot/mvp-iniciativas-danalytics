import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';


const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Empresa {
  id: string;
  nombre: string;
  sector?: string | null;
  tipoOrganizacion?: string | null;
  logoUrl?: string | null;
  createdAt: string;
  contextoPdfNombre?: string | null;
  contextoPdfActualizadoEn?: string | null;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function LogoPreview({ src, nombre, size = 32 }: { src?: string | null; nombre: string; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={nombre}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'contain', border: '1px solid #E2E8F0', background: '#fff' }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #2563EB, #0F172A)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35 + 'px', fontWeight: 700, color: 'white', flexShrink: 0,
    }}>
      {nombre.charAt(0).toUpperCase()}
    </div>
  );
}

function LogoUploadField({
  current,
  onChange,
}: {
  current?: string | null;
  onChange: (base64: string | null) => void;
}) {
  const { t } = useTranslation(['organization']);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current ?? null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const b64 = await toBase64(file);
    setPreview(b64);
    onChange(b64);
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {preview ? (
        <img
          src={preview}
          alt="Logo"
          style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'contain', border: '1px solid #E2E8F0', background: '#F8FAFC' }}
        />
      ) : (
        <div style={{
          width: 48, height: 48, borderRadius: 8,
          background: '#F1F5F9', border: '1px dashed #CBD5E1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.25rem', color: '#94A3B8',
        }}>🖼</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', fontSize: '0.8rem',
          background: '#EFF6FF', color: '#2563EB',
          borderRadius: 6, cursor: 'pointer', fontWeight: 500,
          border: '1px solid #BFDBFE', width: 'fit-content',
        }}>
          {preview ? t('organization:empresas.logo_field.change_logo') : t('organization:empresas.logo_field.upload_logo')}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </label>
        {preview && (
          <button
            type="button"
            onClick={handleRemove}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.75rem', color: '#EF4444', textAlign: 'left', padding: 0,
            }}
          >
            {t('organization:empresas.logo_field.remove_logo')}
          </button>
        )}
        <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{t('organization:empresas.logo_field.format_hint')}</span>
      </div>
    </div>
  );
}

export function EmpresasPage() {
  const { t } = useTranslation(['organization', 'common']);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [nombre, setNombre] = useState('');
  const [sector, setSector] = useState('');
  const [tipoOrganizacion, setTipoOrganizacion] = useState('');
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [createPdfFile, setCreatePdfFile] = useState<File | null>(null);
  const [wasValidated, setWasValidated] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string; nombre: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [editModal, setEditModal] = useState<Empresa | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editSector, setEditSector] = useState('');
  const [editTipoOrganizacion, setEditTipoOrganizacion] = useState('');
  const [editLogoBase64, setEditLogoBase64] = useState<string | null | undefined>(undefined);
  const [editWasValidated, setEditWasValidated] = useState(false);
  const [editPdfFile, setEditPdfFile] = useState<File | null>(null);
  const [editPdfRemove, setEditPdfRemove] = useState(false);
  const [saving, setSaving] = useState(false);


  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/organization/empresas`);
      setEmpresas(await res.json());
    } catch (err) {
      showToast(translateError(err));
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!nombre) return;
    const body: any = { nombre, sector, tipoOrganizacion };
    if (logoBase64 !== null) body.logoUrl = logoBase64;
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/organization/empresas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (createPdfFile) {
        const created = await res.json();
        const fd = new FormData();
        fd.append('archivo', createPdfFile);
        await fetchWithErrorMapping(`${API_URL}/organization/empresas/${created.id}/contexto-pdf`, { method: 'POST', body: fd });
      }
      setNombre('');
      setSector('');
      setTipoOrganizacion('');
      setLogoBase64(null);
      setCreatePdfFile(null);
      setWasValidated(false);
      load();
      showToast(t('organization:empresas.toast.created'));
    } catch (err) {
      showToast(translateError(err));
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await fetchWithErrorMapping(`${API_URL}/organization/empresas/${deleteModal.id}`, { method: 'DELETE' });
      setDeleteModal(null);
      load();
      showToast(t('organization:empresas.toast.deleted'));
    } catch (err) {
      showToast(translateError(err));
    }
  };

  const openEdit = (emp: Empresa) => {
    setEditModal(emp);
    setEditNombre(emp.nombre);
    setEditSector(emp.sector ?? '');
    setEditTipoOrganizacion(emp.tipoOrganizacion ?? '');
    setEditLogoBase64(undefined);
    setEditWasValidated(false);
    setEditPdfFile(null);
    setEditPdfRemove(false);
  };

  const handleEdit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    setEditWasValidated(true);
    if (!form.checkValidity()) return;
    if (!editModal) return;
    setSaving(true);
    try {
      const body: any = { nombre: editNombre, sector: editSector, tipoOrganizacion: editTipoOrganizacion };
      if (editLogoBase64 !== undefined) body.logoUrl = editLogoBase64;
      await fetchWithErrorMapping(`${API_URL}/organization/empresas/${editModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (editPdfRemove) {
        await fetchWithErrorMapping(`${API_URL}/organization/empresas/${editModal.id}/contexto-pdf`, { method: 'DELETE' });
      } else if (editPdfFile) {
        const fd = new FormData();
        fd.append('archivo', editPdfFile);
        await fetchWithErrorMapping(`${API_URL}/organization/empresas/${editModal.id}/contexto-pdf`, { method: 'POST', body: fd });
      }
      setEditModal(null);
      load();
      showToast(t('organization:empresas.toast.updated'));
    } catch (err) {
      showToast(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {toast && <div className="toast">{toast}</div>}

      <ConfirmModal
        isOpen={!!deleteModal}
        title={t('organization:empresas.delete_modal.title')}
        message={t('organization:empresas.delete_modal.message', { nombre: deleteModal?.nombre ?? '' })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(null)}
      />

      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>{t('organization:empresas.edit_modal_title')}</h3>
              <button onClick={() => setEditModal(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '1.25rem', color: 'var(--color-text-secondary)', lineHeight: 1, padding: 4,
              }}>×</button>
            </div>
            <form
              className={editWasValidated ? 'was-validated' : ''}
              onSubmit={handleEdit}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
              noValidate
            >
              <div>
                <label className="required-label" style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: '0.875rem' }}>{t('organization:empresas.fields.nombre')}</label>
                <input className="input" value={editNombre} onChange={e => setEditNombre(e.target.value)} required />
                <div className="invalid-feedback">{t('organization:empresas.validation.nombre_required_short')}</div>
              </div>
              <div>
                <label className="required-label" style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: '0.875rem' }}>{t('organization:empresas.fields.sector')}</label>
                <input
                  className="input"
                  required
                  value={editSector}
                  onChange={e => setEditSector(e.target.value)}
                  placeholder={t('organization:empresas.placeholders.sector')}
                />
                <div className="invalid-feedback">{t('organization:empresas.validation.sector_required')}</div>
              </div>
              <div>
                <label className="required-label" style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: '0.875rem' }}>{t('organization:empresas.fields.tipo_organizacion')}</label>
                <input
                  className="input"
                  required
                  value={editTipoOrganizacion}
                  onChange={e => setEditTipoOrganizacion(e.target.value)}
                  placeholder={t('organization:empresas.placeholders.tipo_organizacion')}
                />
                <div className="invalid-feedback">{t('organization:empresas.validation.tipo_organizacion_required')}</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: '0.875rem' }}>{t('organization:empresas.fields.logo')}</label>
                <LogoUploadField
                  current={editLogoBase64 !== undefined ? editLogoBase64 : editModal.logoUrl}
                  onChange={setEditLogoBase64}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: '0.875rem' }}>
                  {t('organization:empresas.fields.contexto_pdf')} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>{t('organization:empresas.pdf_field.optional')}</span>
                </label>
                {editPdfRemove ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '0.8rem', color: '#EF4444' }}>{t('organization:empresas.pdf_field.will_delete_warning')}</span>
                    <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#64748B', padding: 0 }}
                      onClick={() => setEditPdfRemove(false)}>{t('organization:empresas.pdf_field.undo')}</button>
                  </div>
                ) : editPdfFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '0.8rem', color: '#0F172A' }}>📄 {editPdfFile.name}</span>
                    <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#EF4444', padding: 0 }}
                      onClick={() => setEditPdfFile(null)}>{t('organization:empresas.pdf_field.remove')}</button>
                  </div>
                ) : editModal.contextoPdfNombre ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 500,
                      background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0',
                    }}>
                      📄 {editModal.contextoPdfNombre}
                    </span>
                    <label style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
                      fontSize: '0.78rem', background: '#EFF6FF', color: '#2563EB',
                      borderRadius: 6, cursor: 'pointer', border: '1px solid #BFDBFE',
                    }}>
                      {t('organization:empresas.pdf_field.replace')}
                      <input type="file" accept=".pdf" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) setEditPdfFile(f); }} />
                    </label>
                    <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#EF4444', padding: 0 }}
                      onClick={() => setEditPdfRemove(true)}>{t('organization:empresas.pdf_field.remove_pdf')}</button>
                  </div>
                ) : (
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px',
                    fontSize: '0.8rem', background: '#EFF6FF', color: '#2563EB',
                    borderRadius: 6, cursor: 'pointer', border: '1px solid #BFDBFE', fontWeight: 500,
                  }}>
                    {t('organization:empresas.pdf_field.upload_pdf')}
                    <input type="file" accept=".pdf" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) setEditPdfFile(f); }} />
                  </label>
                )}
                <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: '#94A3B8' }}>
                  {t('organization:empresas.pdf_field.context_hint')}
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

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>{t('organization:empresas.page_title')}</h1>
          <p className="page-description">
            {t('organization:empresas.page_description')}
          </p>
        </div>
        {empresas.length > 0 && (
          <Link to="/admin/iniciativas" className="btn btn-secondary" style={{ textDecoration: 'none', flexShrink: 0 }}>
            {t('organization:empresas.next_iniciativas')}
          </Link>
        )}
      </div>

      {/* Create form */}
      <div className="card mb-4" style={{ maxWidth: '560px' }}>
        <h3 style={{ margin: '0 0 4px' }}>{t('organization:empresas.create_section_title')}</h3>
        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem' }}>{t('organization:empresas.create_section_subtitle')}</p>
        <form
          className={wasValidated ? 'was-validated' : ''}
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            setWasValidated(true);
            if (form.checkValidity()) create();
          }}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div>
            <input
              className="input"
              required
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder={t('organization:empresas.placeholders.nombre')}
            />
            <div className="invalid-feedback">{t('organization:empresas.validation.nombre_required')}</div>
          </div>
          <div>
            <label className="required-label" style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: '0.875rem' }}>{t('organization:empresas.fields.sector')}</label>
            <input
              className="input"
              required
              value={sector}
              onChange={e => setSector(e.target.value)}
              placeholder={t('organization:empresas.placeholders.sector')}
            />
            <div className="invalid-feedback">{t('organization:empresas.validation.sector_required')}</div>
          </div>
          <div>
            <label className="required-label" style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: '0.875rem' }}>{t('organization:empresas.fields.tipo_organizacion')}</label>
            <input
              className="input"
              required
              value={tipoOrganizacion}
              onChange={e => setTipoOrganizacion(e.target.value)}
              placeholder={t('organization:empresas.placeholders.tipo_organizacion')}
            />
            <div className="invalid-feedback">{t('organization:empresas.validation.tipo_organizacion_required')}</div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: '0.875rem' }}>{t('organization:empresas.fields.logo')} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>{t('organization:empresas.logo_field.optional')}</span></label>
            <LogoUploadField current={logoBase64} onChange={setLogoBase64} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: '0.875rem' }}>{t('organization:empresas.fields.contexto_pdf')} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>{t('organization:empresas.pdf_field.optional')}</span></label>
            {createPdfFile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.8rem', color: '#0F172A' }}>📄 {createPdfFile.name}</span>
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#EF4444', padding: 0 }}
                  onClick={() => setCreatePdfFile(null)}>{t('organization:empresas.pdf_field.remove')}</button>
              </div>
            ) : (
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px',
                fontSize: '0.8rem', background: '#EFF6FF', color: '#2563EB',
                borderRadius: 6, cursor: 'pointer', border: '1px solid #BFDBFE', fontWeight: 500,
              }}>
                {t('organization:empresas.pdf_field.upload_pdf')}
                <input type="file" accept=".pdf" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) setCreatePdfFile(f); }} />
              </label>
            )}
            <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: '#94A3B8' }}>
              {t('organization:empresas.pdf_field.context_hint')}
            </p>
          </div>
          <div>
            <button type="submit" className="btn btn-primary">{t('organization:empresas.create_submit')}</button>
          </div>
        </form>
      </div>

      {/* Table or empty state */}
      {empresas.length === 0 ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="empty-state">
            <div className="empty-state-icon">🏢</div>
            <p className="empty-state-title">{t('organization:empresas.empty.title')}</p>
            <p className="empty-state-desc">
              {t('organization:empresas.empty.description')}
            </p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table cellPadding={0} cellSpacing={0}>
            <thead>
              <tr>
                <th>{t('organization:empresas.table.empresa')}</th>
                <th>{t('organization:empresas.table.contexto_pdf')}</th>
                <th>{t('organization:empresas.table.created')}</th>
                <th style={{ textAlign: 'right' }}>{t('organization:empresas.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <LogoPreview src={emp.logoUrl} nombre={emp.nombre} size={32} />
                      <span style={{ fontWeight: 500 }}>{emp.nombre}</span>
                    </div>
                  </td>
                  <td>
                    {emp.contextoPdfNombre ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: '0.75rem', fontWeight: 500,
                        padding: '2px 9px', borderRadius: 20,
                        background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0',
                      }} title={emp.contextoPdfNombre}>
                        {t('organization:empresas.table.pdf_uploaded')}
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: '0.75rem', fontWeight: 500,
                        padding: '2px 9px', borderRadius: 20,
                        background: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0',
                      }}>
                        {t('organization:empresas.table.pdf_missing')}
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                    {new Date(emp.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                        onClick={() => openEdit(emp)}
                      >
                        {t('common:buttons.edit')}
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '4px 8px', fontSize: '0.875rem' }}
                        onClick={() => setDeleteModal({ id: emp.id, nombre: emp.nombre })}
                        title={t('common:buttons.delete')}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Next step hint */}
      {empresas.length > 0 && (
        <div style={{
          marginTop: '1.25rem',
          padding: '0.875rem 1.25rem',
          background: '#F0F9FF',
          border: '1px solid #BAE6FD',
          borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', gap: '0.875rem',
        }}>
          <span style={{ fontSize: '1rem' }}>💡</span>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#0369A1' }}>
            <strong>{t('organization:empresas.next_step.label')}</strong> {t('organization:empresas.next_step.text')}
          </p>
          <Link to="/admin/iniciativas" className="btn btn-secondary"
            style={{ textDecoration: 'none', flexShrink: 0, padding: '4px 12px', fontSize: '0.8rem' }}>
            {t('organization:empresas.next_step.link')}
          </Link>
        </div>
      )}
    </div>
  );
}
