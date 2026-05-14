import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const [toast, setToast] = useState<string | null>(null);

  const [editModal, setEditModal] = useState<Empresa | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editWasValidated, setEditWasValidated] = useState(false);
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

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
    showToast('Empresa creada correctamente');
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    await fetch(`${API_URL}/organization/empresas/${deleteModal.id}`, { method: 'DELETE' });
    setDeleteModal(null);
    load();
    showToast('Empresa eliminada');
  };

  const openEdit = (emp: Empresa) => {
    setEditModal(emp);
    setEditNombre(emp.nombre);
    setEditWasValidated(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    setEditWasValidated(true);
    if (!form.checkValidity()) return;
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
    showToast('Empresa actualizada');
  };

  return (
    <div>
      {toast && <div className="toast">{toast}</div>}

      <ConfirmModal
        isOpen={!!deleteModal}
        title="¿Eliminar Empresa?"
        message={`Se desactivarán también todas las iniciativas, actividades y ejecuciones de "${deleteModal?.nombre}".`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(null)}
      />

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

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>Empresas</h1>
          <p className="page-description">
            Paso 1 de 4 — Registra las organizaciones cliente. Cada empresa agrupa sus propias iniciativas y actividades.
          </p>
        </div>
        {empresas.length > 0 && (
          <Link to="/admin/iniciativas" className="btn btn-secondary" style={{ textDecoration: 'none', flexShrink: 0 }}>
            Siguiente: Iniciativas →
          </Link>
        )}
      </div>

      {/* Create form */}
      <div className="card mb-4" style={{ maxWidth: '560px' }}>
        <h3 style={{ margin: '0 0 4px' }}>Nueva Empresa</h3>
        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem' }}>Ingresa el nombre de la organización que usará la plataforma.</p>
        <form
          className={wasValidated ? 'was-validated' : ''}
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            setWasValidated(true);
            if (form.checkValidity()) create();
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
                placeholder="Ej: Empresa ABC S.A."
              />
              <div className="invalid-feedback">El nombre de la empresa es requerido.</div>
            </div>
            <button type="submit" className="btn btn-primary">Crear empresa</button>
          </div>
        </form>
      </div>

      {/* Table or empty state */}
      {empresas.length === 0 ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="empty-state">
            <div className="empty-state-icon">🏢</div>
            <p className="empty-state-title">Aún no hay empresas registradas</p>
            <p className="empty-state-desc">
              Las empresas son el punto de partida del sistema. Crea la primera para comenzar a configurar iniciativas y actividades.
            </p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table cellPadding={0} cellSpacing={0}>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Creada</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((emp) => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 500 }}>{emp.nombre}</td>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                    {new Date(emp.createdAt).toLocaleDateString()}
                  </td>
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
            </tbody>
          </table>
        </div>
      )}

      {/* Next step hint */}
      {empresas.length > 0 && (
        <div style={{
          marginTop: '1.25rem',
          padding: '0.875rem 1.25rem',
          background: '#F0F9FF',
          border: '1px solid #BAE6FD',
          borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', gap: '0.875rem',
        }}>
          <span style={{ fontSize: '1rem' }}>💡</span>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#0369A1' }}>
            <strong>Siguiente paso:</strong> Ahora puedes crear Iniciativas que agrupen las actividades de cada empresa.
          </p>
          <Link to="/admin/iniciativas" className="btn btn-secondary"
            style={{ textDecoration: 'none', flexShrink: 0, padding: '4px 12px', fontSize: '0.8rem' }}>
            Ir a Iniciativas →
          </Link>
        </div>
      )}
    </div>
  );
}
