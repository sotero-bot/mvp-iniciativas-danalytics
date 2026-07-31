import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PromptTemplateField } from '../../components/PromptTemplateField';
import { TranslationPanel, TranslationField } from '../../components/TranslationPanel';
import { TranslationFields, emptyTranslations } from '../../components/TranslationFields';
import { Loading, Alert, Breadcrumb, PageHeader, Button, Field, EmptyState } from '../../components/ui';
import { toast } from '../../components/toast-store';
import { fetchWithErrorMapping, translateError, withAuth } from '../../shared/api/fetchWithErrorMapping';

const PASO_TRANS_FIELDS: TranslationField[] = [
  { key: 'titulo', label: 'Título' },
  { key: 'objetivo', label: 'Objetivo' },
  { key: 'instrucciones', label: 'Instrucciones', multiline: true },
];

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
  translations: emptyTranslations(),
};

export function ActividadPasosPage() {
  const { t } = useTranslation(['methodology', 'common', 'admin']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [pasos, setPasos] = useState<any[]>([]);
  const [nombreActividad, setNombreActividad] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [wasValidated, setWasValidated] = useState(false);
  const [modal, setModal] = useState<{ id: string; titulo: string } | null>(null);
  const [form, setForm] = useState({ titulo: '', objetivo: '', instrucciones: '', orden: 0, translations: emptyTranslations() });

  const [uploadingEjemploId, setUploadingEjemploId] = useState<string | null>(null);
  const [deleteEjemploModal, setDeleteEjemploModal] = useState<{ pasoId: string; titulo: string } | null>(null);

  const handleDeleteEjemplo = async () => {
    if (!deleteEjemploModal) return;
    try {
      const res = await fetch(`${API_URL}/admin/actividades/${id}/pasos/${deleteEjemploModal.pasoId}/ejemplo`, withAuth({
        method: 'DELETE',
      }));
      if (!res.ok && res.status !== 204) { toast.error(t('methodology:pasos.ejemplo.errors.delete_failed')); return; }
      toast.success(t('methodology:pasos.ejemplo.deleted'));
      setDeleteEjemploModal(null);
      loadPasos();
    } catch { toast.error(t('methodology:pasos.ejemplo.errors.delete_connection')); }
  };

  const handleUploadEjemplo = async (paso: any, file: File) => {
    setUploadingEjemploId(paso.id);
    try {
      const presignRes = await fetchWithErrorMapping(`${API_URL}/admin/actividades/${id}/pasos/${paso.id}/presign-ejemplo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' }),
      });
      const { uploadUrl, key } = await presignRes.json();
      const uploadRes = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      if (!uploadRes.ok) { toast.error(t('errors:S3_UPLOAD_FAILED')); return; }
      await fetchWithErrorMapping(`${API_URL}/admin/actividades/${id}/pasos/${paso.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: paso.titulo, objetivo: paso.objetivo, instrucciones: paso.instrucciones, orden: paso.orden, ejemploKey: key }),
      });
      toast.success(t('methodology:pasos.ejemplo.upload_success'));
      loadPasos();
    } catch (err) { toast.error(translateError(err)); }
    finally { setUploadingEjemploId(null); }
  };

  const [activePasoId, setActivePasoId] = useState<string | null>(null);
  const [editingPreguntaId, setEditingPreguntaId] = useState<string | null>(null);
  const [preguntaForm, setPreguntaForm] = useState({ ...PREGUNTA_BLANK });
  const [preguntaWasValidated, setPreguntaWasValidated] = useState(false);
  const [preguntaModal, setPreguntaModal] = useState<{ pasoId: string; id: string; enunciado: string } | null>(null);

  // Panel de traducciones inline (solo pasos)
  const [transOpenPasoId, setTransOpenPasoId] = useState<string | null>(null);

  const loadPasos = async () => {
    try {
      setLoading(true);
      const res = await fetchWithErrorMapping(`${API_URL}/admin/actividades/${id}/pasos`);
      const data = await res.json();
      setPasos(data.pasos);
      setNombreActividad(data.nombre);
      const maxOrden = data.pasos.length > 0 ? Math.max(...data.pasos.map((p: any) => p.orden)) : 0;
      setForm(prev => ({ ...prev, orden: maxOrden + 1 }));
    } catch (err) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPasos(); }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId
        ? `${API_URL}/admin/actividades/${id}/pasos/${editingId}`
        : `${API_URL}/admin/actividades/${id}/pasos`;
      await fetchWithErrorMapping(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      toast.success(editingId ? t('methodology:pasos.toast.updated') : t('methodology:pasos.toast.created'));
      const maxOrden = pasos.length > 0 ? Math.max(...pasos.map((p: any) => p.orden)) : 0;
      setForm({ titulo: '', objetivo: '', instrucciones: '', orden: maxOrden + (editingId ? 1 : 2), translations: emptyTranslations() });
      setShowForm(false);
      setEditingId(null);
      setWasValidated(false);
      loadPasos();
    } catch (err) { toast.error(translateError(err)); }
  };

  const handleEdit = (p: any) => {
    setEditingId(p.id);
    setForm({ titulo: p.titulo, objetivo: p.objetivo || '', instrucciones: p.instrucciones || '', orden: p.orden, translations: p.translations ?? emptyTranslations() });
    setShowForm(true);
    setActivePasoId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setShowForm(false);
    const maxOrden = pasos.length > 0 ? Math.max(...pasos.map((p: any) => p.orden)) : 0;
    setForm({ titulo: '', objetivo: '', instrucciones: '', orden: maxOrden + 1, translations: emptyTranslations() });
    setWasValidated(false);
  };

  const handleDelete = async () => {
    if (!modal) return;
    await fetch(`${API_URL}/admin/actividades/${id}/pasos/${modal.id}`, withAuth({ method: 'DELETE' }));
    toast.success(t('methodology:pasos.toast.deleted'));
    setModal(null);
    loadPasos();
  };

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
      translations: q.translations ?? emptyTranslations(),
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
      await fetchWithErrorMapping(url, {
        method: editingPreguntaId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preguntaForm),
      });
      toast.success(editingPreguntaId ? t('methodology:preguntas.toast.updated') : t('methodology:preguntas.toast.created'));
      cancelPregunta();
      loadPasos();
    } catch (err) { toast.error(translateError(err)); }
  };

  const handleDeletePregunta = async () => {
    if (!preguntaModal) return;
    try {
      await fetchWithErrorMapping(
        `${API_URL}/admin/actividades/${id}/pasos/${preguntaModal.pasoId}/preguntas/${preguntaModal.id}`,
        { method: 'DELETE' },
      );
    } catch (err) {
      toast.error(translateError(err));
      setPreguntaModal(null);
      return;
    }
    toast.success(t('methodology:preguntas.toast.deleted'));
    setPreguntaModal(null);
    loadPasos();
  };

  const breadcrumbItems = [
    { label: t('admin:sidebar.actividades'), to: '/admin/actividades' },
    { label: nombreActividad || t('methodology:pasos.page_title_actividad') },
  ];

  if (loading) return <div className="runner-center"><Loading label={t('methodology:pasos.loading')} /></div>;
  if (error) return (
    <div className="runner-center" style={{ flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Alert variant="danger">{error}</Alert>
      <Button variant="secondary" onClick={() => navigate('/admin/actividades')}>{t('common:buttons.back')}</Button>
    </div>
  );

  return (
    <div>
      <ConfirmModal
        isOpen={!!modal}
        title={t('methodology:pasos.delete_modal.title')}
        message={t('methodology:pasos.delete_modal.message', { titulo: modal?.titulo ?? '' })}
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
      <ConfirmModal
        isOpen={!!deleteEjemploModal}
        title={t('methodology:pasos.ejemplo.delete_modal_title')}
        message={t('methodology:pasos.ejemplo.delete_modal_message', { titulo: deleteEjemploModal?.titulo ?? '' })}
        onConfirm={handleDeleteEjemplo}
        onCancel={() => setDeleteEjemploModal(null)}
      />

      <Breadcrumb items={breadcrumbItems} />

      <PageHeader
        eyebrow={nombreActividad}
        title={t('methodology:pasos.page_title_actividad')}
        actions={!showForm && (
          <Button onClick={() => { setShowForm(true); setActivePasoId(null); }}>
            {t('methodology:pasos.add_button')}
          </Button>
        )}
      />

      {showForm && (
        <div className="card card-accent" style={{ marginBottom: 'var(--space-6)' }}>
          <h3>{editingId ? t('methodology:pasos.edit_section_title') : t('methodology:pasos.create_section_title')}</h3>
          <form
            className={wasValidated ? 'was-validated' : ''}
            onSubmit={(e) => { e.preventDefault(); setWasValidated(true); if (e.currentTarget.checkValidity()) handleSubmit(e); }}
            style={{ marginTop: 'var(--space-4)' }}
            noValidate
          >
            <div className="form-grid">
              <div style={{ gridColumn: 'span 2' }}>
                <Field label={t('methodology:pasos.fields.titulo')} htmlFor="paso-titulo" required
                  error={<div className="invalid-feedback">{t('methodology:pasos.validation.titulo_required')}</div>}>
                  <input id="paso-titulo" className="input" required value={form.titulo}
                    onChange={e => setForm({ ...form, titulo: e.target.value })}
                    placeholder={t('methodology:pasos.placeholders.titulo')} />
                </Field>
              </div>
              <Field label={t('methodology:pasos.fields.orden')} htmlFor="paso-orden" required
                error={<div className="invalid-feedback">{t('methodology:pasos.validation.orden_required')}</div>}>
                <input id="paso-orden" className="input" type="number" required value={form.orden}
                  onChange={e => setForm({ ...form, orden: parseInt(e.target.value) })} />
              </Field>
              <Field label={t('methodology:pasos.fields.objetivo')} htmlFor="paso-objetivo">
                <input id="paso-objetivo" className="input" value={form.objetivo}
                  onChange={e => setForm({ ...form, objetivo: e.target.value })}
                  placeholder={t('methodology:pasos.placeholders.objetivo')} />
              </Field>
              <div style={{ gridColumn: 'span 2' }}>
                <Field label={t('methodology:pasos.fields.instrucciones')} htmlFor="paso-instrucciones">
                  <textarea id="paso-instrucciones" className="input" rows={3} value={form.instrucciones}
                    onChange={e => setForm({ ...form, instrucciones: e.target.value })}
                    placeholder={t('methodology:pasos.placeholders.instrucciones')} />
                </Field>
              </div>
            </div>
            <TranslationFields
              fields={[
                { key: 'titulo', label: t('methodology:pasos.fields.titulo') },
                { key: 'objetivo', label: t('methodology:pasos.fields.objetivo') },
                { key: 'instrucciones', label: t('methodology:pasos.fields.instrucciones'), multiline: true },
              ]}
              values={form.translations}
              onChange={(locale, key, val) => setForm({ ...form, translations: { ...form.translations, [locale]: { ...form.translations[locale], [key]: val } } })}
            />
            <div className="form-footer" style={{ marginTop: 'var(--space-4)' }}>
              <Button type="button" variant="secondary" onClick={handleCancelEdit}>{t('common:buttons.cancel')}</Button>
              <Button type="submit">{editingId ? t('common:buttons.save_changes') : t('methodology:pasos.create_submit')}</Button>
            </div>
          </form>
        </div>
      )}

      {pasos.length === 0 ? (
        <div className="card">
          <EmptyState title={t('methodology:pasos.empty_actividad')} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {pasos.map((p) => {
            const preguntas: any[] = p.preguntas ?? [];
            const isActive = activePasoId === p.id;

            return (
              <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: '1rem 1.25rem', backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                  <span className="status-badge" style={{ background: 'var(--color-primary)', color: 'var(--color-bg-card)', fontWeight: 700, minWidth: 28, justifyContent: 'center' }}>
                    {p.orden}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>{p.titulo}</div>
                    {p.objetivo && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{p.objetivo}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setTransOpenPasoId(transOpenPasoId === p.id ? null : p.id)}
                      aria-label={t('methodology:pasos.translations_toggle')}
                      title={t('methodology:pasos.translations_toggle')}
                    >
                      🌐
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleEdit(p)}>
                      {t('common:buttons.edit')}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setModal({ id: p.id, titulo: p.titulo })}
                      aria-label={t('common:buttons.delete')}
                    >
                      🗑️
                    </Button>
                  </div>
                </div>

                {transOpenPasoId === p.id && (
                  <div style={{ padding: '0 1.25rem 0.75rem', borderBottom: '1px solid var(--color-border)' }}>
                    <TranslationPanel
                      fields={PASO_TRANS_FIELDS}
                      getUrl={(loc) => `${API_URL}/admin/actividades/${id}/pasos/${p.id}/translations?locale=${loc}`}
                      putUrl={(loc) => `${API_URL}/admin/actividades/${id}/pasos/${p.id}/translations/${loc}`}
                    />
                  </div>
                )}

                <div style={{ padding: '0.6rem 1.25rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-page)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('methodology:pasos.ejemplo.label')}</span>
                  {p.ejemploKey ? (
                    <>
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-success-strong)' }}>{t('methodology:pasos.ejemplo.uploaded_badge')}</span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          try {
                            const res = await fetchWithErrorMapping(`${API_URL}/admin/actividades/${id}/pasos/${p.id}/ejemplo-url`);
                            const json = await res.json();
                            if (json.url) window.open(json.url, '_blank');
                          } catch (err) { toast.error(translateError(err)); }
                        }}
                      >{t('methodology:pasos.ejemplo.download_button')}</Button>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>{t('methodology:pasos.ejemplo.no_file')}</span>
                  )}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', fontSize: '0.72rem', background: uploadingEjemploId === p.id ? 'var(--color-border)' : 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-sm)', cursor: uploadingEjemploId === p.id ? 'wait' : 'pointer', fontWeight: 500 }}>
                    {uploadingEjemploId === p.id ? t('methodology:pasos.ejemplo.uploading') : (p.ejemploKey ? t('methodology:pasos.ejemplo.replace_button') : t('methodology:pasos.ejemplo.upload_button'))}
                    <input type="file" style={{ display: 'none' }} disabled={uploadingEjemploId === p.id}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadEjemplo(p, f); e.target.value = ''; }} />
                  </label>
                  {p.ejemploKey && (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={uploadingEjemploId === p.id}
                      onClick={() => setDeleteEjemploModal({ pasoId: p.id, titulo: p.titulo })}
                    >🗑️ {t('common:buttons.delete')}</Button>
                  )}
                </div>

                <div style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {t('methodology:preguntas.section_title', { count: preguntas.length })}
                    </span>
                    {!isActive && (
                      <Button size="sm" onClick={() => openAddPregunta(p.id, preguntas)}>
                        {t('methodology:preguntas.add_button')}
                      </Button>
                    )}
                  </div>

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
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--color-bg-page)', border: '1px solid var(--color-border)' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', minWidth: 20, textAlign: 'center' }}>{q.orden}</span>
                                <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--color-text-main)' }}>{q.enunciado}</span>
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                                  {q.usarIa && (
                                    <span className="status-badge" style={{ background: 'var(--color-primary)', color: 'var(--color-bg-card)', fontSize: '0.65rem' }}>
                                      🤖{q.iaAutomatica ? '⚡' : ''}
                                    </span>
                                  )}
                                  {q.soloArchivo ? (
                                    <span className="status-badge" style={{ background: 'var(--color-info)', color: 'var(--color-bg-card)', fontSize: '0.65rem' }}>📄</span>
                                  ) : q.permitirArchivo ? (
                                    <span className="status-badge" style={{ background: 'var(--color-success-strong)', color: 'var(--color-bg-card)', fontSize: '0.65rem' }}>📎</span>
                                  ) : null}
                                  <Button variant="secondary" size="sm" onClick={() => openEditPregunta(p.id, q)}>
                                    {t('common:buttons.edit')}
                                  </Button>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => setPreguntaModal({ pasoId: p.id, id: q.id, enunciado: q.enunciado })}
                                    aria-label={t('common:buttons.delete')}
                                  >
                                    🗑️
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

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

