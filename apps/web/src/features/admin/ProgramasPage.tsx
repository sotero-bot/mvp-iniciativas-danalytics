import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { ProgramasDashboardPanel } from './ProgramasDashboardPanel';
import { Modal, Field, StatusBadge, Loading, EmptyState, PageHeader } from '../../components/ui';
import type { StatusVariant } from '../../components/ui';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type EstadoPrograma = 'borrador' | 'activo' | 'finalizado' | 'cancelado';

const ESTADO_VARIANTS: Record<EstadoPrograma, StatusVariant> = {
  borrador:   'neutral',
  activo:     'success',
  finalizado: 'info',
  cancelado:  'danger',
};

interface EmpresaLite { id: string; nombre: string; }
interface FacilitadorLite { id: string; nombre: string; email: string | null; }

interface Programa {
  id: string;
  nombre: string;
  descripcion: string | null;
  empresaId: string;
  estado: EstadoPrograma;
  timezone: string;
  diasGracia: number;
  fechaInicio: string | null;
  fechaFin: string | null;
  activo: boolean;
  bitacoraHabilitadaEn: string | null; // O-01
  createdAt: string;
  updatedAt: string;
  empresa: { id: string; nombre: string } | null;
  // C-01: N:M — un programa puede tener varios facilitadores.
  facilitadores: { id: string; nombre: string; email: string | null }[];
  _count: { sesiones: number; participantes: number };
}

interface TraduccionCampos {
  nombre: string;
  descripcion: string;
}

interface PlantillaGlobalLite {
  id: string;
  tipoFormulario: string;
  nombre: string;
  version: number;
  activa: boolean;
}

// Tipos de formulario que se congelan en el snapshot del programa (RF-46), en orden.
const TIPOS_SNAPSHOT = ['diagnostico_inicial', 'diagnostico_final', 'feedback', 'bitacora', 'plantilla_proyecto'];

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

interface FormState {
  nombre: string;
  descripcion: string;
  empresaId: string;
  facilitadorIds: string[];
  estado: EstadoPrograma;
  timezone: string;
  diasGracia: number;
  fechaInicio: string;
  fechaFin: string;
  traduccionesPt: TraduccionCampos;
  // RF-46: plantilla global elegida por tipo (''=ninguna). Solo aplica al crear.
  plantillaSeleccion: Record<string, string>;
}

