import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, Loading, EmptyState } from '../../components/ui';
import { toast } from '../../components/toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Grupo {
  id: string;
  nombre: string;
  miembros: { id: string; usuarioId: string; usuario: { id: string; nombre: string; email: string } }[];
}

interface Participante {
  usuarioId: string;
  usuario: { id: string; nombre: string; email: string };
}

// RF-15 + C-02: el facilitador ve los grupos y además puede crear grupos y asignar
// integrantes (sin quitar/renombrar/eliminar — eso es del admin).
export function FacilitadorGruposPage() {
  const { id: programaId = '' } = useParams();
  const { t } = useTranslation(['facilitador', 'common']);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [loading, setLoading] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [creando, setCreando] = useState(false);

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

  // RN-04: participantes que aún no están en ningún grupo (candidatos a asignar).
  const asignados = new Set(grupos.flatMap((g) => g.miembros.map((m) => m.usuarioId)));
  const sinGrupo = participantes.filter((p) => !asignados.has(p.usuarioId));

  return (
    <div className="page">
      <PageHeader
        back={{ to: '/facilitador/programas', label: t('facilitador:sesiones.back') }}
        title={t('facilitador:grupos.title')}
      />

      {/* C-02: crear grupo */}
      <form onSubmit={crearGrupo} className="card" style={{ marginBottom: '1.25rem', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', maxWidth: 480 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', flex: '1 1 200px' }}>
          {t('facilitador:grupos.nuevo_nombre')}
          <input className="input" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} required />
        </label>
        <button type="submit" className="btn btn-primary" disabled={creando}>
          {creando ? t('common:loading') : t('facilitador:grupos.crear')}
        </button>
      </form>

      {loading && <Loading label={t('common:loading')} />}
      {!loading && grupos.length === 0 && <EmptyState title={t('facilitador:grupos.empty')} />}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: '1.25rem',
      }}>
        {grupos.map((g) => (
          <div key={g.id} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text-main)' }}>{g.nombre}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              {t('facilitador:grupos.miembros')} ({g.miembros.length})
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {g.miembros.map((m) => (
                <li key={m.id}>{m.usuario.nombre}</li>
              ))}
            </ul>
            {/* C-02: asignar integrante (no se puede quitar — eso es del admin).
                Se oculta cuando ya no queda ningún participante sin grupo. */}
            {sinGrupo.length > 0 && (
              <label style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                {t('facilitador:grupos.asignar_label')}
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
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
