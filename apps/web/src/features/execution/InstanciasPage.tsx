import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmModal } from '../../components/ConfirmModal';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function InstanciasPage() {
  const [instancias, setInstancias] = useState<any[]>([]);
  const [actividades, setActividades] = useState<any[]>([]);
  const [enlaces, setEnlaces] = useState<any[]>([]);

  const [formEnlace, setFormEnlace] = useState({ actividadId: '', nombre: '' });
  const [enlaceGenerado, setEnlaceGenerado] = useState<string | null>(null);
  const [generandoEnlace, setGenerandoEnlace] = useState(false);
  const [wasValidated, setWasValidated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [deleteEnlaceModal, setDeleteEnlaceModal] = useState<string | null>(null);

  // Datatable
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleDeleteInstancia = async () => {
    if (!deleteModal) return;
    await fetch(`${API_URL}/admin/instancias/${deleteModal}`, { method: 'DELETE' });
    setDeleteModal(null);
    load();
  };

  const handleDeleteEnlace = async () => {
    if (!deleteEnlaceModal) return;
    await fetch(`${API_URL}/admin/enlaces/${deleteEnlaceModal}`, { method: 'DELETE' });
    setDeleteEnlaceModal(null);
    load();
  };

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

  useEffect(() => { load(); loadActividades(); }, []);

  const generarEnlace = async () => {
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
      setWasValidated(false);
    } catch (err: any) {
      alert('Error al generar el enlace: ' + err.message);
    } finally {
      setGenerandoEnlace(false);
    }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/runner/${token}`);
    showToast('Enlace copiado al portapapeles');
  };

  // Datatable logic
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return instancias.filter(ins => {
      const matchSearch = !q ||
        ins.actividad?.nombre?.toLowerCase().includes(q) ||
        ins.actividad?.iniciativa?.nombre?.toLowerCase().includes(q) ||
        ins.usuario?.nombre?.toLowerCase().includes(q) ||
        ins.emailReferencia?.toLowerCase().includes(q);
      const matchEstado = !filterEstado || ins.estado === filterEstado;
      return matchSearch && matchEstado;
    });
  }, [instancias, search, filterEstado]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };
  const handleFilterEstado = (val: string) => { setFilterEstado(val); setPage(1); };
  const handlePageSize = (val: number) => { setPageSize(val); setPage(1); };

  // Stats
  const finalizadas = instancias.filter(i => i.estado === 'finalizado').length;
  const enProgreso = instancias.filter(i => i.estado === 'iniciado').length;
  const pendientes = instancias.filter(i => i.estado === 'generado').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {toast && <div className="toast">{toast}</div>}

      <ConfirmModal isOpen={!!deleteModal} title="¿Eliminar Ejecución?"
        message="Esta acción desactivará la ejecución y no se podrá acceder a ella."
        onConfirm={handleDeleteInstancia} onCancel={() => setDeleteModal(null)} />
      <ConfirmModal isOpen={!!deleteEnlaceModal} title="¿Eliminar Enlace?"
        message="Este enlace quedará desactivado. Las sesiones ya iniciadas continuarán, pero no se podrán crear nuevas."
        onConfirm={handleDeleteEnlace} onCancel={() => setDeleteEnlaceModal(null)} />

      {/* Header + stats en una fila */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Control de Ejecuciones</h1>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          {[
            { label: 'Finalizadas', value: finalizadas, color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
            { label: 'En progreso', value: enProgreso, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
            { label: 'Pendientes',  value: pendientes,  color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, border: `1px solid ${s.border}`,
              borderRadius: 8, padding: '0.375rem 0.875rem',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: '0.72rem', color: s.color, fontWeight: 500 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sección 1: Generar enlace ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.625rem' }}>
          <div style={{ width: 3, height: 16, background: 'var(--color-primary)', borderRadius: 9999 }} />
          <h2 style={{ margin: 0, fontSize: '0.95rem' }}>Enlace Multi-Persona</h2>
        </div>

        <div className="card" style={{ padding: '1rem', background: 'linear-gradient(135deg, #FAFBFF, #F5F8FF)' }}>
          <form
            className={wasValidated ? 'was-validated' : ''}
            onSubmit={(e) => { e.preventDefault(); setWasValidated(true); if (e.currentTarget.checkValidity()) generarEnlace(); }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}
            noValidate
          >
            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 4, fontSize: '0.78rem', fontWeight: 500 }}>Actividad</label>
              <select className="input" style={{ fontSize: '0.82rem' }} required value={formEnlace.actividadId}
                onChange={e => setFormEnlace({ ...formEnlace, actividadId: e.target.value })}>
                <option value="">Seleccione una actividad</option>
                {actividades.map(a => (
                  <option key={a.id} value={a.id}>{a.iniciativa?.empresa?.nombre} · {a.iniciativa?.nombre} · {a.nombre}</option>
                ))}
              </select>
              <div className="invalid-feedback">Seleccione una actividad.</div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.78rem', fontWeight: 500 }}>
                Etiqueta <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(opcional)</span>
              </label>
              <input className="input" style={{ fontSize: '0.82rem' }} placeholder="Ej: Campaña Mayo 2025"
                value={formEnlace.nombre} onChange={e => setFormEnlace({ ...formEnlace, nombre: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ fontSize: '0.82rem' }} disabled={generandoEnlace}>
              {generandoEnlace ? 'Generando...' : 'Generar enlace'}
            </button>
          </form>

          {enlaceGenerado && (
            <div style={{
              marginTop: '0.75rem', padding: '0.625rem 1rem', borderRadius: 6,
              background: '#F0FDF4', border: '1px solid #86EFAC',
              display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#166534', fontSize: '0.78rem', marginBottom: 2 }}>✓ Enlace generado y copiado</div>
                <code style={{ fontSize: '0.75rem', wordBreak: 'break-all', color: '#166534' }}>{enlaceGenerado}</code>
              </div>
              <button className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: '0.75rem', flexShrink: 0 }}
                onClick={() => navigator.clipboard.writeText(enlaceGenerado)}>Copiar</button>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', flexShrink: 0 }}
                onClick={() => setEnlaceGenerado(null)}>✕</button>
            </div>
          )}
        </div>
      </section>

      {/* ── Sección 2: Enlaces activos ── */}
      {enlaces.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.625rem' }}>
            <div style={{ width: 3, height: 16, background: '#8B5CF6', borderRadius: 9999 }} />
            <h2 style={{ margin: 0, fontSize: '0.95rem' }}>Enlaces Activos</h2>
            <span style={{
              background: '#EDE9FE', color: '#6D28D9', border: '1px solid #DDD6FE',
              borderRadius: 9999, padding: '1px 8px', fontSize: '0.7rem', fontWeight: 600,
            }}>{enlaces.length}</span>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table-compact">
                <thead>
                  <tr>
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
                        <td style={{ fontWeight: 500 }}>
                          {e.nombre || <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Sin etiqueta</span>}
                        </td>
                        <td>{e.actividad?.nombre || '—'}</td>
                        <td>
                          <span className={`status-badge ${e.activo ? 'status-success' : 'status-neutral'}`}>
                            {e.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                          {new Date(e.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                              onClick={() => { navigator.clipboard.writeText(url); showToast('Enlace copiado'); }}>
                              Copiar
                            </button>
                            <button className="btn btn-danger" style={{ padding: '3px 6px', fontSize: '0.8rem' }}
                              onClick={() => setDeleteEnlaceModal(e.id)} title="Eliminar">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Sección 3: Ejecuciones individuales ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.625rem' }}>
          <div style={{ width: 3, height: 16, background: '#0EA5E9', borderRadius: 9999 }} />
          <h2 style={{ margin: 0, fontSize: '0.95rem' }}>Ejecuciones Individuales</h2>
          <span style={{
            background: '#E0F2FE', color: '#0369A1', border: '1px solid #BAE6FD',
            borderRadius: 9999, padding: '1px 10px', fontSize: '0.75rem', fontWeight: 600,
          }}>{instancias.length}</span>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
            padding: '0.5rem 1rem', borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-subtle)',
          }}>
            <input
              className="input"
              style={{ maxWidth: 240, fontSize: '0.78rem' }}
              placeholder="Buscar por actividad, usuario..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
            <select
              className="input"
              style={{ maxWidth: 150, fontSize: '0.78rem' }}
              value={filterEstado}
              onChange={e => handleFilterEstado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="generado">Generado</option>
              <option value="iniciado">En progreso</option>
              <option value="finalizado">Finalizado</option>
            </select>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              Mostrar
              <select
                className="input"
                style={{ width: 70, fontSize: '0.82rem', padding: '0.375rem 0.5rem' }}
                value={pageSize}
                onChange={e => handlePageSize(Number(e.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              por página
            </div>
          </div>

          {/* Table */}
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table-compact">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Actividad</th>
                  <th>Usuario</th>
                  <th>Última actualización</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((ins: any) => (
                  <tr key={ins.id}>
                    <td>
                      <span className={`status-badge ${
                        ins.estado === 'finalizado' ? 'status-success' :
                        ins.estado === 'iniciado' ? 'status-warning' : 'status-neutral'
                      }`}>
                        {ins.estado}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{ins.actividad?.nombre || 'Desconocida'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                        {ins.actividad?.iniciativa?.nombre || '—'}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.875rem' }}>
                      {ins.usuario?.nombre || (ins.emailReferencia
                        ? <span style={{ color: 'var(--color-text-secondary)' }}>{ins.emailReferencia}</span>
                        : <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Pendiente</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(ins.updatedAt).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <Link to={`/admin/instancias/${ins.id}`} className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.78rem', textDecoration: 'none' }}>
                          Ver resultados
                        </Link>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                          onClick={() => copyLink(ins.accessToken)}>
                          Copiar enlace
                        </button>
                        <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.875rem' }}
                          onClick={() => setDeleteModal(ins.id)} title="Eliminar">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                      {search || filterEstado ? 'No hay resultados para los filtros aplicados.' : 'No hay ejecuciones registradas todavía.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.5rem 1rem', borderTop: '1px solid var(--color-border)',
            background: 'var(--color-bg-subtle)', flexWrap: 'wrap', gap: '0.75rem',
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              {filtered.length === 0 ? 'Sin resultados' : `Mostrando ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} de ${filtered.length}`}
            </span>

            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => setPage(1)}
                disabled={page === 1}
              >«</button>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
              >‹</button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .reduce<(number | '...')[]>((acc, n, i, arr) => {
                  if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('...');
                  acc.push(n);
                  return acc;
                }, [])
                .map((n, i) => n === '...'
                  ? <span key={`ellipsis-${i}`} style={{ padding: '4px 8px', fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>…</span>
                  : <button
                      key={n}
                      className="btn"
                      style={{
                        padding: '4px 10px', fontSize: '0.8rem',
                        background: page === n ? 'var(--color-primary)' : 'white',
                        color: page === n ? 'white' : 'var(--color-text-main)',
                        border: `1px solid ${page === n ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      }}
                      onClick={() => setPage(n as number)}
                    >{n}</button>
                )}

              <button
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => setPage(p => p + 1)}
                disabled={page === totalPages}
              >›</button>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
              >»</button>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
