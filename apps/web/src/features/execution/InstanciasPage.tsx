import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function InstanciasPage() {
  const [instancias, setInstancias] = useState<any[]>([]);
  const [actividades, setActividades] = useState<any[]>([]);
  const [enlaces, setEnlaces] = useState<any[]>([]);

  // Formulario de enlace multi-persona
  const [formEnlace, setFormEnlace] = useState({ actividadId: '', nombre: '' });
  const [enlaceGenerado, setEnlaceGenerado] = useState<string | null>(null);
  const [generandoEnlace, setGenerandoEnlace] = useState(false);

  const load = async () => {
    const [resInst, resEnl] = await Promise.all([
      fetch(`${API_URL}/admin/instancias`),
      fetch(`${API_URL}/admin/enlaces`),
    ]);
    if (resInst.ok) setInstancias(await resInst.json());
    if (resEnl.ok) setEnlaces(await resEnl.json());
  };

  const loadActividades = async () => {
    const res = await fetch(`${API_URL}/methodology/actividades`);
    if (res.ok) setActividades(await res.json());
  };

  useEffect(() => {
    load();
    loadActividades();
  }, []);

  const generarEnlace = async () => {
    if (!formEnlace.actividadId) return alert('Seleccione una Actividad');
    setGenerandoEnlace(true);
    setEnlaceGenerado(null);
    try {
      const res = await fetch(`${API_URL}/admin/enlaces/generar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formEnlace),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }
      const data = await res.json();
      const url = `${window.location.origin}/runner/enlace/${data.accessToken}`;
      setEnlaceGenerado(url);
      try { await navigator.clipboard.writeText(url); } catch (_) { }
      await load();
      setFormEnlace({ actividadId: '', nombre: '' });
    } catch (err: any) {
      alert('Error al generar el enlace: ' + err.message);
    } finally {
      setGenerandoEnlace(false);
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/runner/${token}`;
    navigator.clipboard.writeText(url);
    alert('Enlace copiado: ' + url);
  };

  return (
    <div>
      {/* ─── SECCIÓN: ENLACES MULTI-PERSONA ─── */}
      <div className="flex justify-between items-center mb-6">
        <h1>Control de Ejecuciones</h1>
      </div>

      <div className="card mb-8" style={{ border: '1px solid var(--color-primary)', background: 'linear-gradient(to right, #ffffff, #f0f7ff)' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>🔗 Generar Enlace Multi-Persona</h3>
        <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
          Crea un link permanente que <strong>cualquier número de personas</strong> puede usar. Cada visita genera una sesión independiente.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontSize: '0.85em' }}>Actividad Metodológica</label>
            <select
              className="input"
              value={formEnlace.actividadId}
              onChange={e => setFormEnlace({ ...formEnlace, actividadId: e.target.value })}
            >
              <option value="">Seleccione una Actividad</option>
              {actividades.map(a => (
                <option key={a.id} value={a.id}>
                  {a.iniciativa?.empresa?.nombre} | {a.iniciativa?.nombre} | {a.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontSize: '0.85em' }}>Etiqueta (Opcional)</label>
            <input
              className="input"
              placeholder="Ej: Campaña Mayo 2025"
              value={formEnlace.nombre}
              onChange={e => setFormEnlace({ ...formEnlace, nombre: e.target.value })}
            />
          </div>
          <button className="btn btn-primary" onClick={generarEnlace} disabled={!formEnlace.actividadId || generandoEnlace}>
            {generandoEnlace ? '⏳ Generando...' : 'Generar Enlace'}
          </button>
        </div>

        {enlaceGenerado && (
          <div style={{
            marginTop: '1.25rem', padding: '1rem 1.25rem', borderRadius: '8px',
            background: '#f0fdf4', border: '1px solid #86efac',
            display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '1.1rem' }}>✅</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: '#166534', marginBottom: 4 }}>¡Enlace generado y copiado!</div>
              <code style={{ fontSize: '0.82rem', wordBreak: 'break-all', color: '#166534' }}>{enlaceGenerado}</code>
            </div>
            <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              onClick={() => navigator.clipboard.writeText(enlaceGenerado)}>
              📋 Copiar
            </button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.1rem' }}
              onClick={() => setEnlaceGenerado(null)}>✕</button>
          </div>
        )}
      </div>

      {/* Lista de enlaces existentes */}
      {enlaces.length > 0 && (
        <div className="card mb-8" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-bg-page)' }}>
            <strong>🔗 Enlaces Activos ({enlaces.length})</strong>
          </div>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-page)' }}>
                <th>Etiqueta</th>
                <th>Actividad</th>
                <th>Estado</th>
                <th>Creado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {enlaces.map((e: any) => {
                const url = `${window.location.origin}/runner/enlace/${e.accessToken}`;
                return (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 500 }}>{e.nombre || <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Sin etiqueta</span>}</td>
                    <td style={{ fontSize: '0.9em' }}>{e.actividad?.nombre || '-'}</td>
                    <td>
                      <span className={`status-badge ${e.activo ? 'status-success' : 'status-neutral'}`}>
                        {e.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85em', color: 'var(--color-text-secondary)' }}>
                      {new Date(e.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '0.82rem' }}
                        onClick={() => { navigator.clipboard.writeText(url); alert('Copiado: ' + url); }}>
                        📋 Copiar enlace
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── SECCIÓN: EJECUCIONES INDIVIDUALES ─── */}
      <div style={{ marginBottom: '1rem' }}>
        <strong>📋 Ejecuciones Individuales</strong>
        <span className="status-badge status-neutral" style={{ marginLeft: 8 }}>Total: {instancias.length}</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table" style={{ margin: 0 }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg-page)' }}>
              <th>Estado</th>
              <th>Actividad</th>
              <th>Usuario</th>
              <th>Última Actualización</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {instancias.map((ins: any) => (
              <tr key={ins.id}>
                <td>
                  <span className={`status-badge ${ins.estado === 'finalizado' ? 'status-success' :
                    ins.estado === 'iniciado' ? 'status-warning' : 'status-neutral'
                    }`}>
                    {ins.estado}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{ins.actividad?.nombre || 'Desconocida'}</div>
                  <div style={{ fontSize: '0.75em', color: 'var(--color-text-secondary)' }}>
                    {ins.actividad?.iniciativa?.nombre || '-'}
                  </div>
                </td>
                <td style={{ fontSize: '0.9em' }}>
                  {ins.usuario?.nombre || (ins.emailReferencia ? `Ref: ${ins.emailReferencia}` : 'Pendiente')}
                </td>
                <td style={{ fontSize: '0.85em', color: 'var(--color-text-secondary)' }}>
                  {new Date(ins.updatedAt).toLocaleString()}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <Link to={`/admin/instancias/${ins.id}`} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85em' }}>
                      🔍 Ver Resultados
                    </Link>
                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85em' }}
                      onClick={() => copyLink(ins.accessToken)}>
                      Copiar Enlace
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {instancias.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
                  No hay ejecuciones registradas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
