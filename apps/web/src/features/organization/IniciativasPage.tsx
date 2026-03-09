import React, { useEffect, useState } from 'react';
import { ConfirmModal } from '../../components/ConfirmModal';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Iniciativa {
  id: string;
  nombre: string;
  descripcion?: string;
  empresaId: string;
  empresa?: { nombre: string };
  createdAt: string;
}

interface Empresa {
  id: string;
  nombre: string;
}

export function IniciativasPage() {
  const [iniciativas, setIniciativas] = useState<Iniciativa[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  // Create form
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [wasValidated, setWasValidated] = useState(false);

  // Delete modal
  const [deleteModal, setDeleteModal] = useState<{ id: string; nombre: string } | null>(null);

  // Edit modal
  const [editModal, setEditModal] = useState<Iniciativa | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editEmpresaId, setEditEmpresaId] = useState('');
  const [editWasValidated, setEditWasValidated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchIniciativas();
    fetchEmpresas();
  }, []);

  const fetchIniciativas = () => {
    fetch(`${API_URL}/organization/iniciativas`)
      .then(res => res.json())
      .then(setIniciativas);
  };

  const fetchEmpresas = () => {
    fetch(`${API_URL}/organization/empresas`)
      .then(res => res.json())
      .then(setEmpresas);
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    await fetch(`${API_URL}/organization/iniciativas/${deleteModal.id}`, { method: 'DELETE' });
    setDeleteModal(null);
    fetchIniciativas();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetch(`${API_URL}/organization/iniciativas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion, empresaId })
    }).then(() => {
      setNombre('');
      setDescripcion('');
      setEmpresaId('');
      setWasValidated(false);
      fetchIniciativas();
    });
  };

  const openEdit = (ini: Iniciativa) => {
    setEditModal(ini);
    setEditNombre(ini.nombre);
    setEditDescripcion(ini.descripcion || '');
    setEditEmpresaId(ini.empresaId);
    setEditWasValidated(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditWasValidated(true);
    if (!(e.currentTarget as HTMLFormElement).checkValidity()) return;
    if (!editModal) return;
    setSaving(true);
    await fetch(`${API_URL}/organization/iniciativas/${editModal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editNombre, descripcion: editDescripcion, empresaId: editEmpresaId })
    });
    setSaving(false);
    setEditModal(null);
    fetchIniciativas();
  };

  return (
    <div>
      {/* Delete confirm */}
      <ConfirmModal
        isOpen={!!deleteModal}
        title="¿Eliminar Iniciativa?"
        message={`Se desactivarán también sus actividades y ejecuciones de "${deleteModal?.nombre}".`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(null)}
      />

      {/* Edit modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Editar Iniciativa</h3>
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
                <label className="required-label" style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>Empresa</label>
                <select className="input" value={editEmpresaId} onChange={e => setEditEmpresaId(e.target.value)} required>
                  <option value="">Seleccione una empresa</option>
                  {empresas.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                  ))}
                </select>
                <div className="invalid-feedback">Debe seleccionar una empresa.</div>
              </div>
              <div>
                <label className="required-label" style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>Nombre</label>
                <input className="input" value={editNombre} onChange={e => setEditNombre(e.target.value)} required />
                <div className="invalid-feedback">El nombre es requerido.</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>Descripción</label>
                <textarea className="input" value={editDescripcion} onChange={e => setEditDescripcion(e.target.value)} rows={3} />
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

      <h1 style={{ marginBottom: 24 }}>Gestión de Iniciativas</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
        {/* Create form */}
        <div className="card">
          <h3 style={{ marginBottom: 20 }}>Nueva Iniciativa</h3>
          <form
            className={wasValidated ? 'was-validated' : ''}
            onSubmit={(e) => {
              e.preventDefault();
              setWasValidated(true);
              if (e.currentTarget.checkValidity()) handleSubmit(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            noValidate
          >
            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 5 }}>Empresa</label>
              <select className="input" value={empresaId} onChange={e => setEmpresaId(e.target.value)} required>
                <option value="">Seleccione una empresa</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                ))}
              </select>
              <div className="invalid-feedback">Debe seleccionar una empresa.</div>
            </div>
            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 5 }}>Nombre</label>
              <input className="input" value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Transformación Digital" required />
              <div className="invalid-feedback">El nombre es requerido.</div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>Descripción</label>
              <textarea className="input" value={descripcion} onChange={e => setDescripcion(e.target.value)}
                placeholder="Descripción breve..." rows={3} />
            </div>
            <button type="submit" className="btn btn-primary">Crear Iniciativa</button>
          </form>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ margin: 0 }}>Lista de Iniciativas</h3>
          </div>
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Empresa</th>
                  <th>Descripción</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {iniciativas.map(ini => (
                  <tr key={ini.id}>
                    <td><strong>{ini.nombre}</strong></td>
                    <td>
                      <span className="status-badge status-neutral">{ini.empresa?.nombre}</span>
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', maxWidth: 200 }}>
                      {ini.descripcion || <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(ini.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                          onClick={() => openEdit(ini)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 8px', fontSize: '0.875rem' }}
                          onClick={() => setDeleteModal({ id: ini.id, nombre: ini.nombre })}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {iniciativas.length === 0 && (
            <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              No hay iniciativas registradas.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
