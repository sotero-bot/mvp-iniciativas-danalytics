import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { ProgramasDashboardPanel } from './ProgramasDashboardPanel';
import { Field, StatusBadge, Loading, EmptyState, PageHeader, Breadcrumb, Button, FilterToolbar, DataTable } from '../../components/ui';
import { toast } from '../../components/toast-store';
import type { StatusVariant, DataTableColumn } from '../../components/ui';
import { ProgramaFormModal } from './ProgramaFormModal';
import { ProgramaDetailDrawer } from './ProgramaDetailDrawer';
import { MatriculaModal } from './MatriculaModal';
import type { EstadoPrograma, EmpresaLite, FacilitadorLite, Programa, PlantillaGlobalLite, FormState } from './programas.types';
import { TIPOS_SNAPSHOT } from './programas.types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const ESTADO_VARIANTS: Record<EstadoPrograma, StatusVariant> = {
  borrador:   'neutral',
  activo:     'success',
  finalizado: 'info',
  cancelado:  'danger',
};

// Selección por defecto: la versión vigente (activa, o la más reciente) de cada tipo.
// `globs` viene ordenado por version desc del backend.
function defaultPlantillaSeleccion(globs: PlantillaGlobalLite[]): Record<string, string> {
  const sel: Record<string, string> = {};
  for (const tipo of TIPOS_SNAPSHOT) {
    const delTipo = globs.filter(g => g.tipoFormulario === tipo);
    if (delTipo.length === 0) continue;
    sel[tipo] = (delTipo.find(g => g.activa) ?? delTipo[0]).id;
  }
  return sel;
}

const emptyForm: FormState = {
  nombre: '',
  descripcion: '',
  empresaId: '',
  facilitadorIds: [],
  estado: 'borrador',
  timezone: 'America/Bogota',
  diasGracia: 3,
  totalSesionesEsperadas: '',
  presentacionDesdeSesion: '',
  fechaInicio: '',
  fechaFin: '',
  traduccionesPt: { nombre: '', descripcion: '' },
  plantillaSeleccion: {},
};

