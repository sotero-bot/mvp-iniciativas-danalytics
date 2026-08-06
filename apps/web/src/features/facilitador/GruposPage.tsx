import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
} from '../../components/ui';
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

  // RN-04: participantes que aún no están en ningún grupo (candidatos a asignar).
  const asignados = new Set(grupos.flatMap((g) => g.miembros.map((m) => m.usuarioId)));
  const sinGrupo = participantes.filter((p) => !asignados.has(p.usuarioId));

  const listaGrupos = (
    <div className="section-card">
      <div className="section-card-header">
        <span className="section-card-title">{t('facilitador:grupos.title')}</span>
        <span className="count-badge">{grupos.length}</span>
      </div>
      {loading && <Loading label={t('common:loading')} />}
      {!loading && grupos.length === 0 && <EmptyState title={t('facilitador:grupos.empty')} />}
      {!loading && grupos.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 'var(--space-5)',
            padding: 'var(--space-4)',
          }}
        >
          {grupos.map((g) => (
            <div key={g.id} className="card" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--color-text-heading)' }}>{g.nombre}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                {t('facilitador:grupos.miembros')} ({g.miembros.length})
              </div>
              <ul style={{ margin: 0, paddingLeft: 'var(--space-5)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {g.miembros.map((m) => (
                  <li key={m.id}>{m.usuario.nombre}</li>
                ))}
              </ul>
              {/* C-02: asignar integrante (no se puede quitar — eso es del admin).
                  Se oculta cuando ya no queda ningún participante sin grupo o en modo solo-lectura. */}
              {!soloLectura && sinGrupo.length > 0 && (
                <div style={{ marginTop: 'auto' }}>
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
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
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
