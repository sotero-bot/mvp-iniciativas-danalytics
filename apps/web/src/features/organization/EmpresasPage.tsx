import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmModal } from '../../components/ConfirmModal';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Empresa {
  id: string;
  nombre: string;
  logoUrl?: string | null;
  createdAt: string;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function LogoPreview({ src, nombre, size = 32 }: { src?: string | null; nombre: string; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={nombre}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'contain', border: '1px solid #E2E8F0', background: '#fff' }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #2563EB, #0F172A)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35 + 'px', fontWeight: 700, color: 'white', flexShrink: 0,
    }}>
      {nombre.charAt(0).toUpperCase()}
    </div>
  );
}

function LogoUploadField({
  current,
  onChange,
}: {
  current?: string | null;
  onChange: (base64: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current ?? null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const b64 = await toBase64(file);
    setPreview(b64);
    onChange(b64);
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {preview ? (
        <img
          src={preview}
          alt="Logo"
          style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'contain', border: '1px solid #E2E8F0', background: '#F8FAFC' }}
        />
      ) : (
        <div style={{
          width: 48, height: 48, borderRadius: 8,
          background: '#F1F5F9', border: '1px dashed #CBD5E1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.25rem', color: '#94A3B8',
        }}>🖼</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', fontSize: '0.8rem',
          background: '#EFF6FF', color: '#2563EB',
          borderRadius: 6, cursor: 'pointer', fontWeight: 500,
          border: '1px solid #BFDBFE', width: 'fit-content',
        }}>
          {preview ? 'Cambiar logo' : 'Subir logo'}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </label>
        {preview && (
          <button
            type="button"
            onClick={handleRemove}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.75rem', color: '#EF4444', textAlign: 'left', padding: 0,
            }}
          >
            ✕ Quitar logo
          </button>
        )}
        <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>PNG, JPG, SVG — recomendado cuadrado</span>
      </div>
    </div>
  );
}

export function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [nombre, setNombre] = useState('');
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [wasValidated, setWasValidated] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string; nombre: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [editModal, setEditModal] = useState<Empresa | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editLogoBase64, setEditLogoBase64] = useState<string | null | undefined>(undefined);
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
    const body: any = { nombre };
    if (logoBase64 !== null) body.logoUrl = logoBase64;
    await fetch(`${API_URL}/organization/empresas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setNombre('');
    setLogoBase64(null);
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
    setEditLogoBase64(undefined);
    setEditWasValidated(false);
  };

  const handleEdit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    setEditWasValidated(true);
    if (!form.checkValidity()) return;
    if (!editModal) return;
    setSaving(true);
    const body: any = { nombre: editNombre };
    if (editLogoBase64 !== undefined) body.logoUrl = editLogoBase64;
    await fetch(`${API_URL}/organization/empresas/${editModal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
              noValidate
            >
              <div>
                <label className="required-label" style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: '0.875rem' }}>Nombre</label>
                <input className="input" value={editNombre} onChange={e => setEditNombre(e.target.value)} required />
                <div className="invalid-feedback">El nombre es requerido.</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: '0.875rem' }}>Logo</label>
                <LogoUploadField
                  current={editLogoBase64 !== undefined ? editLogoBase64 : editModal.logoUrl}
                  onChange={setEditLogoBase64}
                />
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
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div>
            <input
              className="input"
              required
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Empresa ABC S.A."
            />
            <div className="invalid-feedback">El nombre de la empresa es requerido.</div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: '0.875rem' }}>Logo <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>(opcional)</span></label>
            <LogoUploadField current={logoBase64} onChange={setLogoBase64} />
          </div>
          <div>
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
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <LogoPreview src={emp.logoUrl} nombre={emp.nombre} size={32} />
                      <span style={{ fontWeight: 500 }}>{emp.nombre}</span>
                    </div>
                  </td>
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
