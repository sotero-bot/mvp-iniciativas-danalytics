import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type PlantillaOption = { id: string; nombre: string; _count: { pasos: number } };

export function ActividadesPage() {
  const { t } = useTranslation(['methodology', 'common']);
  const [list, setList] = useState<any[]>([]);
  const [iniciativas, setIniciativas] = useState<any[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaOption[]>([]);
  const [wasValidated, setWasValidated] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string; nombre: string } | null>(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', iniciativaId: '', plantillaId: '' });
  const [toast, setToast] = useState<string | null>(null);
  const [empresaFiltro, setEmpresaFiltro] = useState('');

  const [editModal, setEditModal] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '', descripcion: '', iniciativaId: '' });
  const [editWasValidated, setEditWasValidated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/methodology/actividades`);
      setList(await res.json());
    } catch (err) {
      showToast(translateError(err));
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
        showToast(t('methodology:actividades.toast.created_with_pasos', { count: p?._count.pasos ?? 0, nombre: p?.nombre ?? '' }));
      } else {
        showToast(t('methodology:actividades.toast.created'));
      }
    } catch (err) {
      showToast(translateError(err) || t('methodology:actividades.toast.create_error'));
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
      showToast(t('methodology:actividades.toast.updated'));
    } catch (err) {
      showToast(translateError(err) || t('methodology:actividades.toast.update_error'));
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
      showToast(t('methodology:actividades.toast.deleted'));
    } catch (err) {
      showToast(translateError(err));
    }
  };

  const plantillaSeleccionada = plantillas.find(p => p.id === form.plantillaId);

  return (
    <div>
      {toast && <div className="toast">{toast}</div>}

      <ConfirmModal
        isOpen={!!deleteModal}
        title={t('methodology:actividades.delete_modal.title')}
        message={t('methodology:actividades.delete_modal.message', { nombre: deleteModal?.nombre ?? '' })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(null)}
      />

      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>{t('methodology:actividades.edit_modal_title')}</h3>
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
                <label className="required-label" style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>{t('methodology:actividades.fields.iniciativa')}</label>
                <select className="input" required value={editForm.iniciativaId}
                  onChange={e => setEditForm({ ...editForm, iniciativaId: e.target.value })}>
                  <option value="">{t('methodology:actividades.placeholders.select_iniciativa_alt')}</option>
                  {iniciativas.map(ini => (
                    <option key={ini.id} value={ini.id}>{t('methodology:actividades.iniciativa_option_with_empresa', { nombre: ini.nombre, empresa: ini.empresa?.nombre ?? '' })}</option>
                  ))}
                </select>
                <div className="invalid-feedback">{t('methodology:actividades.validation.iniciativa_required')}</div>
              </div>
              <div>
                <label className="required-label" style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>{t('methodology:actividades.fields.nombre')}</label>
                <input className="input" required value={editForm.nombre}
                  onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} />
                <div className="invalid-feedback">{t('methodology:actividades.validation.nombre_required_short')}</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>{t('methodology:actividades.fields.descripcion')}</label>
                <textarea className="input" rows={4} value={editForm.descripcion}
                  onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} />
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
          <h1>{t('methodology:actividades.page_title')}</h1>
          <p className="page-description">
            {t('methodology:actividades.page_description')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
          <Link to="/admin/plantillas" className="btn btn-secondary"
            style={{ textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('methodology:actividades.manage_plantillas')}
          </Link>
          {list.length > 0 && (
            <Link to="/admin/instancias" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              {t('methodology:actividades.next_ejecuciones')}
            </Link>
          )}
        </div>
      </div>

      {/* Filtro por empresa */}
      {loaded && empresas.length > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: 'white', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', padding: '0.625rem 1rem',
          marginBottom: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>🏢</span>
          <label style={{
            fontWeight: 600, fontSize: '0.875rem',
            color: 'var(--color-text-main)', whiteSpace: 'nowrap',
          }}>
            {t('methodology:actividades.filter.empresa_label')}
          </label>
          <select
            className="input"
            style={{ flex: 1, maxWidth: 320, marginBottom: 0 }}
            value={empresaFiltro}
            onChange={e => setEmpresaFiltro(e.target.value)}
          >
            <option value="">{t('methodology:actividades.filter.all_empresas')}</option>
            {empresas.map(e => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
          {empresaFiltro ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
              {t('methodology:actividades.filter.result', { count: listFiltrada.length })}
            </span>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
              {t('methodology:actividades.filter.total', { count: list.length })}
            </span>
          )}
        </div>
      )}

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
          <Link to="/admin/iniciativas" className="btn btn-secondary"
            style={{ textDecoration: 'none', flexShrink: 0, fontSize: '0.8125rem' }}>
            {t('methodology:actividades.prereq_banner.link')}
          </Link>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>

        {/* Create form */}
        <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: '20px' }}>
          <h3 style={{ margin: '0 0 4px' }}>{t('methodology:actividades.create_section_title')}</h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.8125rem' }}>
            {t('methodology:actividades.create_section_subtitle')}
          </p>
          <form
            className={wasValidated ? 'was-validated' : ''}
            onSubmit={(e) => { e.preventDefault(); const formEl = e.currentTarget; setWasValidated(true); if (formEl.checkValidity()) create(); }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            noValidate
          >
            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 5 }}>{t('methodology:actividades.fields.iniciativa')}</label>
              <select className="input" required value={form.iniciativaId}
                onChange={e => setForm({ ...form, iniciativaId: e.target.value })}
                disabled={iniciativasFiltradas.length === 0}>
                <option value="">{iniciativasFiltradas.length === 0 ? t('methodology:actividades.placeholders.no_iniciativas') : t('methodology:actividades.placeholders.select_iniciativa')}</option>
                {iniciativasFiltradas.map(ini => (
                  <option key={ini.id} value={ini.id}>{ini.nombre}{!empresaFiltro && ini.empresa ? ` (${ini.empresa.nombre})` : ''}</option>
                ))}
              </select>
              <div className="invalid-feedback">{t('methodology:actividades.validation.iniciativa_required')}</div>
            </div>

            {/* Selector de plantilla */}
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>{t('methodology:actividades.fields.plantilla')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{t('methodology:actividades.optional_label')}</span></label>
              {plantillas.length === 0 ? (
                <>
                  <select className="input" disabled>
                    <option>{t('methodology:actividades.placeholders.no_plantillas')}</option>
                  </select>
                  <div style={{ marginTop: 4, fontSize: '0.78rem' }}>
                    <Link to="/admin/plantillas" style={{ color: 'var(--color-primary)' }}>{t('methodology:actividades.plantilla_create_link')}</Link>
                  </div>
                </>
              ) : (
                <>
                  <select className="input" value={form.plantillaId}
                    onChange={e => setForm({ ...form, plantillaId: e.target.value })}
                    disabled={iniciativasFiltradas.length === 0}>
                    <option value="">{t('methodology:actividades.placeholders.no_plantilla')}</option>
                    {plantillas.map(p => (
                      <option key={p.id} value={p.id}>{t('methodology:actividades.plantilla_pasos_option', { nombre: p.nombre, count: p._count.pasos })}</option>
                    ))}
                  </select>
                  {plantillaSeleccionada && (
                    plantillaSeleccionada._count.pasos > 0 ? (
                      <div style={{ marginTop: 6, padding: '8px 12px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: '#166534' }}>
                        <Trans
                          i18nKey="methodology:actividades.plantilla_info_with_pasos"
                          values={{ count: plantillaSeleccionada._count.pasos }}
                          components={[<strong />]}
                        />
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, padding: '8px 12px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: '#92400E' }}>
                        {t('methodology:actividades.plantilla_info_no_pasos')}
                      </div>
                    )
                  )}
                </>
              )}
            </div>

            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 5 }}>{t('methodology:actividades.fields.nombre')}</label>
              <input className="input" required placeholder={t('methodology:actividades.placeholders.nombre')}
                value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                disabled={iniciativasFiltradas.length === 0} />
              <div className="invalid-feedback">{t('methodology:actividades.validation.nombre_required')}</div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>{t('methodology:actividades.fields.descripcion')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{t('methodology:actividades.optional_label')}</span></label>
              <textarea className="input" placeholder={t('methodology:actividades.placeholders.descripcion')}
                value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                rows={4} disabled={iniciativasFiltradas.length === 0} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={iniciativasFiltradas.length === 0}>
              {t('methodology:actividades.create_submit')}
            </button>
          </form>
        </div>

        {/* List */}
        <div>
          {listFiltrada.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">⚡</div>
                <p className="empty-state-title">
                  {empresaFiltro ? t('methodology:actividades.empty.title_filter') : t('methodology:actividades.empty.title_default')}
                </p>
                <p className="empty-state-desc">
                  {iniciativas.length === 0
                    ? t('methodology:actividades.empty.no_iniciativas')
                    : empresaFiltro
                      ? t('methodology:actividades.empty.filter_default')
                      : t('methodology:actividades.empty.default')}
                </p>
                {iniciativas.length === 0 && (
                  <Link to="/admin/iniciativas" className="btn btn-secondary" style={{ textDecoration: 'none', marginTop: 4, fontSize: '0.8125rem' }}>
                    {t('methodology:actividades.empty.link_iniciativas')}
                  </Link>
                )}
              </div>
            </div>
          ) : (
            listFiltrada.map((a: any) => (
              <div key={a.id} className="card" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                      <span className="status-badge status-info" style={{ fontSize: '0.7rem' }}>
                        {a.iniciativa?.empresa?.nombre}
                      </span>
                      <span className="status-badge status-neutral" style={{ fontSize: '0.7rem' }}>
                        {a.iniciativa?.nombre}
                      </span>
                      {a.plantillaOrigenId && (
                        <span className="status-badge" style={{ fontSize: '0.7rem', background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE' }}>
                          {t('methodology:actividades.from_template_badge')}
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: '0 0 4px', color: 'var(--color-text-main)', fontSize: '1rem' }}>{a.nombre}</h3>
                    {a.descripcion && (
                      <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.8125rem', lineHeight: 1.5 }}>
                        {a.descripcion}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '0.82rem' }}
                      onClick={() => openEdit(a)}>
                      {t('common:buttons.edit')}
                    </button>
                    <Link to={`/admin/actividades/${a.id}/pasos`} className="btn btn-primary"
                      style={{ padding: '5px 12px', fontSize: '0.82rem', textDecoration: 'none' }}>
                      {t('methodology:actividades.configure_pasos')}
                    </Link>
                    <button className="btn btn-danger" style={{ padding: '5px 8px', fontSize: '0.875rem' }}
                      onClick={() => setDeleteModal({ id: a.id, nombre: a.nombre })} title={t('common:buttons.delete')}>
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Next step hint */}
      {list.length > 0 && (
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
            <strong>{t('methodology:actividades.next_step.label')}</strong> {t('methodology:actividades.next_step.text')}
          </p>
          <Link to="/admin/instancias" className="btn btn-secondary"
            style={{ textDecoration: 'none', flexShrink: 0, padding: '4px 12px', fontSize: '0.8rem' }}>
            {t('methodology:actividades.next_step.link')}
          </Link>
        </div>
      )}
    </div>
  );
}
