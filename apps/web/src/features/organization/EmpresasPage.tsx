import React, { useEffect, useState } from 'react';
import { ConfirmModal } from '../../components/ConfirmModal';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Empresa {
  id: string;
  nombre: string;
  createdAt: string;
}

export function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [nombre, setNombre] = useState('');
  const [wasValidated, setWasValidated] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string; nombre: string } | null>(null);

  // Edit
  const [editModal, setEditModal] = useState<Empresa | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editWasValidated, setEditWasValidated] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await fetch(`${API_URL}/organization/empresas`);
    setEmpresas(await res.json());
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!nombre) return;
    await fetch(`${API_URL}/organization/empresas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre })
    });
    setNombre('');
    setWasValidated(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    await fetch(`${API_URL}/organization/empresas/${deleteModal.id}`, { method: 'DELETE' });
    setDeleteModal(null);
    load();
  };

  const openEdit = (emp: Empresa) => {
    setEditModal(emp);
    setEditNombre(emp.nombre);
    setEditWasValidated(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditWasValidated(true);
    if (!(e.currentTarget as HTMLFormElement).checkValidity()) return;
    if (!editModal) return;
    setSaving(true);
    await fetch(`${API_URL}/organization/empresas/${editModal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editNombre })
    });
    setSaving(false);
    setEditModal(null);
    load();
  };

  return (
    <div>
      <ConfirmModal
        isOpen={!!deleteModal}
        title="¿Eliminar Empresa?"
        message={`Se desactivarán también todas las iniciativas, actividades y ejecuciones de "${deleteModal?.nombre}".`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(null)}
      />

      {/* Edit modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Editar Empresa</h3>
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
                <label className="required-label" style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: '0.875rem' }}>Nombre</label>
                <input className="input" value={editNombre} onChange={e => setEditNombre(e.target.value)} required />
                <div className="invalid-feedback">El nombre es requerido.</div>
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

      <div className="flex justify-between items-center mb-4">
        <h1>Gestión de Empresas</h1>
      </div>

      <div className="card mb-4" style={{ maxWidth: '500px' }}>
        <label className="required-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Nueva Empresa</label>
        <form
          className={wasValidated ? 'was-validated' : ''}
          onSubmit={(e) => {
            e.preventDefault();
            setWasValidated(true);
            if (e.currentTarget.checkValidity()) create();
          }}
          noValidate
        >
          <div className="flex gap-2" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <input
                className="input"
                required
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Nombre de la empresa..."
              />
              <div className="invalid-feedback">El nombre de la empresa es requerido.</div>
            </div>
            <button type="submit" className="btn btn-primary">Crear</button>
          </div>
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table cellPadding={0} cellSpacing={0}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Creado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((emp) => (
              <tr key={emp.id}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8em', color: 'var(--color-text-secondary)' }}>
                  {emp.id.split('-')[0]}...
                </td>
                <td style={{ fontWeight: 500 }}>{emp.nombre}</td>
                <td style={{ color: 'var(--color-text-secondary)' }}>{new Date(emp.createdAt).toLocaleDateString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                      onClick={() => openEdit(emp)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 8px', fontSize: '0.875rem' }}
                      onClick={() => setDeleteModal({ id: emp.id, nombre: emp.nombre })}
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {empresas.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '2rem' }}>
                  No hay empresas registradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
