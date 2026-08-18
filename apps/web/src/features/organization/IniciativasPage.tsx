import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import {
  Modal, Field, StatusBadge, EmptyState,
  Breadcrumb, PageHeader, Button, FormListLayout, DataTable, Pagination,
} from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { toast } from '../../components/toast-store';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const PAGE_SIZE = 5;

interface Iniciativa {
  id: string;
  nombre: string;
  descripcion?: string;
  empresaId: string;
  empresa?: { nombre: string };
  createdAt: string;
}

interface Empresa {
  id: string;
  nombre: string;
}

export function IniciativasPage() {
  const { t } = useTranslation(['organization', 'admin', 'common']);
  const [iniciativas, setIniciativas] = useState<Iniciativa[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [wasValidated, setWasValidated] = useState(false);

  const [deleteModal, setDeleteModal] = useState<{ id: string; nombre: string } | null>(null);

  const [editModal, setEditModal] = useState<Iniciativa | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editEmpresaId, setEditEmpresaId] = useState('');
  const [editWasValidated, setEditWasValidated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(iniciativas.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => iniciativas.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [iniciativas, currentPage],
  );

  useEffect(() => {
    Promise.all([
      fetchWithErrorMapping(`${API_URL}/organization/iniciativas`).then(r => r.json()).catch(() => []),
      fetchWithErrorMapping(`${API_URL}/organization/empresas`).then(r => r.json()).catch(() => []),
    ]).then(([ini, emp]) => {
      setIniciativas(ini);
      setEmpresas(emp);
      setLoaded(true);
    });
  }, []);

  const fetchIniciativas = () => {
    fetchWithErrorMapping(`${API_URL}/organization/iniciativas`)
      .then(res => res.json())
      .then(setIniciativas)
      .catch(err => toast.error(translateError(err)));
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await fetchWithErrorMapping(`${API_URL}/organization/iniciativas/${deleteModal.id}`, { method: 'DELETE' });
      setDeleteModal(null);
      fetchIniciativas();
      toast.success(t('organization:iniciativas.toast.deleted'));
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithErrorMapping(`${API_URL}/organization/iniciativas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, descripcion, empresaId }),
      });
      setNombre('');
      setDescripcion('');
      setEmpresaId('');
      setWasValidated(false);
      fetchIniciativas();
      toast.success(t('organization:iniciativas.toast.created'));
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const openEdit = (ini: Iniciativa) => {
    setEditModal(ini);
    setEditNombre(ini.nombre);
    setEditDescripcion(ini.descripcion || '');
    setEditEmpresaId(ini.empresaId);
    setEditWasValidated(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    setEditWasValidated(true);
    if (!form.checkValidity()) return;
    if (!editModal) return;
    setSaving(true);
    try {
      await fetchWithErrorMapping(`${API_URL}/organization/iniciativas/${editModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editNombre, descripcion: editDescripcion, empresaId: editEmpresaId }),
      });
      setEditModal(null);
      fetchIniciativas();
      toast.success(t('organization:iniciativas.toast.updated'));
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<Iniciativa>[] = [
    {
      key: 'nombre',
      header: t('organization:iniciativas.table.nombre'),
      render: (ini) => <strong>{ini.nombre}</strong>,
    },
    {
      key: 'empresa',
      header: t('organization:iniciativas.table.empresa'),
      render: (ini) => <StatusBadge variant="neutral">{ini.empresa?.nombre}</StatusBadge>,
    },
    {
      key: 'descripcion',
      header: t('organization:iniciativas.table.descripcion'),
      render: (ini) => (
        ini.descripcion
          ? <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>{ini.descripcion}</span>
          : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
      ),
    },
    {
      key: 'actions',
      header: t('organization:iniciativas.table.actions'),
      align: 'right',
      render: (ini) => (
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <Button variant="secondary" size="sm" onClick={() => openEdit(ini)}>
            {t('common:buttons.edit')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setDeleteModal({ id: ini.id, nombre: ini.nombre })}
            title={t('common:buttons.delete')}
            aria-label={t('common:buttons.delete')}
          >
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
        title={t('organization:iniciativas.delete_modal.title')}
        message={t('organization:iniciativas.delete_modal.message', { nombre: deleteModal?.nombre ?? '' })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(null)}
      />

      <Modal
        isOpen={!!editModal}
        onClose={() => setEditModal(null)}
        title={t('organization:iniciativas.edit_modal_title')}
      >
        <form
          className={editWasValidated ? 'was-validated' : ''}
          onSubmit={handleEdit}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          noValidate
        >
          <Field label={t('organization:iniciativas.fields.empresa')} htmlFor="ini-edit-empresa" required>
            <select id="ini-edit-empresa" className="input" value={editEmpresaId} onChange={e => setEditEmpresaId(e.target.value)} required>
              <option value="">{t('organization:iniciativas.placeholders.select_empresa')}</option>
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nombre}</option>
              ))}
            </select>
            <div className="invalid-feedback">{t('organization:iniciativas.validation.empresa_required_short')}</div>
          </Field>
          <Field label={t('organization:iniciativas.fields.nombre')} htmlFor="ini-edit-nombre" required>
            <input id="ini-edit-nombre" className="input" value={editNombre} onChange={e => setEditNombre(e.target.value)} required />
            <div className="invalid-feedback">{t('organization:iniciativas.validation.nombre_required')}</div>
          </Field>
          <Field label={t('organization:iniciativas.fields.descripcion')} htmlFor="ini-edit-descripcion">
            <textarea id="ini-edit-descripcion" className="input" value={editDescripcion} onChange={e => setEditDescripcion(e.target.value)} rows={3} />
          </Field>
          <div className="form-footer">
            <Button type="button" variant="secondary" onClick={() => setEditModal(null)}>{t('common:buttons.cancel')}</Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? t('common:buttons.saving_short') : t('common:buttons.save_changes')}
            </Button>
          </div>
        </form>
      </Modal>

      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/admin/inicio' },
          { label: t('admin:sidebar.iniciativas') },
        ]}
      />

      <PageHeader
        title={t('organization:iniciativas.page_title')}
        description={t('organization:iniciativas.page_description')}
        actions={iniciativas.length > 0 && (
          <Link to="/admin/actividades" className="btn btn-secondary">
            {t('organization:iniciativas.next_actividades')}
          </Link>
        )}
      />

      {/* Prerequisite warning */}
      {loaded && empresas.length === 0 && (
        <div className="prereq-banner">
          <span className="prereq-banner-icon">⚠️</span>
          <div className="prereq-banner-body">
            <p className="prereq-banner-title">{t('organization:iniciativas.prereq_banner.title')}</p>
            <p className="prereq-banner-text">
              {t('organization:iniciativas.prereq_banner.text')}
            </p>
          </div>
          <Link to="/admin/empresas" className="btn btn-secondary">
            {t('organization:iniciativas.prereq_banner.link')}
          </Link>
        </div>
      )}

      <FormListLayout
        form={
          <div className="card">
            <h3 style={{ margin: '0 0 var(--space-1)' }}>{t('organization:iniciativas.create_section_title')}</h3>
            <p style={{ margin: '0 0 var(--space-4)', fontSize: '0.8125rem' }}>
              {t('organization:iniciativas.create_section_subtitle')}
            </p>
            <form
              className={wasValidated ? 'was-validated' : ''}
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                setWasValidated(true);
                if (form.checkValidity()) handleSubmit(e);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
              noValidate
            >
              <Field label={t('organization:iniciativas.fields.empresa')} htmlFor="ini-empresa" required>
                <select id="ini-empresa" className="input" value={empresaId} onChange={e => setEmpresaId(e.target.value)} required disabled={empresas.length === 0}>
                  <option value="">{empresas.length === 0 ? t('organization:iniciativas.placeholders.no_empresas') : t('organization:iniciativas.placeholders.select_empresa')}</option>
                  {empresas.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                  ))}
                </select>
                <div className="invalid-feedback">{t('organization:iniciativas.validation.empresa_required')}</div>
              </Field>
              <Field label={t('organization:iniciativas.fields.nombre')} htmlFor="ini-nombre" required>
                <input id="ini-nombre" className="input" value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder={t('organization:iniciativas.placeholders.nombre')} required disabled={empresas.length === 0} />
                <div className="invalid-feedback">{t('organization:iniciativas.validation.nombre_required')}</div>
              </Field>
              <Field
                label={<>{t('organization:iniciativas.fields.descripcion')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{t('organization:iniciativas.optional_label')}</span></>}
                htmlFor="ini-descripcion"
              >
                <textarea id="ini-descripcion" className="input" value={descripcion} onChange={e => setDescripcion(e.target.value)}
                  placeholder={t('organization:iniciativas.placeholders.descripcion')} rows={3} disabled={empresas.length === 0} />
              </Field>
              <Button type="submit" variant="primary" block disabled={empresas.length === 0}>
                {t('organization:iniciativas.create_submit')}
              </Button>
            </form>
          </div>
        }
        list={
          iniciativas.length === 0 ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <EmptyState
                icon="🚀"
                title={t('organization:iniciativas.empty.title')}
                description={empresas.length === 0
                  ? t('organization:iniciativas.empty.no_empresas')
                  : t('organization:iniciativas.empty.default')}
                action={empresas.length === 0 && (
                  <Link to="/admin/empresas" className="btn btn-secondary">
                    {t('organization:iniciativas.empty.link_empresas')}
                  </Link>
                )}
              />
            </div>
          ) : (
            <div className="section-card home-panel">
              <div className="section-card-header">
                <span className="section-card-title">{t('organization:iniciativas.table.header_title')}</span>
                <span className="count-badge">{iniciativas.length}</span>
              </div>
              <DataTable columns={columns} rows={pageRows} rowKey={ini => ini.id} />
              <Pagination
                page={currentPage}
                pageCount={totalPages}
                onPageChange={setPage}
                prevLabel={t('common:buttons.previous')}
                nextLabel={t('common:buttons.next')}
                info={t('organization:iniciativas.table.showing', {
                  from: (currentPage - 1) * PAGE_SIZE + 1,
                  to: Math.min(currentPage * PAGE_SIZE, iniciativas.length),
                  total: iniciativas.length,
                })}
              />
            </div>
          )
        }
      />

      {/* Next step hint */}
      {iniciativas.length > 0 && (
        <div className="next-step-banner">
          <p style={{ margin: 0, fontSize: '0.8125rem' }}>
            <strong>{t('organization:iniciativas.next_step.label')}</strong> {t('organization:iniciativas.next_step.text')}
          </p>
          <Link to="/admin/actividades" className="btn btn-secondary">
            {t('organization:iniciativas.next_step.link')}
          </Link>
        </div>
      )}
    </div>
  );
}
