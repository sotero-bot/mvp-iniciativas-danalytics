import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PromptTemplateField } from '../../components/PromptTemplateField';
import { fetchWithErrorMapping, translateError, ApiError } from '../../shared/api/fetchWithErrorMapping';

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

export function PlantillaPasosPage() {
  const { t } = useTranslation(['methodology', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [pasos, setPasos] = useState<any[]>([]);
  const [nombrePlantilla, setNombrePlantilla] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Paso form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [wasValidated, setWasValidated] = useState(false);
  const [modal, setModal] = useState<{ id: string; titulo: string } | null>(null);
  const [form, setForm] = useState({ titulo: '', objetivo: '', instrucciones: '', orden: 0 });

  // Pregunta form
  const [activePasoId, setActivePasoId] = useState<string | null>(null);
  const [editingPreguntaId, setEditingPreguntaId] = useState<string | null>(null);
  const [preguntaForm, setPreguntaForm] = useState({ ...PREGUNTA_BLANK });
  const [preguntaWasValidated, setPreguntaWasValidated] = useState(false);
  const [preguntaModal, setPreguntaModal] = useState<{ pasoId: string; id: string; enunciado: string } | null>(null);

  const loadPasos = async () => {
    try {
      setLoading(true);
      const res = await fetchWithErrorMapping(`${API_URL}/admin/plantillas/${id}/pasos`);
      const data = await res.json();
      setPasos(data.pasos);
      setNombrePlantilla(data.nombre);
      const maxOrden = data.pasos.length > 0 ? Math.max(...data.pasos.map((p: any) => p.orden)) : 0;
      setForm(prev => ({ ...prev, orden: maxOrden + 1 }));
    } catch (err: any) {
      if (err instanceof ApiError && err.statusCode === 404) {
        setError(t('methodology:pasos.errors.plantilla_not_found'));
      } else {
        setError(translateError(err) || t('methodology:pasos.errors.load_failed'));
      }
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
        ? `${API_URL}/admin/plantillas/${id}/pasos/${editingId}`
        : `${API_URL}/admin/plantillas/${id}/pasos`;
      await fetchWithErrorMapping(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const maxOrden = pasos.length > 0 ? Math.max(...pasos.map((p: any) => p.orden)) : 0;
      setForm({ titulo: '', objetivo: '', instrucciones: '', orden: maxOrden + (editingId ? 1 : 2) });
      setShowForm(false);
      setEditingId(null);
      setWasValidated(false);
      loadPasos();
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        alert(t('methodology:pasos.errors.paso_not_found_plantilla'));
      } else {
        alert(translateError(err) || t('methodology:pasos.errors.connection_error'));
      }
    }
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
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/plantillas/${id}/pasos/${modal.id}`, { method: 'DELETE' });
      setModal(null);
      loadPasos();
    } catch (err) {
      alert(translateError(err));
    }
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
        ? `${API_URL}/admin/plantillas/${id}/pasos/${pasoId}/preguntas/${editingPreguntaId}`
        : `${API_URL}/admin/plantillas/${id}/pasos/${pasoId}/preguntas`;
      await fetchWithErrorMapping(url, {
        method: editingPreguntaId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preguntaForm),
      });
      cancelPregunta();
      loadPasos();
    } catch (err) {
      alert(translateError(err) || t('methodology:preguntas.errors.connection_error'));
    }
  };

  const handleDeletePregunta = async () => {
    if (!preguntaModal) return;
    try {
      await fetchWithErrorMapping(
        `${API_URL}/admin/plantillas/${id}/pasos/${preguntaModal.pasoId}/preguntas/${preguntaModal.id}`,
        { method: 'DELETE' },
      );
      setPreguntaModal(null);
      loadPasos();
    } catch (err) {
      alert(translateError(err) || t('methodology:preguntas.errors.delete_failed'));
      setPreguntaModal(null);
    }
  };

  if (loading) return <div className="runner-center">{t('methodology:pasos.loading')}</div>;
  if (error) return (
    <div className="runner-center" style={{ flexDirection: 'column', gap: '1rem' }}>
      <div style={{ color: '#ef4444' }}>{error}</div>
      <button className="btn btn-secondary" onClick={() => navigate('/admin/plantillas')}>{t('methodology:pasos.back')}</button>
    </div>
  );

  return (
    <div className="layout-content">
      <ConfirmModal
        isOpen={!!modal}
        title={t('methodology:pasos.delete_modal.title')}
        message={t('methodology:pasos.delete_modal.message_plantilla', { titulo: modal?.titulo ?? '' })}
        onConfirm={handleDelete}
        onCancel={() => setModal(null)}
      />
      <ConfirmModal
        isOpen={!!preguntaModal}
        title={t('methodology:preguntas.delete_modal.title')}
        message={t('methodology:preguntas.delete_modal.message', { enunciado: (preguntaModal?.enunciado ?? '').slice(0, 60) })}
        onConfirm={handleDeletePregunta}
        onCancel={() => setPreguntaModal(null)}
      />

      <div className="flex justify-between items-center mb-4">
        <div>
          <button className="btn btn-secondary"
            style={{ marginBottom: '10px', padding: '5px 10px', fontSize: '0.8rem' }}
            onClick={() => navigate('/admin/plantillas')}>
            {t('methodology:pasos.back_to_plantillas')}
          </button>
          <h1>{t('methodology:pasos.page_title_plantilla')}</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>{t('methodology:pasos.plantilla_label')} <strong>{nombrePlantilla}</strong></p>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setActivePasoId(null); }}>
            {t('methodology:pasos.add_button')}
          </button>
        )}
      </div>

      {/* ── Paso form ── */}
      {showForm && (
        <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--color-primary)' }}>
          <h3>{editingId ? t('methodology:pasos.edit_section_title') : t('methodology:pasos.create_section_title')}</h3>
          <form
            className={wasValidated ? 'was-validated' : ''}
            onSubmit={(e) => { e.preventDefault(); setWasValidated(true); if (e.currentTarget.checkValidity()) handleSubmit(e); }}
            style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}
            noValidate
          >
            <div style={{ gridColumn: 'span 2' }}>
              <label className="required-label">{t('methodology:pasos.fields.titulo')}</label>
              <input className="input" required value={form.titulo}
                onChange={e => setForm({ ...form, titulo: e.target.value })}
                placeholder={t('methodology:pasos.placeholders.titulo')} />
              <div className="invalid-feedback">{t('methodology:pasos.validation.titulo_required')}</div>
            </div>
            <div>
              <label className="required-label">{t('methodology:pasos.fields.orden')}</label>
              <input className="input" type="number" required value={form.orden}
                onChange={e => setForm({ ...form, orden: parseInt(e.target.value) })} />
              <div className="invalid-feedback">{t('methodology:pasos.validation.orden_required')}</div>
            </div>
            <div>
              <label>{t('methodology:pasos.fields.objetivo')}</label>
              <input className="input" value={form.objetivo}
                onChange={e => setForm({ ...form, objetivo: e.target.value })}
                placeholder={t('methodology:pasos.placeholders.objetivo')} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>{t('methodology:pasos.fields.instrucciones')}</label>
              <textarea className="input" rows={3} value={form.instrucciones}
                onChange={e => setForm({ ...form, instrucciones: e.target.value })}
                placeholder={t('methodology:pasos.placeholders.instrucciones_plantilla')} />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>{t('common:buttons.cancel')}</button>
              <button type="submit" className="btn btn-primary">{editingId ? t('methodology:pasos.save_changes') : t('methodology:pasos.save_paso')}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Paso cards ── */}
      {pasos.length === 0 ? (
        <div className="card">
          <p style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)' }}>
            {t('methodology:pasos.empty_plantilla')}
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
                      {t('common:buttons.edit')}
                    </button>
                    <button className="btn" style={{ padding: '3px 8px', fontSize: '0.78rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}
                      onClick={() => setModal({ id: p.id, titulo: p.titulo })}>
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Preguntas section */}
                <div style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {t('methodology:preguntas.section_title', { count: preguntas.length })}
                    </span>
                    {!isActive && (
                      <button className="btn btn-primary" style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                        onClick={() => openAddPregunta(p.id, preguntas)}>
                        {t('methodology:preguntas.add_button')}
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
                                promptApiBase={`${API_URL}/admin/plantillas/${id}/pasos/${p.id}/preguntas/${q.id}`}
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
                                    {t('common:buttons.edit')}
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
                      {t('methodology:preguntas.empty')}
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
  const { t } = useTranslation(['methodology', 'common']);
  return (
    <div style={{ border: '1px solid var(--color-primary)', borderRadius: 8, padding: '1rem', background: '#fafbff' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--color-primary)' }}>
        {isEditing ? t('methodology:preguntas.edit_section_title') : t('methodology:preguntas.create_section_title')}
      </div>
      <form
        className={wasValidated ? 'was-validated' : ''}
        onSubmit={onSave}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}
        noValidate
      >
        <div style={{ gridColumn: 'span 2' }}>
          <label className="required-label">{t('methodology:preguntas.fields.enunciado')}</label>
          <textarea className="input" rows={2} required value={form.enunciado}
            onChange={e => setForm({ ...form, enunciado: e.target.value })}
            placeholder={t('methodology:preguntas.placeholders.enunciado')} />
          <div className="invalid-feedback">{t('methodology:preguntas.validation.enunciado_required')}</div>
        </div>

        <div>
          <label className="required-label">{t('methodology:preguntas.fields.orden')}</label>
          <input className="input" type="number" required min={1} value={form.orden}
            onChange={e => setForm({ ...form, orden: parseInt(e.target.value) })} />
          <div className="invalid-feedback">{t('methodology:preguntas.validation.orden_required')}</div>
        </div>

        {/* Archivo flags */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', justifyContent: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none', fontSize: '0.88rem' }}>
            <input type="checkbox" checked={form.permitirArchivo}
              onChange={e => setForm({ ...form, permitirArchivo: e.target.checked, soloArchivo: e.target.checked ? form.soloArchivo : false })}
              style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#16a34a' }} />
            <span style={{ fontWeight: 600 }}>{t('methodology:preguntas.options.permitir_archivo')}</span>
          </label>
          {form.permitirArchivo && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none', fontSize: '0.85rem', marginLeft: 8 }}>
              <input type="checkbox" checked={form.soloArchivo}
                onChange={e => setForm({ ...form, soloArchivo: e.target.checked })}
                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#0369a1' }} />
              <span>{t('methodology:preguntas.options.solo_archivo')}</span>
            </label>
          )}
          {form.permitirArchivo && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none', fontSize: '0.85rem', marginLeft: 8 }}
              title={t('methodology:preguntas.options.subir_archivo_s3_title')}>
              <input type="checkbox" checked={form.subirArchivoS3}
                onChange={e => setForm({ ...form, subirArchivoS3: e.target.checked })}
                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#16a34a' }} />
              <span>{t('methodology:preguntas.options.subir_archivo_s3')}</span>
            </label>
          )}
        </div>

        {form.permitirArchivo && (
          <div style={{ gridColumn: 'span 2' }}>
            <label>{t('methodology:preguntas.fields.url_plantilla')}</label>
            <input className="input" value={form.urlPlantilla}
              onChange={e => setForm({ ...form, urlPlantilla: e.target.value })}
              placeholder={t('methodology:preguntas.placeholders.url_plantilla')} />
          </div>
        )}

        {/* IA flags — TODO(IA-por-pregunta): revisar al implementar REQ-11 */}
        <div style={{ gridColumn: 'span 2', borderTop: '1px solid #E2E8F0', paddingTop: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('methodology:preguntas.ia_config_title')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none', fontSize: '0.88rem' }}>
              <input type="checkbox" checked={form.usarIa}
                onChange={e => setForm({ ...form, usarIa: e.target.checked, promptIa: e.target.checked ? form.promptIa : '', iaAutomatica: e.target.checked ? form.iaAutomatica : false })}
                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--color-primary)' }} />
              <span style={{ fontWeight: 600 }}>{t('methodology:preguntas.options.usar_ia')}</span>
            </label>
            {form.usarIa && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none', fontSize: '0.85rem', marginLeft: 8 }}>
                <input type="checkbox" checked={form.iaAutomatica}
                  onChange={e => setForm({ ...form, iaAutomatica: e.target.checked })}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#7C3AED' }} />
                <span>{t('methodology:preguntas.options.ia_automatica')}</span>
              </label>
            )}
          </div>
          {form.usarIa && (
            <div style={{ marginTop: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: '0.875rem' }}>
                  {t('methodology:preguntas.prompt_template_label')} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>{t('methodology:preguntas.prompt_template_optional')}</span>
                </label>
                <PromptTemplateField
                  value={form.urlPromptTemplate}
                  onChange={(v) => setForm({ ...form, urlPromptTemplate: v })}
                  apiBase={promptApiBase}
                />
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <label className="required-label">{t('methodology:pasos.fields.prompt_ia')}</label>
                <textarea className="input" rows={2} required={form.usarIa && !form.urlPromptTemplate} value={form.promptIa}
                  onChange={e => setForm({ ...form, promptIa: e.target.value })}
                  placeholder={t('methodology:preguntas.placeholders.prompt_ia')} />
                <div className="invalid-feedback">{t('methodology:preguntas.validation.prompt_required')}</div>
              </div>
            </div>
          )}
        </div>

        <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={onCancel}>
            {t('common:buttons.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
            {isEditing ? t('methodology:preguntas.save_changes') : t('methodology:preguntas.add_action')}
          </button>
        </div>
      </form>
    </div>
  );
}
