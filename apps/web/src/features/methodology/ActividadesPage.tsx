import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmModal } from '../../components/ConfirmModal';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function ActividadesPage() {
  const [list, setList] = useState<any[]>([]);
  const [iniciativas, setIniciativas] = useState<any[]>([]);
  const [wasValidated, setWasValidated] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string; nombre: string } | null>(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', iniciativaId: '' });

  // Edit modal
  const [editModal, setEditModal] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '', descripcion: '', iniciativaId: '' });
  const [editWasValidated, setEditWasValidated] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await fetch(`${API_URL}/methodology/actividades`);
    setList(await res.json());
  };

  const loadIniciativas = async () => {
    const res = await fetch(`${API_URL}/organization/iniciativas`);
    setIniciativas(await res.json());
  };

  useEffect(() => { load(); loadIniciativas(); }, []);

  const create = async () => {
    if (!form.iniciativaId) return alert('Debe seleccionar una Iniciativa');
    try {
      const res = await fetch(`${API_URL}/methodology/actividades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: form.nombre, descripcion: form.descripcion, iniciativaId: form.iniciativaId })
      });
      if (res.ok) {
        load();
        setForm({ nombre: '', descripcion: '', iniciativaId: form.iniciativaId });
        setWasValidated(false);
      }
    } catch { alert('Error en el servidor'); }
  };

  const openEdit = (a: any) => {
    setEditModal(a);
    setEditForm({ nombre: a.nombre, descripcion: a.descripcion || '', iniciativaId: a.iniciativaId });
    setEditWasValidated(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditWasValidated(true);
    if (!(e.currentTarget as HTMLFormElement).checkValidity()) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/methodology/actividades/${editModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editForm.nombre, descripcion: editForm.descripcion, iniciativaId: editForm.iniciativaId })
      });
      load();
      setEditModal(null);
    } catch { alert('Error al actualizar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    await fetch(`${API_URL}/methodology/actividades/${deleteModal.id}`, { method: 'DELETE' });
    setDeleteModal(null);
    load();
  };

  return (
    <div>
      <ConfirmModal
        isOpen={!!deleteModal}
        title="¿Eliminar Actividad?"
        message={`Se desactivarán también los pasos y ejecuciones de "${deleteModal?.nombre}".`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(null)}
      />

      {/* Edit modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Editar Actividad</h3>
              <button onClick={() => setEditModal(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '1.25rem', color: 'var(--color-text-secondary)', lineHeight: 1, padding: 4,
              }}>×</button>
            </div>
            <form
              className={editWasValidated ? 'was-validated' : ''}
              onSubmit={handleEdit}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              noValidate
            >
              <div>
                <label className="required-label" style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>Iniciativa</label>
                <select className="input" required value={editForm.iniciativaId}
                  onChange={e => setEditForm({ ...editForm, iniciativaId: e.target.value })}>
                  <option value="">Seleccione una iniciativa</option>
                  {iniciativas.map(ini => (
                    <option key={ini.id} value={ini.id}>{ini.nombre} ({ini.empresa?.nombre})</option>
                  ))}
                </select>
                <div className="invalid-feedback">Seleccione una iniciativa.</div>
              </div>
              <div>
                <label className="required-label" style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>Nombre</label>
                <input className="input" required value={editForm.nombre}
                  onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} />
                <div className="invalid-feedback">El nombre es requerido.</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>Descripción</label>
                <textarea className="input" rows={4} value={editForm.descripcion}
                  onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <h1 style={{ marginBottom: 24 }}>Diseño de Metodología</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>

        {/* Create form */}
        <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: '20px' }}>
          <h3 style={{ marginBottom: 16 }}>Nueva Actividad</h3>
          <form
            className={wasValidated ? 'was-validated' : ''}
            onSubmit={(e) => { e.preventDefault(); setWasValidated(true); if (e.currentTarget.checkValidity()) create(); }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            noValidate
          >
            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 5 }}>Iniciativa</label>
              <select className="input" required value={form.iniciativaId}
                onChange={e => setForm({ ...form, iniciativaId: e.target.value })}>
                <option value="">Seleccione una Iniciativa</option>
                {iniciativas.map(ini => (
                  <option key={ini.id} value={ini.id}>{ini.nombre} ({ini.empresa?.nombre})</option>
                ))}
              </select>
              <div className="invalid-feedback">Seleccione una iniciativa.</div>
            </div>
            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 5 }}>Nombre</label>
              <input className="input" required placeholder="Ej: Análisis de Brechas"
                value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
              <div className="invalid-feedback">Ingrese el nombre de la actividad.</div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>Descripción</label>
              <textarea className="input" placeholder="¿Qué se espera en esta actividad?"
                value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={4} />
            </div>
            <button type="submit" className="btn btn-primary">Guardar Actividad</button>
          </form>
        </div>

        {/* List */}
        <div>
          {list.map((a: any) => (
            <div key={a.id} className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    <span className="status-badge status-info" style={{ fontSize: '0.7rem' }}>
                      {a.iniciativa?.empresa?.nombre}
                    </span>
                    <span className="status-badge status-neutral" style={{ fontSize: '0.7rem' }}>
                      {a.iniciativa?.nombre}
                    </span>
                    <span className="status-badge status-neutral" style={{ fontSize: '0.7rem' }}>
                      {a.estado}
                    </span>
                  </div>
                  <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.05rem' }}>{a.nombre}</h3>
                  {a.descripcion && (
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: 6, marginBottom: 0, fontSize: '0.875rem' }}>
                      {a.descripcion}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '0.82rem' }}
                    onClick={() => openEdit(a)}>
                    Editar
                  </button>
                  <Link to={`/admin/actividades/${a.id}/pasos`} className="btn btn-secondary"
                    style={{ padding: '5px 12px', fontSize: '0.82rem', textDecoration: 'none' }}>
                    ⚙️ Pasos
                  </Link>
                  <button className="btn btn-danger" style={{ padding: '5px 8px', fontSize: '0.875rem' }}
                    onClick={() => setDeleteModal({ id: a.id, nombre: a.nombre })} title="Eliminar">
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-secondary)' }}>
              No hay actividades configuradas. Comience creando una nueva actividad.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