const emptyForm: FormState = {
  nombre: '',
  descripcion: '',
  empresaId: '',
  facilitadorIds: [],
  estado: 'borrador',
  timezone: 'America/Bogota',
  diasGracia: 3,
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
  const [toast, setToast] = useState<string | null>(null);

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
  const [matriculaFor, setMatriculaFor] = useState<Programa | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

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
      showToast(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadEmpresas = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/organization/empresas`);
      setEmpresas(await res.json());
    } catch (err) {
      showToast(translateError(err));
    }
  };

  const loadFacilitadores = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/usuarios?role=facilitador&estado=activo`);
      const data = await res.json();
      setFacilitadores(data.map((u: any) => ({ id: u.id, nombre: u.nombre, email: u.email })));
    } catch (err) {
      showToast(translateError(err));
    }
  };

  const loadPlantillasGlobales = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/plantillas-formulario`);
      setPlantillasGlobales(await res.json());
    } catch (err) {
      showToast(translateError(err));
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
        showToast(t('admin:programas.toast.updated'));
      } else {
        const res = await fetchWithErrorMapping(`${API_URL}/admin/programas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const created = await res.json();
        programaId = created.id;
        showToast(t('admin:programas.toast.created'));
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
      showToast(translateError(err));
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
      showToast(t('admin:programas.toast.cancelled'));
    } catch (err) {
      showToast(translateError(err));
    }
  };

  const empresaOptions = useMemo(() => empresas.map(e => ({ id: e.id, nombre: e.nombre })), [empresas]);

  return (
    <div>
      {toast && <div className="toast">{toast}</div>}

      <ConfirmModal
        isOpen={!!deleteModal}
        title={t('admin:programas.cancel_modal.title')}
        message={t('admin:programas.cancel_modal.message', { nombre: deleteModal?.nombre ?? '' })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(null)}
      />

      <PageHeader
        title={t('admin:programas.page_title')}
        description={t('admin:programas.page_subtitle')}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            + {t('admin:programas.actions.new')}
          </button>
        }
      />

      {/* RF-04: dashboard de programas activos */}
      <ProgramasDashboardPanel />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: 16,
        padding: 16,
        background: 'var(--color-bg-page)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
      }}>
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
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('admin:programas.columns.nombre')}</th>
              <th>{t('admin:programas.columns.empresa')}</th>
              <th>{t('admin:programas.columns.facilitador')}</th>
              <th style={{ textAlign: 'center' }}>{t('admin:programas.columns.estado')}</th>
              <th style={{ textAlign: 'center' }}>{t('admin:programas.columns.sesiones')}</th>
              <th style={{ textAlign: 'center' }}>{t('admin:programas.columns.participantes')}</th>
              <th style={{ textAlign: 'right' }}>{t('admin:programas.columns.acciones')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7}><Loading label={t('common:loading')} /></td></tr>
            )}
            {!loading && programas.length === 0 && (
              <tr><td colSpan={7}><EmptyState title={t('admin:programas.empty')} /></td></tr>
            )}
            {programas.map(p => {
              return (
                <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.5 }}>
                  <td style={{ fontWeight: 500 }}>
                    <button className="btn-link" onClick={() => setDetailOpen(p)} style={{ padding: 0, textAlign: 'left' }}>
                      {p.nombre}
                    </button>
                    {p.descripcion && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>{p.descripcion.slice(0, 80)}</div>}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                    {p.empresa?.nombre ?? <span style={{ color: 'var(--color-border-strong)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
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
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusBadge variant={ESTADO_VARIANTS[p.estado]}>
                      {t(`programa:estado.${p.estado}`)}
                    </StatusBadge>
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                    {p._count.sesiones}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                    {p._count.participantes}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn-link" onClick={() => setDetailOpen(p)}>
                      {t('admin:programas.actions.details')}
                    </button>
                    {' · '}
                    <button className="btn-link" onClick={() => openEdit(p)}>
                      {t('admin:programas.actions.edit')}
                    </button>
                    {' · '}
                    <Link className="btn-link" to={`/admin/programas/${p.id}/diagnostico`}>
                      {t('admin:programas.actions.diagnostico')}
                    </Link>
                    {' · '}
                    <Link className="btn-link" to={`/admin/programas/${p.id}/asistencia`}>
                      {t('admin:programas.actions.asistencia')}
                    </Link>
                    {p.activo && (
                      <>
                        {' · '}
                        <button className="btn-link" onClick={() => setMatriculaFor(p)}>
                          {t('admin:programas.actions.matricular')}
                        </button>
                      </>
                    )}
                    {p.activo && p.estado !== 'cancelado' && (
                      <>
                        {' · '}
                        <button className="btn-link btn-link-danger" onClick={() => setDeleteModal(p)}>
                          {t('admin:programas.actions.cancel')}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
          onError={showToast}
        />
      )}

      {matriculaFor && (
        <MatriculaModal
          programaId={matriculaFor.id}
          empresaId={matriculaFor.empresaId}
          onClose={() => setMatriculaFor(null)}
          onSaved={() => {
            showToast(t('admin:programas.toast.participant_added'));
            load();
          }}
          onError={showToast}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal de creación/edición
// ─────────────────────────────────────────────────────────────
interface ProgramaFormModalProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  editing: Programa | null;
  empresas: EmpresaLite[];
  facilitadores: FacilitadorLite[];
  plantillasGlobales: PlantillaGlobalLite[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

function ProgramaFormModal({
  form, setForm, editing, empresas, facilitadores, plantillasGlobales, saving, onClose, onSubmit,
}: ProgramaFormModalProps) {
  const { t } = useTranslation(['admin', 'common', 'programa', 'formularios']);
  const [langTab, setLangTab] = useState<'es' | 'pt'>('es');

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
    color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
    fontWeight: 500,
    fontSize: '0.8rem',
  });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing ? t('admin:programas.modal.title_edit') : t('admin:programas.modal.title_create')}
      maxWidth={620}
    >
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 4 }}>
            <button type="button" onClick={() => setLangTab('es')} className="btn-link" style={tabStyle(langTab === 'es')}>
              🇪🇸 {t('admin:programas.lang.es')}
            </button>
            <button type="button" onClick={() => setLangTab('pt')} className="btn-link" style={tabStyle(langTab === 'pt')}>
              🇧🇷 {t('admin:programas.lang.pt')}
            </button>
          </div>

          {langTab === 'es' ? (
            <>
              <Field label={t('admin:programas.fields.nombre')} required>
                <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
              </Field>
              <Field label={t('admin:programas.fields.descripcion')}>
                <textarea
                  className="input"
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  rows={3}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label={<>{t('admin:programas.fields.nombre')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(pt)</span></>}>
                <input
                  className="input"
                  value={form.traduccionesPt.nombre}
                  onChange={e => setForm(f => ({ ...f, traduccionesPt: { ...f.traduccionesPt, nombre: e.target.value } }))}
                  placeholder={form.nombre}
                />
              </Field>
              <Field label={<>{t('admin:programas.fields.descripcion')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(pt)</span></>}>
                <textarea
                  className="input"
                  value={form.traduccionesPt.descripcion}
                  onChange={e => setForm(f => ({ ...f, traduccionesPt: { ...f.traduccionesPt, descripcion: e.target.value } }))}
                  rows={3}
                  placeholder={form.descripcion || undefined}
                />
              </Field>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: -4 }}>
                {t('admin:programas.lang.hint')}
              </div>
            </>
          )}

          <div className="form-grid">
            <Field label={t('admin:programas.fields.empresa')} required>
              <select
                className="input"
                value={form.empresaId}
                onChange={e => setForm(f => ({ ...f, empresaId: e.target.value }))}
                required
                disabled={!!editing}
              >
                <option value="">—</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </Field>
            <Field label={t('admin:programas.fields.facilitadores')}>
              {/* C-01: N:M — selección múltiple de facilitadores. */}
              <div style={{
                maxHeight: 140, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 6,
                padding: '6px 10px',
              }}>
                {facilitadores.length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>{t('admin:programas.fields.sin_facilitadores')}</div>
                )}
                {facilitadores.map(f => {
                  const checked = form.facilitadorIds.includes(f.id);
                  return (
                    <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => setForm(fm => ({
                          ...fm,
                          facilitadorIds: e.target.checked
                            ? [...fm.facilitadorIds, f.id]
                            : fm.facilitadorIds.filter(id => id !== f.id),
                        }))}
                      />
                      {f.nombre}
                    </label>
                  );
                })}
              </div>
            </Field>
          </div>

          <div className="form-grid form-grid-3">
            <Field label={t('admin:programas.fields.estado')}>
              <select className="input" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value as EstadoPrograma }))}>
                <option value="borrador">{t('programa:estado.borrador')}</option>
                <option value="activo">{t('programa:estado.activo')}</option>
                <option value="finalizado">{t('programa:estado.finalizado')}</option>
                <option value="cancelado">{t('programa:estado.cancelado')}</option>
              </select>
            </Field>
            <Field label={t('admin:programas.fields.timezone')}>
              <input className="input" value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} />
            </Field>
            <Field label={t('admin:programas.fields.dias_gracia')}>
              <input
                type="number"
                className="input"
                value={form.diasGracia}
                min={0}
                max={90}
                onChange={e => setForm(f => ({ ...f, diasGracia: Number(e.target.value) }))}
              />
            </Field>
          </div>

          <div className="form-grid">
            <Field label={t('admin:programas.fields.fecha_inicio')}>
              <input type="date" className="input" value={form.fechaInicio} onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))} />
            </Field>
            <Field label={t('admin:programas.fields.fecha_fin')}>
              <input type="date" className="input" value={form.fechaFin} onChange={e => setForm(f => ({ ...f, fechaFin: e.target.value }))} />
            </Field>
          </div>

          {/* RF-46: selección de plantillas del snapshot — solo al crear (después el
              snapshot es inmutable). Una por tipo, opcional, default última versión. */}
          {!editing && (
            <Field label={t('admin:programas.plantillas.title')}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
                {t('admin:programas.plantillas.hint')}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {TIPOS_SNAPSHOT.map(tipo => {
                  const opciones = plantillasGlobales.filter(g => g.tipoFormulario === tipo);
                  if (opciones.length === 0) return null;
                  return (
                    <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ minWidth: 150, fontSize: '0.85rem' }}>{t(`formularios:tipos.${tipo}`)}</span>
                      <select
                        className="input"
                        value={form.plantillaSeleccion[tipo] ?? ''}
                        onChange={e => setForm(f => ({ ...f, plantillaSeleccion: { ...f.plantillaSeleccion, [tipo]: e.target.value } }))}
                      >
                        <option value="">{t('admin:programas.plantillas.ninguna')}</option>
                        {opciones.map(o => (
                          <option key={o.id} value={o.id}>
                            {o.nombre} · v{o.version}{o.activa ? '' : ` (${t('admin:programas.plantillas.inactiva')})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </Field>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              {t('common:cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common:saving') : t('common:save')}
            </button>
          </div>
        </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Drawer de detalle (Sesiones + Participantes)
// ─────────────────────────────────────────────────────────────
interface Sesion {
  id: string;
  programaId: string;
  numeroSesion: number;
  titulo: string;
  descripcion: string | null;
  fechaProgramada: string;
  materialArchivoKey: string | null;
  urlPresentacion: string | null;
  urlGrabacion: string | null;
  materialDesbloqueoEn: string | null;
  estado: 'pendiente' | 'completada';
}

interface Participante {
  id: string;
  programaId: string;
  usuarioId: string;
  activo: boolean;
  usuario: {
    id: string;
    nombre: string;
    email: string | null;
    cargo: string | null;
    area: string | null;
    puedeIniciarSesion: boolean;
    role: { id: string; slug: string; nombre: string } | null;
  };
}

interface GrupoMiembro {
  id: string;
  usuarioId: string;
  usuario: { id: string; nombre: string; email: string | null };
}

interface Grupo {
  id: string;
  programaId: string;
  nombre: string;
  orden: number;
  miembros: GrupoMiembro[];
}

interface ProgramaDetail extends Programa {
  sesiones: Sesion[];
  participantes: Participante[];
}

function ProgramaDetailDrawer({
  programaId, onClose, onError,
}: { programaId: string; onClose: () => void; onError: (msg: string) => void }) {
  const { t, i18n } = useTranslation(['admin', 'common', 'programa']);
  const [programa, setPrograma] = useState<ProgramaDetail | null>(null);
  const [tab, setTab] = useState<'sesiones' | 'participantes' | 'grupos'>('sesiones');
  const [loading, setLoading] = useState(false);
  const [sesionModalOpen, setSesionModalOpen] = useState(false);
  const [editingSesion, setEditingSesion] = useState<Sesion | null>(null);
  const [matriculaOpen, setMatriculaOpen] = useState(false);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoModal, setGrupoModal] = useState<{ editing: Grupo | null } | null>(null);
  const [deleteGrupoModal, setDeleteGrupoModal] = useState<Grupo | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}?locale=${i18n.language}`);
      setPrograma(await res.json());
    } catch (err) {
      onError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadGrupos = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/grupos`);
      setGrupos(await res.json());
    } catch (err) {
      onError(translateError(err));
    }
  };

  useEffect(() => { load(); loadGrupos(); }, [programaId, i18n.language]);

  const reenviarInvitacion = async (usuarioId: string) => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/usuarios/${usuarioId}/enviar-invitacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: i18n.language,
          propositoRedirect: `/programa/${programaId}`,
        }),
      });
      onError(t('admin:programas.toast.invitation_sent'));
    } catch (err) {
      onError(translateError(err));
    }
  };

  const desmatricular = async (participanteId: string) => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/participantes/${participanteId}`, {
        method: 'DELETE',
      });
      onError(t('admin:programas.toast.participant_removed'));
      load();
    } catch (err) {
      onError(translateError(err));
    }
  };

  const deleteSesion = async (sesionId: string) => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/sesiones/${sesionId}`, { method: 'DELETE' });
      onError(t('admin:programas.toast.session_removed'));
      load();
    } catch (err) {
      onError(translateError(err));
    }
  };

  const eliminarGrupo = async (grupoId: string) => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/grupos/${grupoId}`, { method: 'DELETE' });
      onError(t('admin:programas.toast.group_removed'));
      loadGrupos();
    } catch (err) {
      onError(translateError(err));
    }
  };

  const agregarMiembro = async (grupoId: string, usuarioId: string) => {
    if (!usuarioId) return;
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/grupos/${grupoId}/miembros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId }),
      });
      onError(t('admin:programas.toast.member_added'));
      loadGrupos();
    } catch (err) {
      onError(translateError(err));
    }
  };

  const quitarMiembro = async (grupoId: string, usuarioId: string) => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/grupos/${grupoId}/miembros/${usuarioId}`, { method: 'DELETE' });
      onError(t('admin:programas.toast.member_removed'));
      loadGrupos();
    } catch (err) {
      onError(translateError(err));
    }
  };

  // O-01: habilitar/deshabilitar la bitácora para los grupos del programa.
  const toggleBitacora = async () => {
    if (!programa) return;
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/programas/${programa.id}/bitacora/habilitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habilitar: !programa.bitacoraHabilitadaEn }),
      });
      load();
    } catch (err) {
      onError(translateError(err));
    }
  };

  // RN-04: un estudiante en un solo grupo por programa → participantes aún sin grupo.
  const usuariosAsignados = new Set(grupos.flatMap(g => g.miembros.map(m => m.usuarioId)));
  const participantesSinGrupo = (programa?.participantes ?? [])
    .filter(p => p.activo && !usuariosAsignados.has(p.usuarioId));

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 12px',
    borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
    color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
    fontWeight: 500,
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="programa-detail-title"
        style={{ maxWidth: 920, width: '95%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 id="programa-detail-title" style={{ margin: 0 }}>{programa?.nombre ?? '…'}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
              {programa?.empresa?.nombre}
              {programa && programa.facilitadores.length > 0 && ` · ${programa.facilitadores.map(f => f.nombre).join(', ')}`}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1.25rem', color: 'var(--color-text-secondary)', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', marginBottom: 16 }}>
          <button onClick={() => setTab('sesiones')} className="btn-link" style={tabStyle(tab === 'sesiones')}>
            {t('admin:programas.tabs.sesiones')} ({programa?.sesiones.length ?? 0})
          </button>
          <button onClick={() => setTab('participantes')} className="btn-link" style={tabStyle(tab === 'participantes')}>
            {t('admin:programas.tabs.participantes')} ({programa?.participantes.length ?? 0})
          </button>
          <button onClick={() => setTab('grupos')} className="btn-link" style={tabStyle(tab === 'grupos')}>
            {t('admin:programas.tabs.grupos')} ({grupos.length})
          </button>
        </div>

        {loading && <Loading label={t('common:loading')} />}

        {!loading && programa && tab === 'sesiones' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn-primary" onClick={() => { setEditingSesion(null); setSesionModalOpen(true); }}>
                + {t('admin:programas.sesiones.actions.new')}
              </button>
            </div>
            <div className="table-container">
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('admin:programas.sesiones.columns.titulo')}</th>
                    <th>{t('admin:programas.sesiones.columns.fecha')}</th>
                    <th style={{ textAlign: 'center' }}>{t('admin:programas.sesiones.columns.estado')}</th>
                    <th style={{ textAlign: 'right' }}>{t('admin:programas.sesiones.columns.acciones')}</th>
                  </tr>
                </thead>
                <tbody>
                  {programa.sesiones.length === 0 && (
                    <tr><td colSpan={5}><EmptyState title={t('admin:programas.sesiones.empty')} /></td></tr>
                  )}
                  {programa.sesiones.map(s => (
                    <tr key={s.id}>
                      <td>{s.numeroSesion}</td>
                      <td style={{ fontWeight: 500 }}>{s.titulo}</td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {new Date(s.fechaProgramada).toLocaleString(i18n.language)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <StatusBadge variant={s.estado === 'completada' ? 'success' : 'neutral'}>
                          {t(`programa:sesion_estado.${s.estado}`)}
                        </StatusBadge>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-link" onClick={() => { setEditingSesion(s); setSesionModalOpen(true); }}>
                          {t('admin:programas.sesiones.actions.edit')}
                        </button>
                        {' · '}
                        <button className="btn-link btn-link-danger" onClick={() => deleteSesion(s.id)}>
                          {t('admin:programas.sesiones.actions.delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && programa && tab === 'participantes' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn-primary" onClick={() => setMatriculaOpen(true)}>
                + {t('admin:programas.participantes.actions.new')}
              </button>
            </div>
            <div className="table-container">
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>{t('admin:programas.participantes.columns.nombre')}</th>
                    <th>{t('admin:programas.participantes.columns.email')}</th>
                    <th>{t('admin:programas.participantes.columns.cargo')}</th>
                    <th style={{ textAlign: 'right' }}>{t('admin:programas.participantes.columns.acciones')}</th>
                  </tr>
                </thead>
                <tbody>
                  {programa.participantes.length === 0 && (
                    <tr><td colSpan={4}><EmptyState title={t('admin:programas.participantes.empty')} /></td></tr>
                  )}
                  {programa.participantes.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.usuario.nombre}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{p.usuario.email ?? '—'}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                        {p.usuario.cargo ?? <span style={{ color: 'var(--color-border-strong)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {p.usuario.puedeIniciarSesion && (
                          <>
                            <button className="btn-link" onClick={() => reenviarInvitacion(p.usuario.id)}>
                              {t('admin:programas.participantes.actions.resend_invite')}
                            </button>
                            {' · '}
                          </>
                        )}
                        <button className="btn-link btn-link-danger" onClick={() => desmatricular(p.id)}>
                          {t('admin:programas.participantes.actions.remove')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && programa && tab === 'grupos' && (
          <>
            {/* O-01: habilitación de la bitácora para los grupos. */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12, padding: '8px 12px', background: 'var(--color-bg-page)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
              <span style={{ fontSize: '0.82rem' }}>
                {programa.bitacoraHabilitadaEn ? '🟢 ' : '🔒 '}
                {programa.bitacoraHabilitadaEn
                  ? t('admin:programas.bitacora.habilitada')
                  : t('admin:programas.bitacora.no_habilitada')}
              </span>
              <button className="btn-link" onClick={toggleBitacora}>
                {programa.bitacoraHabilitadaEn
                  ? t('admin:programas.bitacora.deshabilitar')
                  : t('admin:programas.bitacora.habilitar')}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                {participantesSinGrupo.length > 0
                  ? `${participantesSinGrupo.length} ${t('admin:programas.tabs.participantes').toLowerCase()} ${t('admin:programas.grupos.no_members').toLowerCase()}`
                  : t('admin:programas.grupos.all_assigned')}
              </span>
              <button className="btn btn-primary" onClick={() => setGrupoModal({ editing: null })}>
                + {t('admin:programas.grupos.actions.new')}
              </button>
            </div>

            {grupos.length === 0 && (
              <EmptyState title={t('admin:programas.grupos.empty')} />
            )}

            <div style={{ display: 'grid', gap: 12 }}>
              {grupos.map(g => (
                <div key={g.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: '0.95rem' }}>{g.nombre}</strong>
                      {g.miembros.length < 2 && (
                        <span title={t('admin:programas.grupos.min_hint')}>
                          <StatusBadge variant="warning">⚠ {t('admin:programas.grupos.incomplete')}</StatusBadge>
                        </span>
                      )}
                    </span>
                    <div>
                      <button className="btn-link" onClick={() => setGrupoModal({ editing: g })}>
                        {t('admin:programas.grupos.actions.rename')}
                      </button>
                      {' · '}
                      <button className="btn-link btn-link-danger" onClick={() => setDeleteGrupoModal(g)}>
                        {t('admin:programas.grupos.actions.delete')}
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
                    {t('admin:programas.grupos.members')} ({g.miembros.length})
                  </div>
                  {g.miembros.length === 0 && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-border-strong)', marginBottom: 8 }}>
                      {t('admin:programas.grupos.no_members')}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {g.miembros.map(m => (
                      <span key={m.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'var(--color-bg-subtle)', borderRadius: 999, padding: '3px 6px 3px 10px', fontSize: '0.82rem',
                      }}>
                        {m.usuario.nombre}
                        <button
                          className="btn-link btn-link-danger"
                          title={t('admin:programas.grupos.remove_member')}
                          style={{ fontSize: '0.9rem', lineHeight: 1 }}
                          onClick={() => quitarMiembro(g.id, m.usuarioId)}
                        >×</button>
                      </span>
                    ))}
                  </div>

                  <select
                    className="input"
                    value=""
                    disabled={participantesSinGrupo.length === 0}
                    onChange={e => agregarMiembro(g.id, e.target.value)}
                    style={{ maxWidth: 320 }}
                  >
                    <option value="">
                      {participantesSinGrupo.length === 0
                        ? t('admin:programas.grupos.all_assigned')
                        : t('admin:programas.grupos.add_member')}
                    </option>
                    {participantesSinGrupo.map(p => (
                      <option key={p.usuarioId} value={p.usuarioId}>
                        {p.usuario.nombre}{p.usuario.email ? ` — ${p.usuario.email}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </>
        )}

        {sesionModalOpen && programa && (
          <SesionFormModal
            programaId={programa.id}
            editing={editingSesion}
            defaultNumero={programa.sesiones.length + 1}
            fechaInicio={programa.fechaInicio}
            fechaFin={programa.fechaFin}
            onClose={() => setSesionModalOpen(false)}
            onSaved={() => { setSesionModalOpen(false); load(); }}
            onError={onError}
          />
        )}

        {grupoModal && programa && (
          <GrupoFormModal
            programaId={programa.id}
            editing={grupoModal.editing}
            onClose={() => setGrupoModal(null)}
            onSaved={() => { setGrupoModal(null); loadGrupos(); }}
            onError={onError}
          />
        )}

        <ConfirmModal
          isOpen={!!deleteGrupoModal}
          title={t('admin:programas.grupos.confirm_delete.title')}
          message={t('admin:programas.grupos.confirm_delete.message', { nombre: deleteGrupoModal?.nombre ?? '' })}
          onConfirm={() => { if (deleteGrupoModal) { eliminarGrupo(deleteGrupoModal.id); setDeleteGrupoModal(null); } }}
          onCancel={() => setDeleteGrupoModal(null)}
        />

        {matriculaOpen && programa && (
          <MatriculaModal
            programaId={programa.id}
            empresaId={programa.empresaId}
            onClose={() => setMatriculaOpen(false)}
            onSaved={() => { load(); }}
            onError={onError}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal para crear/editar sesión
// ─────────────────────────────────────────────────────────────
function SesionFormModal({
  programaId, editing, defaultNumero, fechaInicio, fechaFin, onClose, onSaved, onError,
}: {
  programaId: string;
  editing: Sesion | null;
  defaultNumero: number;
  fechaInicio: string | null;
  fechaFin: string | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [saving, setSaving] = useState(false);
  const [langTab, setLangTab] = useState<'es' | 'pt'>('es');
  const [form, setForm] = useState({
    numeroSesion: editing?.numeroSesion ?? defaultNumero,
    titulo: editing?.titulo ?? '',
    descripcion: editing?.descripcion ?? '',
    fechaProgramada: editing?.fechaProgramada ? editing.fechaProgramada.slice(0, 16) : '',
    urlPresentacion: editing?.urlPresentacion ?? '',
    urlGrabacion: editing?.urlGrabacion ?? '',
    estado: editing?.estado ?? 'pendiente' as const,
    tituloPt: '',
    descripcionPt: '',
  });

  useEffect(() => {
    if (!editing) return;
    (async () => {
      try {
        const res = await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/traducciones/pt`);
        const data = await res.json();
        const sesion = data?.sesiones?.find((s: any) => s.numeroSesion === editing.numeroSesion);
        if (sesion?.campos) {
          setForm(f => ({
            ...f,
            tituloPt: sesion.campos.titulo ?? '',
            descripcionPt: sesion.campos.descripcion ?? '',
          }));
        }
      } catch {
        // Silencioso
      }
    })();
  }, [editing?.id]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
    color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
    fontWeight: 500,
    fontSize: '0.8rem',
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        numeroSesion: form.numeroSesion,
        titulo: form.titulo,
        descripcion: form.descripcion || null,
        fechaProgramada: form.fechaProgramada ? new Date(form.fechaProgramada).toISOString() : null,
        urlPresentacion: form.urlPresentacion || null,
        urlGrabacion: form.urlGrabacion || null,
        estado: form.estado,
      };
      if (editing) {
        await fetchWithErrorMapping(`${API_URL}/admin/sesiones/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/sesiones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      const tituloPt = form.tituloPt.trim();
      const descripcionPt = form.descripcionPt.trim();
      if (tituloPt || descripcionPt) {
        await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/traducciones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locale: 'pt',
            sesiones: [{
              numeroSesion: form.numeroSesion,
              titulo: tituloPt,
              descripcion: descripcionPt,
            }],
          }),
        });
      }

      onSaved();
    } catch (err) {
      onError(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing ? t('admin:programas.sesiones.modal.title_edit') : t('admin:programas.sesiones.modal.title_create')}
      maxWidth={520}
    >
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 4 }}>
            <button type="button" onClick={() => setLangTab('es')} className="btn-link" style={tabStyle(langTab === 'es')}>
              🇪🇸 {t('admin:programas.lang.es')}
            </button>
            <button type="button" onClick={() => setLangTab('pt')} className="btn-link" style={tabStyle(langTab === 'pt')}>
              🇧🇷 {t('admin:programas.lang.pt')}
            </button>
          </div>

          {langTab === 'es' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                <Field label={t('admin:programas.sesiones.fields.numero')} required>
                  <input
                    type="number"
                    className="input"
                    value={form.numeroSesion}
                    min={1}
                    onChange={e => setForm(f => ({ ...f, numeroSesion: Number(e.target.value) }))}
                    required
                  />
                </Field>
                <Field label={t('admin:programas.sesiones.fields.titulo')} required>
                  <input className="input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} required />
                </Field>
              </div>
              <Field label={t('admin:programas.sesiones.fields.descripcion')}>
                <textarea
                  className="input"
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  rows={2}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label={<>{t('admin:programas.sesiones.fields.titulo')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(pt)</span></>}>
                <input
                  className="input"
                  value={form.tituloPt}
                  onChange={e => setForm(f => ({ ...f, tituloPt: e.target.value }))}
                  placeholder={form.titulo}
                />
              </Field>
              <Field label={<>{t('admin:programas.sesiones.fields.descripcion')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(pt)</span></>}>
                <textarea
                  className="input"
                  value={form.descripcionPt}
                  onChange={e => setForm(f => ({ ...f, descripcionPt: e.target.value }))}
                  rows={2}
                  placeholder={form.descripcion || undefined}
                />
              </Field>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: -4 }}>
                {t('admin:programas.lang.hint')}
              </div>
            </>
          )}
          <Field label={t('admin:programas.sesiones.fields.fecha')} required>
            <input
              type="datetime-local"
              className="input"
              value={form.fechaProgramada}
              onChange={e => setForm(f => ({ ...f, fechaProgramada: e.target.value }))}
              min={fechaInicio ? `${fechaInicio.slice(0, 10)}T00:00` : undefined}
              max={fechaFin ? `${fechaFin.slice(0, 10)}T23:59` : undefined}
              required
            />
          </Field>
          <Field label={t('admin:programas.sesiones.fields.url_presentacion')}>
            <input
              className="input"
              type="url"
              value={form.urlPresentacion}
              onChange={e => setForm(f => ({ ...f, urlPresentacion: e.target.value }))}
              placeholder="https://…"
            />
          </Field>
          <Field label={t('admin:programas.sesiones.fields.url_grabacion')}>
            <input
              className="input"
              type="url"
              value={form.urlGrabacion}
              onChange={e => setForm(f => ({ ...f, urlGrabacion: e.target.value }))}
              placeholder="https://…"
            />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>{t('common:cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common:saving') : t('common:save')}
            </button>
          </div>
        </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal de matrícula
// ─────────────────────────────────────────────────────────────
interface EstudianteEmpresa {
  id: string;
  nombre: string;
  email: string | null;
  participaciones: { activo: boolean; programa: { id: string; nombre: string; estado: string; empresaId: string } }[];
}

function MatriculaModal({
  programaId, empresaId, onClose, onSaved, onError,
}: {
  programaId: string;
  empresaId: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [estudiantes, setEstudiantes] = useState<EstudianteEmpresa[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [saving, setSaving] = useState(false);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [form, setForm] = useState({ email: '', nombre: '', cargo: '', area: '', enviarInvitacion: true });

  const cargarEstudiantes = React.useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetchWithErrorMapping(
        `${API_URL}/admin/usuarios?role=estudiante&empresaId=${empresaId}&estado=activo&conProgramas=1`,
      );
      setEstudiantes(await res.json());
    } catch (err) {
      onError(translateError(err));
    } finally {
      setLoadingList(false);
    }
  }, [empresaId, onError]);

  useEffect(() => { cargarEstudiantes(); }, [cargarEstudiantes]);

  // Programas de ESTA empresa donde el estudiante ya participa (activo).
  const programasEmpresa = (est: EstudianteEmpresa) =>
    est.participaciones.filter(p => p.activo && p.programa.empresaId === empresaId);
  const yaEnEste = (est: EstudianteEmpresa) =>
    programasEmpresa(est).some(p => p.programa.id === programaId);

  const term = busqueda.trim().toLowerCase();
  const filtrados = term
    ? estudiantes.filter(e => e.nombre.toLowerCase().includes(term) || (e.email ?? '').toLowerCase().includes(term))
    : estudiantes;

  const anadir = async (usuarioId: string) => {
    setAddingId(usuarioId);
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/participantes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId, enviarInvitacion: false }),
      });
      await cargarEstudiantes(); // refresca badges "ya matriculado"
      onSaved();
    } catch (err) {
      onError(translateError(err));
    } finally {
      setAddingId(null);
    }
  };

  const crearNuevo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/participantes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          nombre: form.nombre,
          cargo: form.cargo || null,
          area: form.area || null,
          enviarInvitacion: form.enviarInvitacion,
          locale: i18n.language,
        }),
      });
      setForm({ email: '', nombre: '', cargo: '', area: '', enviarInvitacion: true });
      setMostrarNuevo(false);
      await cargarEstudiantes();
      onSaved();
    } catch (err) {
      onError(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={t('admin:programas.participantes.modal.title')} maxWidth={560}>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 8 }}>
        {t('admin:programas.participantes.picker.registrados')}
      </div>
      <input
        className="input"
        placeholder={t('admin:programas.participantes.picker.buscar')}
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        style={{ marginBottom: 10 }}
      />

      {loadingList ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          {t('admin:programas.participantes.picker.loading')}
        </div>
      ) : filtrados.length === 0 ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', padding: '8px 0' }}>
          {t('admin:programas.participantes.picker.empty')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
          {filtrados.map(est => {
            const otros = programasEmpresa(est).filter(p => p.programa.id !== programaId);
            const enEste = yaEnEste(est);
            return (
              <div key={est.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{est.nombre}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{est.email}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                    {otros.length === 0
                      ? t('admin:programas.participantes.picker.sin_otros')
                      : <>{t('admin:programas.participantes.picker.otros_programas')} {otros.map(p => p.programa.nombre).join(', ')}</>}
                  </div>
                </div>
                {enEste ? (
                  <StatusBadge variant="success">{t('admin:programas.participantes.picker.ya_matriculado')}</StatusBadge>
                ) : (
                  <button className="btn" disabled={addingId === est.id} onClick={() => anadir(est.id)}>
                    {addingId === est.id ? t('common:actions.saving') : `+ ${t('admin:programas.participantes.picker.anadir')}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 14, paddingTop: 12 }}>
        {!mostrarNuevo ? (
          <button className="btn-link" onClick={() => setMostrarNuevo(true)}>
            {t('admin:programas.participantes.picker.nuevo_toggle')}
          </button>
        ) : (
          <>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 8 }}>
              {t('admin:programas.participantes.picker.nuevo_title')}
            </div>
            <p style={{ marginTop: 0, color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
              {t('admin:programas.participantes.modal.hint')}
            </p>
            <form onSubmit={crearNuevo} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label={t('admin:programas.participantes.fields.email')} required>
                <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </Field>
              <Field label={t('admin:programas.participantes.fields.nombre')} required>
                <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
              </Field>
              <div className="form-grid">
                <Field label={t('admin:programas.participantes.fields.cargo')}>
                  <input className="input" value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
                </Field>
                <Field label={t('admin:programas.participantes.fields.area')}>
                  <input className="input" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} />
                </Field>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.enviarInvitacion} onChange={e => setForm(f => ({ ...f, enviarInvitacion: e.target.checked }))} />
                {t('admin:programas.participantes.fields.enviar_invitacion')}
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setMostrarNuevo(false)} disabled={saving}>{t('common:buttons.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? t('common:actions.saving') : t('common:buttons.save')}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common:buttons.close')}</button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal para crear / renombrar grupo (RF-14, solo danalytics_admin)
// ─────────────────────────────────────────────────────────────
function GrupoFormModal({
  programaId, editing, onClose, onSaved, onError,
}: {
  programaId: string;
  editing: Grupo | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState(editing?.nombre ?? '');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await fetchWithErrorMapping(`${API_URL}/admin/grupos/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre }),
        });
        onError(t('admin:programas.toast.group_updated'));
      } else {
        await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/grupos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre }),
        });
        onError(t('admin:programas.toast.group_created'));
      }
      onSaved();
    } catch (err) {
      onError(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing ? t('admin:programas.grupos.modal.title_edit') : t('admin:programas.grupos.modal.title_create')}
      maxWidth={440}
    >
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label={t('admin:programas.grupos.fields.nombre')} required>
            <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} required autoFocus />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>{t('common:cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !nombre.trim()}>
              {saving ? t('common:saving') : t('common:save')}
            </button>
          </div>
        </form>
    </Modal>
  );
}