export function ProgramasPage() {
  const { t, i18n } = useTranslation(['admin', 'common', 'programa']);

  const [programas, setProgramas] = useState<Programa[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaLite[]>([]);
  const [facilitadores, setFacilitadores] = useState<FacilitadorLite[]>([]);
  const [plantillasGlobales, setPlantillasGlobales] = useState<PlantillaGlobalLite[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterEstado, setFilterEstado] = useState<'' | EstadoPrograma>('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Programa | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<Programa | null>(null);
  const [detailOpen, setDetailOpen] = useState<Programa | null>(null);
  // Matrícula rápida desde la lista, sin abrir el panel del programa.
  const [matriculaFor, setMatriculaFor] = useState<{ programa: Programa; modo: 'individual' | 'masiva' } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterEmpresa) params.set('empresaId', filterEmpresa);
      if (filterEstado) params.set('estado', filterEstado);
      if (search.trim()) params.set('search', search.trim());
      params.set('locale', i18n.language);
      const res = await fetchWithErrorMapping(`${API_URL}/admin/programas?${params.toString()}`);
      setProgramas(await res.json());
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadEmpresas = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/organization/empresas`);
      setEmpresas(await res.json());
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const loadFacilitadores = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/usuarios?role=facilitador&estado=activo`);
      const data = await res.json();
      setFacilitadores(data.map((u: any) => ({ id: u.id, nombre: u.nombre, email: u.email })));
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const loadPlantillasGlobales = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/plantillas-formulario`);
      setPlantillasGlobales(await res.json());
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  useEffect(() => { loadEmpresas(); loadFacilitadores(); loadPlantillasGlobales(); }, []);
  useEffect(() => { load(); }, [filterEmpresa, filterEstado]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, plantillaSeleccion: defaultPlantillaSeleccion(plantillasGlobales) });
    setModalOpen(true);
  };

  const openEdit = async (p: Programa) => {
    setEditing(p);
    const baseForm: FormState = {
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      empresaId: p.empresaId,
      facilitadorIds: p.facilitadores.map(f => f.id),
      estado: p.estado,
      timezone: p.timezone,
      diasGracia: p.diasGracia,
      totalSesionesEsperadas: p.totalSesionesEsperadas != null ? String(p.totalSesionesEsperadas) : '',
      presentacionDesdeSesion: p.presentacionDesdeSesion != null ? String(p.presentacionDesdeSesion) : '',
      fechaInicio: p.fechaInicio ? p.fechaInicio.slice(0, 10) : '',
      fechaFin: p.fechaFin ? p.fechaFin.slice(0, 10) : '',
      traduccionesPt: { nombre: '', descripcion: '' },
      plantillaSeleccion: {}, // no aplica al editar (el snapshot ya está tomado)
    };
    setForm(baseForm);
    setModalOpen(true);
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/programas/${p.id}/traducciones/pt`);
      const data = await res.json();
      setForm(f => ({
        ...f,
        traduccionesPt: {
          nombre: data?.programa?.nombre ?? '',
          descripcion: data?.programa?.descripcion ?? '',
        },
      }));
    } catch {
      // Silencioso: si no hay traducciones aún, seguimos con los defaults vacíos.
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        empresaId: form.empresaId,
        facilitadorIds: form.facilitadorIds,
        estado: form.estado,
        timezone: form.timezone,
        diasGracia: form.diasGracia,
        totalSesionesEsperadas: form.totalSesionesEsperadas.trim() === '' ? null : Number(form.totalSesionesEsperadas),
        presentacionDesdeSesion: form.presentacionDesdeSesion.trim() === '' ? null : Number(form.presentacionDesdeSesion),
        fechaInicio: form.fechaInicio || null,
        fechaFin: form.fechaFin || null,
        // RF-46: plantillas globales elegidas (una por tipo). Solo se envía al crear.
        plantillaGlobalIds: Object.values(form.plantillaSeleccion).filter(Boolean),
      };
      let programaId: string;
      if (editing) {
        const { empresaId, plantillaGlobalIds, ...updateBody } = body;
        await fetchWithErrorMapping(`${API_URL}/admin/programas/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateBody),
        });
        programaId = editing.id;
        toast.success(t('admin:programas.toast.updated'));
      } else {
        const res = await fetchWithErrorMapping(`${API_URL}/admin/programas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const created = await res.json();
        programaId = created.id;
        toast.success(t('admin:programas.toast.created'));
      }

      const ptNombre = form.traduccionesPt.nombre.trim();
      const ptDescripcion = form.traduccionesPt.descripcion.trim();
      if (ptNombre || ptDescripcion) {
        await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/traducciones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locale: 'pt',
            nombre: ptNombre,
            descripcion: ptDescripcion,
          }),
        });
      }

      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/programas/${deleteModal.id}`, { method: 'DELETE' });
      setDeleteModal(null);
      load();
      toast.success(t('admin:programas.toast.cancelled'));
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const empresaOptions = useMemo(() => empresas.map(e => ({ id: e.id, nombre: e.nombre })), [empresas]);

  // Atenúa la fila de programas inactivos sin depender de estilos por-fila del DataTable.
  const dim = (p: Programa, node: React.ReactNode) => (
    <span style={{ opacity: p.activo ? 1 : 0.5 }}>{node}</span>
  );

  const columns: DataTableColumn<Programa>[] = [
    {
      key: 'nombre',
      header: t('admin:programas.columns.nombre'),
      render: p => dim(p, (
        <>
          <button className="btn-link" onClick={() => setDetailOpen(p)} style={{ padding: 0, textAlign: 'left', fontWeight: 500 }}>
            {p.nombre}
          </button>
          {p.descripcion && (
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>{p.descripcion.slice(0, 80)}</div>
          )}
        </>
      )),
    },
    {
      key: 'empresa',
      header: t('admin:programas.columns.empresa'),
      render: p => dim(p, (
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          {p.empresa?.nombre ?? <span style={{ color: 'var(--color-border-strong)' }}>—</span>}
        </span>
      )),
    },
    {
      key: 'facilitador',
      header: t('admin:programas.columns.facilitador'),
      render: p => dim(p, (
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          {p.facilitadores.length === 0 ? (
            <span style={{ color: 'var(--color-border-strong)' }}>—</span>
          ) : (
            p.facilitadores.map(f => (
              <div key={f.id}>
                {f.nombre}
                {f.email && <span style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}> · {f.email}</span>}
              </div>
            ))
          )}
        </span>
      )),
    },
    {
      key: 'estado',
      header: t('admin:programas.columns.estado'),
      align: 'center',
      render: p => dim(p, (
        <StatusBadge variant={ESTADO_VARIANTS[p.estado]}>
          {t(`programa:estado.${p.estado}`)}
        </StatusBadge>
      )),
    },
    {
      key: 'sesiones',
      header: t('admin:programas.columns.sesiones'),
      align: 'center',
      render: p => dim(p, <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{p._count.sesiones}</span>),
    },
    {
      key: 'participantes',
      header: t('admin:programas.columns.participantes'),
      align: 'center',
      render: p => dim(p, <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{p._count.participantes}</span>),
    },
    {
      key: 'acciones',
      header: t('admin:programas.columns.acciones'),
      align: 'right',
      render: p => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <Button variant="secondary" size="sm" onClick={() => setDetailOpen(p)}>
            {t('admin:programas.actions.details')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>
            {t('admin:programas.actions.edit')}
          </Button>
          <Link className="btn btn-secondary btn-sm" to={`/admin/programas/${p.id}/diagnostico`}>
            {t('admin:programas.actions.diagnostico')}
          </Link>
          <Link className="btn btn-secondary btn-sm" to={`/admin/programas/${p.id}/asistencia`}>
            {t('admin:programas.actions.asistencia')}
          </Link>
          {p.activo && (
            <Button variant="secondary" size="sm" onClick={() => setMatriculaFor({ programa: p, modo: 'individual' })}>
              {t('admin:programas.actions.matricular')}
            </Button>
          )}
          {p.activo && (
            <Button variant="secondary" size="sm" onClick={() => setMatriculaFor({ programa: p, modo: 'masiva' })}>
              {t('admin:programas.participantes.actions.new_masiva')}
            </Button>
          )}
          {p.activo && p.estado !== 'cancelado' && (
            <Button variant="danger" size="sm" onClick={() => setDeleteModal(p)}>
              {t('admin:programas.actions.cancel')}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <ConfirmModal
        isOpen={!!deleteModal}
        title={t('admin:programas.cancel_modal.title')}
        message={t('admin:programas.cancel_modal.message', { nombre: deleteModal?.nombre ?? '' })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(null)}
      />

      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/admin/inicio' },
          { label: t('admin:sidebar.programas') },
        ]}
      />

      <PageHeader
        title={t('admin:programas.page_title')}
        description={t('admin:programas.page_subtitle')}
        actions={
          <Button variant="primary" onClick={openCreate}>
            + {t('admin:programas.actions.new')}
          </Button>
        }
      />

      {/* RF-04: dashboard de programas activos */}
      <ProgramasDashboardPanel />

      <div className="section-card home-panel">
        <div className="section-card-header">
          <span className="section-card-title">{t('admin:programas.list_title')}</span>
          <span className="count-badge">{programas.length}</span>
        </div>

        <div className="home-filter-strip">
          <FilterToolbar>
            <Field label={t('admin:programas.filters.empresa')}>
              <select className="input" value={filterEmpresa} onChange={e => setFilterEmpresa(e.target.value)}>
                <option value="">{t('admin:programas.filters.all')}</option>
                {empresaOptions.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </Field>
            <Field label={t('admin:programas.filters.estado')}>
              <select className="input" value={filterEstado} onChange={e => setFilterEstado(e.target.value as any)}>
                <option value="">{t('admin:programas.filters.all')}</option>
                <option value="borrador">{t('programa:estado.borrador')}</option>
                <option value="activo">{t('programa:estado.activo')}</option>
                <option value="finalizado">{t('programa:estado.finalizado')}</option>
                <option value="cancelado">{t('programa:estado.cancelado')}</option>
              </select>
            </Field>
            <Field label={t('admin:programas.filters.search')}>
              <input
                className="input"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') load(); }}
                onBlur={load}
                placeholder={t('admin:programas.filters.search_placeholder')}
              />
            </Field>
          </FilterToolbar>
        </div>

        {loading && <Loading label={t('common:loading')} />}
        {!loading && programas.length === 0 && (
          <EmptyState title={t('admin:programas.empty')} />
        )}
        {!loading && programas.length > 0 && (
          <DataTable columns={columns} rows={programas} rowKey={p => p.id} />
        )}
      </div>

      {modalOpen && (
        <ProgramaFormModal
          form={form}
          setForm={setForm}
          editing={editing}
          empresas={empresaOptions}
          facilitadores={facilitadores}
          plantillasGlobales={plantillasGlobales}
          saving={saving}
          onClose={() => setModalOpen(false)}
          onSubmit={submit}
        />
      )}

      {detailOpen && (
        <ProgramaDetailDrawer
          programaId={detailOpen.id}
          onClose={() => setDetailOpen(null)}
        />
      )}

      {matriculaFor && (
        <MatriculaModal
          modo={matriculaFor.modo}
          programaId={matriculaFor.programa.id}
          empresaId={matriculaFor.programa.empresaId}
          onClose={() => setMatriculaFor(null)}
          onSaved={() => {
            toast.success(t('admin:programas.toast.participant_added'));
            load();
          }}
        />
      )}
    </div>
  );
}
