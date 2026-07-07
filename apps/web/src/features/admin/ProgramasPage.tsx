import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type EstadoPrograma = 'borrador' | 'activo' | 'finalizado' | 'cancelado';

const ESTADO_COLORS: Record<EstadoPrograma, { bg: string; fg: string; border: string }> = {
  borrador:   { bg: 'rgba(100,116,139,0.12)', fg: '#475569', border: 'rgba(100,116,139,0.35)' },
  activo:     { bg: 'rgba(34,197,94,0.12)',   fg: '#15803D', border: 'rgba(34,197,94,0.35)' },
  finalizado: { bg: 'rgba(37,99,235,0.12)',   fg: '#1D4ED8', border: 'rgba(37,99,235,0.35)' },
  cancelado:  { bg: 'rgba(239,68,68,0.12)',   fg: '#B91C1C', border: 'rgba(239,68,68,0.35)' },
};

interface EmpresaLite { id: string; nombre: string; }
interface FacilitadorLite { id: string; nombre: string; email: string | null; }

interface Programa {
  id: string;
  nombre: string;
  descripcion: string | null;
  empresaId: string;
  facilitadorId: string;
  estado: EstadoPrograma;
  timezone: string;
  diasGracia: number;
  fechaInicio: string | null;
  fechaFin: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  empresa: { id: string; nombre: string } | null;
  facilitador: { id: string; nombre: string; email: string | null } | null;
  _count: { sesiones: number; participantes: number };
}

interface TraduccionCampos {
  nombre: string;
  descripcion: string;
}

interface FormState {
  nombre: string;
  descripcion: string;
  empresaId: string;
  facilitadorId: string;
  estado: EstadoPrograma;
  timezone: string;
  diasGracia: number;
  fechaInicio: string;
  fechaFin: string;
  traduccionesPt: TraduccionCampos;
}

const emptyForm: FormState = {
  nombre: '',
  descripcion: '',
  empresaId: '',
  facilitadorId: '',
  estado: 'borrador',
  timezone: 'America/Bogota',
  diasGracia: 3,
  fechaInicio: '',
  fechaFin: '',
  traduccionesPt: { nombre: '', descripcion: '' },
};

