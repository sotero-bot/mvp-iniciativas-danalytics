import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Modal, Field, EmptyState, Breadcrumb, PageHeader, Button, StatusBadge, FormListLayout, FilterToolbar, DataTable, Pagination } from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { toast } from '../../components/toast-store';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const PAGE_SIZE = 5;

type PlantillaOption = { id: string; nombre: string; _count: { pasos: number } };

export function ActividadesPage() {
  const { t } = useTranslation(['methodology', 'admin', 'common']);
  const [list, setList] = useState<any[]>([]);
  const [iniciativas, setIniciativas] = useState<any[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaOption[]>([]);
  const [wasValidated, setWasValidated] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string; nombre: string } | null>(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', iniciativaId: '', plantillaId: '' });
  const [empresaFiltro, setEmpresaFiltro] = useState('');

  const [editModal, setEditModal] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '', descripcion: '', iniciativaId: '' });
  const [editWasValidated, setEditWasValidated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);

  const empresas = React.useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; nombre: string }[] = [];
    for (const ini of iniciativas) {
      if (ini.empresa && !seen.has(ini.empresa.id)) {
        seen.add(ini.empresa.id);
        result.push({ id: ini.empresa.id, nombre: ini.empresa.nombre });
      }
    }
    return result;
  }, [iniciativas]);

  const iniciativasFiltradas = empresaFiltro
    ? iniciativas.filter(ini => ini.empresa?.id === empresaFiltro)
    : iniciativas;

  const listFiltrada = empresaFiltro
    ? list.filter(a => a.iniciativa?.empresa?.id === empresaFiltro)
    : list;

  const load = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/methodology/actividades`);
      setList(await res.json());
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  useEffect(() => {
    Promise.all([
      fetchWithErrorMapping(`${API_URL}/methodology/actividades`).then(r => r.json()).catch(() => []),
      fetchWithErrorMapping(`${API_URL}/organization/iniciativas`).then(r => r.json()).catch(() => []),
      fetchWithErrorMapping(`${API_URL}/admin/plantillas`).then(r => r.json()).catch(() => []),
    ]).then(([acts, inis, plts]) => {
      setList(acts);
      setIniciativas(inis);
      setPlantillas(plts);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (empresaFiltro && form.iniciativaId) {
      const valida = iniciativasFiltradas.some(ini => ini.id === form.iniciativaId);
      if (!valida) setForm(prev => ({ ...prev, iniciativaId: '' }));
    }
  }, [empresaFiltro]);

  useEffect(() => { setPage(1); }, [empresaFiltro]);

  const totalPages = Math.max(1, Math.ceil(listFiltrada.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => listFiltrada.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [listFiltrada, currentPage],
  );

  const columns: DataTableColumn<any>[] = [
    {
      key: 'nombre',
      header: t('methodology:actividades.table.nombre'),
      render: (a) => <strong>{a.nombre}</strong>,
    },
    {
      key: 'iniciativa',
      header: t('methodology:actividades.table.iniciativa'),
      render: (a) => (
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge variant="info">{a.iniciativa?.empresa?.nombre}</StatusBadge>
          <StatusBadge variant="neutral">{a.iniciativa?.nombre}</StatusBadge>
          {a.plantillaOrigenId && (
            <StatusBadge variant="info">{t('methodology:actividades.from_template_badge')}</StatusBadge>
          )}
        </div>
      ),
    },
    {
      key: 'descripcion',
      header: t('methodology:actividades.table.descripcion'),
      render: (a) => (
        a.descripcion
          ? <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>{a.descripcion}</span>
          : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
      ),
    },
    {
      key: 'actions',
      header: t('methodology:actividades.table.actions'),
      align: 'right',
      render: (a) => (
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => openEdit(a)}>
            {t('common:buttons.edit')}
          </Button>
          <Link to={`/admin/actividades/${a.id}/pasos`} className="btn btn-primary btn-sm">
            {t('methodology:actividades.configure_pasos')}
          </Link>
          <Button variant="danger" size="sm" onClick={() => setDeleteModal({ id: a.id, nombre: a.nombre })}
            title={t('common:buttons.delete')} aria-label={t('common:buttons.delete')}>
            🗑️
          </Button>
        </div>
      ),
    },
  ];

  const create = async () => {
    if (!form.iniciativaId) return;
    try {
      const body: any = { nombre: form.nombre, descripcion: form.descripcion, iniciativaId: form.iniciativaId };
      if (form.plantillaId) body.plantillaId = form.plantillaId;
      await fetchWithErrorMapping(`${API_URL}/methodology/actividades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      load();
      setForm({ nombre: '', descripcion: '', iniciativaId: form.iniciativaId, plantillaId: '' });
      setWasValidated(false);
      if (form.plantillaId) {
        const p = plantillas.find(p => p.id === form.plantillaId);
        toast.success(t('methodology:actividades.toast.created_with_pasos', { count: p?._count.pasos ?? 0, nombre: p?.nombre ?? '' }));
      } else {
        toast.success(t('methodology:actividades.toast.created'));
      }
    } catch (err) {
      toast.error(translateError(err) || t('methodology:actividades.toast.create_error'));
    }
  };

  const openEdit = (a: any) => {
    setEditModal(a);
    setEditForm({ nombre: a.nombre, descripcion: a.descripcion || '', iniciativaId: a.iniciativaId });
    setEditWasValidated(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formEl = e.currentTarget as HTMLFormElement;
    setEditWasValidated(true);
    if (!formEl.checkValidity()) return;
    setSaving(true);
    try {
      await fetchWithErrorMapping(`${API_URL}/methodology/actividades/${editModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editForm.nombre, descripcion: editForm.descripcion, iniciativaId: editForm.iniciativaId }),
      });
      load();
      setEditModal(null);
      toast.success(t('methodology:actividades.toast.updated'));
    } catch (err) {
      toast.error(translateError(err) || t('methodology:actividades.toast.update_error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await fetchWithErrorMapping(`${API_URL}/methodology/actividades/${deleteModal.id}`, { method: 'DELETE' });
      setDeleteModal(null);
      load();
      toast.success(t('methodology:actividades.toast.deleted'));
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const plantillaSeleccionada = plantillas.find(p => p.id === form.plantillaId);

  return (
    <div>
      <ConfirmModal
        isOpen={!!deleteModal}
        title={t('methodology:actividades.delete_modal.title')}
        message={t('methodology:actividades.delete_modal.message', { nombre: deleteModal?.nombre ?? '' })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(null)}
      />

      <Modal
        isOpen={!!editModal}
        onClose={() => setEditModal(null)}
        title={t('methodology:actividades.edit_modal_title')}
        maxWidth={520}
      >
        <form
          className={editWasValidated ? 'was-validated' : ''}
          onSubmit={handleEdit}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          noValidate
        >
          <Field label={t('methodology:actividades.fields.iniciativa')} htmlFor="act-edit-iniciativa" required>
            <select id="act-edit-iniciativa" className="input" required value={editForm.iniciativaId}
              onChange={e => setEditForm({ ...editForm, iniciativaId: e.target.value })}>
              <option value="">{t('methodology:actividades.placeholders.select_iniciativa_alt')}</option>
              {iniciativas.map(ini => (
                <option key={ini.id} value={ini.id}>{t('methodology:actividades.iniciativa_option_with_empresa', { nombre: ini.nombre, empresa: ini.empresa?.nombre ?? '' })}</option>
              ))}
            </select>
            <div className="invalid-feedback">{t('methodology:actividades.validation.iniciativa_required')}</div>
          </Field>
          <Field label={t('methodology:actividades.fields.nombre')} htmlFor="act-edit-nombre" required>
            <input id="act-edit-nombre" className="input" required value={editForm.nombre}
              onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} />
            <div className="invalid-feedback">{t('methodology:actividades.validation.nombre_required_short')}</div>
          </Field>
          <Field label={t('methodology:actividades.fields.descripcion')} htmlFor="act-edit-descripcion">
            <textarea id="act-edit-descripcion" className="input" rows={4} value={editForm.descripcion}
              onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} />
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
          { label: t('admin:sidebar.actividades') },
        ]}
      />

      <PageHeader
        title={t('methodology:actividades.page_title')}
        description={t('methodology:actividades.page_description')}
        actions={
          <>
            <Link to="/admin/plantillas" className="btn btn-secondary">
              {t('methodology:actividades.manage_plantillas')}
            </Link>
            {list.length > 0 && (
              <Link to="/admin/instancias" className="btn btn-secondary">
                {t('methodology:actividades.next_ejecuciones')}
              </Link>
            )}
          </>
        }
      />

      {/* Prerequisite warning */}
      {loaded && iniciativas.length === 0 && (
        <div className="prereq-banner">
          <span className="prereq-banner-icon">⚠️</span>
          <div className="prereq-banner-body">
            <p className="prereq-banner-title">{t('methodology:actividades.prereq_banner.title')}</p>
            <p className="prereq-banner-text">
              {t('methodology:actividades.prereq_banner.text')}
            </p>
          </div>
          <Link to="/admin/iniciativas" className="btn btn-secondary" style={{ flexShrink: 0 }}>
            {t('methodology:actividades.prereq_banner.link')}
          </Link>
        </div>
      )}

      <FormListLayout
        form={
          <div className="card" style={{ position: 'sticky', top: 'var(--space-5)' }}>
            <h3 style={{ margin: '0 0 var(--space-1)' }}>{t('methodology:actividades.create_section_title')}</h3>
            <p style={{ margin: '0 0 var(--space-4)', fontSize: '0.8125rem' }}>
              {t('methodology:actividades.create_section_subtitle')}
            </p>
            <form
              className={wasValidated ? 'was-validated' : ''}
              onSubmit={(e) => { e.preventDefault(); const formEl = e.currentTarget; setWasValidated(true); if (formEl.checkValidity()) create(); }}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
              noValidate
            >
              <Field label={t('methodology:actividades.fields.iniciativa')} htmlFor="act-iniciativa" required>
                <select id="act-iniciativa" className="input" required value={form.iniciativaId}
                  onChange={e => setForm({ ...form, iniciativaId: e.target.value })}
                  disabled={iniciativasFiltradas.length === 0}>
                  <option value="">{iniciativasFiltradas.length === 0 ? t('methodology:actividades.placeholders.no_iniciativas') : t('methodology:actividades.placeholders.select_iniciativa')}</option>
                  {iniciativasFiltradas.map(ini => (
                    <option key={ini.id} value={ini.id}>{ini.nombre}{!empresaFiltro && ini.empresa ? ` (${ini.empresa.nombre})` : ''}</option>
                  ))}
                </select>
                <div className="invalid-feedback">{t('methodology:actividades.validation.iniciativa_required')}</div>
              </Field>

              {/* Selector de plantilla */}
              <Field
                label={<>{t('methodology:actividades.fields.plantilla')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{t('methodology:actividades.optional_label')}</span></>}
                htmlFor="act-plantilla"
              >
                {plantillas.length === 0 ? (
                  <>
                    <select id="act-plantilla" className="input" disabled>
                      <option>{t('methodology:actividades.placeholders.no_plantillas')}</option>
                    </select>
                    <div style={{ marginTop: 'var(--space-1)', fontSize: '0.78rem' }}>
                      <Link to="/admin/plantillas" className="btn-link">{t('methodology:actividades.plantilla_create_link')}</Link>
                    </div>
                  </>
                ) : (
                  <>
                    <select id="act-plantilla" className="input" value={form.plantillaId}
                      onChange={e => setForm({ ...form, plantillaId: e.target.value })}
                      disabled={iniciativasFiltradas.length === 0}>
                      <option value="">{t('methodology:actividades.placeholders.no_plantilla')}</option>
                      {plantillas.map(p => (
                        <option key={p.id} value={p.id}>{t('methodology:actividades.plantilla_pasos_option', { nombre: p.nombre, count: p._count.pasos })}</option>
                      ))}
                    </select>
                    {plantillaSeleccionada && (
                      plantillaSeleccionada._count.pasos > 0 ? (
                        <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', fontSize: '0.8rem', color: 'var(--color-success-strong)' }}>
                          <Trans
                            i18nKey="methodology:actividades.plantilla_info_with_pasos"
                            values={{ count: plantillaSeleccionada._count.pasos }}
                            components={[<strong />]}
                          />
                        </div>
                      ) : (
                        <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', fontSize: '0.8rem', color: 'var(--color-warning-strong)' }}>
                          {t('methodology:actividades.plantilla_info_no_pasos')}
                        </div>
                      )
                    )}
                  </>
                )}
              </Field>

              <Field label={t('methodology:actividades.fields.nombre')} htmlFor="act-nombre" required>
                <input id="act-nombre" className="input" required placeholder={t('methodology:actividades.placeholders.nombre')}
                  value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                  disabled={iniciativasFiltradas.length === 0} />
                <div className="invalid-feedback">{t('methodology:actividades.validation.nombre_required')}</div>
              </Field>
              <Field
                label={<>{t('methodology:actividades.fields.descripcion')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{t('methodology:actividades.optional_label')}</span></>}
                htmlFor="act-descripcion"
              >
                <textarea id="act-descripcion" className="input" placeholder={t('methodology:actividades.placeholders.descripcion')}
                  value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  rows={4} disabled={iniciativasFiltradas.length === 0} />
              </Field>
              <Button type="submit" variant="primary" block disabled={iniciativasFiltradas.length === 0}>
                {t('methodology:actividades.create_submit')}
              </Button>
            </form>
          </div>
        }
        list={
          <div className="section-card home-panel">
            <div className="section-card-header">
              <span className="section-card-title">{t('methodology:actividades.table.header_title')}</span>
              <span className="count-badge">{listFiltrada.length}</span>
            </div>

            {/* Filtro por empresa */}
            {loaded && empresas.length > 1 && (
              <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-bg-subtle)' }}>
                <FilterToolbar>
                  <span aria-hidden="true">🏢</span>
                  <Field label={t('methodology:actividades.filter.empresa_label')} htmlFor="act-empresa-filtro">
                    <select
                      id="act-empresa-filtro"
                      className="input"
                      value={empresaFiltro}
                      onChange={e => setEmpresaFiltro(e.target.value)}
                    >
                      <option value="">{t('methodology:actividades.filter.all_empresas')}</option>
                      {empresas.map(e => (
                        <option key={e.id} value={e.id}>{e.nombre}</option>
                      ))}
                    </select>
                  </Field>
                  <FilterToolbar.Divider />
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
                    {empresaFiltro
                      ? t('methodology:actividades.filter.result', { count: listFiltrada.length })
                      : t('methodology:actividades.filter.total', { count: list.length })}
                  </span>
                </FilterToolbar>
              </div>
            )}

            {listFiltrada.length === 0 ? (
              <EmptyState
                icon="⚡"
                title={empresaFiltro ? t('methodology:actividades.empty.title_filter') : t('methodology:actividades.empty.title_default')}
                description={iniciativas.length === 0
                  ? t('methodology:actividades.empty.no_iniciativas')
                  : empresaFiltro
                    ? t('methodology:actividades.empty.filter_default')
                    : t('methodology:actividades.empty.default')}
                action={iniciativas.length === 0 ? (
                  <Link to="/admin/iniciativas" className="btn btn-secondary">
                    {t('methodology:actividades.empty.link_iniciativas')}
                  </Link>
                ) : undefined}
              />
            ) : (
              <>
                <DataTable columns={columns} rows={pageRows} rowKey={a => a.id} />
                <Pagination
                  page={currentPage}
                  pageCount={totalPages}
                  onPageChange={setPage}
                  prevLabel={t('common:buttons.previous')}
                  nextLabel={t('common:buttons.next')}
                  info={t('methodology:actividades.table.showing', {
                    from: (currentPage - 1) * PAGE_SIZE + 1,
                    to: Math.min(currentPage * PAGE_SIZE, listFiltrada.length),
                    total: listFiltrada.length,
                  })}
                />
              </>
            )}
          </div>
        }
      />

      {/* Next step hint */}
      {list.length > 0 && (
        <div className="next-step-banner">
          <p style={{ margin: 0, fontSize: '0.8125rem' }}>
            <strong>{t('methodology:actividades.next_step.label')}</strong> {t('methodology:actividades.next_step.text')}
          </p>
          <Link to="/admin/instancias" className="btn btn-secondary">
            {t('methodology:actividades.next_step.link')}
          </Link>
        </div>
      )}
    </div>
  );
}
