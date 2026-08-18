import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { StatusBadge, Loading, EmptyState } from '../../components/ui';
import { toast } from '../../components/toast-store';
import type { Programa, Sesion, Grupo } from './programas.types';
import { SesionFormModal } from './SesionFormModal';
import { GrupoFormModal } from './GrupoFormModal';
import { MatriculaModal } from './MatriculaModal';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// ─────────────────────────────────────────────────────────────
// Drawer de detalle (Sesiones + Participantes)
// ─────────────────────────────────────────────────────────────
interface Participante {
  id: string;
  programaId: string;
  usuarioId: string;
  activo: boolean;
  confirmadoEn: string | null;
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

export function ProgramaDetailDrawer({
  programaId, onClose,
}: { programaId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation(['admin', 'common', 'programa']);
  const [programa, setPrograma] = useState<ProgramaDetail | null>(null);
  const [tab, setTab] = useState<'sesiones' | 'participantes' | 'grupos'>('sesiones');
  const [loading, setLoading] = useState(false);
  const [sesionModalOpen, setSesionModalOpen] = useState(false);
  const [editingSesion, setEditingSesion] = useState<Sesion | null>(null);
  const [matriculaModo, setMatriculaModo] = useState<'individual' | 'masiva' | null>(null);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoModal, setGrupoModal] = useState<{ editing: Grupo | null } | null>(null);
  const [deleteGrupoModal, setDeleteGrupoModal] = useState<Grupo | null>(null);
  const [deleteSesionModal, setDeleteSesionModal] = useState<Sesion | null>(null);
  const [desmatricularModal, setDesmatricularModal] = useState<Participante | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}?locale=${i18n.language}`);
      setPrograma(await res.json());
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadGrupos = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/grupos`);
      setGrupos(await res.json());
    } catch (err) {
      toast.error(translateError(err));
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
      toast.success(t('admin:programas.toast.invitation_sent'));
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const desmatricular = async (participanteId: string) => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/participantes/${participanteId}`, {
        method: 'DELETE',
      });
      toast.success(t('admin:programas.toast.participant_removed'));
      load();
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const deleteSesion = async (sesionId: string) => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/sesiones/${sesionId}`, { method: 'DELETE' });
      toast.success(t('admin:programas.toast.session_removed'));
      load();
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const eliminarGrupo = async (grupoId: string) => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/grupos/${grupoId}`, { method: 'DELETE' });
      toast.success(t('admin:programas.toast.group_removed'));
      loadGrupos();
    } catch (err) {
      toast.error(translateError(err));
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
      toast.success(t('admin:programas.toast.member_added'));
      loadGrupos();
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const quitarMiembro = async (grupoId: string, usuarioId: string) => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/grupos/${grupoId}/miembros/${usuarioId}`, { method: 'DELETE' });
      toast.success(t('admin:programas.toast.member_removed'));
      loadGrupos();
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  // O-01: habilitar/deshabilitar la bitácora para los grupos del programa.
  const toggleBitacora = async () => {
    if (!programa) return;
    const habilitar = !programa.bitacoraHabilitadaEn;
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/programas/${programa.id}/bitacora/habilitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habilitar }),
      });
      toast.success(t(habilitar ? 'admin:programas.bitacora.habilitada' : 'admin:programas.bitacora.no_habilitada'));
      load();
    } catch (err) {
      toast.error(translateError(err));
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

        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
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
            {/* RF-01: resumen de sesiones registradas frente a las esperadas. */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                {programa.totalSesionesEsperadas != null ? (
                  <>
                    <strong>{programa.sesiones.length}</strong> / {programa.totalSesionesEsperadas}{' '}
                    {t('admin:programas.sesiones.registradas')}
                    {programa.sesiones.length < programa.totalSesionesEsperadas && (
                      <> · {t('admin:programas.sesiones.faltan', { n: programa.totalSesionesEsperadas - programa.sesiones.length })}</>
                    )}
                    {programa.presentacionDesdeSesion != null && (
                      <> · {t('admin:programas.sesiones.presentacion_desde', { n: programa.presentacionDesdeSesion })}</>
                    )}
                  </>
                ) : (
                  <>
                    <strong>{programa.sesiones.length}</strong> {t('admin:programas.sesiones.registradas_sin_total')}
                  </>
                )}
              </div>
              <button
                className="btn btn-primary"
                disabled={
                  programa.totalSesionesEsperadas != null &&
                  programa.sesiones.length >= programa.totalSesionesEsperadas
                }
                title={
                  programa.totalSesionesEsperadas != null &&
                  programa.sesiones.length >= programa.totalSesionesEsperadas
                    ? t('admin:programas.sesiones.total_alcanzado')
                    : undefined
                }
                onClick={() => { setEditingSesion(null); setSesionModalOpen(true); }}
              >
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
                        {s.estado === 'completada' && !s.urlGrabacion && (
                          <div style={{ marginTop: 4 }}>
                            <StatusBadge variant="warning">
                              {t('admin:programas.sesiones.sin_grabacion')}
                            </StatusBadge>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setEditingSesion(s); setSesionModalOpen(true); }}>
                            {t('admin:programas.sesiones.actions.edit')}
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleteSesionModal(s)}>
                            {t('admin:programas.sesiones.actions.delete')}
                          </button>
                        </div>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
              <button className="btn btn-secondary" onClick={() => setMatriculaModo('masiva')}>
                {t('admin:programas.participantes.actions.new_masiva')}
              </button>
              <button className="btn btn-primary" onClick={() => setMatriculaModo('individual')}>
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
                    <th style={{ textAlign: 'center' }}>{t('admin:programas.participantes.columns.confirmacion')}</th>
                    <th style={{ textAlign: 'right' }}>{t('admin:programas.participantes.columns.acciones')}</th>
                  </tr>
                </thead>
                <tbody>
                  {programa.participantes.length === 0 && (
                    <tr><td colSpan={5}><EmptyState title={t('admin:programas.participantes.empty')} /></td></tr>
                  )}
                  {programa.participantes.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.usuario.nombre}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{p.usuario.email ?? '—'}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                        {p.usuario.cargo ?? <span style={{ color: 'var(--color-border-strong)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <StatusBadge variant={p.confirmadoEn ? 'success' : 'warning'}>
                          {p.confirmadoEn
                            ? t('admin:programas.participantes.registro.confirmado')
                            : t('admin:programas.participantes.registro.pendiente')}
                        </StatusBadge>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                          {p.usuario.puedeIniciarSesion && (
                            <button className="btn btn-secondary btn-sm" onClick={() => reenviarInvitacion(p.usuario.id)}>
                              {t('admin:programas.participantes.actions.resend_invite')}
                            </button>
                          )}
                          <button className="btn btn-danger btn-sm" onClick={() => setDesmatricularModal(p)}>
                            {t('admin:programas.participantes.actions.remove')}
                          </button>
                        </div>
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
              <button
                className={`btn btn-sm ${programa.bitacoraHabilitadaEn ? 'btn-danger' : 'btn-success'}`}
                onClick={toggleBitacora}
              >
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
          />
        )}

        {grupoModal && programa && (
          <GrupoFormModal
            programaId={programa.id}
            editing={grupoModal.editing}
            onClose={() => setGrupoModal(null)}
            onSaved={() => { setGrupoModal(null); loadGrupos(); }}
          />
        )}

        <ConfirmModal
          isOpen={!!deleteGrupoModal}
          title={t('admin:programas.grupos.confirm_delete.title')}
          message={t('admin:programas.grupos.confirm_delete.message', { nombre: deleteGrupoModal?.nombre ?? '' })}
          onConfirm={() => { if (deleteGrupoModal) { eliminarGrupo(deleteGrupoModal.id); setDeleteGrupoModal(null); } }}
          onCancel={() => setDeleteGrupoModal(null)}
        />

        <ConfirmModal
          isOpen={!!deleteSesionModal}
          title={t('admin:programas.sesiones.confirm_delete.title')}
          message={t('admin:programas.sesiones.confirm_delete.message', { titulo: deleteSesionModal?.titulo ?? '' })}
          onConfirm={() => { if (deleteSesionModal) { deleteSesion(deleteSesionModal.id); setDeleteSesionModal(null); } }}
          onCancel={() => setDeleteSesionModal(null)}
        />

        <ConfirmModal
          isOpen={!!desmatricularModal}
          title={t('admin:programas.participantes.confirm_delete.title')}
          message={t('admin:programas.participantes.confirm_delete.message', { nombre: desmatricularModal?.usuario.nombre ?? '' })}
          confirmLabel={t('admin:programas.participantes.actions.remove')}
          onConfirm={() => { if (desmatricularModal) { desmatricular(desmatricularModal.id); setDesmatricularModal(null); } }}
          onCancel={() => setDesmatricularModal(null)}
        />

        {matriculaModo && programa && (
          <MatriculaModal
            modo={matriculaModo}
            programaId={programa.id}
            empresaId={programa.empresaId}
            onClose={() => setMatriculaModo(null)}
            onSaved={() => { load(); }}
          />
        )}
      </div>
    </div>
  );
}
