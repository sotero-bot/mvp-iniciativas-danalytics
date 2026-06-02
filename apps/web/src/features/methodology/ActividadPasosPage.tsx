import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PromptTemplateField } from '../../components/PromptTemplateField';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const PREGUNTA_BLANK = {
  enunciado: '',
  orden: 1,
  permitirArchivo: false,
  soloArchivo: false,
  subirArchivoS3: false,
  usarIa: false,
  iaAutomatica: false,
  promptIa: '',
  urlPlantilla: '',
  urlPromptTemplate: '',
};

export function ActividadPasosPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [pasos, setPasos] = useState<any[]>([]);
  const [nombreActividad, setNombreActividad] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Paso form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [wasValidated, setWasValidated] = useState(false);
  const [modal, setModal] = useState<{ id: string; titulo: string } | null>(null);
  const [form, setForm] = useState({ titulo: '', objetivo: '', instrucciones: '', orden: 0 });

  // Ejemplo upload
  const [uploadingEjemploId, setUploadingEjemploId] = useState<string | null>(null);
  const [deleteEjemploModal, setDeleteEjemploModal] = useState<{ pasoId: string; titulo: string } | null>(null);

  const handleDeleteEjemplo = async () => {
    if (!deleteEjemploModal) return;
    try {
      const res = await fetch(`${API_URL}/admin/actividades/${id}/pasos/${deleteEjemploModal.pasoId}/ejemplo`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204) { alert('Error al eliminar el archivo'); return; }
      setDeleteEjemploModal(null);
      loadPasos();
    } catch { alert('Error de conexión al eliminar el archivo'); }
  };

  const handleUploadEjemplo = async (paso: any, file: File) => {
    setUploadingEjemploId(paso.id);
    try {
      const presignRes = await fetch(`${API_URL}/admin/actividades/${id}/pasos/${paso.id}/presign-ejemplo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' }),
      });
      if (!presignRes.ok) { alert('S3 no configurado o error al obtener URL'); return; }
      const { uploadUrl, key } = await presignRes.json();
      const uploadRes = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      if (!uploadRes.ok) { alert('Error al subir el archivo a S3'); return; }
      await fetch(`${API_URL}/admin/actividades/${id}/pasos/${paso.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: paso.titulo, objetivo: paso.objetivo, instrucciones: paso.instrucciones, orden: paso.orden, ejemploKey: key }),
      });
      loadPasos();
    } catch { alert('Error al subir el archivo'); }
    finally { setUploadingEjemploId(null); }
  };

  // Pregunta form
  const [activePasoId, setActivePasoId] = useState<string | null>(null);
  const [editingPreguntaId, setEditingPreguntaId] = useState<string | null>(null);
  const [preguntaForm, setPreguntaForm] = useState({ ...PREGUNTA_BLANK });
  const [preguntaWasValidated, setPreguntaWasValidated] = useState(false);
  const [preguntaModal, setPreguntaModal] = useState<{ pasoId: string; id: string; enunciado: string } | null>(null);

  const loadPasos = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/admin/actividades/${id}/pasos`);
      if (res.status === 404) { setError('Actividad no encontrada'); return; }
      if (!res.ok) throw new Error('Error al cargar pasos');
      const data = await res.json();
      setPasos(data.pasos);
      setNombreActividad(data.nombre);
      const maxOrden = data.pasos.length > 0 ? Math.max(...data.pasos.map((p: any) => p.orden)) : 0;
      setForm(prev => ({ ...prev, orden: maxOrden + 1 }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPasos(); }, [id]);

  // ── Paso CRUD ─────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId
        ? `${API_URL}/admin/actividades/${id}/pasos/${editingId}`
        : `${API_URL}/admin/actividades/${id}/pasos`;
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.status === 400) { alert(data.message || 'Error en los datos'); return; }
      if (res.status === 404) { alert('Actividad/Paso no encontrado'); return; }
      if (res.ok) {
        const maxOrden = pasos.length > 0 ? Math.max(...pasos.map((p: any) => p.orden)) : 0;
        setForm({ titulo: '', objetivo: '', instrucciones: '', orden: maxOrden + (editingId ? 1 : 2) });
        setShowForm(false);
        setEditingId(null);
        setWasValidated(false);
        loadPasos();
      }
    } catch { alert('Error de conexión con el servidor'); }
  };

  const handleEdit = (p: any) => {
    setEditingId(p.id);
    setForm({ titulo: p.titulo, objetivo: p.objetivo || '', instrucciones: p.instrucciones || '', orden: p.orden });
    setShowForm(true);
    setActivePasoId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setShowForm(false);
    const maxOrden = pasos.length > 0 ? Math.max(...pasos.map((p: any) => p.orden)) : 0;
    setForm({ titulo: '', objetivo: '', instrucciones: '', orden: maxOrden + 1 });
    setWasValidated(false);
  };

  const handleDelete = async () => {
    if (!modal) return;
    await fetch(`${API_URL}/admin/actividades/${id}/pasos/${modal.id}`, { method: 'DELETE' });
    setModal(null);
    loadPasos();
  };

  // ── Pregunta CRUD ─────────────────────────────────────────────────────────

  const openAddPregunta = (pasoId: string, preguntas: any[]) => {
    const maxOrden = preguntas.length > 0 ? Math.max(...preguntas.map((q: any) => q.orden)) : 0;
    setActivePasoId(pasoId);
    setEditingPreguntaId(null);
    setPreguntaForm({ ...PREGUNTA_BLANK, orden: maxOrden + 1 });
    setPreguntaWasValidated(false);
    setShowForm(false);
  };

  const openEditPregunta = (pasoId: string, q: any) => {
    setActivePasoId(pasoId);
    setEditingPreguntaId(q.id);
    setPreguntaForm({
      enunciado: q.enunciado || '',
      orden: q.orden,
      permitirArchivo: q.permitirArchivo || false,
      soloArchivo: q.soloArchivo || false,
      subirArchivoS3: q.subirArchivoS3 || false,
      usarIa: q.usarIa || false,
      iaAutomatica: q.iaAutomatica || false,
      promptIa: q.promptIa || '',
      urlPlantilla: q.urlPlantilla || '',
      urlPromptTemplate: q.urlPromptTemplate || '',
    });
    setPreguntaWasValidated(false);
    setShowForm(false);
  };

  const cancelPregunta = () => {
    setActivePasoId(null);
    setEditingPreguntaId(null);
    setPreguntaWasValidated(false);
  };

  const handleSavePregunta = async (pasoId: string, e: React.FormEvent) => {
    e.preventDefault();
    setPreguntaWasValidated(true);
    if (!(e.currentTarget as HTMLFormElement).checkValidity()) return;
    try {
      const url = editingPreguntaId
        ? `${API_URL}/admin/actividades/${id}/pasos/${pasoId}/preguntas/${editingPreguntaId}`
        : `${API_URL}/admin/actividades/${id}/pasos/${pasoId}/preguntas`;
      const res = await fetch(url, {
        method: editingPreguntaId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preguntaForm),
      });
      const data = await res.json();
      if (res.status === 400) { alert(data.message || 'Error en los datos'); return; }
      if (res.ok) {
        cancelPregunta();
        loadPasos();
      }
    } catch { alert('Error de conexión con el servidor'); }
  };

  const handleDeletePregunta = async () => {
    if (!preguntaModal) return;
    const res = await fetch(
      `${API_URL}/admin/actividades/${id}/pasos/${preguntaModal.pasoId}/preguntas/${preguntaModal.id}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || 'No se puede eliminar la pregunta');
      setPreguntaModal(null);
      return;
    }
    setPreguntaModal(null);
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
      <ConfirmModal
        isOpen={!!preguntaModal}
        title="¿Eliminar Pregunta?"
        message={`La pregunta "${(preguntaModal?.enunciado ?? '').slice(0, 60)}..." será eliminada permanentemente.`}
        onConfirm={handleDeletePregunta}
        onCancel={() => setPreguntaModal(null)}
      />
      <ConfirmModal
        isOpen={!!deleteEjemploModal}
        title="¿Eliminar archivo de ejemplo?"
        message={`El archivo de ejemplo del paso "${deleteEjemploModal?.titulo}" se borrará de S3 y de la base de datos. Esta acción no se puede deshacer.`}
        onConfirm={handleDeleteEjemplo}
        onCancel={() => setDeleteEjemploModal(null)}
      />

      <div className="flex justify-between items-center mb-4">
        <div>
          <button className="btn btn-secondary"
            style={{ marginBottom: '10px', padding: '5px 10px', fontSize: '0.8rem' }}
            onClick={() => navigate('/admin/actividades')}>
            ← Volver a Actividades
          </button>
          <h1>Gestión de Pasos</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Actividad: <strong>{nombreActividad}</strong></p>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setActivePasoId(null); }}>
            ➕ Agregar Paso
          </button>
        )}
      </div>

      {/* ── Paso form ── */}
      {showForm && (
        <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--color-primary)' }}>
          <h3>{editingId ? 'Editar Paso' : 'Nuevo Paso'}</h3>
          <form
            className={wasValidated ? 'was-validated' : ''}
            onSubmit={(e) => { e.preventDefault(); setWasValidated(true); if (e.currentTarget.checkValidity()) handleSubmit(e); }}
            style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}
            noValidate
          >
            <div style={{ gridColumn: 'span 2' }}>
              <label className="required-label">Título</label>
              <input className="input" required value={form.titulo}
                onChange={e => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ej: Entrevista de Stakeholders" />
              <div className="invalid-feedback">El título del paso es necesario.</div>
            </div>
            <div>
              <label className="required-label">Orden</label>
              <input className="input" type="number" required value={form.orden}
                onChange={e => setForm({ ...form, orden: parseInt(e.target.value) })} />
              <div className="invalid-feedback">Definí el orden del paso.</div>
            </div>
            <div>
              <label>Objetivo</label>
              <input className="input" value={form.objetivo}
                onChange={e => setForm({ ...form, objetivo: e.target.value })}
                placeholder="¿Qué se busca lograr?" />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Instrucciones</label>
              <textarea className="input" rows={3} value={form.instrucciones}
                onChange={e => setForm({ ...form, instrucciones: e.target.value })}
                placeholder="Guía para el usuario..." />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>Cancelar</button>
              <button type="submit" className="btn btn-primary">{editingId ? 'Guardar Cambios' : 'Guardar Paso'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Paso cards ── */}
      {pasos.length === 0 ? (
        <div className="card">
          <p style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)' }}>
            No hay pasos configurados para esta actividad.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {pasos.map((p) => {
            const preguntas: any[] = p.preguntas ?? [];
            const isActive = activePasoId === p.id;

            return (
              <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Paso header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-bg-page)' }}>
                  <span className="status-badge" style={{ background: 'var(--color-primary)', color: '#fff', fontWeight: 700, minWidth: 28, textAlign: 'center' }}>
                    {p.orden}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>{p.titulo}</div>
                    {p.objetivo && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{p.objetivo}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: '0.78rem' }} onClick={() => handleEdit(p)}>
                      Editar
                    </button>
                    <button className="btn" style={{ padding: '3px 8px', fontSize: '0.78rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}
                      onClick={() => setModal({ id: p.id, titulo: p.titulo })}>
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Ejemplo upload section */}
                <div style={{ padding: '0.6rem 1.25rem', borderBottom: '1px solid var(--color-bg-page)', background: '#FAFAFA', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>Archivo de ejemplo:</span>
                  {p.ejemploKey ? (
                    <>
                      <span style={{ fontSize: '0.78rem', color: '#16a34a' }}>✓ Subido</span>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                        onClick={async () => {
                          try {
                            const res = await fetch(`${API_URL}/admin/actividades/${id}/pasos/${p.id}/ejemplo-url`);
                            const json = await res.json();
                            if (json.url) window.open(json.url, '_blank');
                          } catch { alert('Error al obtener URL de descarga'); }
                        }}
                      >⬇ Descargar</button>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontStyle: 'italic' }}>Sin archivo</span>
                  )}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', fontSize: '0.72rem', background: uploadingEjemploId === p.id ? '#E2E8F0' : 'white', color: '#475569', border: '1px solid #CBD5E1', borderRadius: 5, cursor: uploadingEjemploId === p.id ? 'wait' : 'pointer', fontWeight: 500 }}>
                    {uploadingEjemploId === p.id ? '⏳ Subiendo...' : '📂 ' + (p.ejemploKey ? 'Reemplazar' : 'Subir archivo')}
                    <input type="file" style={{ display: 'none' }} disabled={uploadingEjemploId === p.id}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadEjemplo(p, f); e.target.value = ''; }} />
                  </label>
                  {p.ejemploKey && (
                    <button
                      className="btn"
                      style={{ padding: '2px 8px', fontSize: '0.72rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}
                      disabled={uploadingEjemploId === p.id}
                      onClick={() => setDeleteEjemploModal({ pasoId: p.id, titulo: p.titulo })}
                    >🗑️ Eliminar</button>
                  )}
                </div>

                {/* Preguntas section */}
                <div style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Preguntas ({preguntas.length})
                    </span>
                    {!isActive && (
                      <button className="btn btn-primary" style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                        onClick={() => openAddPregunta(p.id, preguntas)}>
                        ➕ Agregar pregunta
                      </button>
                    )}
                  </div>

                  {/* Pregunta list */}
                  {preguntas.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: isActive ? '1rem' : 0 }}>
                      {preguntas.map((q) => {
                        const isEditingThis = isActive && editingPreguntaId === q.id;
                        return (
                          <div key={q.id}>
                            {isEditingThis ? (
                              <PreguntaForm
                                pasoId={p.id}
                                form={preguntaForm}
                                setForm={setPreguntaForm}
                                wasValidated={preguntaWasValidated}
                                isEditing
                                onSave={(e) => handleSavePregunta(p.id, e)}
                                onCancel={cancelPregunta}
                                promptApiBase={`${API_URL}/admin/actividades/${id}/pasos/${p.id}/preguntas/${q.id}`}
                              />
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6 }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', minWidth: 20, textAlign: 'center' }}>{q.orden}</span>
                                <span style={{ flex: 1, fontSize: '0.88rem', color: '#1E293B' }}>{q.enunciado}</span>
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                  {q.usarIa && (
                                    <span className="status-badge" style={{ background: 'var(--color-primary)', color: '#fff', fontSize: '0.65rem' }}>
                                      🤖{q.iaAutomatica ? '⚡' : ''}
                                    </span>
                                  )}
                                  {q.soloArchivo ? (
                                    <span className="status-badge" style={{ background: '#0369a1', color: '#fff', fontSize: '0.65rem' }}>📄</span>
                                  ) : q.permitirArchivo ? (
                                    <span className="status-badge" style={{ background: '#16a34a', color: '#fff', fontSize: '0.65rem' }}>📎</span>
                                  ) : null}
                                  <button className="btn btn-secondary" style={{ padding: '1px 7px', fontSize: '0.72rem' }}
                                    onClick={() => openEditPregunta(p.id, q)}>
                                    Editar
                                  </button>
                                  <button className="btn" style={{ padding: '1px 6px', fontSize: '0.72rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}
                                    onClick={() => setPreguntaModal({ pasoId: p.id, id: q.id, enunciado: q.enunciado })}>
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add pregunta form */}
                  {isActive && !editingPreguntaId && (
                    <PreguntaForm
                      pasoId={p.id}
                      form={preguntaForm}
                      setForm={setPreguntaForm}
                      wasValidated={preguntaWasValidated}
                      isEditing={false}
                      onSave={(e) => handleSavePregunta(p.id, e)}
                      onCancel={cancelPregunta}
                      promptApiBase={null}
                    />
                  )}

                  {preguntas.length === 0 && !isActive && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '0.5rem 0' }}>
                      Sin preguntas — agregá al menos una.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Pregunta inline form ───────────────────────────────────────────────────

interface PreguntaFormProps {
  pasoId: string;
  form: typeof PREGUNTA_BLANK;
  setForm: (f: typeof PREGUNTA_BLANK) => void;
  wasValidated: boolean;
  isEditing: boolean;
  onSave: (e: React.FormEvent) => void;
  onCancel: () => void;
  /** Base URL del endpoint REST de la pregunta. Null cuando aún no está guardada. */
  promptApiBase: string | null;
}

function PreguntaForm({ form, setForm, wasValidated, isEditing, onSave, onCancel, promptApiBase }: PreguntaFormProps) {
  return (
    <div style={{ border: '1px solid var(--color-primary)', borderRadius: 8, padding: '1rem', background: '#fafbff' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--color-primary)' }}>
        {isEditing ? 'Editar pregunta' : 'Nueva pregunta'}
      </div>
      <form
        className={wasValidated ? 'was-validated' : ''}
        onSubmit={onSave}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}
        noValidate
      >
        <div style={{ gridColumn: 'span 2' }}>
          <label className="required-label">Enunciado</label>
          <textarea className="input" rows={2} required value={form.enunciado}
            onChange={e => setForm({ ...form, enunciado: e.target.value })}
            placeholder="¿Cuál es la pregunta que debe responder el participante?" />
          <div className="invalid-feedback">El enunciado es obligatorio.</div>
        </div>

        <div>
          <label className="required-label">Orden</label>
          <input className="input" type="number" required min={1} value={form.orden}
            onChange={e => setForm({ ...form, orden: parseInt(e.target.value) })} />
          <div className="invalid-feedback">El orden es obligatorio.</div>
        </div>

        {/* Archivo flags */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', justifyContent: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none', fontSize: '0.88rem' }}>
            <input type="checkbox" checked={form.permitirArchivo}
              onChange={e => setForm({ ...form, permitirArchivo: e.target.checked, soloArchivo: e.target.checked ? form.soloArchivo : false })}
              style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#16a34a' }} />
            <span style={{ fontWeight: 600 }}>Permitir archivo</span>
          </label>
          {form.permitirArchivo && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none', fontSize: '0.85rem', marginLeft: 8 }}>
              <input type="checkbox" checked={form.soloArchivo}
                onChange={e => setForm({ ...form, soloArchivo: e.target.checked })}
                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#0369a1' }} />
              <span>Solo documento (sin texto)</span>
            </label>
          )}
          {form.permitirArchivo && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none', fontSize: '0.85rem', marginLeft: 8 }}
              title="Solo activá esto en la pregunta entregable final. El resto se guarda solo en BD.">
              <input type="checkbox" checked={form.subirArchivoS3}
                onChange={e => setForm({ ...form, subirArchivoS3: e.target.checked })}
                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#16a34a' }} />
              <span>Guardar archivo en S3 (entregable final)</span>
            </label>
          )}
        </div>

        {form.permitirArchivo && (
          <div style={{ gridColumn: 'span 2' }}>
            <label>URL plantilla descargable</label>
            <input className="input" value={form.urlPlantilla}
              onChange={e => setForm({ ...form, urlPlantilla: e.target.value })}
              placeholder="Ej: /templates/plantilla-ejemplo.xlsx" />
          </div>
        )}

        {/* IA flags — TODO(IA-por-pregunta): revisar al implementar REQ-11 */}
        <div style={{ gridColumn: 'span 2', borderTop: '1px solid #E2E8F0', paddingTop: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Configuración IA (REQ-11)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none', fontSize: '0.88rem' }}>
              <input type="checkbox" checked={form.usarIa}
                onChange={e => setForm({ ...form, usarIa: e.target.checked, promptIa: e.target.checked ? form.promptIa : '', iaAutomatica: e.target.checked ? form.iaAutomatica : false })}
                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--color-primary)' }} />
              <span style={{ fontWeight: 600 }}>Usar IA en esta pregunta</span>
            </label>
            {form.usarIa && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none', fontSize: '0.85rem', marginLeft: 8 }}>
                <input type="checkbox" checked={form.iaAutomatica}
                  onChange={e => setForm({ ...form, iaAutomatica: e.target.checked })}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#7C3AED' }} />
                <span>IA automática al entrar</span>
              </label>
            )}
          </div>
          {form.usarIa && (
            <div style={{ marginTop: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: '0.875rem' }}>
                  Template de prompt (.md) <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>(opcional — reemplaza el prompt inline)</span>
                </label>
                <PromptTemplateField
                  value={form.urlPromptTemplate}
                  onChange={(v) => setForm({ ...form, urlPromptTemplate: v })}
                  apiBase={promptApiBase}
                />
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <label className="required-label">Prompt IA</label>
                <textarea className="input" rows={2} required={form.usarIa && !form.urlPromptTemplate} value={form.promptIa}
                  onChange={e => setForm({ ...form, promptIa: e.target.value })}
                  placeholder="Instrucciones para el asistente..." />
                <div className="invalid-feedback">Agregá el prompt para la IA (o usa un template de prompt).</div>
              </div>
            </div>
          )}
        </div>

        <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
            {isEditing ? 'Guardar cambios' : 'Agregar pregunta'}
          </button>
        </div>
      </form>
    </div>
  );
}
