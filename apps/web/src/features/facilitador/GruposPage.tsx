import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import {
  Breadcrumb,
  PageHeader,
  Field,
  Button,
  FormListLayout,
  Loading,
  EmptyState,
  Alert,
  StatusBadge,
} from '../../components/ui';
import { toast } from '../../components/toast-store';
import { ConfirmModal } from '../../components/ConfirmModal';
import { MoverMiembroModal } from '../../components/MoverMiembroModal';
import { ReemplazarMiembroModal } from '../../components/ReemplazarMiembroModal';
import { GrupoFormModal } from '../admin/GrupoFormModal';
import { estadoRevision, ordenarPorRevision, contarListos } from './revisionGrupos';
import type { FaltanteEntrega } from './revisionGrupos';
import { GrupoEntregaProgreso } from '../../components/GrupoEntregaProgreso';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Grupo {
  id: string;
  programaId: string;
  nombre: string;
  orden: number;
  finalizadoEn: string | null;
  finalizadoPor: { id: string; nombre: string } | null;
  entregaCompleta: boolean;
  faltante?: FaltanteEntrega;
  miembros: { id: string; usuarioId: string; usuario: { id: string; nombre: string; email: string } }[];
}

interface Participante {
  usuarioId: string;
  usuario: { id: string; nombre: string; email: string };
}

