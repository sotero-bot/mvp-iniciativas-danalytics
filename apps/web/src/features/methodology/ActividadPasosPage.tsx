import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ConfirmModal } from '../../components/ConfirmModal';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function ActividadPasosPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [pasos, setPasos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [wasValidated, setWasValidated] = useState(false);
  const [modal, setModal] = useState<{ id: string; titulo: string } | null>(null);
  const [form, setForm] = useState({
    titulo: '',
    objetivo: '',
    instrucciones: '',
    usarIa: false,
    promptIa: '',
    orden: 0
  });

  const loadPasos = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/admin/actividades/${id}/pasos`);

      if (res.status === 404) {
        setError('Actividad no encontrada');
        return;
      }

      if (!res.ok) throw new Error('Error al cargar pasos');

      const data = await res.json();
      setPasos(data);
      const maxOrden = data.length > 0 ? Math.max(...data.map((p: any) => p.orden)) : 0;
      setForm(prev => ({ ...prev, orden: maxOrden + 1 }));

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPasos();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId
        ? `${API_URL}/admin/actividades/${id}/pasos/${editingId}`
        : `${API_URL}/admin/actividades/${id}/pasos`;

      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (res.status === 400) {
        alert(data.message || 'Error en los datos');
        return;
      }

      if (res.status === 404) {
        alert('Actividad/Paso no encontrado');
        return;
      }

      if (res.ok) {
        setForm({
          titulo: '',
          objetivo: '',
          instrucciones: '',
          usarIa: false,
          promptIa: '',
          orden: pasos.length + (editingId ? 1 : 2)
        });
        setShowForm(false);
        setEditingId(null);
        setWasValidated(false);
        loadPasos();
      }
    } catch (err) {
      alert('Error de conexión con el servidor');
    }
  };

  const handleEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      titulo: p.titulo,
      objetivo: p.objetivo || '',
      instrucciones: p.instrucciones || '',
      usarIa: p.usarIa || false,
      promptIa: p.promptIa || '',
      orden: p.orden
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setShowForm(false);
    const maxOrden = pasos.length > 0 ? Math.max(...pasos.map((p: any) => p.orden)) : 0;
    setForm({
      titulo: '',
      objetivo: '',
      instrucciones: '',
      usarIa: false,
      promptIa: '',
      orden: maxOrden + 1
    });
    setWasValidated(false);
  };


  const handleDelete = async () => {
    if (!modal) return;
    await fetch(`${API_URL}/admin/actividades/${id}/pasos/${modal.id}`, { method: 'DELETE' });
    setModal(null);
    loadPasos();
  };

  if (loading) return <div className="runner-center">Cargando pasos...</div>;
  if (error) return (
    <div className="runner-center" style={{ flexDirection: 'column', gap: '1rem' }}>
      <div style={{ color: '#ef4444' }}>{error}</div>
      <button className="btn btn-secondary" onClick={() => navigate('/admin/actividades')}>Volver</button>
    </div>
  );

  return (
    <div className="layout-content">
      <ConfirmModal
        isOpen={!!modal}
        title="¿Eliminar Paso?"
        message={`El paso "${modal?.titulo}" será eliminado de esta actividad.`}
        onConfirm={handleDelete}
        onCancel={() => setModal(null)}
      />
      <div className="flex justify-between items-center mb-4">
        <div>
          <button
            className="btn btn-secondary"
            style={{ marginBottom: '10px', padding: '5px 10px', fontSize: '0.8rem' }}
            onClick={() => navigate('/admin/actividades')}
          >
            ← Volver a Actividades
          </button>
          <h1>Gestión de Pasos</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>ID Actividad: {id}</p>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            ➕ Agregar Paso
          </button>
        )}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--color-primary)' }}>
          <h3>{editingId ? 'Editar Paso' : 'Nuevo Paso'}</h3>
          <form
            className={wasValidated ? 'was-validated' : ''}
            onSubmit={(e) => {
              e.preventDefault();
              setWasValidated(true);
              if (e.currentTarget.checkValidity()) {
                handleSubmit(e);
              }
            }}
            style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}
            noValidate
          >
            <div style={{ gridColumn: 'span 2' }}>
              <label className="required-label">Título</label>
              <input
                className="input"
                required
                value={form.titulo}
                onChange={e => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ej: Entrevista de Stakeholders"
              />
              <div className="invalid-feedback">El título del paso es requerido.</div>
            </div>
            <div>
              <label className="required-label">Orden</label>
              <input
                className="input"
                type="number"
                required
                value={form.orden}
                onChange={e => setForm({ ...form, orden: parseInt(e.target.value) })}
              />
              <div className="invalid-feedback">El orden es requerido.</div>
            </div>
            <div>
              <label>Objetivo</label>
              <input
                className="input"
                value={form.objetivo}
                onChange={e => setForm({ ...form, objetivo: e.target.value })}
                placeholder="¿Qué se busca lograr?"
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Instrucciones</label>
              <textarea
                className="input"
                rows={3}
                value={form.instrucciones}
                onChange={e => setForm({ ...form, instrucciones: e.target.value })}
                placeholder="Guía para el usuario..."
              />
            </div>

            {/* Toggle Usar IA */}
            <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={form.usarIa}
                  onChange={e => setForm({ ...form, usarIa: e.target.checked, promptIa: e.target.checked ? form.promptIa : '' })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                />
                <span style={{ fontWeight: 600 }}>Usar IA en este paso</span>
              </label>
              {form.usarIa && (
                <span className="status-badge" style={{ background: 'var(--color-primary)', color: '#fff', fontSize: '0.7rem' }}>
                  🤖 IA activa
                </span>
              )}
            </div>

            {/* Prompt IA — visible solo si usarIa === true */}
            {form.usarIa && (
              <div style={{ gridColumn: 'span 2' }}>
                <label className="required-label">Prompt IA</label>
                <textarea
                  className="input"
                  rows={3}
                  required={form.usarIa}
                  value={form.promptIa}
                  onChange={e => setForm({ ...form, promptIa: e.target.value })}
                  placeholder="Instrucciones para la IA (contexto, tono, objetivo del paso)..."
                />
                <div className="invalid-feedback">El prompt IA es requerido cuando la IA está activa.</div>
              </div>
            )}

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>Cancelar</button>
              <button type="submit" className="btn btn-primary">{editingId ? 'Guardar Cambios' : 'Guardar Paso'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {pasos.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)' }}>
            No hay pasos configurados para esta actividad.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-bg-page)', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>Orden</th>
                <th style={{ padding: '12px' }}>Título</th>
                <th style={{ padding: '12px' }}>Objetivo</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>IA</th>
                <th style={{ padding: '12px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pasos.map((p) => (
                <React.Fragment key={p.id}>
                  <tr style={{ borderBottom: p.usarIa && p.promptIa ? 'none' : '1px solid var(--color-bg-page)' }}>
                    <td style={{ padding: '12px' }}>
                      <span className="status-badge" style={{ background: 'var(--color-bg-page)' }}>{p.orden}</span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 500 }}>{p.titulo}</td>
                    <td style={{ padding: '12px', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                      {p.objetivo || '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {p.usarIa ? (
                        <span className="status-badge" style={{ background: 'var(--color-primary)', color: '#fff', fontSize: '0.7rem' }}>
                          🤖 Sí
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => handleEdit(p)}>
                          Editar
                        </button>
                        <button
                          className="btn"
                          style={{ padding: '2px 8px', fontSize: '0.75rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}
                          onClick={() => setModal({ id: p.id, titulo: p.titulo })}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                  {p.usarIa && p.promptIa && (
                    <tr style={{ borderBottom: '1px solid var(--color-bg-page)', background: 'rgba(0,0,0,0.02)' }}>
                      <td colSpan={5} style={{ padding: '6px 12px 10px 32px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                          🤖 Prompt: {p.promptIa}
                        </span>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
