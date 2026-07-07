import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// TODO(fase-2): distinguir la UI según el role del usuario logueado.
//   - facilitador: sin acciones de gestión, listado limitado a sus estudiantes.
//   - cliente_admin: solo puede crear/revocar usuario_cliente de su empresa.
//   - usuario_cliente: solo lectura, sin botón "Nuevo usuario".
//   Hoy la página asume que el actor es danalytics_admin.

type RoleSlug = string;

interface RoleOption {
  id: string;
  slug: RoleSlug;
  nombre: string;
  descripcion?: string | null;
}

const ROLE_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  danalytics_admin:    { bg: 'rgba(37,99,235,0.12)',  fg: '#1D4ED8', border: 'rgba(37,99,235,0.35)' },
  facilitador:         { bg: 'rgba(217,119,6,0.12)',  fg: '#B45309', border: 'rgba(217,119,6,0.35)' },
  estudiante:          { bg: 'rgba(34,197,94,0.12)',  fg: '#15803D', border: 'rgba(34,197,94,0.35)' },
  cliente_admin:       { bg: 'rgba(168,85,247,0.12)', fg: '#7E22CE', border: 'rgba(168,85,247,0.35)' },
  usuario_cliente:     { bg: 'rgba(139,92,246,0.10)', fg: '#6D28D9', border: 'rgba(139,92,246,0.30)' },
  participante_legacy: { bg: 'rgba(100,116,139,0.12)', fg: '#475569', border: 'rgba(100,116,139,0.35)' },
};
const DEFAULT_ROLE_COLOR = { bg: 'rgba(100,116,139,0.12)', fg: '#475569', border: 'rgba(100,116,139,0.35)' };

interface EmpresaLite {
  id: string;
  nombre: string;
}

interface Usuario {
  id: string;
  nombre: string;
  email: string | null;
  username: string | null;
  roleId: string | null;
  role: { id: string; slug: string; nombre: string } | null;
  puedeIniciarSesion: boolean;
  googleId: string | null;
  googleEmailVerificado: boolean;
  cargo: string | null;
  area: string | null;
  estado: string;
  activo: boolean;
  empresaId: string | null;
  empresa: EmpresaLite | null;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  nombre: string;
  role: string;
  email: string;
  username: string;
  password: string;
  empresaId: string;
  cargo: string;
  area: string;
  puedeIniciarSesion: boolean;
  activo: boolean;
}

const emptyForm: FormState = {
  nombre: '',
  role: 'estudiante',
  email: '',
  username: '',
  password: '',
  empresaId: '',
  cargo: '',
  area: '',
  puedeIniciarSesion: true,
  activo: true,
};

interface ProgramaLite { id: string; nombre: string; }

