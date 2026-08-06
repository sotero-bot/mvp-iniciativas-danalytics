import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Breadcrumb, PageHeader, StatusBadge, Button, Field, EmptyState, Alert, FormListLayout, DataTable, Pagination } from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { fetchWithErrorMapping, translateError, withAuth } from '../../shared/api/fetchWithErrorMapping';
import { toast } from '../../components/toast-store';

const PAGE_SIZE = 5;

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
  const [loaded, setLoaded] = useState(false);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [deleteEnlaceModal, setDeleteEnlaceModal] = useState<string | null>(null);

  // Datatable
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterActividad, setFilterActividad] = useState('');
  const [page, setPage] = useState(1);
  const [enlacePage, setEnlacePage] = useState(1);

  const handleDeleteInstancia = async () => {
    if (!deleteModal) return;
    await fetch(`${API_URL}/admin/instancias/${deleteModal}`, withAuth({ method: 'DELETE' }));
    setDeleteModal(null);
    load();
  };

  const handleDeleteEnlace = async () => {
    if (!deleteEnlaceModal) return;
    await fetch(`${API_URL}/admin/enlaces/${deleteEnlaceModal}`, withAuth({ method: 'DELETE' }));
    setDeleteEnlaceModal(null);
    load();
  };

  const load = async () => {
    const [resInst, resEnl] = await Promise.all([
      fetch(`${API_URL}/admin/instancias`, withAuth()),
      fetch(`${API_URL}/admin/enlaces`, withAuth()),
    ]);
    if (resInst.ok) setInstancias(await resInst.json());
    if (resEnl.ok) setEnlaces(await resEnl.json());
  };

  const loadActividades = async () => {
    const res = await fetch(`${API_URL}/methodology/actividades`, withAuth());
    if (res.ok) setActividades(await res.json());
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/admin/instancias`, withAuth()).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/admin/enlaces`, withAuth()).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/methodology/actividades`, withAuth()).then(r => r.ok ? r.json() : []),
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
      const url = `${window.location.origin}/runner/enlace/${data.accessToken}?lang=${i18n.language}`;
      setEnlaceGenerado(url);
      try { await navigator.clipboard.writeText(url); } catch (_) { }
      await load();
      setFormEnlace({ actividadId: '', nombre: '' });
      setWasValidated(false);
    } catch (err) {
      toast.error(t('execution:instancias.generar_enlace.error_prefix') + translateError(err));
    } finally {
      generandoEnlaceRef.current = false;
      setGenerandoEnlace(false);
    }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/runner/${token}?lang=${i18n.language}`);
    toast.success(t('execution:instancias.link_copied_clipboard'));
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  const enlaceTotalPages = Math.max(1, Math.ceil(filteredEnlaces.length / PAGE_SIZE));
  const enlaceCurrentPage = Math.min(enlacePage, enlaceTotalPages);
  const paginatedEnlaces = useMemo(
    () => filteredEnlaces.slice((enlaceCurrentPage - 1) * PAGE_SIZE, enlaceCurrentPage * PAGE_SIZE),
    [filteredEnlaces, enlaceCurrentPage],
  );

  const enlaceColumns: DataTableColumn<any>[] = [
    {
      key: 'etiqueta',
      header: t('execution:instancias.enlaces_activos.table.etiqueta'),
      render: (e) => (
        <span style={{ fontWeight: 500 }}>
          {e.nombre || <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>{t('execution:instancias.enlaces_activos.table.sin_etiqueta')}</span>}
        </span>
      ),
    },
    {
      key: 'actividad',
      header: t('execution:instancias.enlaces_activos.table.actividad'),
      render: (e) => (
        <>
          <div>{e.actividad?.nombre || '—'}</div>
          {e.actividad?.plantillaOrigen && (
            <span className="chip" style={{ fontSize: '0.68rem', marginTop: 2 }}>
              📋 {e.actividad.plantillaOrigen.nombre}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'estado',
      header: t('execution:instancias.enlaces_activos.table.estado'),
      render: (e) => (
        <StatusBadge variant={e.activo ? 'success' : 'neutral'}>
          {e.activo ? t('execution:instancias.enlaces_activos.table.activo') : t('execution:instancias.enlaces_activos.table.inactivo')}
        </StatusBadge>
      ),
    },
    {
      key: 'creado',
      header: t('execution:instancias.enlaces_activos.table.creado'),
      render: (e) => (
        <span style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
          {new Date(e.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('execution:instancias.enlaces_activos.table.actions'),
      align: 'right',
      render: (e) => {
        const url = `${window.location.origin}/runner/enlace/${e.accessToken}?lang=${i18n.language}`;
        return (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { navigator.clipboard.writeText(url); toast.success(t('execution:instancias.link_copied')); }}
            >
              {t('execution:instancias.enlaces_activos.copy')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              aria-label={t('common:buttons.delete')}
              title={t('common:buttons.delete')}
              onClick={() => setDeleteEnlaceModal(e.id)}
            >🗑️</Button>
          </div>
        );
      },
    },
  ];

  const individualColumns: DataTableColumn<any>[] = [
    {
      key: 'estado',
      header: t('execution:instancias.individuales.table.estado'),
      render: (ins) => (
        <StatusBadge variant={
          ins.estado === 'finalizado' ? 'success' :
          ins.estado === 'iniciado' ? 'warning' : 'neutral'
        }>
          {ESTADO_LABELS[ins.estado] ?? ins.estado}
        </StatusBadge>
      ),
    },
    {
      key: 'actividad',
      header: t('execution:instancias.individuales.table.actividad'),
      render: (ins) => (
        <>
          <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{ins.actividad?.nombre || t('execution:instancias.individuales.table.desconocida')}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {ins.actividad?.iniciativa?.nombre || '—'}
          </div>
          {ins.actividad?.plantillaOrigen && (
            <span className="chip" style={{ fontSize: '0.68rem', marginTop: 2 }}>
              📋 {ins.actividad.plantillaOrigen.nombre}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'usuario',
      header: t('execution:instancias.individuales.table.usuario'),
      render: (ins) => (
        <span style={{ fontSize: '0.875rem' }}>
          {ins.usuario?.nombre || (ins.emailReferencia
            ? <span style={{ color: 'var(--color-text-secondary)' }}>{ins.emailReferencia}</span>
            : <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>{t('execution:instancias.individuales.table.pendiente')}</span>
          )}
          {ins.usuario?.email && (
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{ins.usuario.email}</div>
          )}
          {ins.usuario?.cargo && (
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{ins.usuario.cargo}</div>
          )}
        </span>
      ),
    },
    {
      key: 'area',
      header: t('execution:instancias.individuales.table.area'),
      render: (ins) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-main)' }}>
          {ins.usuario?.area || <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>—</span>}
        </span>
      ),
    },
    {
      key: 'archivos',
      header: t('execution:instancias.individuales.table.archivos'),
      render: (ins) => {
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
                  } catch (err) { toast.error(translateError(err)); }
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 8px', fontSize: '0.72rem',
                  background: 'var(--color-success-bg)', color: 'var(--color-success-strong)',
                  borderRadius: 5, fontWeight: 600,
                  border: '1px solid var(--color-success-border)', whiteSpace: 'nowrap',
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
                  background: 'var(--color-primary-light)', color: 'var(--color-primary-hover)',
                  borderRadius: 5, fontWeight: 600, textDecoration: 'none',
                  border: '1px solid var(--color-info-border)', whiteSpace: 'nowrap',
                }}
                title={t('execution:instancias.individuales.actions.interaccion_title')}
              >
                ⬇ {labelFor(inter.paso?.titulo)}
              </a>
            ))}
          </div>
        );
      },
    },
    {
      key: 'ultima_actualizacion',
      header: t('execution:instancias.individuales.table.ultima_actualizacion'),
      render: (ins) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
          {new Date(ins.updatedAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('execution:instancias.individuales.table.actions'),
      align: 'right',
      render: (ins) => (
        <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Link to={`/admin/instancias/${ins.id}`} className="btn btn-secondary btn-sm"
            style={{ textDecoration: 'none' }}>
            {t('execution:instancias.individuales.actions.view_results')}
          </Link>
          <Button variant="secondary" size="sm"
            onClick={() => descargarPdf(ins.id)}
            title={t('execution:instancias.individuales.actions.pdf_title')}>
            📄 PDF
          </Button>
          <Button variant="secondary" size="sm"
            onClick={() => descargarZip(ins.id)}
            title={t('execution:instancias.individuales.actions.zip_title')}>
            📦 ZIP
          </Button>
          <Button variant="secondary" size="sm"
            onClick={() => copyLink(ins.accessToken)}>
            {t('execution:instancias.individuales.actions.copy_link')}
          </Button>
          <Button variant="danger" size="sm"
            aria-label={t('common:buttons.delete')}
            onClick={() => setDeleteModal(ins.id)} title={t('common:buttons.delete')}>
            🗑️
          </Button>
        </div>
      ),
    },
  ];

  const individualEmptyMessage = search || filterEstado || filterEmpresa || filterActividad ? (
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
  );

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };
  const handleFilterEstado = (val: string) => { setFilterEstado(val); setPage(1); };

  const actividadError = wasValidated && !formEnlace.actividadId
    ? t('execution:instancias.generar_enlace.actividad_required')
    : undefined;

  return (
    <div>

      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/admin/inicio' },
          { label: t('admin:sidebar.ejecuciones') },
        ]}
      />

      <ConfirmModal isOpen={!!deleteModal} title={t('execution:instancias.delete_instancia_modal.title')}
        message={t('execution:instancias.delete_instancia_modal.message')}
        onConfirm={handleDeleteInstancia} onCancel={() => setDeleteModal(null)} />
      <ConfirmModal isOpen={!!deleteEnlaceModal} title={t('execution:instancias.delete_enlace_modal.title')}
        message={t('execution:instancias.delete_enlace_modal.message')}
        onConfirm={handleDeleteEnlace} onCancel={() => setDeleteEnlaceModal(null)} />

      {/* Page header */}
      <PageHeader
        title={t('execution:instancias.page_title')}
        description={t('execution:instancias.page_description')}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* Prerequisite warning */}
      {loaded && actividades.length === 0 && (
        <div className="prereq-banner">
          <span className="prereq-banner-icon">⚠️</span>
          <div className="prereq-banner-body">
            <p className="prereq-banner-title">{t('execution:instancias.prereq_banner.title')}</p>
            <p className="prereq-banner-text">
              {t('execution:instancias.prereq_banner.text')}
            </p>
          </div>
          <Link to="/admin/actividades" className="btn btn-secondary" style={{ textDecoration: 'none', flexShrink: 0 }}>
            {t('execution:instancias.prereq_banner.link')}
          </Link>
        </div>
      )}

      {/* ── Sección 1 + 2: Generar enlace / Enlaces activos (lado a lado) ── */}
      <FormListLayout
        form={
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title">{t('execution:instancias.generar_enlace.section_title')}</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{t('execution:instancias.generar_enlace.section_subtitle')}</span>
          </div>

          <div className="section-card-body">
          <form
            onSubmit={(e) => { e.preventDefault(); setWasValidated(true); if (e.currentTarget.checkValidity()) generarEnlace(); }}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
            noValidate
          >
            <Field
              label={t('execution:instancias.generar_enlace.actividad_label')}
              htmlFor="enlace-actividad"
              required
              error={actividadError}
            >
              <select id="enlace-actividad" className="input" required value={formEnlace.actividadId}
                onChange={e => setFormEnlace({ ...formEnlace, actividadId: e.target.value })}>
                <option value="">{t('execution:instancias.generar_enlace.select_actividad')}</option>
                {actividades.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.iniciativa?.empresa?.nombre} · {a.iniciativa?.nombre} · {a.nombre}
                    {a.plantillaOrigen ? ` [📋 ${a.plantillaOrigen.nombre}]` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={<>{t('execution:instancias.generar_enlace.etiqueta_label')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{t('execution:instancias.generar_enlace.etiqueta_optional')}</span></>}
              htmlFor="enlace-etiqueta"
            >
              <input id="enlace-etiqueta" className="input" placeholder={t('execution:instancias.generar_enlace.etiqueta_placeholder')}
                value={formEnlace.nombre} onChange={e => setFormEnlace({ ...formEnlace, nombre: e.target.value })} />
            </Field>
            <div className="form-footer">
              <Button type="submit" variant="primary" disabled={generandoEnlace}>
                {generandoEnlace ? t('execution:instancias.generar_enlace.generating') : t('execution:instancias.generar_enlace.submit')}
              </Button>
            </div>
          </form>

          {enlaceGenerado && (
            <div style={{ marginTop: 'var(--space-4)' }}>
            <Alert variant="success" className="" title={t('execution:instancias.generar_enlace.success_title')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <code style={{ fontSize: '0.75rem', wordBreak: 'break-all', flex: 1, minWidth: 0 }}>{enlaceGenerado}</code>
                <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(enlaceGenerado)}>
                  {t('execution:instancias.generar_enlace.copy')}
                </Button>
                <button
                  type="button"
                  aria-label={t('common:buttons.close')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', flexShrink: 0 }}
                  onClick={() => setEnlaceGenerado(null)}
                >✕</button>
              </div>
            </Alert>
            </div>
          )}
          </div>
        </div>
        }
        list={
          enlaces.length === 0 ? (
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title">{t('execution:instancias.enlaces_activos.section_title')}</span>
            <span className="count-badge">0</span>
          </div>
          <EmptyState title={t('common:no_data')} />
        </div>
          ) : (
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title">{t('execution:instancias.enlaces_activos.section_title')}</span>
            <span className="count-badge">{filteredEnlaces.length}</span>
          </div>

          <DataTable
            columns={enlaceColumns}
            rows={paginatedEnlaces}
            rowKey={e => e.id}
            emptyMessage={t('execution:instancias.enlaces_activos.table.no_results')}
          />
          <Pagination
            page={enlaceCurrentPage}
            pageCount={enlaceTotalPages}
            onPageChange={setEnlacePage}
            prevLabel={t('common:buttons.previous')}
            nextLabel={t('common:buttons.next')}
            info={t('execution:instancias.enlaces_activos.pagination.showing', {
              from: (enlaceCurrentPage - 1) * PAGE_SIZE + 1,
              to: Math.min(enlaceCurrentPage * PAGE_SIZE, filteredEnlaces.length),
              total: filteredEnlaces.length,
            })}
          />
        </div>
          )
        }
      />

      {/* ── Sección 3: Ejecuciones individuales ── */}
      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title">{t('execution:instancias.individuales.section_title')}</span>
          <span className="count-badge">{instancias.length}</span>
        </div>

        <div>

          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap',
            padding: 'var(--space-2) var(--space-4)',
            background: 'var(--color-bg-subtle)',
          }}>
            <input
              className="input"
              style={{ maxWidth: 240, fontSize: '0.78rem' }}
              placeholder={t('execution:instancias.filters.search_placeholder')}
              value={search}
              onChange={e => handleSearch(e.target.value)}
              aria-label={t('execution:instancias.filters.search_placeholder')}
            />
            <select
              className="input"
              style={{ maxWidth: 150, fontSize: '0.78rem' }}
              value={filterEstado}
              onChange={e => handleFilterEstado(e.target.value)}
              aria-label={t('execution:instancias.filters.all_estados')}
            >
              <option value="">{t('execution:instancias.filters.all_estados')}</option>
              <option value="generado">{ESTADO_LABELS.generado}</option>
              <option value="iniciado">{ESTADO_LABELS.iniciado}</option>
              <option value="finalizado">{ESTADO_LABELS.finalizado}</option>
            </select>
            {empresaOptions.length > 0 && (
              <select
                className="input"
                style={{ maxWidth: 170, fontSize: '0.78rem' }}
                value={filterEmpresa}
                onChange={e => { setFilterEmpresa(e.target.value); setPage(1); setEnlacePage(1); }}
                aria-label={t('execution:instancias.filters.all_empresas')}
              >
                <option value="">{t('execution:instancias.filters.all_empresas')}</option>
                {empresaOptions.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
            {actividadOptions.length > 0 && (
              <select
                className="input"
                style={{ maxWidth: 170, fontSize: '0.78rem' }}
                value={filterActividad}
                onChange={e => { setFilterActividad(e.target.value); setPage(1); setEnlacePage(1); }}
                aria-label={t('execution:instancias.filters.all_actividades')}
              >
                <option value="">{t('execution:instancias.filters.all_actividades')}</option>
                {actividadOptions.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
            {(filterEmpresa || filterActividad) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setFilterEmpresa(''); setFilterActividad(''); setPage(1); setEnlacePage(1); }}
              >
                {t('execution:instancias.filters.clear')}
              </Button>
            )}
          </div>

          {/* Table */}
          <DataTable
            columns={individualColumns}
            rows={paginated}
            rowKey={ins => ins.id}
            emptyMessage={individualEmptyMessage}
          />
          <Pagination
            page={currentPage}
            pageCount={totalPages}
            onPageChange={setPage}
            prevLabel={t('common:buttons.previous')}
            nextLabel={t('common:buttons.next')}
            info={filtered.length === 0
              ? t('execution:instancias.individuales.pagination.no_results')
              : t('execution:instancias.individuales.pagination.showing', {
                  from: (currentPage - 1) * PAGE_SIZE + 1,
                  to: Math.min(currentPage * PAGE_SIZE, filtered.length),
                  total: filtered.length,
                })}
          />

        </div>
      </div>

      </div>

    </div>
  );
}
