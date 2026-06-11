import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function InstanciasPage() {
  const { t, i18n } = useTranslation(['execution', 'common']);
  const ESTADO_LABELS: Record<string, string> = {
    generado: t('execution:instancias.estados.generado'),
    iniciado: t('execution:instancias.estados.iniciado'),
    finalizado: t('execution:instancias.estados.finalizado'),
  };
  const [instancias, setInstancias] = useState<any[]>([]);
  const [actividades, setActividades] = useState<any[]>([]);
  const [enlaces, setEnlaces] = useState<any[]>([]);

  const [formEnlace, setFormEnlace] = useState({ actividadId: '', nombre: '' });
  const [enlaceGenerado, setEnlaceGenerado] = useState<string | null>(null);
  const [generandoEnlace, setGenerandoEnlace] = useState(false);
  const generandoEnlaceRef = useRef(false);
  const [wasValidated, setWasValidated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [deleteEnlaceModal, setDeleteEnlaceModal] = useState<string | null>(null);

  // Datatable
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterActividad, setFilterActividad] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleDeleteInstancia = async () => {
    if (!deleteModal) return;
    await fetch(`${API_URL}/admin/instancias/${deleteModal}`, { method: 'DELETE' });
    setDeleteModal(null);
    load();
  };

  const handleDeleteEnlace = async () => {
    if (!deleteEnlaceModal) return;
    await fetch(`${API_URL}/admin/enlaces/${deleteEnlaceModal}`, { method: 'DELETE' });
    setDeleteEnlaceModal(null);
    load();
  };

  const load = async () => {
    const [resInst, resEnl] = await Promise.all([
      fetch(`${API_URL}/admin/instancias`),
      fetch(`${API_URL}/admin/enlaces`),
    ]);
    if (resInst.ok) setInstancias(await resInst.json());
    if (resEnl.ok) setEnlaces(await resEnl.json());
  };

  const loadActividades = async () => {
    const res = await fetch(`${API_URL}/methodology/actividades`);
    if (res.ok) setActividades(await res.json());
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/admin/instancias`).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/admin/enlaces`).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/methodology/actividades`).then(r => r.ok ? r.json() : []),
    ]).then(([inst, enl, acts]) => {
      setInstancias(inst);
      setEnlaces(enl);
      setActividades(acts);
      setLoaded(true);
    });
  }, []);

  const generarEnlace = async () => {
    if (generandoEnlaceRef.current) return;
    generandoEnlaceRef.current = true;
    setGenerandoEnlace(true);
    setEnlaceGenerado(null);
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/enlaces/generar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formEnlace),
      });
      const data = await res.json();
      const url = `${window.location.origin}/runner/enlace/${data.accessToken}`;
      setEnlaceGenerado(url);
      try { await navigator.clipboard.writeText(url); } catch (_) { }
      await load();
      setFormEnlace({ actividadId: '', nombre: '' });
      setWasValidated(false);
    } catch (err) {
      alert(t('execution:instancias.generar_enlace.error_prefix') + translateError(err));
    } finally {
      generandoEnlaceRef.current = false;
      setGenerandoEnlace(false);
    }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/runner/${token}`);
    showToast(t('execution:instancias.link_copied_clipboard'));
  };

  const descargarPdf = (instanciaId: string) => {
    window.location.href = `${API_URL}/admin/instancias/${instanciaId}/pdf`;
  };

  const descargarZip = (instanciaId: string) => {
    window.location.href = `${API_URL}/admin/instancias/${instanciaId}/zip`;
  };

  // Opciones únicas para filtros globales
  const empresaOptions = useMemo(() => {
    const set = new Set<string>();
    instancias.forEach(i => { if (i.actividad?.iniciativa?.empresa?.nombre) set.add(i.actividad.iniciativa.empresa.nombre); });
    enlaces.forEach(e => { if (e.actividad?.iniciativa?.empresa?.nombre) set.add(e.actividad.iniciativa.empresa.nombre); });
    return [...set].sort();
  }, [instancias, enlaces]);

  const actividadOptions = useMemo(() => {
    const set = new Set<string>();
    instancias.forEach(i => { if (i.actividad?.nombre) set.add(i.actividad.nombre); });
    enlaces.forEach(e => { if (e.actividad?.nombre) set.add(e.actividad.nombre); });
    return [...set].sort();
  }, [instancias, enlaces]);

  // Filtros globales aplicados a enlaces
  const filteredEnlaces = useMemo(() => {
    return enlaces.filter(e => {
      const matchEmpresa = !filterEmpresa || e.actividad?.iniciativa?.empresa?.nombre === filterEmpresa;
      const matchActividad = !filterActividad || e.actividad?.nombre === filterActividad;
      return matchEmpresa && matchActividad;
    });
  }, [enlaces, filterEmpresa, filterActividad]);

  // Datatable logic
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return instancias.filter(ins => {
      const matchSearch = !q ||
        ins.actividad?.nombre?.toLowerCase().includes(q) ||
        ins.actividad?.iniciativa?.nombre?.toLowerCase().includes(q) ||
        ins.usuario?.nombre?.toLowerCase().includes(q) ||
        ins.emailReferencia?.toLowerCase().includes(q) ||
        ins.actividad?.plantillaOrigen?.nombre?.toLowerCase().includes(q);
      const matchEstado = !filterEstado || ins.estado === filterEstado;
      const matchEmpresa = !filterEmpresa || ins.actividad?.iniciativa?.empresa?.nombre === filterEmpresa;
      const matchActividad = !filterActividad || ins.actividad?.nombre === filterActividad;
      return matchSearch && matchEstado && matchEmpresa && matchActividad;
    });
  }, [instancias, search, filterEstado, filterEmpresa, filterActividad]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };
  const handleFilterEstado = (val: string) => { setFilterEstado(val); setPage(1); };
  const handlePageSize = (val: number) => { setPageSize(val); setPage(1); };

  // Stats
  const finalizadas = instancias.filter(i => i.estado === 'finalizado').length;
  const enProgreso = instancias.filter(i => i.estado === 'iniciado').length;
  const pendientes = instancias.filter(i => i.estado === 'generado').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {toast && <div className="toast">{toast}</div>}

      <ConfirmModal isOpen={!!deleteModal} title={t('execution:instancias.delete_instancia_modal.title')}
        message={t('execution:instancias.delete_instancia_modal.message')}
        onConfirm={handleDeleteInstancia} onCancel={() => setDeleteModal(null)} />
      <ConfirmModal isOpen={!!deleteEnlaceModal} title={t('execution:instancias.delete_enlace_modal.title')}
        message={t('execution:instancias.delete_enlace_modal.message')}
        onConfirm={handleDeleteEnlace} onCancel={() => setDeleteEnlaceModal(null)} />

      {/* Page header */}
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div>
          <h1>{t('execution:instancias.page_title')}</h1>
          <p className="page-description">
            {t('execution:instancias.page_description')}
          </p>
        </div>
      </div>

      {/* Prerequisite warning */}
      {loaded && actividades.length === 0 && (
        <div className="prereq-banner" style={{ marginBottom: '1.25rem' }}>
          <span className="prereq-banner-icon">⚠️</span>
          <div className="prereq-banner-body">
            <p className="prereq-banner-title">{t('execution:instancias.prereq_banner.title')}</p>
            <p className="prereq-banner-text">
              {t('execution:instancias.prereq_banner.text')}
            </p>
          </div>
          <Link to="/admin/actividades" className="btn btn-secondary"
            style={{ textDecoration: 'none', flexShrink: 0, fontSize: '0.8125rem' }}>
            {t('execution:instancias.prereq_banner.link')}
          </Link>
        </div>
      )}

      {/* Stats en una fila */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{t('execution:instancias.summary_title')}</h2>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          {[
            { label: t('execution:instancias.stats.finalizadas'), value: finalizadas, color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
            { label: t('execution:instancias.stats.en_progreso'), value: enProgreso, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
            { label: t('execution:instancias.stats.pendientes'),  value: pendientes,  color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, border: `1px solid ${s.border}`,
              borderRadius: 8, padding: '0.375rem 0.875rem',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: '0.72rem', color: s.color, fontWeight: 500 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filtros globales ── */}
      {(empresaOptions.length > 0 || actividadOptions.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          <select
            className="input"
            style={{ maxWidth: 200, fontSize: '0.82rem' }}
            value={filterEmpresa}
            onChange={e => { setFilterEmpresa(e.target.value); setPage(1); }}
          >
            <option value="">{t('execution:instancias.filters.all_empresas')}</option>
            {empresaOptions.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select
            className="input"
            style={{ maxWidth: 220, fontSize: '0.82rem' }}
            value={filterActividad}
            onChange={e => { setFilterActividad(e.target.value); setPage(1); }}
          >
            <option value="">{t('execution:instancias.filters.all_actividades')}</option>
            {actividadOptions.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {(filterEmpresa || filterActividad) && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.375rem 0.75rem' }}
              onClick={() => { setFilterEmpresa(''); setFilterActividad(''); setPage(1); }}
            >
              {t('execution:instancias.filters.clear')}
            </button>
          )}
        </div>
      )}

      {/* ── Sección 1: Generar enlace ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.625rem' }}>
          <div style={{ width: 3, height: 16, background: 'var(--color-primary)', borderRadius: 9999 }} />
          <h2 style={{ margin: 0, fontSize: '0.95rem' }}>{t('execution:instancias.generar_enlace.section_title')}</h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{t('execution:instancias.generar_enlace.section_subtitle')}</span>
        </div>

        <div className="card" style={{ padding: '1rem', background: 'linear-gradient(135deg, #FAFBFF, #F5F8FF)' }}>
          <form
            className={wasValidated ? 'was-validated' : ''}
            onSubmit={(e) => { e.preventDefault(); setWasValidated(true); if (e.currentTarget.checkValidity()) generarEnlace(); }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}
            noValidate
          >
            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 4, fontSize: '0.78rem', fontWeight: 500 }}>{t('execution:instancias.generar_enlace.actividad_label')}</label>
              <select className="input" style={{ fontSize: '0.82rem' }} required value={formEnlace.actividadId}
                onChange={e => setFormEnlace({ ...formEnlace, actividadId: e.target.value })}>
                <option value="">{t('execution:instancias.generar_enlace.select_actividad')}</option>
                {actividades.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.iniciativa?.empresa?.nombre} · {a.iniciativa?.nombre} · {a.nombre}
                    {a.plantillaOrigen ? ` [📋 ${a.plantillaOrigen.nombre}]` : ''}
                  </option>
                ))}
              </select>
              <div className="invalid-feedback">{t('execution:instancias.generar_enlace.actividad_required')}</div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.78rem', fontWeight: 500 }}>
                {t('execution:instancias.generar_enlace.etiqueta_label')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{t('execution:instancias.generar_enlace.etiqueta_optional')}</span>
              </label>
              <input className="input" style={{ fontSize: '0.82rem' }} placeholder={t('execution:instancias.generar_enlace.etiqueta_placeholder')}
                value={formEnlace.nombre} onChange={e => setFormEnlace({ ...formEnlace, nombre: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ fontSize: '0.82rem' }} disabled={generandoEnlace}>
              {generandoEnlace ? t('execution:instancias.generar_enlace.generating') : t('execution:instancias.generar_enlace.submit')}
            </button>
          </form>

          {enlaceGenerado && (
            <div style={{
              marginTop: '0.75rem', padding: '0.625rem 1rem', borderRadius: 6,
              background: '#F0FDF4', border: '1px solid #86EFAC',
              display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#166534', fontSize: '0.78rem', marginBottom: 2 }}>{t('execution:instancias.generar_enlace.success_title')}</div>
                <code style={{ fontSize: '0.75rem', wordBreak: 'break-all', color: '#166534' }}>{enlaceGenerado}</code>
              </div>
              <button className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: '0.75rem', flexShrink: 0 }}
                onClick={() => navigator.clipboard.writeText(enlaceGenerado)}>{t('execution:instancias.generar_enlace.copy')}</button>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', flexShrink: 0 }}
                onClick={() => setEnlaceGenerado(null)}>✕</button>
            </div>
          )}
        </div>
      </section>

      {/* ── Sección 2: Enlaces activos ── */}
      {enlaces.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.625rem' }}>
            <div style={{ width: 3, height: 16, background: '#8B5CF6', borderRadius: 9999 }} />
            <h2 style={{ margin: 0, fontSize: '0.95rem' }}>{t('execution:instancias.enlaces_activos.section_title')}</h2>
            <span style={{
              background: '#EDE9FE', color: '#6D28D9', border: '1px solid #DDD6FE',
              borderRadius: 9999, padding: '1px 8px', fontSize: '0.7rem', fontWeight: 600,
            }}>{filteredEnlaces.length}</span>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>{t('execution:instancias.enlaces_activos.table.etiqueta')}</th>
                    <th>{t('execution:instancias.enlaces_activos.table.actividad')}</th>
                    <th>{t('execution:instancias.enlaces_activos.table.estado')}</th>
                    <th>{t('execution:instancias.enlaces_activos.table.creado')}</th>
                    <th style={{ textAlign: 'right' }}>{t('execution:instancias.enlaces_activos.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEnlaces.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--color-text-secondary)' }}>
                      {t('execution:instancias.enlaces_activos.table.no_results')}
                    </td></tr>
                  ) : filteredEnlaces.map((e: any) => {
                    const url = `${window.location.origin}/runner/enlace/${e.accessToken}`;
                    return (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 500 }}>
                          {e.nombre || <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>{t('execution:instancias.enlaces_activos.table.sin_etiqueta')}</span>}
                        </td>
                        <td>
                          <div>{e.actividad?.nombre || '—'}</div>
                          {e.actividad?.plantillaOrigen && (
                            <span style={{ fontSize: '0.68rem', color: '#4338CA', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 4, padding: '1px 5px', marginTop: 2, display: 'inline-block' }}>
                              📋 {e.actividad.plantillaOrigen.nombre}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`status-badge ${e.activo ? 'status-success' : 'status-neutral'}`}>
                            {e.activo ? t('execution:instancias.enlaces_activos.table.activo') : t('execution:instancias.enlaces_activos.table.inactivo')}
                          </span>
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                          {new Date(e.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                              onClick={() => { navigator.clipboard.writeText(url); showToast(t('execution:instancias.link_copied')); }}>
                              {t('execution:instancias.enlaces_activos.copy')}
                            </button>
                            <button className="btn btn-danger" style={{ padding: '3px 6px', fontSize: '0.8rem' }}
                              onClick={() => setDeleteEnlaceModal(e.id)} title="Eliminar">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Sección 3: Ejecuciones individuales ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.625rem' }}>
          <div style={{ width: 3, height: 16, background: '#0EA5E9', borderRadius: 9999 }} />
          <h2 style={{ margin: 0, fontSize: '0.95rem' }}>{t('execution:instancias.individuales.section_title')}</h2>
          <span style={{
            background: '#E0F2FE', color: '#0369A1', border: '1px solid #BAE6FD',
            borderRadius: 9999, padding: '1px 10px', fontSize: '0.75rem', fontWeight: 600,
          }}>{instancias.length}</span>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
            padding: '0.5rem 1rem', borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-subtle)',
          }}>
            <input
              className="input"
              style={{ maxWidth: 240, fontSize: '0.78rem' }}
              placeholder={t('execution:instancias.filters.search_placeholder')}
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
            <select
              className="input"
              style={{ maxWidth: 150, fontSize: '0.78rem' }}
              value={filterEstado}
              onChange={e => handleFilterEstado(e.target.value)}
            >
              <option value="">{t('execution:instancias.filters.all_estados')}</option>
              <option value="generado">{ESTADO_LABELS.generado}</option>
              <option value="iniciado">{ESTADO_LABELS.iniciado}</option>
              <option value="finalizado">{ESTADO_LABELS.finalizado}</option>
            </select>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              {t('execution:instancias.filters.show')}
              <select
                className="input"
                style={{ width: 70, fontSize: '0.82rem', padding: '0.375rem 0.5rem' }}
                value={pageSize}
                onChange={e => handlePageSize(Number(e.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {t('execution:instancias.filters.per_page')}
            </div>
          </div>

          {/* Table */}
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table-compact">
              <thead>
                <tr>
                  <th>{t('execution:instancias.individuales.table.estado')}</th>
                  <th>{t('execution:instancias.individuales.table.actividad')}</th>
                  <th>{t('execution:instancias.individuales.table.usuario')}</th>
                  <th>{t('execution:instancias.individuales.table.area')}</th>
                  <th>{t('execution:instancias.individuales.table.archivos')}</th>
                  <th>{t('execution:instancias.individuales.table.ultima_actualizacion')}</th>
                  <th style={{ textAlign: 'right' }}>{t('execution:instancias.individuales.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((ins: any) => (
                  <tr key={ins.id}>
                    <td>
                      <span className={`status-badge ${
                        ins.estado === 'finalizado' ? 'status-success' :
                        ins.estado === 'iniciado' ? 'status-warning' : 'status-neutral'
                      }`}>
                        {ESTADO_LABELS[ins.estado] ?? ins.estado}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{ins.actividad?.nombre || t('execution:instancias.individuales.table.desconocida')}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                        {ins.actividad?.iniciativa?.nombre || '—'}
                      </div>
                      {ins.actividad?.plantillaOrigen && (
                        <span style={{ fontSize: '0.68rem', color: '#4338CA', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 4, padding: '1px 5px', marginTop: 3, display: 'inline-block' }}>
                          📋 {ins.actividad.plantillaOrigen.nombre}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.875rem' }}>
                      {ins.usuario?.nombre || (ins.emailReferencia
                        ? <span style={{ color: 'var(--color-text-secondary)' }}>{ins.emailReferencia}</span>
                        : <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>{t('execution:instancias.individuales.table.pendiente')}</span>
                      )}
                      {ins.usuario?.cargo && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{ins.usuario.cargo}</div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--color-text-main)' }}>
                      {ins.usuario?.area || <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>—</span>}
                    </td>
                    <td>
                      {(() => {
                        const slug = (s: string) => (s || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                        const respArchivos = (ins.respuestas ?? []).filter((r: any) => r.archivoNombre);
                        const interArchivos = (ins.interacciones ?? []).filter((i: any) => i.archivoNombre);
                        if (respArchivos.length === 0 && interArchivos.length === 0) {
                          return <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.78rem', fontStyle: 'italic' }}>—</span>;
                        }
                        const labelFor = (titulo: string) => [
                          slug(ins.actividad?.iniciativa?.empresa?.nombre || ''),
                          slug(ins.actividad?.nombre || ''),
                          slug(ins.usuario?.area || ''),
                          slug(titulo || ''),
                        ].filter(Boolean).join('_') + '.xlsx';
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {respArchivos.map((r: any) => (
                              <button
                                key={r.preguntaId}
                                type="button"
                                onClick={async () => {
                                  try {
                                    const res = await fetchWithErrorMapping(`${API_URL}/admin/instancias/${ins.id}/respuestas/${r.preguntaId}/archivo-url`);
                                    const json = await res.json();
                                    if (!json.url) return;
                                    const a = document.createElement('a');
                                    a.href = json.url;
                                    a.download = json.archivoNombre ?? '';
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                  } catch (err) { alert(translateError(err)); }
                                }}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  padding: '3px 8px', fontSize: '0.72rem',
                                  background: '#F0FDF4', color: '#166534',
                                  borderRadius: 5, fontWeight: 600,
                                  border: '1px solid #86EFAC', whiteSpace: 'nowrap',
                                  cursor: 'pointer',
                                }}
                                title={r.archivoNombre}
                              >
                                ⬇ {labelFor(r.pregunta?.paso?.titulo)}
                              </button>
                            ))}
                            {interArchivos.map((inter: any) => (
                              <a
                                key={inter.pasoId}
                                href={`${API_URL}/admin/instancias/${ins.id}/excel/${inter.pasoId}`}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  padding: '3px 8px', fontSize: '0.72rem',
                                  background: '#EFF6FF', color: '#1D4ED8',
                                  borderRadius: 5, fontWeight: 600, textDecoration: 'none',
                                  border: '1px solid #BFDBFE', whiteSpace: 'nowrap',
                                }}
                                title={t('execution:instancias.individuales.actions.interaccion_title')}
                              >
                                ⬇ {labelFor(inter.paso?.titulo)}
                              </a>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(ins.updatedAt).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <Link to={`/admin/instancias/${ins.id}`} className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.78rem', textDecoration: 'none' }}>
                          {t('execution:instancias.individuales.actions.view_results')}
                        </Link>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                          onClick={() => descargarPdf(ins.id)}
                          title={t('execution:instancias.individuales.actions.pdf_title')}>
                          📄 PDF
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                          onClick={() => descargarZip(ins.id)}
                          title={t('execution:instancias.individuales.actions.zip_title')}>
                          📦 ZIP
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                          onClick={() => copyLink(ins.accessToken)}>
                          {t('execution:instancias.individuales.actions.copy_link')}
                        </button>
                        <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.875rem' }}
                          onClick={() => setDeleteModal(ins.id)} title="Eliminar">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      {search || filterEstado || filterEmpresa || filterActividad ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-secondary)' }}>
                          {t('execution:instancias.individuales.no_filter_results')}
                        </div>
                      ) : (
                        <div className="empty-state" style={{ padding: '2.5rem 2rem' }}>
                          <div className="empty-state-icon">📋</div>
                          <p className="empty-state-title">{t('execution:instancias.individuales.empty.title')}</p>
                          <p className="empty-state-desc">
                            {t('execution:instancias.individuales.empty.description')}
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.5rem 1rem', borderTop: '1px solid var(--color-border)',
            background: 'var(--color-bg-subtle)', flexWrap: 'wrap', gap: '0.75rem',
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              {filtered.length === 0 ? t('execution:instancias.individuales.pagination.no_results') : t('execution:instancias.individuales.pagination.showing', { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, filtered.length), total: filtered.length })}
            </span>

            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => setPage(1)}
                disabled={page === 1}
              >«</button>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
              >‹</button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .reduce<(number | '...')[]>((acc, n, i, arr) => {
                  if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('...');
                  acc.push(n);
                  return acc;
                }, [])
                .map((n, i) => n === '...'
                  ? <span key={`ellipsis-${i}`} style={{ padding: '4px 8px', fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>…</span>
                  : <button
                      key={n}
                      className="btn"
                      style={{
                        padding: '4px 10px', fontSize: '0.8rem',
                        background: page === n ? 'var(--color-primary)' : 'white',
                        color: page === n ? 'white' : 'var(--color-text-main)',
                        border: `1px solid ${page === n ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      }}
                      onClick={() => setPage(n as number)}
                    >{n}</button>
                )}

              <button
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => setPage(p => p + 1)}
                disabled={page === totalPages}
              >›</button>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
              >»</button>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