export function UsuariosPage() {
  const { t, i18n } = useTranslation(['admin', 'common']);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaLite[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [programas, setProgramas] = useState<ProgramaLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [filterRole, setFilterRole] = useState<string>('');
  const [filterEmpresa, setFilterEmpresa] = useState<string>('');
  const [filterEstado, setFilterEstado] = useState<'activo' | 'inactivo' | 'todos'>('activo');
  const [filterPrograma, setFilterPrograma] = useState<string>('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [resetPasswordModal, setResetPasswordModal] = useState<Usuario | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleteModal, setDeleteModal] = useState<Usuario | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterRole) params.set('role', filterRole);
      if (filterEmpresa) params.set('empresaId', filterEmpresa);
      if (filterPrograma) params.set('programaId', filterPrograma);
      params.set('estado', filterEstado);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetchWithErrorMapping(`${API_URL}/admin/usuarios?${params.toString()}`);
      setUsuarios(await res.json());
    } catch (err) {
      showToast(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadProgramas = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/programas?activo=true`);
      const data = await res.json();
      setProgramas(data.map((p: any) => ({ id: p.id, nombre: p.nombre })));
    } catch (err) {
      // Silencioso — la página funciona sin el filtro si el endpoint no responde
    }
  };

  const reenviarInvitacion = async (u: Usuario) => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/usuarios/${u.id}/enviar-invitacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: i18n.language }),
      });
      showToast(t('admin:usuarios.toast.invitation_sent'));
    } catch (err) {
      showToast(translateError(err));
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

  const loadRoles = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/roles`);
      setRoles(await res.json());
    } catch (err) {
      showToast(translateError(err));
    }
  };

  useEffect(() => { loadEmpresas(); loadRoles(); loadProgramas(); }, []);
  useEffect(() => { load(); }, [filterRole, filterEmpresa, filterEstado, filterPrograma]);

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') load();
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (u: Usuario) => {
    setEditing(u);
    setForm({
      nombre: u.nombre,
      role: u.role?.slug ?? 'participante_legacy',
      email: u.email ?? '',
      username: u.username ?? '',
      password: '',
      empresaId: u.empresaId ?? '',
      cargo: u.cargo ?? '',
      area: u.area ?? '',
      puedeIniciarSesion: u.puedeIniciarSesion,
      activo: u.activo,
    });
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isAdmin = form.role === 'danalytics_admin';
      const body: Record<string, unknown> = {
        nombre: form.nombre,
        role: form.role,
        cargo: form.cargo || null,
        area: form.area || null,
        puedeIniciarSesion: form.puedeIniciarSesion,
      };

      if (isAdmin) {
        body.username = form.username;
        body.email = form.email || null;
        body.empresaId = null;
        if (!editing || form.password) body.password = form.password;
      } else {
        body.email = form.email;
        body.username = form.username || null;
        body.empresaId = form.empresaId || null;
      }

      if (editing) {
        body.activo = form.activo;
        await fetchWithErrorMapping(`${API_URL}/admin/usuarios/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        showToast(t('admin:usuarios.toast.updated'));
      } else {
        await fetchWithErrorMapping(`${API_URL}/admin/usuarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        showToast(t('admin:usuarios.toast.created'));
      }
      setModalOpen(false);
      load();
    } catch (err) {
      showToast(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  const submitResetPassword = async () => {
    if (!resetPasswordModal || !newPassword) return;
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/usuarios/${resetPasswordModal.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      setResetPasswordModal(null);
      setNewPassword('');
      showToast(t('admin:usuarios.toast.password_reset'));
    } catch (err) {
      showToast(translateError(err));
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/usuarios/${deleteModal.id}`, { method: 'DELETE' });
      setDeleteModal(null);
      load();
      showToast(t('admin:usuarios.toast.deactivated'));
    } catch (err) {
      showToast(translateError(err));
    }
  };

  const handleReactivate = async (u: Usuario) => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/usuarios/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: true }),
      });
      load();
      showToast(t('admin:usuarios.toast.reactivated'));
    } catch (err) {
      showToast(translateError(err));
    }
  };

  const isAdminRole = form.role === 'danalytics_admin';
  const isEmpresaRole = ['estudiante', 'cliente_admin', 'usuario_cliente'].includes(form.role);

  const empresaOptions = useMemo(() => empresas.map(e => ({ id: e.id, nombre: e.nombre })), [empresas]);

  return (
    <div>
      {toast && <div className="toast">{toast}</div>}

      <ConfirmModal
        isOpen={!!deleteModal}
        title={t('admin:usuarios.deactivate_modal.title')}
        message={t('admin:usuarios.deactivate_modal.message', { nombre: deleteModal?.nombre ?? '' })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(null)}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{t('admin:usuarios.page_title')}</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            {t('admin:usuarios.page_subtitle')}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + {t('admin:usuarios.actions.new')}
        </button>
      </div>

      {/* Filtros */}
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
            {t('admin:usuarios.filters.role')}
          </label>
          <select className="input" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="">{t('admin:usuarios.filters.all')}</option>
            {roles.map(r => <option key={r.id} value={r.slug}>{r.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginBottom: 4 }}>
            {t('admin:usuarios.filters.empresa')}
          </label>
          <select className="input" value={filterEmpresa} onChange={e => setFilterEmpresa(e.target.value)}>
            <option value="">{t('admin:usuarios.filters.all')}</option>
            {empresaOptions.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginBottom: 4 }}>
            {t('admin:usuarios.filters.estado')}
          </label>
          <select className="input" value={filterEstado} onChange={e => setFilterEstado(e.target.value as any)}>
            <option value="activo">{t('admin:usuarios.filters.estado_activo')}</option>
            <option value="inactivo">{t('admin:usuarios.filters.estado_inactivo')}</option>
            <option value="todos">{t('admin:usuarios.filters.all')}</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginBottom: 4 }}>
            {t('admin:usuarios.filters.programa')}
          </label>
          <select className="input" value={filterPrograma} onChange={e => setFilterPrograma(e.target.value)}>
            <option value="">{t('admin:usuarios.filters.all')}</option>
            {programas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginBottom: 4 }}>
            {t('admin:usuarios.filters.search')}
          </label>
          <input
            className="input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={onSearchKey}
            onBlur={load}
            placeholder={t('admin:usuarios.filters.search_placeholder')}
          />
        </div>
      </div>

      {/* Tabla */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F1F5F9', fontSize: '0.75rem', textTransform: 'uppercase', color: '#475569' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('admin:usuarios.columns.nombre')}</th>
              <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('admin:usuarios.columns.identificacion')}</th>
              <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('admin:usuarios.columns.role')}</th>
              <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('admin:usuarios.columns.empresa')}</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>{t('admin:usuarios.columns.login')}</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>{t('admin:usuarios.columns.estado')}</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>{t('admin:usuarios.columns.acciones')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>{t('common:loading')}</td></tr>
            )}
            {!loading && usuarios.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>{t('admin:usuarios.empty')}</td></tr>
            )}
            {usuarios.map(u => {
              const slug = u.role?.slug ?? 'participante_legacy';
              const c = ROLE_COLORS[slug] ?? DEFAULT_ROLE_COLOR;
              return (
                <tr key={u.id} style={{ borderTop: '1px solid #E2E8F0', opacity: u.activo ? 1 : 0.55 }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                    {u.nombre}
                    {u.cargo && <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{u.cargo}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '0.85rem', color: '#475569' }}>
                    {u.username && <div>@{u.username}</div>}
                    {u.email && <div>{u.email}</div>}
                    {!u.username && !u.email && <span style={{ color: '#CBD5E1' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600,
                      background: c.bg, color: c.fg, border: `1px solid ${c.border}`, borderRadius: 999,
                    }}>
                      {u.role?.nombre ?? t(`admin:usuarios.roles.${slug}`)}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '0.85rem', color: '#475569' }}>
                    {u.empresa?.nombre ?? <span style={{ color: '#CBD5E1' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <span title={u.puedeIniciarSesion ? t('admin:usuarios.login_enabled') : t('admin:usuarios.login_disabled')}>
                      {u.puedeIniciarSesion ? '🔓' : '🔒'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '0.75rem' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 999,
                      background: u.activo ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                      color: u.activo ? '#15803D' : '#B91C1C',
                    }}>
                      {u.activo ? t('admin:usuarios.status.active') : t('admin:usuarios.status.inactive')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn-link" onClick={() => openEdit(u)}>{t('admin:usuarios.actions.edit')}</button>
                    {u.role?.slug === 'danalytics_admin' && (
                      <>
                        {' · '}
                        <button className="btn-link" onClick={() => { setResetPasswordModal(u); setNewPassword(''); }}>
                          {t('admin:usuarios.actions.reset_password')}
                        </button>
                      </>
                    )}
                    {u.role?.slug !== 'danalytics_admin' && u.puedeIniciarSesion && u.email && u.activo && (
                      <>
                        {' · '}
                        <button className="btn-link" onClick={() => reenviarInvitacion(u)}>
                          {t('admin:usuarios.actions.resend_invite')}
                        </button>
                      </>
                    )}
                    {u.activo ? (
                      <>
                        {' · '}
                        <button className="btn-link" style={{ color: '#B91C1C' }} onClick={() => setDeleteModal(u)}>
                          {t('admin:usuarios.actions.deactivate')}
                        </button>
                      </>
                    ) : (
                      <>
                        {' · '}
                        <button className="btn-link" style={{ color: '#15803D' }} onClick={() => handleReactivate(u)}>
                          {t('admin:usuarios.actions.reactivate')}
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

      {/* Modal crear/editar */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>
                {editing ? t('admin:usuarios.modal.title_edit') : t('admin:usuarios.modal.title_create')}
              </h3>
              <button onClick={() => setModalOpen(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '1.25rem', color: 'var(--color-text-secondary)', lineHeight: 1, padding: 4,
              }}>×</button>
            </div>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="required-label" style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                  {t('admin:usuarios.fields.nombre')}
                </label>
                <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
              </div>

              <div>
                <label className="required-label" style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                  {t('admin:usuarios.fields.role')}
                </label>
                <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} required>
                  {roles.map(r => <option key={r.id} value={r.slug}>{r.nombre}</option>)}
                </select>
              </div>

              {isAdminRole ? (
                <>
                  <div>
                    <label className="required-label" style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                      {t('admin:usuarios.fields.username')}
                    </label>
                    <input className="input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                      {editing ? t('admin:usuarios.fields.password_optional') : t('admin:usuarios.fields.password')}
                    </label>
                    <input
                      type="password"
                      className="input"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      required={!editing}
                      placeholder={editing ? t('admin:usuarios.fields.password_keep') : ''}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="required-label" style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                      {t('admin:usuarios.fields.email')}
                    </label>
                    <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                  </div>
                  {isEmpresaRole && (
                    <div>
                      <label className="required-label" style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                        {t('admin:usuarios.fields.empresa')}
                      </label>
                      <select className="input" value={form.empresaId} onChange={e => setForm(f => ({ ...f, empresaId: e.target.value }))} required>
                        <option value="">—</option>
                        {empresaOptions.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                    {t('admin:usuarios.fields.cargo')}
                  </label>
                  <input className="input" value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.85rem' }}>
                    {t('admin:usuarios.fields.area')}
                  </label>
                  <input className="input" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.puedeIniciarSesion}
                  onChange={e => setForm(f => ({ ...f, puedeIniciarSesion: e.target.checked }))}
                />
                {t('admin:usuarios.fields.puede_iniciar_sesion')}
              </label>

              {editing && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
                  />
                  {t('admin:usuarios.fields.activo')}
                </label>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                  {t('common:cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? t('common:saving') : t('common:save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal reset password */}
      {resetPasswordModal && (
        <div className="modal-overlay" onClick={() => setResetPasswordModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>{t('admin:usuarios.reset_password_modal.title')}</h3>
              <button onClick={() => setResetPasswordModal(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '1.25rem', color: 'var(--color-text-secondary)', lineHeight: 1, padding: 4,
              }}>×</button>
            </div>
            <p style={{ marginTop: 0, color: '#64748B', fontSize: '0.9rem' }}>
              {t('admin:usuarios.reset_password_modal.message', { nombre: resetPasswordModal.nombre })}
            </p>
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder={t('admin:usuarios.fields.password')}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setResetPasswordModal(null)}>{t('common:cancel')}</button>
              <button className="btn btn-primary" onClick={submitResetPassword} disabled={!newPassword}>
                {t('common:save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
