import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const TIPOS_FORMULARIO = [
  'diagnostico_inicial',
  'diagnostico_final',
  'feedback',
  'bitacora',
  'plantilla_proyecto',
] as const;

const TIPOS_CAMPO = [
  'texto_corto',
  'texto_largo',
  'numero',
  'likert',
  'opcion_multiple',
  'tabla',
  'grupo_repetible',
] as const;

interface Plantilla {
  id: string;
  tipoFormulario: string;
  nombre: string;
  descripcion: string | null;
  version: number;
  activa: boolean;
  _count: { campos: number; respuestas: number };
}

interface Campo {
  id: string;
  campoPadreId: string | null;
  tipoCampo: string;
  etiqueta: string;
  descripcion: string | null;
  dimension: string | null;
  esObligatorio: boolean;
  orden: number;
  configJson: unknown;
}

interface CampoForm {
  id?: string;
  tipoCampo: string;
  etiqueta: string;
  descripcion: string;
  dimension: string;
  esObligatorio: boolean;
  campoPadreId: string;
  configText: string;
}

const EMPTY_CAMPO: CampoForm = {
  tipoCampo: 'texto_corto',
  etiqueta: '',
  descripcion: '',
  dimension: '',
  esObligatorio: false,
  campoPadreId: '',
  configText: '{}',
};