interface PreguntaFormProps {
  pasoId: string;
  form: typeof PREGUNTA_BLANK;
  setForm: (f: typeof PREGUNTA_BLANK) => void;
  wasValidated: boolean;
  isEditing: boolean;
  onSave: (e: React.FormEvent) => void;
  onCancel: () => void;
  promptApiBase: string | null;
}

function PreguntaForm({ form, setForm, wasValidated, isEditing, onSave, onCancel, promptApiBase }: PreguntaFormProps) {
  const { t } = useTranslation(['methodology', 'common']);
  return (
    <div style={{ border: '1px solid var(--color-primary)', padding: '1rem', background: 'var(--color-bg-accent)' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--color-primary)' }}>
        {isEditing ? t('methodology:preguntas.edit_section_title') : t('methodology:preguntas.create_section_title')}
      </div>
      <form
        className={wasValidated ? 'was-validated' : ''}
        onSubmit={onSave}
        noValidate
      >
        <div className="form-grid">
          <div style={{ gridColumn: 'span 2' }}>
            <Field label={t('methodology:preguntas.fields.enunciado')} htmlFor="pregunta-enunciado" required
              error={<div className="invalid-feedback">{t('methodology:preguntas.validation.enunciado_required')}</div>}>
              <textarea id="pregunta-enunciado" className="input" rows={2} required value={form.enunciado}
                onChange={e => setForm({ ...form, enunciado: e.target.value })}
                placeholder={t('methodology:preguntas.placeholders.enunciado')} />
            </Field>
          </div>

          <Field label={t('methodology:preguntas.fields.orden')} htmlFor="pregunta-orden" required
            error={<div className="invalid-feedback">{t('methodology:preguntas.validation.orden_required')}</div>}>
            <input id="pregunta-orden" className="input" type="number" required min={1} value={form.orden}
              onChange={e => setForm({ ...form, orden: parseInt(e.target.value) })} />
          </Field>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', justifyContent: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none', fontSize: '0.88rem' }}>
              <input type="checkbox" checked={form.permitirArchivo}
                onChange={e => setForm({ ...form, permitirArchivo: e.target.checked, soloArchivo: e.target.checked ? form.soloArchivo : false })}
                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--color-success-strong)' }} />
              <span style={{ fontWeight: 600 }}>{t('methodology:preguntas.options.permitir_archivo')}</span>
            </label>
            {form.permitirArchivo && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none', fontSize: '0.85rem', marginLeft: 8 }}>
                <input type="checkbox" checked={form.soloArchivo}
                  onChange={e => setForm({ ...form, soloArchivo: e.target.checked })}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--color-info)' }} />
                <span>{t('methodology:preguntas.options.solo_archivo')}</span>
              </label>
            )}
            {form.permitirArchivo && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none', fontSize: '0.85rem', marginLeft: 8 }}
                title={t('methodology:preguntas.options.subir_archivo_s3_title')}>
                <input type="checkbox" checked={form.subirArchivoS3}
                  onChange={e => setForm({ ...form, subirArchivoS3: e.target.checked })}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--color-success-strong)' }} />
                <span>{t('methodology:preguntas.options.subir_archivo_s3')}</span>
              </label>
            )}
          </div>

          {form.permitirArchivo && (
            <div style={{ gridColumn: 'span 2' }}>
              <Field label={t('methodology:preguntas.fields.url_plantilla')} htmlFor="pregunta-url-plantilla">
                <input id="pregunta-url-plantilla" className="input" value={form.urlPlantilla}
                  onChange={e => setForm({ ...form, urlPlantilla: e.target.value })}
                  placeholder={t('methodology:preguntas.placeholders.url_plantilla')} />
              </Field>
            </div>
          )}

          <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                    style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
                  <span>{t('methodology:preguntas.options.ia_automatica')}</span>
                </label>
              )}
            </div>
            {form.usarIa && (
              <div style={{ marginTop: '0.5rem' }}>
                <Field
                  label={<>{t('methodology:preguntas.prompt_template_label')} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>{t('methodology:preguntas.prompt_template_optional')}</span></>}
                  htmlFor="pregunta-prompt-template"
                >
                  <PromptTemplateField
                    value={form.urlPromptTemplate}
                    onChange={(v) => setForm({ ...form, urlPromptTemplate: v })}
                    apiBase={promptApiBase}
                  />
                </Field>
                <Field
                  label={<>{t('methodology:preguntas.fields.prompt_ia')} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>{t('methodology:preguntas.prompt_ia_optional')}</span></>}
                  htmlFor="pregunta-prompt-ia"
                >
                  <textarea id="pregunta-prompt-ia" className="input" rows={2} value={form.promptIa}
                    onChange={e => setForm({ ...form, promptIa: e.target.value })}
                    placeholder={t('methodology:preguntas.placeholders.prompt_ia_hereda')} />
                </Field>
              </div>
            )}
          </div>

          <TranslationFields
            fields={[
              { key: 'enunciado', label: t('methodology:preguntas.fields.enunciado'), multiline: true },
            ]}
            values={form.translations}
            onChange={(locale, key, val) => setForm({ ...form, translations: { ...form.translations, [locale]: { ...form.translations[locale], [key]: val } } })}
          />
        </div>

        <div className="form-footer" style={{ marginTop: '0.75rem' }}>
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            {t('common:buttons.cancel')}
          </Button>
          <Button type="submit" size="sm">
            {isEditing ? t('common:buttons.save_changes') : t('methodology:preguntas.add_action')}
          </Button>
        </div>
      </form>
    </div>
  );
}
