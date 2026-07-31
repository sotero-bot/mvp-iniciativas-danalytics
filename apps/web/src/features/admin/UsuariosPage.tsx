import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import {
  Breadcrumb,
  PageHeader,
  Field,
  Modal,
  StatusBadge,
  Loading,
  EmptyState,
  Button,
  DataTable,
  FilterToolbar,
  Pagination,
} from '../../components/ui';
import type { DataTableColumn, StatusVariant } from '../../components/ui';
import { toast } from '../../components/toast-store';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Cierre Fase 4 (Plan 2 §4.2): esta página es EXCLUSIVA de danalytics_admin
// (AdminRoute + @Roles en el backend). El antiguo TODO(fase-2) de "UI por rol"
// quedó resuelto por diseño: el cliente_admin gestiona sus usuario_cliente en
// su propio portal (PortalUsuariosPage → /portal/usuarios) y el facilitador ve
// a sus estudiantes vía grupos/asistencia — ningún rol no-admin entra aquí.

type RoleSlug = string;

interface RoleOption {
  id: string;
  slug: RoleSlug;
  nombre: string;
  descripcion?: string | null;
}

// StatusBadge solo tiene 5 variantes semánticas; con 6 roles, dos comparten
// variante (danalytics_admin / cliente_admin comparten "info": ambos son
// perfiles de administración). El nombre del rol ya los distingue.
const ROLE_BADGE_VARIANT: Record<string, StatusVariant> = {
  danalytics_admin: 'info',
  cliente_admin: 'info',
  facilitador: 'warning',
  estudiante: 'success',
  usuario_cliente: 'neutral',
  participante_legacy: 'neutral',
};

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

  const [filterRole, setFilterRole] = useState<string>('');
  const [filterEmpresa, setFilterEmpresa] = useState<string>('');
  const [filterEstado, setFilterEstado] = useState<'activo' | 'inactivo' | 'todos'>('activo');
  const [filterPrograma, setFilterPrograma] = useState<string>('');
  const [search, setSearch] = useState('');

  // Datatable: ordenamiento y paginación en cliente.
  type SortKey = 'nombre' | 'identificacion' | 'role' | 'empresa' | 'login' | 'estado';
  const [sortKey, setSortKey] = useState<SortKey>('nombre');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [resetPasswordModal, setResetPasswordModal] = useState<Usuario | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleteModal, setDeleteModal] = useState<Usuario | null>(null);
  // C-07: asignación de programas de IA en Acción a un usuario_cliente.
  const [programasModal, setProgramasModal] = useState<Usuario | null>(null);
  const [programasCliente, setProgramasCliente] = useState<{ programas: ProgramaLite[]; asignados: string[] } | null>(null);

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
      setPage(1);
    } catch (err) {
      toast.error(translateError(err));
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

  // C-07: abre el modal de programas de un usuario_cliente y carga su estado.
  const abrirProgramasCliente = async (u: Usuario) => {
    setProgramasModal(u);
    setProgramasCliente(null);
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/usuarios/${u.id}/programas-cliente`);
      setProgramasCliente(await res.json());
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const toggleProgramaCliente = async (usuarioId: string, programaId: string, asignar: boolean) => {
    try {
      if (asignar) {
        const res = await fetchWithErrorMapping(`${API_URL}/admin/usuarios/${usuarioId}/programas-cliente`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ programaId }),
        });
        setProgramasCliente(await res.json());
      } else {
        await fetchWithErrorMapping(`${API_URL}/admin/usuarios/${usuarioId}/programas-cliente/${programaId}`, {
          method: 'DELETE',
        });
        setProgramasCliente(d => (d ? { ...d, asignados: d.asignados.filter(id => id !== programaId) } : d));
      }
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const reenviarInvitacion = async (u: Usuario) => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/usuarios/${u.id}/enviar-invitacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: i18n.language }),
      });
      toast.success(t('admin:usuarios.toast.invitation_sent'));
    } catch (err) {
      toast.error(translateError(err));
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

  const loadRoles = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/roles`);
      setRoles(await res.json());
    } catch (err) {
      toast.error(translateError(err));
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
        toast.success(t('admin:usuarios.toast.updated'));
      } else {
        await fetchWithErrorMapping(`${API_URL}/admin/usuarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.success(t('admin:usuarios.toast.created'));
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(translateError(err));
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
      toast.success(t('admin:usuarios.toast.password_reset'));
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/usuarios/${deleteModal.id}`, { method: 'DELETE' });
      setDeleteModal(null);
      load();
      toast.success(t('admin:usuarios.toast.deactivated'));
    } catch (err) {
      toast.error(translateError(err));
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
      toast.success(t('admin:usuarios.toast.reactivated'));
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const isAdminRole = form.role === 'danalytics_admin';
  const isEmpresaRole = ['estudiante', 'cliente_admin', 'usuario_cliente'].includes(form.role);

  const empresaOptions = useMemo(() => empresas.map(e => ({ id: e.id, nombre: e.nombre })), [empresas]);

  const sortValue = (u: Usuario, key: SortKey): string | number => {
    switch (key) {
      case 'nombre': return (u.nombre ?? '').toLowerCase();
      case 'identificacion': return (u.username || u.email || '').toLowerCase();
      case 'role': return (u.role?.nombre ?? '').toLowerCase();
      case 'empresa': return (u.empresa?.nombre ?? '').toLowerCase();
      case 'login': return u.puedeIniciarSesion ? 1 : 0;
      case 'estado': return u.activo ? 1 : 0;
    }
  };

  const sortedUsuarios = useMemo(() => {
    const arr = [...usuarios];
    arr.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [usuarios, sortKey, sortDir]);

  const total = sortedUsuarios.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => sortedUsuarios.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sortedUsuarios, currentPage, pageSize],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  // Encabezado de columna ordenable: botón inline (accesible por teclado),
  // hereda la tipografía muted/uppercase de `th` vía `color:inherit`/`font:inherit`.
  const sortHeader = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        margin: 0,
        font: 'inherit',
        color: 'inherit',
        textTransform: 'inherit',
        letterSpacing: 'inherit',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}{sortArrow(key)}
    </button>
  );

  const columns: DataTableColumn<Usuario>[] = [
    {
      key: 'nombre',
      header: sortHeader('nombre', t('admin:usuarios.columns.nombre')),
      render: u => (
        <span style={{ opacity: u.activo ? 1 : 0.55 }}>
          <span style={{ fontWeight: 500 }}>{u.nombre}</span>
          {u.cargo && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>{u.cargo}</div>}
        </span>
      ),
    },
    {
      key: 'identificacion',
      header: sortHeader('identificacion', t('admin:usuarios.columns.identificacion')),
      render: u => (
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', opacity: u.activo ? 1 : 0.55 }}>
          {u.username && <div>@{u.username}</div>}
          {u.email && <div>{u.email}</div>}
          {!u.username && !u.email && <span style={{ color: 'var(--color-border-strong)' }}>—</span>}
        </span>
      ),
    },
    {
      key: 'role',
      header: sortHeader('role', t('admin:usuarios.columns.role')),
      render: u => {
        const slug = u.role?.slug ?? 'participante_legacy';
        return (
          <StatusBadge variant={ROLE_BADGE_VARIANT[slug] ?? 'neutral'}>
            {u.role?.nombre ?? t(`admin:usuarios.roles.${slug}`)}
          </StatusBadge>
        );
      },
    },
    {
      key: 'empresa',
      header: sortHeader('empresa', t('admin:usuarios.columns.empresa')),
      render: u => (
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', opacity: u.activo ? 1 : 0.55 }}>
          {u.empresa?.nombre ?? <span style={{ color: 'var(--color-border-strong)' }}>—</span>}
        </span>
      ),
    },
    {
      key: 'login',
      header: sortHeader('login', t('admin:usuarios.columns.login')),
      align: 'center',
      render: u => (
        <span title={u.puedeIniciarSesion ? t('admin:usuarios.login_enabled') : t('admin:usuarios.login_disabled')}>
          {u.puedeIniciarSesion ? '🔓' : '🔒'}
        </span>
      ),
    },
    {
      key: 'estado',
      header: sortHeader('estado', t('admin:usuarios.columns.estado')),
      align: 'center',
      render: u => (
        <StatusBadge variant={u.activo ? 'success' : 'danger'}>
          {u.activo ? t('admin:usuarios.status.active') : t('admin:usuarios.status.inactive')}
        </StatusBadge>
      ),
    },
    {
      key: 'acciones',
      header: t('admin:usuarios.columns.acciones'),
      align: 'right',
      render: u => (
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => openEdit(u)}>
            {t('admin:usuarios.actions.edit')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { setResetPasswordModal(u); setNewPassword(''); }}>
            {t('admin:usuarios.actions.reset_password')}
          </Button>
          {u.role?.slug === 'usuario_cliente' && (
            <Button variant="secondary" size="sm" onClick={() => abrirProgramasCliente(u)}>
              {t('admin:usuarios.actions.programas_cliente')}
            </Button>
          )}
          {u.role?.slug !== 'danalytics_admin' && u.puedeIniciarSesion && u.email && u.activo && (
            <Button variant="secondary" size="sm" onClick={() => reenviarInvitacion(u)}>
              {t('admin:usuarios.actions.resend_invite')}
            </Button>
          )}
          {u.activo ? (
            <Button variant="danger" size="sm" onClick={() => setDeleteModal(u)}>
              {t('admin:usuarios.actions.deactivate')}
            </Button>
          ) : (
            <Button variant="success" size="sm" onClick={() => handleReactivate(u)}>
              {t('admin:usuarios.actions.reactivate')}
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
        title={t('admin:usuarios.deactivate_modal.title')}
        message={t('admin:usuarios.deactivate_modal.message', { nombre: deleteModal?.nombre ?? '' })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(null)}
      />

      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/admin/inicio' },
          { label: t('admin:sidebar.usuarios') },
        ]}
      />

      <PageHeader
        title={t('admin:usuarios.page_title')}
        description={t('admin:usuarios.page_subtitle')}
        actions={
          <Button variant="primary" onClick={openCreate}>
            + {t('admin:usuarios.actions.new')}
          </Button>
        }
      />

      <FilterToolbar>
        <Field label={t('admin:usuarios.filters.role')}>
          <select className="input" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="">{t('admin:usuarios.filters.all')}</option>
            {roles.map(r => <option key={r.id} value={r.slug}>{r.nombre}</option>)}
          </select>
        </Field>
        <Field label={t('admin:usuarios.filters.empresa')}>
          <select className="input" value={filterEmpresa} onChange={e => setFilterEmpresa(e.target.value)}>
            <option value="">{t('admin:usuarios.filters.all')}</option>
            {empresaOptions.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </Field>
        <Field label={t('admin:usuarios.filters.estado')}>
          <select className="input" value={filterEstado} onChange={e => setFilterEstado(e.target.value as any)}>
            <option value="activo">{t('admin:usuarios.filters.estado_activo')}</option>
            <option value="inactivo">{t('admin:usuarios.filters.estado_inactivo')}</option>
            <option value="todos">{t('admin:usuarios.filters.all')}</option>
          </select>
        </Field>
        <Field label={t('admin:usuarios.filters.programa')}>
          <select className="input" value={filterPrograma} onChange={e => setFilterPrograma(e.target.value)}>
            <option value="">{t('admin:usuarios.filters.all')}</option>
            {programas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Field>
        <Field label={t('admin:usuarios.filters.search')}>
          <input
            className="input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={onSearchKey}
            onBlur={load}
            placeholder={t('admin:usuarios.filters.search_placeholder')}
          />
        </Field>
      </FilterToolbar>

      {loading && <Loading label={t('common:loading')} />}
      {!loading && usuarios.length === 0 && (
        <EmptyState title={t('admin:usuarios.empty')} />
      )}
      {!loading && usuarios.length > 0 && (
        <>
          <DataTable columns={columns} rows={pageRows} rowKey={u => u.id} />
          <Pagination
            page={currentPage}
            pageCount={totalPages}
            onPageChange={setPage}
            prevLabel={t('admin:usuarios.table.prev')}
            nextLabel={t('admin:usuarios.table.next')}
            info={
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <span>
                  {t('admin:usuarios.table.showing', {
                    from: (currentPage - 1) * pageSize + 1,
                    to: Math.min(currentPage * pageSize, total),
                    total,
                  })}
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {t('admin:usuarios.table.per_page')}
                  <select
                    className="input"
                    style={{ width: 'auto', padding: '0.25rem 0.5rem' }}
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>
            }
          />
        </>
      )}

      {/* Modal crear/editar */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('admin:usuarios.modal.title_edit') : t('admin:usuarios.modal.title_create')}
        maxWidth={560}
      >
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column' }}>
          <Field label={t('admin:usuarios.fields.nombre')} required>
            <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
          </Field>

          <Field label={t('admin:usuarios.fields.role')} required>
            <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} required>
              {roles.map(r => <option key={r.id} value={r.slug}>{r.nombre}</option>)}
            </select>
          </Field>

          {isAdminRole ? (
            <Field label={t('admin:usuarios.fields.username')} required>
              <input className="input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
            </Field>
          ) : (
            <>
              <Field label={t('admin:usuarios.fields.email')} required>
                <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </Field>
              {isEmpresaRole && (
                <Field label={t('admin:usuarios.fields.empresa')} required>
                  <select className="input" value={form.empresaId} onChange={e => setForm(f => ({ ...f, empresaId: e.target.value }))} required>
                    <option value="">—</option>
                    {empresaOptions.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
                  </select>
                </Field>
              )}
            </>
          )}

          {/* RN: como danalytics_admin se puede poner/cambiar la contraseña de
              CUALQUIER usuario, sin importar el rol — es un método de login
              alternativo al magic link/OAuth, no exclusivo de danalytics_admin. */}
          <Field label={editing ? t('admin:usuarios.fields.password_optional') : t('admin:usuarios.fields.password_optional_create')}>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={editing ? t('admin:usuarios.fields.password_keep') : ''}
            />
          </Field>

          <div className="form-grid">
            <Field label={t('admin:usuarios.fields.cargo')}>
              <input className="input" value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
            </Field>
            <Field label={t('admin:usuarios.fields.area')}>
              <input className="input" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} />
            </Field>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.85rem', cursor: 'pointer', marginBottom: 'var(--space-4)' }}>
            <input
              type="checkbox"
              checked={form.puedeIniciarSesion}
              onChange={e => setForm(f => ({ ...f, puedeIniciarSesion: e.target.checked }))}
            />
            {t('admin:usuarios.fields.puede_iniciar_sesion')}
          </label>

          {editing && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.85rem', cursor: 'pointer', marginBottom: 'var(--space-4)' }}>
              <input
                type="checkbox"
                checked={form.activo}
                onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
              />
              {t('admin:usuarios.fields.activo')}
            </label>
          )}

          <div className="form-footer">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              {t('common:buttons.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? t('common:actions.saving') : t('common:buttons.save')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal reset password */}
      <Modal
        isOpen={!!resetPasswordModal}
        onClose={() => setResetPasswordModal(null)}
        title={t('admin:usuarios.reset_password_modal.title')}
        maxWidth={420}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetPasswordModal(null)}>{t('common:buttons.cancel')}</Button>
            <Button variant="primary" onClick={submitResetPassword} disabled={!newPassword}>
              {t('common:buttons.save')}
            </Button>
          </>
        }
      >
        <p style={{ marginTop: 0, color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
          {resetPasswordModal && t('admin:usuarios.reset_password_modal.message', { nombre: resetPasswordModal.nombre })}
        </p>
        <Field label={t('admin:usuarios.fields.password')}>
          <input
            type="password"
            className="input"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder={t('admin:usuarios.fields.password')}
            autoFocus
          />
        </Field>
      </Modal>

      {/* C-07: modal de programas asignados a un usuario_cliente */}
      <Modal
        isOpen={!!programasModal}
        onClose={() => { setProgramasModal(null); setProgramasCliente(null); }}
        title={t('admin:usuarios.programas_modal.title')}
        maxWidth={520}
      >
        <p style={{ margin: '0 0 var(--space-3)', color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
          {programasModal && t('admin:usuarios.programas_modal.subtitle', { nombre: programasModal.nombre })}
        </p>
        {!programasCliente && <Loading label={t('common:loading')} inline />}
        {programasCliente && programasCliente.programas.length === 0 && (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{t('admin:usuarios.programas_modal.empty')}</p>
        )}
        {programasCliente && programasModal && programasCliente.programas.map(p => (
          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '4px 0', fontSize: '0.88rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={programasCliente.asignados.includes(p.id)}
              onChange={e => toggleProgramaCliente(programasModal.id, p.id, e.target.checked)}
            />
            {p.nombre}
          </label>
        ))}
      </Modal>
    </div>
  );
}
