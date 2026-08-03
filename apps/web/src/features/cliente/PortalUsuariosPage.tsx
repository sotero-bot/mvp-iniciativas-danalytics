import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Breadcrumb, PageHeader, Button, Field, FormListLayout, Loading, EmptyState, StatusBadge } from '../../components/ui';
import { ConfirmModal } from '../../components/ConfirmModal';
import { toast } from '../../components/toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface MiembroPortal {
  id: string;
  activo: boolean;
  invitadoEn: string;
  invitadoPor: { id: string; nombre: string } | null;
  usuario: {
    id: string;
    nombre: string;
    email: string | null;
    activo: boolean;
    puedeIniciarSesion: boolean;
    role: { slug: string; nombre: string } | null;
  };
  invitacionEnviada?: boolean;
}

interface ProgramasAsignables {
  programas: { id: string; nombre: string; estado: string }[];
  asignados: string[];
}

// RF-44/RF-45: SOLO el cliente_admin gestiona los usuario_cliente de su empresa.
// La ruta ya está protegida (PortalRoute allow=cliente_admin); el backend
// re-valida con @Roles('cliente_admin') + empresaId del JWT (RN-09).
export function PortalUsuariosPage() {
  const { t, i18n } = useTranslation(['portal', 'common', 'admin']);
  const [miembros, setMiembros] = useState<MiembroPortal[]>([]);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false); // guard StrictMode/doble click (patrón del proyecto)
  // C-07: gestión de programas asignados por usuario_cliente (panel expandible).
  const [programasOpen, setProgramasOpen] = useState<string | null>(null);
  const [programasData, setProgramasData] = useState<ProgramasAsignables | null>(null);
  // Confirmación de revocación (sustituye window.confirm por el modal accesible).
  const [revocarTarget, setRevocarTarget] = useState<MiembroPortal | null>(null);

  const cargar = () => {
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/portal/usuarios-cliente`)
      .then(res => res.json())
      .then(data => setMiembros(data))
      .catch(err => toast.error(translateError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const invitar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/portal/usuarios-cliente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, locale: i18n.language?.startsWith('pt') ? 'pt' : 'es' }),
      });
      const creado = (await res.json()) as MiembroPortal;
      setNombre('');
      setEmail('');
      if (creado.invitacionEnviada === false) toast.error(t('portal:usuarios.invitacion_no_enviada'));
      else toast.success(t('portal:usuarios.invitado_ok'));
      cargar();
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  // C-07: abre/cierra el panel de programas de un usuario_cliente y carga su estado.
  const toggleProgramas = async (usuarioId: string) => {
    if (programasOpen === usuarioId) {
      setProgramasOpen(null);
      setProgramasData(null);
      return;
    }
    setProgramasOpen(usuarioId);
    setProgramasData(null);
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/portal/usuarios-cliente/${usuarioId}/programas`);
      setProgramasData(await res.json());
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const toggleAsignacion = async (usuarioId: string, programaId: string, asignar: boolean) => {
    try {
      if (asignar) {
        const res = await fetchWithErrorMapping(`${API_URL}/portal/usuarios-cliente/${usuarioId}/programas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ programaId }),
        });
        setProgramasData(await res.json());
      } else {
        await fetchWithErrorMapping(`${API_URL}/portal/usuarios-cliente/${usuarioId}/programas/${programaId}`, {
          method: 'DELETE',
        });
        setProgramasData(d => (d ? { ...d, asignados: d.asignados.filter(id => id !== programaId) } : d));
      }
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const confirmarRevocar = async () => {
    const m = revocarTarget;
    if (!m) return;
    setRevocarTarget(null);
    try {
      await fetchWithErrorMapping(`${API_URL}/portal/usuarios-cliente/${m.id}`, { method: 'DELETE' });
      toast.success(t('portal:usuarios.revocado_ok'));
      cargar();
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  return (
    <div>
      {/* Vista de nivel superior del portal cliente: no depende de una entidad
          seleccionada (el alcance es la propia empresa del actor, implícito en
          el JWT), por eso el breadcrumb tiene un único segmento — la vista
          actual — sin padre navegable que la anteceda. */}
      <Breadcrumb items={[{ label: t('admin:sidebar.home'), to: '/inicio' }, { label: t('portal:usuarios.title') }]} />
      <PageHeader title={t('portal:usuarios.title')} description={t('portal:usuarios.subtitle')} />

      <FormListLayout
        form={
          <form onSubmit={invitar} className="card" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <Field label={t('portal:usuarios.nombre')} required>
              <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} required />
            </Field>
            <Field label={t('portal:usuarios.email')} required>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </Field>
            <div className="form-footer">
              <Button type="submit" variant="primary" disabled={enviando}>
                {enviando ? t('common:loading') : t('portal:usuarios.invitar')}
              </Button>
            </div>
          </form>
        }
        list={
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">{t('portal:usuarios.title')}</span>
              <span className="count-badge">{miembros.length}</span>
            </div>
            {loading && <Loading label={t('common:loading')} />}
            {!loading && miembros.length === 0 && (
              <EmptyState title={t('portal:usuarios.empty')} />
            )}
            {!loading && miembros.length > 0 && (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>{t('portal:usuarios.nombre')}</th>
                      <th>{t('portal:usuarios.email')}</th>
                      <th>{t('portal:usuarios.estado')}</th>
                      <th>{t('portal:usuarios.invitado')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {miembros.map(m => (
                      <React.Fragment key={m.id}>
                        <tr style={{ opacity: m.activo ? 1 : 0.55 }}>
                          <td style={{ fontWeight: 600 }}>{m.usuario.nombre}</td>
                          <td>{m.usuario.email ?? '—'}</td>
                          <td>
                            <StatusBadge variant={m.activo ? 'success' : 'neutral'}>
                              {m.activo ? t('portal:usuarios.activo') : t('portal:usuarios.revocado')}
                            </StatusBadge>
                          </td>
                          <td style={{ color: 'var(--color-text-secondary)' }}>
                            {new Date(m.invitadoEn).toLocaleDateString()}{m.invitadoPor ? ` · ${m.invitadoPor.nombre}` : ''}
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {m.activo && m.usuario.role?.slug === 'usuario_cliente' && (
                              <>
                                <Button variant="link" onClick={() => toggleProgramas(m.usuario.id)}>
                                  {t('portal:usuarios.programas')}
                                </Button>
                                {' · '}
                                <Button variant="link" className="btn-link-danger" onClick={() => setRevocarTarget(m)}>
                                  {t('portal:usuarios.revocar')}
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                        {programasOpen === m.usuario.id && (
                          <tr>
                            <td colSpan={5} style={{ background: 'var(--color-bg-subtle)' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 'var(--space-1)' }}>
                                {t('portal:usuarios.programas_asignados')}
                              </div>
                              {!programasData && <Loading label={t('common:loading')} inline />}
                              {programasData && programasData.programas.length === 0 && (
                                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{t('portal:usuarios.sin_programas')}</p>
                              )}
                              {programasData && programasData.programas.map(pr => (
                                <label key={pr.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '3px 0', fontSize: '0.82rem', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={programasData.asignados.includes(pr.id)}
                                    onChange={e => toggleAsignacion(m.usuario.id, pr.id, e.target.checked)}
                                  />
                                  {pr.nombre}
                                </label>
                              ))}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        }
      />

      <ConfirmModal
        isOpen={!!revocarTarget}
        title={t('portal:usuarios.revocar')}
        message={revocarTarget ? t('portal:usuarios.confirmar_revocar', { nombre: revocarTarget.usuario.nombre }) : ''}
        confirmLabel={t('portal:usuarios.revocar')}
        onConfirm={confirmarRevocar}
        onCancel={() => setRevocarTarget(null)}
      />
    </div>
  );
}