export function ProgramasPage() {
  const { t, i18n } = useTranslation(['admin', 'common', 'programa']);

  const [programas, setProgramas] = useState<Programa[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaLite[]>([]);
  const [facilitadores, setFacilitadores] = useState<FacilitadorLite[]>([]);
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

  useEffect(() => { loadEmpresas(); loadFacilitadores(); }, []);
  useEffect(() => { load(); }, [filterEmpresa, filterEstado]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = async (p: Programa) => {
    setEditing(p);
    const baseForm: FormState = {
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      empresaId: p.empresaId,
      facilitadorId: p.facilitadorId,
      estado: p.estado,
      timezone: p.timezone,
      diasGracia: p.diasGracia,
      fechaInicio: p.fechaInicio ? p.fechaInicio.slice(0, 10) : '',
      fechaFin: p.fechaFin ? p.fechaFin.slice(0, 10) : '',
      traduccionesPt: { nombre: '', descripcion: '' },
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
        facilitadorId: form.facilitadorId,
        estado: form.estado,
        timezone: form.timezone,
        diasGracia: form.diasGracia,
        fechaInicio: form.fechaInicio || null,
        fechaFin: form.fechaFin || null,
      };
      let programaId: string;
      if (editing) {
        const { empresaId, ...updateBody } = body;
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{t('admin:programas.page_title')}</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            {t('admin:programas.page_subtitle')}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + {t('admin:programas.actions.new')}
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: 16,
        padding: 16,
        background: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: 8,
      }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginBottom: 4 }}>
            {t('admin:programas.filters.empresa')}
          </label>
          <select className="input" value={filterEmpresa} onChange={e => setFilterEmpresa(e.target.value)}>
            <option value="">{t('admin:programas.filters.all')}</option>
            {empresaOptions.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginBottom: 4 }}>
            {t('admin:programas.filters.estado')}
          </label>
          <select className="input" value={filterEstado} onChange={e => setFilterEstado(e.target.value as any)}>
            <option value="">{t('admin:programas.filters.all')}</option>
            <option value="borrador">{t('programa:estado.borrador')}</option>
            <option value="activo">{t('programa:estado.activo')}</option>
            <option value="finalizado">{t('programa:estado.finalizado')}</option>
            <option value="cancelado">{t('programa:estado.cancelado')}</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginBottom: 4 }}>
            {t('admin:programas.filters.search')}
          </label>
          <input
            className="input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') load(); }}
            onBlur={load}
            placeholder={t('admin:programas.filters.search_placeholder')}
          />
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F1F5F9', fontSize: '0.75rem', textTransform: 'uppercase', color: '#475569' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('admin:programas.columns.nombre')}</th>
              <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('admin:programas.columns.empresa')}</th>
              <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('admin:programas.columns.facilitador')}</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>{t('admin:programas.columns.estado')}</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>{t('admin:programas.columns.sesiones')}</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>{t('admin:programas.columns.participantes')}</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>{t('admin:programas.columns.acciones')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>{t('common:loading')}</td></tr>
            )}
            {!loading && programas.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>{t('admin:programas.empty')}</td></tr>
            )}
            {programas.map(p => {
              const c = ESTADO_COLORS[p.estado];
              return (
                <tr key={p.id} style={{ borderTop: '1px solid #E2E8F0', opacity: p.activo ? 1 : 0.5 }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                    <button className="btn-link" onClick={() => setDetailOpen(p)} style={{ padding: 0, textAlign: 'left' }}>
                      {p.nombre}
                    </button>
                    {p.descripcion && <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{p.descripcion.slice(0, 80)}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '0.85rem', color: '#475569' }}>
                    {p.empresa?.nombre ?? <span style={{ color: '#CBD5E1' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '0.85rem', color: '#475569' }}>
                    {p.facilitador?.nombre ?? <span style={{ color: '#CBD5E1' }}>—</span>}
                    {p.facilitador?.email && (
                      <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{p.facilitador.email}</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600,
                      background: c.bg, color: c.fg, border: `1px solid ${c.border}`, borderRadius: 999,
                    }}>
                      {t(`programa:estado.${p.estado}`)}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '0.85rem', color: '#475569' }}>
                    {p._count.sesiones}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '0.85rem', color: '#475569' }}>
                    {p._count.participantes}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn-link" onClick={() => setDetailOpen(p)}>
                      {t('admin:programas.actions.details')}
                    </button>
                    {' · '}
                    <button className="btn-link" onClick={() => openEdit(p)}>
                      {t('admin:programas.actions.edit')}
                    </button>
                    {p.activo && p.estado !== 'cancelado' && (
                      <>
                        {' · '}
                        <button className="btn-link" style={{ color: '#B91C1C' }} onClick={() => setDeleteModal(p)}>
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
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

function ProgramaFormModal({
  form, setForm, editing, empresas, facilitadores, saving, onClose, onSubmit,
}: ProgramaFormModalProps) {
  const { t } = useTranslation(['admin', 'common', 'programa']);
  const [langTab, setLangTab] = useState<'es' | 'pt'>('es');

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    borderBottom: active ? '2px solid #2563EB' : '2px solid transparent',
    color: active ? '#2563EB' : '#64748B',
    fontWeight: 500,
    fontSize: '0.8rem',
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>
            {editing ? t('admin:programas.modal.title_edit') : t('admin:programas.modal.title_create')}
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1.25rem', color: 'var(--color-text-secondary)', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ borderBottom: '1px solid #E2E8F0', display: 'flex', gap: 4 }}>
            <button type="button" onClick={() => setLangTab('es')} className="btn-link" style={tabStyle(langTab === 'es')}>
              🇪🇸 {t('admin:programas.lang.es')}
            </button>
            <button type="button" onClick={() => setLangTab('pt')} className="btn-link" style={tabStyle(langTab === 'pt')}>
              🇧🇷 {t('admin:programas.lang.pt')}
            </button>
          </div>

          {langTab === 'es' ? (
            <>
              <div>
                <label className="required-label" style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                  {t('admin:programas.fields.nombre')}
                </label>
                <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                  {t('admin:programas.fields.descripcion')}
                </label>
                <textarea
                  className="input"
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  rows={3}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                  {t('admin:programas.fields.nombre')} <span style={{ color: '#94A3B8', fontWeight: 400 }}>(pt)</span>
                </label>
                <input
                  className="input"
                  value={form.traduccionesPt.nombre}
                  onChange={e => setForm(f => ({ ...f, traduccionesPt: { ...f.traduccionesPt, nombre: e.target.value } }))}
                  placeholder={form.nombre}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                  {t('admin:programas.fields.descripcion')} <span style={{ color: '#94A3B8', fontWeight: 400 }}>(pt)</span>
                </label>
                <textarea
                  className="input"
                  value={form.traduccionesPt.descripcion}
                  onChange={e => setForm(f => ({ ...f, traduccionesPt: { ...f.traduccionesPt, descripcion: e.target.value } }))}
                  rows={3}
                  placeholder={form.descripcion || undefined}
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: -4 }}>
                {t('admin:programas.lang.hint')}
              </div>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                {t('admin:programas.fields.empresa')}
              </label>
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
            </div>
            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                {t('admin:programas.fields.facilitador')}
              </label>
              <select
                className="input"
                value={form.facilitadorId}
                onChange={e => setForm(f => ({ ...f, facilitadorId: e.target.value }))}
                required
              >
                <option value="">—</option>
                {facilitadores.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                {t('admin:programas.fields.estado')}
              </label>
              <select className="input" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value as EstadoPrograma }))}>
                <option value="borrador">{t('programa:estado.borrador')}</option>
                <option value="activo">{t('programa:estado.activo')}</option>
                <option value="finalizado">{t('programa:estado.finalizado')}</option>
                <option value="cancelado">{t('programa:estado.cancelado')}</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                {t('admin:programas.fields.timezone')}
              </label>
              <input className="input" value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                {t('admin:programas.fields.dias_gracia')}
              </label>
              <input
                type="number"
                className="input"
                value={form.diasGracia}
                min={0}
                max={90}
                onChange={e => setForm(f => ({ ...f, diasGracia: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                {t('admin:programas.fields.fecha_inicio')}
              </label>
              <input type="date" className="input" value={form.fechaInicio} onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                {t('admin:programas.fields.fecha_fin')}
              </label>
              <input type="date" className="input" value={form.fechaFin} onChange={e => setForm(f => ({ ...f, fechaFin: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              {t('common:cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common:saving') : t('common:save')}
            </button>
          </div>
        </form>
      </div>
    </div>
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

interface ProgramaDetail extends Programa {
  sesiones: Sesion[];
  participantes: Participante[];
}

function ProgramaDetailDrawer({
  programaId, onClose, onError,
}: { programaId: string; onClose: () => void; onError: (msg: string) => void }) {
  const { t, i18n } = useTranslation(['admin', 'common', 'programa']);
  const [programa, setPrograma] = useState<ProgramaDetail | null>(null);
  const [tab, setTab] = useState<'sesiones' | 'participantes'>('sesiones');
  const [loading, setLoading] = useState(false);
  const [sesionModalOpen, setSesionModalOpen] = useState(false);
  const [editingSesion, setEditingSesion] = useState<Sesion | null>(null);
  const [matriculaOpen, setMatriculaOpen] = useState(false);

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

  useEffect(() => { load(); }, [programaId, i18n.language]);

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 920, width: '95%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>{programa?.nombre ?? '…'}</h2>
            <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '0.85rem' }}>
              {programa?.empresa?.nombre} · {programa?.facilitador?.nombre}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1.25rem', color: 'var(--color-text-secondary)', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E2E8F0', marginBottom: 16 }}>
          <button
            onClick={() => setTab('sesiones')}
            className="btn-link"
            style={{
              padding: '8px 12px',
              borderBottom: tab === 'sesiones' ? '2px solid #2563EB' : '2px solid transparent',
              color: tab === 'sesiones' ? '#2563EB' : '#64748B',
              fontWeight: 500,
            }}
          >
            {t('admin:programas.tabs.sesiones')} ({programa?.sesiones.length ?? 0})
          </button>
          <button
            onClick={() => setTab('participantes')}
            className="btn-link"
            style={{
              padding: '8px 12px',
              borderBottom: tab === 'participantes' ? '2px solid #2563EB' : '2px solid transparent',
              color: tab === 'participantes' ? '#2563EB' : '#64748B',
              fontWeight: 500,
            }}
          >
            {t('admin:programas.tabs.participantes')} ({programa?.participantes.length ?? 0})
          </button>
        </div>

        {loading && <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>{t('common:loading')}</div>}

        {!loading && programa && tab === 'sesiones' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn-primary" onClick={() => { setEditingSesion(null); setSesionModalOpen(true); }}>
                + {t('admin:programas.sesiones.actions.new')}
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F1F5F9', fontSize: '0.72rem', textTransform: 'uppercase', color: '#475569' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>{t('admin:programas.sesiones.columns.titulo')}</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>{t('admin:programas.sesiones.columns.fecha')}</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>{t('admin:programas.sesiones.columns.estado')}</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>{t('admin:programas.sesiones.columns.acciones')}</th>
                </tr>
              </thead>
              <tbody>
                {programa.sesiones.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#94A3B8' }}>{t('admin:programas.sesiones.empty')}</td></tr>
                )}
                {programa.sesiones.map(s => (
                  <tr key={s.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '8px 12px' }}>{s.numeroSesion}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{s.titulo}</td>
                    <td style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
                      {new Date(s.fechaProgramada).toLocaleString(i18n.language)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.72rem' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999,
                        background: s.estado === 'completada' ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
                        color: s.estado === 'completada' ? '#15803D' : '#475569',
                      }}>
                        {t(`programa:sesion_estado.${s.estado}`)}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <button className="btn-link" onClick={() => { setEditingSesion(s); setSesionModalOpen(true); }}>
                        {t('admin:programas.sesiones.actions.edit')}
                      </button>
                      {' · '}
                      <button className="btn-link" style={{ color: '#B91C1C' }} onClick={() => deleteSesion(s.id)}>
                        {t('admin:programas.sesiones.actions.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {!loading && programa && tab === 'participantes' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn-primary" onClick={() => setMatriculaOpen(true)}>
                + {t('admin:programas.participantes.actions.new')}
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F1F5F9', fontSize: '0.72rem', textTransform: 'uppercase', color: '#475569' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>{t('admin:programas.participantes.columns.nombre')}</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>{t('admin:programas.participantes.columns.email')}</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>{t('admin:programas.participantes.columns.cargo')}</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>{t('admin:programas.participantes.columns.acciones')}</th>
                </tr>
              </thead>
              <tbody>
                {programa.participantes.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#94A3B8' }}>{t('admin:programas.participantes.empty')}</td></tr>
                )}
                {programa.participantes.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{p.usuario.nombre}</td>
                    <td style={{ padding: '8px 12px', fontSize: '0.85rem', color: '#475569' }}>{p.usuario.email ?? '—'}</td>
                    <td style={{ padding: '8px 12px', fontSize: '0.85rem', color: '#475569' }}>
                      {p.usuario.cargo ?? <span style={{ color: '#CBD5E1' }}>—</span>}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      {p.usuario.puedeIniciarSesion && (
                        <>
                          <button className="btn-link" onClick={() => reenviarInvitacion(p.usuario.id)}>
                            {t('admin:programas.participantes.actions.resend_invite')}
                          </button>
                          {' · '}
                        </>
                      )}
                      <button className="btn-link" style={{ color: '#B91C1C' }} onClick={() => desmatricular(p.id)}>
                        {t('admin:programas.participantes.actions.remove')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {sesionModalOpen && programa && (
          <SesionFormModal
            programaId={programa.id}
            editing={editingSesion}
            defaultNumero={programa.sesiones.length + 1}
            onClose={() => setSesionModalOpen(false)}
            onSaved={() => { setSesionModalOpen(false); load(); }}
            onError={onError}
          />
        )}

        {matriculaOpen && programa && (
          <MatriculaModal
            programaId={programa.id}
            onClose={() => setMatriculaOpen(false)}
            onSaved={() => { setMatriculaOpen(false); load(); }}
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
  programaId, editing, defaultNumero, onClose, onSaved, onError,
}: {
  programaId: string;
  editing: Sesion | null;
  defaultNumero: number;
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
    borderBottom: active ? '2px solid #2563EB' : '2px solid transparent',
    color: active ? '#2563EB' : '#64748B',
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>
            {editing ? t('admin:programas.sesiones.modal.title_edit') : t('admin:programas.sesiones.modal.title_create')}
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1.25rem', color: 'var(--color-text-secondary)', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ borderBottom: '1px solid #E2E8F0', display: 'flex', gap: 4 }}>
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
                <div>
                  <label className="required-label" style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                    {t('admin:programas.sesiones.fields.numero')}
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={form.numeroSesion}
                    min={1}
                    onChange={e => setForm(f => ({ ...f, numeroSesion: Number(e.target.value) }))}
                    required
                  />
                </div>
                <div>
                  <label className="required-label" style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                    {t('admin:programas.sesiones.fields.titulo')}
                  </label>
                  <input className="input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                  {t('admin:programas.sesiones.fields.descripcion')}
                </label>
                <textarea
                  className="input"
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  rows={2}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                  {t('admin:programas.sesiones.fields.titulo')} <span style={{ color: '#94A3B8', fontWeight: 400 }}>(pt)</span>
                </label>
                <input
                  className="input"
                  value={form.tituloPt}
                  onChange={e => setForm(f => ({ ...f, tituloPt: e.target.value }))}
                  placeholder={form.titulo}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                  {t('admin:programas.sesiones.fields.descripcion')} <span style={{ color: '#94A3B8', fontWeight: 400 }}>(pt)</span>
                </label>
                <textarea
                  className="input"
                  value={form.descripcionPt}
                  onChange={e => setForm(f => ({ ...f, descripcionPt: e.target.value }))}
                  rows={2}
                  placeholder={form.descripcion || undefined}
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: -4 }}>
                {t('admin:programas.lang.hint')}
              </div>
            </>
          )}
          <div>
            <label className="required-label" style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
              {t('admin:programas.sesiones.fields.fecha')}
            </label>
            <input
              type="datetime-local"
              className="input"
              value={form.fechaProgramada}
              onChange={e => setForm(f => ({ ...f, fechaProgramada: e.target.value }))}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
              {t('admin:programas.sesiones.fields.url_grabacion')}
            </label>
            <input
              className="input"
              type="url"
              value={form.urlGrabacion}
              onChange={e => setForm(f => ({ ...f, urlGrabacion: e.target.value }))}
              placeholder="https://…"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>{t('common:cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common:saving') : t('common:save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal de matrícula
// ─────────────────────────────────────────────────────────────
function MatriculaModal({
  programaId, onClose, onSaved, onError,
}: {
  programaId: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: '',
    nombre: '',
    cargo: '',
    area: '',
    enviarInvitacion: true,
  });

  const submit = async (e: React.FormEvent) => {
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
      onSaved();
    } catch (err) {
      onError(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>{t('admin:programas.participantes.modal.title')}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1.25rem', color: 'var(--color-text-secondary)', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>
        <p style={{ marginTop: 0, color: '#64748B', fontSize: '0.85rem' }}>
          {t('admin:programas.participantes.modal.hint')}
        </p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="required-label" style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
              {t('admin:programas.participantes.fields.email')}
            </label>
            <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label className="required-label" style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
              {t('admin:programas.participantes.fields.nombre')}
            </label>
            <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                {t('admin:programas.participantes.fields.cargo')}
              </label>
              <input className="input" value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                {t('admin:programas.participantes.fields.area')}
              </label>
              <input className="input" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.enviarInvitacion}
              onChange={e => setForm(f => ({ ...f, enviarInvitacion: e.target.checked }))}
            />
            {t('admin:programas.participantes.fields.enviar_invitacion')}
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>{t('common:cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common:saving') : t('common:save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
