import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const [toast, setToast] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [wasValidated, setWasValidated] = useState(false);

  const [deleteModal, setDeleteModal] = useState<{ id: string; nombre: string } | null>(null);

  const [editModal, setEditModal] = useState<Iniciativa | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editEmpresaId, setEditEmpresaId] = useState('');
  const [editWasValidated, setEditWasValidated] = useState(false);
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/organization/iniciativas`).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/organization/empresas`).then(r => r.ok ? r.json() : []),
    ]).then(([ini, emp]) => {
      setIniciativas(ini);
      setEmpresas(emp);
      setLoaded(true);
    });
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
    showToast('Iniciativa eliminada');
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
      showToast('Iniciativa creada correctamente');
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
    const form = e.currentTarget as HTMLFormElement;
    setEditWasValidated(true);
    if (!form.checkValidity()) return;
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
    showToast('Iniciativa actualizada');
  };

  return (
    <div>
      {toast && <div className="toast">{toast}</div>}

      <ConfirmModal
        isOpen={!!deleteModal}
        title="¿Eliminar Iniciativa?"
        message={`Se desactivarán también sus actividades y ejecuciones de "${deleteModal?.nombre}".`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(null)}
      />

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
                <div className="invalid-feedback">Seleccioná una empresa.</div>
              </div>
              <div>
                <label className="required-label" style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>Nombre</label>
                <input className="input" value={editNombre} onChange={e => setEditNombre(e.target.value)} required />
                <div className="invalid-feedback">El nombre es necesario.</div>
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

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>Iniciativas</h1>
          <p className="page-description">
            Paso 2 de 4 — Agrupa actividades bajo un proyecto o programa específico de cada empresa.
          </p>
        </div>
        {iniciativas.length > 0 && (
          <Link to="/admin/actividades" className="btn btn-secondary" style={{ textDecoration: 'none', flexShrink: 0 }}>
            Siguiente: Actividades →
          </Link>
        )}
      </div>

      {/* Prerequisite warning */}
      {loaded && empresas.length === 0 && (
        <div className="prereq-banner">
          <span className="prereq-banner-icon">⚠️</span>
          <div className="prereq-banner-body">
            <p className="prereq-banner-title">Primero necesitas registrar una empresa</p>
            <p className="prereq-banner-text">
              Las iniciativas pertenecen a una empresa. Crea al menos una empresa antes de continuar.
            </p>
          </div>
          <Link to="/admin/empresas" className="btn btn-secondary"
            style={{ textDecoration: 'none', flexShrink: 0, fontSize: '0.8125rem' }}>
            Crear empresa →
          </Link>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
        {/* Create form */}
        <div className="card">
          <h3 style={{ margin: '0 0 4px' }}>Nueva Iniciativa</h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.8125rem' }}>
            Una iniciativa representa un proyecto o programa dentro de una empresa.
          </p>
          <form
            className={wasValidated ? 'was-validated' : ''}
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              setWasValidated(true);
              if (form.checkValidity()) handleSubmit(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            noValidate
          >
            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 5 }}>Empresa</label>
              <select className="input" value={empresaId} onChange={e => setEmpresaId(e.target.value)} required disabled={empresas.length === 0}>
                <option value="">{empresas.length === 0 ? 'Sin empresas disponibles' : 'Seleccione una empresa'}</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                ))}
              </select>
              <div className="invalid-feedback">Debe seleccionar una empresa.</div>
            </div>
            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 5 }}>Nombre</label>
              <input className="input" value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Transformación Digital" required disabled={empresas.length === 0} />
              <div className="invalid-feedback">El nombre es necesario.</div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>Descripción <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(opcional)</span></label>
              <textarea className="input" value={descripcion} onChange={e => setDescripcion(e.target.value)}
                placeholder="¿Cuál es el objetivo de esta iniciativa?" rows={3} disabled={empresas.length === 0} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={empresas.length === 0}>
              Crear Iniciativa
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Iniciativas registradas</h3>
            {iniciativas.length > 0 && (
              <span style={{
                background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE',
                borderRadius: 9999, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 600,
              }}>{iniciativas.length}</span>
            )}
          </div>

          {iniciativas.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🚀</div>
              <p className="empty-state-title">Aún no hay iniciativas</p>
              <p className="empty-state-desc">
                {empresas.length === 0
                  ? 'Primero crea una empresa para poder agregar iniciativas.'
                  : 'Crea tu primera iniciativa usando el formulario de la izquierda.'}
              </p>
              {empresas.length === 0 && (
                <Link to="/admin/empresas" className="btn btn-secondary" style={{ textDecoration: 'none', marginTop: 4, fontSize: '0.8125rem' }}>
                  Ir a Empresas →
                </Link>
              )}
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Empresa</th>
                    <th>Descripción</th>
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
          )}
        </div>
      </div>

      {/* Next step hint */}
      {iniciativas.length > 0 && (
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
            <strong>Siguiente paso:</strong> Ahora puedes crear Actividades vinculadas a tus iniciativas.
          </p>
          <Link to="/admin/actividades" className="btn btn-secondary"
            style={{ textDecoration: 'none', flexShrink: 0, padding: '4px 12px', fontSize: '0.8rem' }}>
            Ir a Actividades →
          </Link>
        </div>
      )}
    </div>
  );
}
