import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Modal, Field, StatusBadge, EmptyState } from '../../components/ui';
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
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'contain', border: '1px solid var(--color-border)', background: 'var(--color-bg-card)' }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--color-primary), var(--color-text-main))',
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
          style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'contain', border: '1px solid var(--color-border)', background: 'var(--color-bg-page)' }}
        />
      ) : (
        <div style={{
          width: 48, height: 48, borderRadius: 8,
          background: 'var(--color-bg-subtle)', border: '1px dashed var(--color-border-strong)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.25rem', color: 'var(--color-text-tertiary)',
        }}>🖼</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', fontSize: '0.8rem',
          background: 'var(--color-primary-light)', color: 'var(--color-primary)',
          borderRadius: 6, cursor: 'pointer', fontWeight: 500,
          border: '1px solid var(--color-info-border)', width: 'fit-content',
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
            className="btn-link btn-link-danger"
            onClick={handleRemove}
            style={{ fontSize: '0.75rem', textAlign: 'left' }}
          >
            {t('organization:empresas.logo_field.remove_logo')}
          </button>
        )}
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>{t('organization:empresas.logo_field.format_hint')}</span>
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

      <Modal
        isOpen={!!editModal}
        onClose={() => setEditModal(null)}
        title={t('organization:empresas.edit_modal_title')}
        maxWidth={520}
      >
        {editModal && (
          <form
            className={editWasValidated ? 'was-validated' : ''}
            onSubmit={handleEdit}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            noValidate
          >
            <Field label={t('organization:empresas.fields.nombre')} htmlFor="emp-edit-nombre" required>
              <input id="emp-edit-nombre" className="input" value={editNombre} onChange={e => setEditNombre(e.target.value)} required />
              <div className="invalid-feedback">{t('organization:empresas.validation.nombre_required_short')}</div>
            </Field>
            <Field label={t('organization:empresas.fields.sector')} htmlFor="emp-edit-sector" required>
              <input
                id="emp-edit-sector"
                className="input"
                required
                value={editSector}
                onChange={e => setEditSector(e.target.value)}
                placeholder={t('organization:empresas.placeholders.sector')}
              />
              <div className="invalid-feedback">{t('organization:empresas.validation.sector_required')}</div>
            </Field>
            <Field label={t('organization:empresas.fields.tipo_organizacion')} htmlFor="emp-edit-tipo" required>
              <input
                id="emp-edit-tipo"
                className="input"
                required
                value={editTipoOrganizacion}
                onChange={e => setEditTipoOrganizacion(e.target.value)}
                placeholder={t('organization:empresas.placeholders.tipo_organizacion')}
              />
              <div className="invalid-feedback">{t('organization:empresas.validation.tipo_organizacion_required')}</div>
            </Field>
            <Field label={t('organization:empresas.fields.logo')}>
              <LogoUploadField
                current={editLogoBase64 !== undefined ? editLogoBase64 : editModal.logoUrl}
                onChange={setEditLogoBase64}
              />
            </Field>
            <Field
              label={<>{t('organization:empresas.fields.contexto_pdf')} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>{t('organization:empresas.pdf_field.optional')}</span></>}
              hint={t('organization:empresas.pdf_field.context_hint')}
            >
              {editPdfRemove ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>{t('organization:empresas.pdf_field.will_delete_warning')}</span>
                  <button type="button" className="btn-link" style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}
                    onClick={() => setEditPdfRemove(false)}>{t('organization:empresas.pdf_field.undo')}</button>
                </div>
              ) : editPdfFile ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-main)' }}>📄 {editPdfFile.name}</span>
                  <button type="button" className="btn-link btn-link-danger" style={{ fontSize: '0.75rem' }}
                    onClick={() => setEditPdfFile(null)}>{t('organization:empresas.pdf_field.remove')}</button>
                </div>
              ) : editModal.contextoPdfNombre ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StatusBadge variant="success">
                    📄 {editModal.contextoPdfNombre}
                  </StatusBadge>
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
                    fontSize: '0.78rem', background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                    borderRadius: 6, cursor: 'pointer', border: '1px solid var(--color-info-border)',
                  }}>
                    {t('organization:empresas.pdf_field.replace')}
                    <input type="file" accept=".pdf,.md" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) setEditPdfFile(f); }} />
                  </label>
                  <button type="button" className="btn-link btn-link-danger" style={{ fontSize: '0.75rem' }}
                    onClick={() => setEditPdfRemove(true)}>{t('organization:empresas.pdf_field.remove_pdf')}</button>
                </div>
              ) : (
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px',
                  fontSize: '0.8rem', background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                  borderRadius: 6, cursor: 'pointer', border: '1px solid var(--color-info-border)', fontWeight: 500,
                }}>
                  {t('organization:empresas.pdf_field.upload_pdf')}
                  <input type="file" accept=".pdf,.md" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) setEditPdfFile(f); }} />
                </label>
              )}
            </Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditModal(null)}>{t('common:buttons.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? t('common:buttons.saving_short') : t('common:buttons.save_changes')}
              </button>
            </div>
          </form>
        )}
      </Modal>

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
          <Field label={t('organization:empresas.fields.sector')} htmlFor="emp-sector" required>
            <input
              id="emp-sector"
              className="input"
              required
              value={sector}
              onChange={e => setSector(e.target.value)}
              placeholder={t('organization:empresas.placeholders.sector')}
            />
            <div className="invalid-feedback">{t('organization:empresas.validation.sector_required')}</div>
          </Field>
          <Field label={t('organization:empresas.fields.tipo_organizacion')} htmlFor="emp-tipo" required>
            <input
              id="emp-tipo"
              className="input"
              required
              value={tipoOrganizacion}
              onChange={e => setTipoOrganizacion(e.target.value)}
              placeholder={t('organization:empresas.placeholders.tipo_organizacion')}
            />
            <div className="invalid-feedback">{t('organization:empresas.validation.tipo_organizacion_required')}</div>
          </Field>
          <Field label={<>{t('organization:empresas.fields.logo')} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>{t('organization:empresas.logo_field.optional')}</span></>}>
            <LogoUploadField current={logoBase64} onChange={setLogoBase64} />
          </Field>
          <Field
            label={<>{t('organization:empresas.fields.contexto_pdf')} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>{t('organization:empresas.pdf_field.optional')}</span></>}
            hint={t('organization:empresas.pdf_field.context_hint')}
          >
            {createPdfFile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-main)' }}>📄 {createPdfFile.name}</span>
                <button type="button" className="btn-link btn-link-danger" style={{ fontSize: '0.75rem' }}
                  onClick={() => setCreatePdfFile(null)}>{t('organization:empresas.pdf_field.remove')}</button>
              </div>
            ) : (
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px',
                fontSize: '0.8rem', background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                borderRadius: 6, cursor: 'pointer', border: '1px solid var(--color-info-border)', fontWeight: 500,
              }}>
                {t('organization:empresas.pdf_field.upload_pdf')}
                <input type="file" accept=".pdf,.md" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) setCreatePdfFile(f); }} />
              </label>
            )}
          </Field>
          <div>
            <button type="submit" className="btn btn-primary">{t('organization:empresas.create_submit')}</button>
          </div>
        </form>
      </div>

      {/* Table or empty state */}
      {empresas.length === 0 ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <EmptyState
            icon="🏢"
            title={t('organization:empresas.empty.title')}
            description={t('organization:empresas.empty.description')}
          />
        </div>
      ) : (
        <div className="table-container">
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
                      <span title={emp.contextoPdfNombre}>
                        <StatusBadge variant="success">
                          {t('organization:empresas.table.pdf_uploaded')}
                        </StatusBadge>
                      </span>
                    ) : (
                      <StatusBadge variant="neutral">
                        {t('organization:empresas.table.pdf_missing')}
                      </StatusBadge>
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
