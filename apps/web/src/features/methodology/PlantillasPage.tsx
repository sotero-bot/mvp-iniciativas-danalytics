import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmModal } from '../../components/ConfirmModal';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type Plantilla = { id: string; nombre: string; descripcion?: string; _count: { pasos: number } };

export function PlantillasPage() {
  const [list, setList] = useState<Plantilla[]>([]);
  const [form, setForm] = useState({ nombre: '', descripcion: '' });
  const [wasValidated, setWasValidated] = useState(false);
  const [editModal, setEditModal] = useState<Plantilla | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '', descripcion: '' });
  const [editWasValidated, setEditWasValidated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string; nombre: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    const res = await fetch(`${API_URL}/admin/plantillas`);
    if (res.ok) setList(await res.json());
  };

  useEffect(() => {
    load().then(() => setLoaded(true));
  }, []);

  const handleCreate = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/plantillas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: form.nombre, descripcion: form.descripcion || undefined }),
      });
      if (res.ok) {
        load();
        setForm({ nombre: '', descripcion: '' });
        setWasValidated(false);
        showToast('Plantilla creada correctamente');
      } else {
        showToast('Error al crear la plantilla');
      }
    } catch {
      showToast('Error al crear la plantilla');
    }
  };

  const openEdit = (p: Plantilla) => {
    setEditModal(p);
    setEditForm({ nombre: p.nombre, descripcion: p.descripcion || '' });
    setEditWasValidated(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formEl = e.currentTarget as HTMLFormElement;
    setEditWasValidated(true);
    if (!formEl.checkValidity()) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/admin/plantillas/${editModal!.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editForm.nombre, descripcion: editForm.descripcion || undefined }),
      });
      load();
      setEditModal(null);
      showToast('Plantilla actualizada');
    } catch {
      showToast('Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    await fetch(`${API_URL}/admin/plantillas/${deleteModal.id}`, { method: 'DELETE' });
    setDeleteModal(null);
    load();
    showToast('Plantilla eliminada');
  };

  return (
    <div>
      {toast && <div className="toast">{toast}</div>}

      <ConfirmModal
        isOpen={!!deleteModal}
        title="¿Eliminar Plantilla?"
        message={`La plantilla "${deleteModal?.nombre}" se desactivará. Las actividades ya creadas desde ella NO se verán afectadas.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(null)}
      />

      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Editar Plantilla</h3>
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

      <div className="page-header">
        <div>
          <h1>Plantillas de Actividad</h1>
          <p className="page-description">
            Define actividades reutilizables. Al crear una actividad, elige una plantilla y sus pasos se copian automáticamente.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>

        {/* Formulario crear */}
        <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: '20px' }}>
          <h3 style={{ margin: '0 0 4px' }}>Nueva Plantilla</h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.8125rem' }}>
            Define una actividad reutilizable con pasos configurables.
          </p>
          <form
            className={wasValidated ? 'was-validated' : ''}
            onSubmit={(e) => {
              e.preventDefault();
              const formEl = e.currentTarget;
              setWasValidated(true);
              if (formEl.checkValidity()) handleCreate();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            noValidate
          >
            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 5 }}>Nombre</label>
              <input className="input" required placeholder="Ej: Mapa de Oportunidades"
                value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
              <div className="invalid-feedback">El nombre es requerido.</div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>Descripción <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(opcional)</span></label>
              <textarea className="input" placeholder="¿Qué trabajará el participante en esta actividad?"
                value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                rows={4} />
            </div>
            <button type="submit" className="btn btn-primary">Guardar Plantilla</button>
          </form>
        </div>

        {/* Lista */}
        <div>
          {loaded && list.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <p className="empty-state-title">Aún no hay plantillas</p>
                <p className="empty-state-desc">
                  Crea tu primera plantilla y define sus pasos. Luego podrás usarla al crear actividades para cualquier empresa.
                </p>
              </div>
            </div>
          ) : (
            list.map(p => (
              <div key={p.id} className="card" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ marginBottom: 6 }}>
                      {p._count.pasos > 0 ? (
                        <span className="status-badge status-info" style={{ fontSize: '0.7rem' }}>
                          {p._count.pasos} {p._count.pasos === 1 ? 'paso' : 'pasos'}
                        </span>
                      ) : (
                        <span className="status-badge status-warning" style={{ fontSize: '0.7rem' }}>Sin pasos</span>
                      )}
                    </div>
                    <h3 style={{ margin: '0 0 4px', color: 'var(--color-text-main)', fontSize: '1rem' }}>{p.nombre}</h3>
                    {p.descripcion && (
                      <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.8125rem', lineHeight: 1.5 }}>
                        {p.descripcion}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '0.82rem' }}
                      onClick={() => openEdit(p)}>
                      Editar
                    </button>
                    <Link to={`/admin/plantillas/${p.id}/pasos`} className="btn btn-primary"
                      style={{ padding: '5px 12px', fontSize: '0.82rem', textDecoration: 'none' }}>
                      ⚙️ Configurar pasos
                    </Link>
                    <button className="btn btn-danger" style={{ padding: '5px 8px', fontSize: '0.875rem' }}
                      onClick={() => setDeleteModal({ id: p.id, nombre: p.nombre })} title="Eliminar">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