// RF-15 + C-02: el facilitador ve los grupos y puede crear grupos y asignar integrantes.
// HU-21/22: además renombra grupos y quita/reemplaza integrantes (eliminar sigue siendo del admin).
export function FacilitadorGruposPage() {
  const { id: programaId = '' } = useParams();
  const { t } = useTranslation(['facilitador', 'common', 'admin', 'errors']);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [loading, setLoading] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [creando, setCreando] = useState(false);
  // Nombre del programa para el breadcrumb/eyebrow (dónde está el usuario).
  const [programaNombre, setProgramaNombre] = useState('');
  // RF-03/RN-03: gracia vencida → el facilitador solo consulta, sin acciones de escritura.
  const [soloLectura, setSoloLectura] = useState(false);
  const [renombrando, setRenombrando] = useState<Grupo | null>(null);
  const [quitando, setQuitando] = useState<{ grupo: Grupo; miembro: Grupo['miembros'][number] } | null>(null);
  const [moviendo, setMoviendo] = useState<{ grupo: Grupo; miembro: Grupo['miembros'][number] } | null>(null);
  const [reemplazando, setReemplazando] = useState<{ grupo: Grupo; miembro: Grupo['miembros'][number] } | null>(null);

  const cargar = () => {
    setLoading(true);
    Promise.all([
      fetchWithErrorMapping(`${API_URL}/facilitador/programas/${programaId}/grupos`).then((r) => r.json()),
      fetchWithErrorMapping(`${API_URL}/facilitador/programas/${programaId}/participantes`).then((r) => r.json()),
    ])
      .then(([g, p]) => { setGrupos(g); setParticipantes(p); })
      .catch((err) => toast.error(translateError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, [programaId]);

  useEffect(() => {
    fetchWithErrorMapping(`${API_URL}/programas`)
      .then((res) => res.json())
      .then((data: { id: string; nombre: string; soloLectura?: boolean }[]) => {
        const p = data.find((x) => x.id === programaId);
        if (p) {
          setProgramaNombre(p.nombre);
          setSoloLectura(!!p.soloLectura);
        }
      })
      .catch(() => {});
  }, [programaId]);

  const crearGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;
    setCreando(true);
    try {
      await fetchWithErrorMapping(`${API_URL}/facilitador/programas/${programaId}/grupos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevoNombre.trim() }),
      });
      setNuevoNombre('');
      toast.success(t('facilitador:grupos.creado'));
      cargar();
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setCreando(false);
    }
  };

  const asignar = async (grupoId: string, usuarioId: string) => {
    if (!usuarioId) return;
    try {
      await fetchWithErrorMapping(`${API_URL}/facilitador/grupos/${grupoId}/miembros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId }),
      });
      toast.success(t('facilitador:grupos.integrante_agregado'));
      cargar();
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const quitar = async (grupoId: string, usuarioId: string) => {
    try {
      await fetchWithErrorMapping(`${API_URL}/facilitador/grupos/${grupoId}/miembros/${usuarioId}`, { method: 'DELETE' });
      toast.success(t('facilitador:grupos.integrante_quitado'));
      cargar();
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  // HU-23: revisión más fácil — listos para revisar primero, finalizados al final.
  const gruposOrdenados = ordenarPorRevision(grupos);
  const gruposListos = contarListos(grupos);

  // RN-04: participantes que aún no están en ningún grupo (candidatos a asignar).
  const asignados = new Set(grupos.flatMap((g) => g.miembros.map((m) => m.usuarioId)));
  const sinGrupo = participantes.filter((p) => !asignados.has(p.usuarioId));

  const listaGrupos = (
    <div className="section-card home-panel">
      <div className="section-card-header">
        <span className="section-card-title">{t('facilitador:grupos.list_title')}</span>
        <span className="count-badge">{grupos.length}</span>
      </div>
      <div className="section-card-body">
        {loading && <Loading label={t('common:loading')} />}
        {!loading && grupos.length === 0 && <EmptyState title={t('facilitador:grupos.empty')} />}
        {/* HU-23: cuántos grupos ya entregaron todo y esperan tu revisión. */}
        {!loading && gruposListos > 0 && (
          <Alert variant="info">
            {t('facilitador:grupos.resumen_listos', { count: gruposListos, total: grupos.length })}
          </Alert>
        )}
        {!loading && grupos.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 'var(--space-5)',
            }}
          >
            {gruposOrdenados.map((g) => (
              <div key={g.id} className="card" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {/* Fila 1: nombre (reserva 2 líneas para que las tarjetas queden alineadas) + renombrar. */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem', lineHeight: 1.3, minHeight: '2.6em', color: 'var(--color-text-heading)' }}>
                    {g.nombre}
                  </span>
                  {!soloLectura && (
                    <button type="button" className="btn-link" onClick={() => setRenombrando(g)}>
                      {t('facilitador:grupos.renombrar')}
                    </button>
                  )}
                </div>
                {/* Fila 2: estado de revisión + advertencias, siempre en la misma línea. */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)', minHeight: 24 }}>
                  {estadoRevision(g) === 'listo' && (
                    <StatusBadge variant="warning">{t('facilitador:grupos.listo_revisar')}</StatusBadge>
                  )}
                  {estadoRevision(g) === 'en_curso' && (
                    <StatusBadge variant="neutral">{t('facilitador:grupos.en_curso')}</StatusBadge>
                  )}
                  {g.finalizadoEn && (
                    <StatusBadge
                      variant="success"
                      title={g.finalizadoPor ? t('facilitador:grupos.finalizado_por', { nombre: g.finalizadoPor.nombre }) : undefined}
                    >
                      {t('facilitador:grupos.finalizado')}
                    </StatusBadge>
                  )}
                  {/* HU-21/22: sin mínimo; un grupo con menos de 2 solo muestra advertencia. */}
                  {g.miembros.length < 2 && (
                    <StatusBadge variant="warning">⚠ {t('facilitador:grupos.incompleto')}</StatusBadge>
                  )}
                </div>
                {/* Fila 3: cantidad de integrantes. */}
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                  {t('facilitador:grupos.miembros')} ({g.miembros.length})
                </div>
                <ul style={{ margin: 0, paddingLeft: 'var(--space-5)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  {g.miembros.map((m) => (
                    <li key={m.id}>
                      {m.usuario.nombre}
                      {!soloLectura && !g.finalizadoEn && (
                        <span style={{ marginLeft: 'var(--space-3)', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <button type="button" className="btn-link" onClick={() => setReemplazando({ grupo: g, miembro: m })}>
                            {t('facilitador:grupos.reemplazar')}
                          </button>
                          <button type="button" className="btn-link" onClick={() => setMoviendo({ grupo: g, miembro: m })}>
                            {t('facilitador:grupos.mover')}
                          </button>
                          <button
                            type="button"
                            className="btn-link btn-link-danger"
                            onClick={() => setQuitando({ grupo: g, miembro: m })}
                          >
                            {t('facilitador:grupos.quitar_integrante')}
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {/* Zona inferior anclada al fondo (margin-top:auto): entregables, acción y asignar quedan
                    alineados entre las tarjetas de una fila aunque los integrantes/título varíen. */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {/* HU-23: qué entregó ya el grupo (barra + lista), sin entrar a revisarlo. */}
                <GrupoEntregaProgreso faltante={g.faltante} />
                {/* HU-23: revisar lo entregado; finalizar se hace desde la pantalla de revisión. */}
                <div>
                  <Link
                    className={`btn btn-sm ${estadoRevision(g) === 'listo' ? 'btn-primary' : 'btn-secondary'}`}
                    to={`/facilitador/programas/${programaId}/grupos/${g.id}/revision`}
                  >
                    {t(
                      estadoRevision(g) === 'listo'
                        ? 'facilitador:grupos.revisar_entrega'
                        : estadoRevision(g) === 'finalizado'
                          ? 'facilitador:grupos.ver_entrega'
                          : 'facilitador:grupos.ver_avance',
                    )}
                  </Link>
                </div>
                {/* C-02: asignar integrante. Se oculta cuando ya no queda ningún participante sin grupo o en modo solo-lectura. */}
                {!soloLectura && !g.finalizadoEn && sinGrupo.length > 0 && (
                  <div>
                    <Field label={t('facilitador:grupos.asignar_label')}>
                      <select
                        className="input"
                        value=""
                        onChange={(e) => asignar(g.id, e.target.value)}
                      >
                        <option value="">{t('facilitador:grupos.asignar')}</option>
                        {sinGrupo.map((p) => (
                          <option key={p.usuarioId} value={p.usuarioId}>{p.usuario.nombre}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {renombrando && (
        <GrupoFormModal
          apiBase="facilitador"
          programaId={programaId}
          editing={renombrando}
          onClose={() => setRenombrando(null)}
          onSaved={() => { setRenombrando(null); cargar(); }}
        />
      )}
      {moviendo && (
        <MoverMiembroModal
          endpointBase="facilitador"
          grupoId={moviendo.grupo.id}
          grupoNombre={moviendo.grupo.nombre}
          miembro={{ usuarioId: moviendo.miembro.usuarioId, nombre: moviendo.miembro.usuario.nombre }}
          grupos={grupos}
          onClose={() => setMoviendo(null)}
          onSaved={() => { setMoviendo(null); cargar(); }}
        />
      )}
      {reemplazando && (
        <ReemplazarMiembroModal
          endpointBase="facilitador"
          grupoId={reemplazando.grupo.id}
          grupoNombre={reemplazando.grupo.nombre}
          saliente={{ usuarioId: reemplazando.miembro.usuarioId, nombre: reemplazando.miembro.usuario.nombre }}
          candidatos={sinGrupo.map((p) => ({ usuarioId: p.usuarioId, nombre: p.usuario.nombre }))}
          onClose={() => setReemplazando(null)}
          onSaved={() => { setReemplazando(null); cargar(); }}
        />
      )}
      <ConfirmModal
        isOpen={!!quitando}
        title={t('facilitador:grupos.quitar_integrante')}
        message={t('facilitador:grupos.quitar_confirm', { nombre: quitando?.miembro.usuario.nombre ?? '', grupo: quitando?.grupo.nombre ?? '' })}
        confirmLabel={t('facilitador:grupos.quitar_integrante')}
        onConfirm={() => { if (quitando) { quitar(quitando.grupo.id, quitando.miembro.usuarioId); setQuitando(null); } }}
        onCancel={() => setQuitando(null)}
      />
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/inicio' },
          { label: t('facilitador:programas.title'), to: '/facilitador/programas' },
          { label: programaNombre || '—' },
          { label: t('facilitador:grupos.title') },
        ]}
      />
      <PageHeader
        eyebrow={programaNombre || undefined}
        title={t('facilitador:grupos.title')}
      />
      {soloLectura && <Alert variant="warning">{t('errors:PROGRAMA_GRACIA_VENCIDA')}</Alert>}

      {soloLectura ? listaGrupos : (
        <FormListLayout
          form={
            // C-02: crear grupo
            <form onSubmit={crearGrupo} className="card" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Field label={t('facilitador:grupos.nuevo_nombre')} required>
                <input className="input" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} required />
              </Field>
              <div className="form-footer">
                <Button type="submit" variant="primary" disabled={creando}>
                  {creando ? t('common:loading') : t('facilitador:grupos.crear')}
                </Button>
              </div>
            </form>
          }
          list={listaGrupos}
        />
      )}
    </div>
  );
}