// RF-22/23/24/25/26: form builder de plantillas globales (IA en Acción).
export function FormBuilderPage() {
  const { t } = useTranslation(['formularios', 'common']);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [selected, setSelected] = useState<Plantilla | null>(null);
  const [campos, setCampos] = useState<Campo[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [nueva, setNueva] = useState({ tipoFormulario: 'diagnostico_inicial', nombre: '', descripcion: '' });
  const [campoForm, setCampoForm] = useState<CampoForm | null>(null);
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadPlantillas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/plantillas-formulario`);
      setPlantillas(await res.json());
    } catch (err) {
      showToast(translateError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCampos = useCallback(async (plantillaId: string) => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/plantillas-formulario/${plantillaId}/campos`);
      setCampos(await res.json());
    } catch (err) {
      showToast(translateError(err));
    }
  }, []);

  useEffect(() => {
    loadPlantillas();
  }, [loadPlantillas]);

  const openPlantilla = (p: Plantilla) => {
    setSelected(p);
    setCampoForm(null);
    loadCampos(p.id);
  };

  const inmutable = (selected?._count.respuestas ?? 0) > 0;

  const crearPlantilla = async () => {
    setSaving(true);
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/plantillas-formulario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoFormulario: nueva.tipoFormulario,
          nombre: nueva.nombre,
          descripcion: nueva.descripcion || null,
        }),
      });
      setModalOpen(false);
      setNueva({ tipoFormulario: 'diagnostico_inicial', nombre: '', descripcion: '' });
      await loadPlantillas();
    } catch (err) {
      showToast(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  const duplicar = async (p: Plantilla) => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/plantillas-formulario/${p.id}/duplicar`, { method: 'POST' });
      setSelected(null);
      await loadPlantillas();
    } catch (err) {
      showToast(translateError(err));
    }
  };

  const toggleActiva = async (p: Plantilla) => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/plantillas-formulario/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activa: !p.activa }),
      });
      await loadPlantillas();
    } catch (err) {
      showToast(translateError(err));
    }
  };

  const guardarCampo = async () => {
    if (!selected || !campoForm) return;
    let config: unknown;
    try {
      config = campoForm.configText.trim() ? JSON.parse(campoForm.configText) : {};
    } catch {
      showToast(t('formularios:builder.campos.config_invalid_json'));
      return;
    }
    const body = {
      tipoCampo: campoForm.tipoCampo,
      etiqueta: campoForm.etiqueta,
      descripcion: campoForm.descripcion || null,
      dimension: campoForm.dimension || null,
      esObligatorio: campoForm.esObligatorio,
      campoPadreId: campoForm.campoPadreId || null,
      configJson: config,
    };
    setSaving(true);
    try {
      if (campoForm.id) {
        await fetchWithErrorMapping(`${API_URL}/admin/campos/${campoForm.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetchWithErrorMapping(`${API_URL}/admin/plantillas-formulario/${selected.id}/campos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      setCampoForm(null);
      await loadCampos(selected.id);
    } catch (err) {
      showToast(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  const borrarCampo = async (campo: Campo) => {
    if (!selected) return;
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/campos/${campo.id}`, { method: 'DELETE' });
      await loadCampos(selected.id);
    } catch (err) {
      showToast(translateError(err));
    }
  };

  const mover = async (index: number, delta: -1 | 1) => {
    if (!selected) return;
    const destino = index + delta;
    if (destino < 0 || destino >= campos.length) return;
    const reordenado = [...campos];
    [reordenado[index], reordenado[destino]] = [reordenado[destino], reordenado[index]];
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/plantillas-formulario/${selected.id}/campos/orden`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orden: reordenado.map((c, i) => ({ id: c.id, orden: i + 1 })) }),
      });
      await loadCampos(selected.id);
    } catch (err) {
      showToast(translateError(err));
    }
  };

  const configHint = useMemo(() => {
    switch (campoForm?.tipoCampo) {
      case 'opcion_multiple':
        return t('formularios:builder.campos.config_hint_opcion_multiple');
      case 'likert':
        return t('formularios:builder.campos.config_hint_likert');
      case 'tabla':
        return t('formularios:builder.campos.config_hint_tabla');
      default:
        return t('formularios:builder.campos.config_hint_default');
    }
  }, [campoForm?.tipoCampo, t]);

  const grupos = campos.filter(c => c.tipoCampo === 'grupo_repetible');

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', margin: 0 }}>{t('formularios:builder.title')}</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: 6 }}>
            {t('formularios:builder.subtitle')}
          </p>
        </div>
        <button className="btn" onClick={() => setModalOpen(true)}>+ {t('formularios:builder.new')}</button>
      </div>
      {toast && <div className="toast">{toast}</div>}
      {loading && <p>{t('common:loading')}</p>}
      {!loading && plantillas.length === 0 && <p>{t('formularios:builder.empty')}</p>}

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', marginTop: '1rem' }}>
        {plantillas.map(p => (
          <div
            key={p.id}
            className="card"
            style={{
              padding: '1rem',
              cursor: 'pointer',
              border: selected?.id === p.id ? '2px solid #14B8A6' : undefined,
              opacity: p.activa ? 1 : 0.55,
            }}
            onClick={() => openPlantilla(p)}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#14B8A6', textTransform: 'uppercase' }}>
              {t(`formularios:tipos.${p.tipoFormulario}`)} · {t('formularios:builder.version', { version: p.version })}
            </div>
            <div style={{ fontWeight: 600, margin: '4px 0' }}>{p.nombre}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
              {p._count.campos} {t('formularios:builder.campos.title').toLowerCase()} · {t('formularios:builder.respuestas', { count: p._count.respuestas })} ·{' '}
              {p.activa ? t('formularios:builder.active') : t('formularios:builder.inactive')}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: '0.8rem' }} onClick={e => e.stopPropagation()}>
              <button className="btn-link" onClick={() => duplicar(p)}>{t('formularios:builder.duplicate')}</button>
              <button className="btn-link" onClick={() => toggleActiva(p)}>
                {p.activa ? t('formularios:builder.deactivate') : t('formularios:builder.activate')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="card" style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
              {t('formularios:builder.campos.title')} — {selected.nombre}
            </h2>
            {!inmutable && (
              <button className="btn" onClick={() => setCampoForm({ ...EMPTY_CAMPO })}>
                + {t('formularios:builder.campos.new')}
              </button>
            )}
          </div>
          {inmutable && (
            <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#78350F', padding: '8px 12px', borderRadius: 8, fontSize: '0.82rem', marginTop: 10 }}>
              {t('formularios:builder.immutable_hint')}
            </div>
          )}
          {campos.length === 0 && <p style={{ marginTop: 12 }}>{t('formularios:builder.campos.empty')}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {campos.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--color-border, #E2E8F0)', borderRadius: 8, padding: '8px 12px', marginLeft: c.campoPadreId ? 24 : 0 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', minWidth: 90 }}>
                  {t(`formularios:tipos_campo.${c.tipoCampo}`)}
                </span>
                <span style={{ flex: 1, fontSize: '0.9rem' }}>
                  {c.etiqueta}
                  {c.esObligatorio && <span style={{ color: '#DC2626' }}> *</span>}
                  {c.dimension && (
                    <span style={{ fontSize: '0.72rem', color: '#0D9488', marginLeft: 8 }}>[{c.dimension}]</span>
                  )}
                </span>
                {!inmutable && (
                  <span style={{ display: 'flex', gap: 6, fontSize: '0.8rem' }}>
                    <button className="btn-link" title={t('formularios:builder.campos.up')} onClick={() => mover(i, -1)}>↑</button>
                    <button className="btn-link" title={t('formularios:builder.campos.down')} onClick={() => mover(i, 1)}>↓</button>
                    <button
                      className="btn-link"
                      onClick={() =>
                        setCampoForm({
                          id: c.id,
                          tipoCampo: c.tipoCampo,
                          etiqueta: c.etiqueta,
                          descripcion: c.descripcion ?? '',
                          dimension: c.dimension ?? '',
                          esObligatorio: c.esObligatorio,
                          campoPadreId: c.campoPadreId ?? '',
                          configText: JSON.stringify(c.configJson ?? {}, null, 2),
                        })
                      }
                    >
                      {t('formularios:builder.campos.edit')}
                    </button>
                    <button className="btn-link" style={{ color: '#B91C1C' }} onClick={() => borrarCampo(c)}>
                      {t('formularios:builder.campos.delete')}
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>

          {campoForm && !inmutable && (
            <div style={{ marginTop: 16, borderTop: '1px solid #E2E8F0', paddingTop: 16, display: 'grid', gap: 10, maxWidth: 640 }}>
              <label style={{ fontSize: '0.82rem' }}>
                {t('formularios:builder.campos.tipo')}
                <select
                  className="input"
                  value={campoForm.tipoCampo}
                  onChange={e => setCampoForm({ ...campoForm, tipoCampo: e.target.value })}
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                >
                  {TIPOS_CAMPO.map(tc => (
                    <option key={tc} value={tc}>{t(`formularios:tipos_campo.${tc}`)}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: '0.82rem' }}>
                {t('formularios:builder.campos.etiqueta')}
                <input
                  className="input"
                  value={campoForm.etiqueta}
                  onChange={e => setCampoForm({ ...campoForm, etiqueta: e.target.value })}
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: '0.82rem' }}>
                {t('formularios:builder.campos.descripcion')}
                <input
                  className="input"
                  value={campoForm.descripcion}
                  onChange={e => setCampoForm({ ...campoForm, descripcion: e.target.value })}
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: '0.82rem' }}>
                {t('formularios:builder.campos.dimension')}
                <input
                  className="input"
                  value={campoForm.dimension}
                  onChange={e => setCampoForm({ ...campoForm, dimension: e.target.value })}
                  placeholder={t('formularios:builder.campos.dimension_hint')}
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                />
              </label>
              {grupos.length > 0 && (
                <label style={{ fontSize: '0.82rem' }}>
                  {t('formularios:builder.campos.padre')}
                  <select
                    className="input"
                    value={campoForm.campoPadreId}
                    onChange={e => setCampoForm({ ...campoForm, campoPadreId: e.target.value })}
                    style={{ display: 'block', width: '100%', marginTop: 4 }}
                  >
                    <option value="">{t('formularios:builder.campos.sin_padre')}</option>
                    {grupos.filter(g => g.id !== campoForm.id).map(g => (
                      <option key={g.id} value={g.id}>{g.etiqueta}</option>
                    ))}
                  </select>
                </label>
              )}
              <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={campoForm.esObligatorio}
                  onChange={e => setCampoForm({ ...campoForm, esObligatorio: e.target.checked })}
                />
                {t('formularios:builder.campos.obligatorio')}
              </label>
              <label style={{ fontSize: '0.82rem' }}>
                {t('formularios:builder.campos.config')}
                <textarea
                  className="textarea"
                  value={campoForm.configText}
                  onChange={e => setCampoForm({ ...campoForm, configText: e.target.value })}
                  rows={5}
                  style={{ display: 'block', width: '100%', marginTop: 4, fontFamily: 'monospace', fontSize: '0.78rem' }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>{configHint}</span>
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn" disabled={saving || !campoForm.etiqueta.trim()} onClick={guardarCampo}>
                  {t('formularios:builder.campos.save')}
                </button>
                <button className="btn-link" onClick={() => setCampoForm(null)}>
                  {t('formularios:builder.campos.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ padding: '1.5rem', width: 420, background: 'var(--color-surface, #fff)' }}>
            <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>{t('formularios:builder.form.title_new')}</h2>
            <label style={{ fontSize: '0.82rem', display: 'block', marginBottom: 10 }}>
              {t('formularios:builder.form.tipo')}
              <select
                className="input"
                value={nueva.tipoFormulario}
                onChange={e => setNueva({ ...nueva, tipoFormulario: e.target.value })}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              >
                {TIPOS_FORMULARIO.map(tf => (
                  <option key={tf} value={tf}>{t(`formularios:tipos.${tf}`)}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: '0.82rem', display: 'block', marginBottom: 10 }}>
              {t('formularios:builder.form.nombre')}
              <input
                className="input"
                value={nueva.nombre}
                onChange={e => setNueva({ ...nueva, nombre: e.target.value })}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <label style={{ fontSize: '0.82rem', display: 'block', marginBottom: 14 }}>
              {t('formularios:builder.form.descripcion')}
              <textarea
                className="textarea"
                value={nueva.descripcion}
                onChange={e => setNueva({ ...nueva, descripcion: e.target.value })}
                rows={3}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-link" onClick={() => setModalOpen(false)}>{t('formularios:builder.form.cancel')}</button>
              <button className="btn" disabled={saving || !nueva.nombre.trim()} onClick={crearPlantilla}>
                {t('formularios:builder.form.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
