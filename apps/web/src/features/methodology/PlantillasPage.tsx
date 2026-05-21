import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmModal } from '../../components/ConfirmModal';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type Plantilla = { id: string; nombre: string; descripcion?: string; orden?: number | null; _count: { pasos: number } };
type PlantillaJson = { nombre: string; descripcion?: string; orden?: number; pasos?: { titulo: string; objetivo?: string; usarIa?: boolean }[] };

export function PlantillasPage() {
  const [list, setList] = useState<Plantilla[]>([]);
  const [form, setForm] = useState({ nombre: '', descripcion: '', orden: '' });
  const [wasValidated, setWasValidated] = useState(false);
  const [editModal, setEditModal] = useState<Plantilla | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '', descripcion: '', orden: '' });
  const [editWasValidated, setEditWasValidated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string; nombre: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const importInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<PlantillaJson[] | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importError, setImportError] = useState('');
  const [importDragging, setImportDragging] = useState(false);

  const openImport = () => { setImportOpen(true); setImportPreview(null); setImportFileName(''); setImportResult(null); setImportError(''); };

  const parseImportFile = (file: File) => {
    setImportResult(null); setImportError(''); setImportFileName(file.name);
    if (!file.name.endsWith('.json')) { setImportError('Solo se aceptan archivos .json'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        const items: PlantillaJson[] = Array.isArray(parsed) ? parsed : [parsed];
        if (!items[0]?.nombre) { setImportError('El JSON debe tener el campo "nombre" en cada plantilla.'); return; }
        setImportPreview(items);
        setImportError('');
      } catch { setImportError('El archivo no es un JSON válido.'); }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importPreview) return;
    setImportLoading(true); setImportError('');
    try {
      const res = await fetch(`${API_URL}/admin/plantillas/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantillas: importPreview }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al importar');
      setImportResult(data);
      setImportPreview(null);
      load();
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      setImportLoading(false);
    }
  };

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
        body: JSON.stringify({
          nombre: form.nombre,
          descripcion: form.descripcion || undefined,
          orden: form.orden ? parseInt(form.orden) : undefined,
        }),
      });
      if (res.ok) {
        load();
        setForm({ nombre: '', descripcion: '', orden: '' });
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
    setEditForm({ nombre: p.nombre, descripcion: p.descripcion || '', orden: p.orden != null ? String(p.orden) : '' });
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
        body: JSON.stringify({
          nombre: editForm.nombre,
          descripcion: editForm.descripcion || undefined,
          orden: editForm.orden ? parseInt(editForm.orden) : null,
        }),
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
                <div className="invalid-feedback">El nombre es necesario.</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>Descripción</label>
                <textarea className="input" rows={4} value={editForm.descripcion}
                  onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>
                  Orden en la secuencia <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(opcional)</span>
                </label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  placeholder="Ej: 1, 2, 3..."
                  value={editForm.orden}
                  onChange={e => setEditForm({ ...editForm, orden: e.target.value })}
                  style={{ maxWidth: 160 }}
                />
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--color-text-tertiary)' }}>
                  Define el orden en que deben completarse las plantillas. La plantilla anterior debe finalizarse antes de iniciar esta.
                </p>
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

      {importOpen && (
        <div className="modal-overlay" onClick={() => setImportOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Importar Plantillas desde JSON</h3>
              <button onClick={() => setImportOpen(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '1.25rem', color: 'var(--color-text-secondary)', lineHeight: 1, padding: 4,
              }}>×</button>
            </div>

            {!importPreview && !importResult && (
              <div
                onDragOver={e => { e.preventDefault(); setImportDragging(true); }}
                onDragLeave={() => setImportDragging(false)}
                onDrop={e => { e.preventDefault(); setImportDragging(false); const f = e.dataTransfer.files[0]; if (f) parseImportFile(f); }}
                onClick={() => importInputRef.current?.click()}
                style={{
                  border: `2px dashed ${importDragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: 8, padding: '40px 24px', textAlign: 'center', cursor: 'pointer',
                  background: importDragging ? 'var(--color-primary-light, #f0f7ff)' : 'var(--color-bg-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>📂</div>
                <p style={{ margin: 0, fontWeight: 500, color: 'var(--color-text-main)' }}>
                  {importFileName || 'Arrastra un archivo .json aquí'}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                  o haz clic para seleccionar
                </p>
                <input ref={importInputRef} type="file" accept=".json" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) parseImportFile(f); }} />
              </div>
            )}

            {importError && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: '0.875rem' }}>
                {importError}
              </div>
            )}

            {importPreview && (
              <div style={{ marginTop: 16 }}>
                <p style={{ margin: '0 0 10px', fontWeight: 500, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  Vista previa — {importPreview.length} {importPreview.length === 1 ? 'plantilla' : 'plantillas'}
                </p>
                <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {importPreview.map((p, i) => (
                    <div key={i} style={{ background: 'var(--color-bg-secondary)', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {p.orden != null && (
                          <span style={{ fontSize: '0.7rem', background: '#e0e7ff', color: '#3730a3', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>
                            #{p.orden}
                          </span>
                        )}
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.nombre}</div>
                      </div>
                      {p.descripcion && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>{p.descripcion}</div>}
                      {p.pasos && p.pasos.length > 0 && (
                        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {p.pasos.map((paso, j) => (
                            <li key={j} style={{ fontSize: '0.8rem', color: 'var(--color-text-main)' }}>
                              {paso.titulo}
                              {paso.usarIa && <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#dbeafe', color: '#1d4ed8', borderRadius: 4, padding: '1px 5px' }}>🤖 IA</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {(!p.pasos || p.pasos.length === 0) && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-tertiary)' }}>Sin pasos definidos</span>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button className="btn btn-secondary" onClick={() => { setImportPreview(null); setImportFileName(''); }}>Cambiar archivo</button>
                  <button className="btn btn-primary" disabled={importLoading} onClick={handleImport}>
                    {importLoading ? 'Importando...' : `Importar ${importPreview.length} ${importPreview.length === 1 ? 'plantilla' : 'plantillas'}`}
                  </button>
                </div>
              </div>
            )}

            {importResult && (
              <div style={{ marginTop: 16 }}>
                <div style={{ padding: '14px 16px', borderRadius: 8, background: '#dcfce7', color: '#15803d', marginBottom: 14 }}>
                  <strong>Importación exitosa</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.875rem' }}>
                    {importResult.plantillasCreadas} {importResult.plantillasCreadas === 1 ? 'plantilla creada' : 'plantillas creadas'} · {importResult.pasosCreados} {importResult.pasosCreados === 1 ? 'paso creado' : 'pasos creados'}
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={() => setImportOpen(false)}>Cerrar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>Plantillas de Actividad</h1>
          <p className="page-description">
            Define actividades reutilizables con un orden de secuencia. El participante debe completar cada plantilla antes de avanzar a la siguiente.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={openImport}>⬆ Importar JSON</button>
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
              <div className="invalid-feedback">El nombre es necesario.</div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>Descripción <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(opcional)</span></label>
              <textarea className="input" placeholder="¿Qué trabajará el participante en esta actividad?"
                value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                rows={3} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>
                Orden en la secuencia <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(opcional)</span>
              </label>
              <input
                className="input"
                type="number"
                min="1"
                placeholder="Ej: 1, 2, 3..."
                value={form.orden}
                onChange={e => setForm({ ...form, orden: e.target.value })}
              />
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--color-text-tertiary)' }}>
                Define el paso en la secuencia. La plantilla anterior debe completarse antes de iniciar esta.
              </p>
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
                    <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {p.orden != null && (
                        <span style={{
                          fontSize: '0.7rem', background: '#e0e7ff', color: '#3730a3',
                          borderRadius: 4, padding: '2px 8px', fontWeight: 700,
                        }}>
                          Paso {p.orden}
                        </span>
                      )}
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
