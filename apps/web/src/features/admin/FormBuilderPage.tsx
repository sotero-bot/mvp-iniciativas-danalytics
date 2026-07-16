import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader, Field, Modal, Alert, Loading, EmptyState } from '../../components/ui';
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
  const [historialAbierto, setHistorialAbierto] = useState<Record<string, boolean>>({});

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

  // Agrupa por tipo: una tarjeta por formulario con su versión vigente (activa, o la
  // más reciente) al frente y las versiones anteriores plegadas.
  const gruposPorTipo = useMemo(() => {
    const map = new Map<string, Plantilla[]>();
    for (const p of plantillas) {
      const arr = map.get(p.tipoFormulario) ?? [];
      arr.push(p);
      map.set(p.tipoFormulario, arr);
    }
    const tiposOrdenados = [
      ...TIPOS_FORMULARIO.filter(tp => map.has(tp)),
      ...[...map.keys()].filter(tp => !TIPOS_FORMULARIO.includes(tp as (typeof TIPOS_FORMULARIO)[number])),
    ];
    return tiposOrdenados.map(tipo => {
      const versiones = [...map.get(tipo)!].sort((a, b) => b.version - a.version);
      const actual = versiones.find(v => v.activa) ?? versiones[0];
      return { tipo, actual, anteriores: versiones.filter(v => v.id !== actual.id) };
    });
  }, [plantillas]);

  return (
    <div style={{ padding: '2rem' }}>
      <PageHeader
        title={t('formularios:builder.title')}
        description={t('formularios:builder.subtitle')}
        actions={<button className="btn" onClick={() => setModalOpen(true)}>+ {t('formularios:builder.new')}</button>}
      />
      {toast && <div className="toast">{toast}</div>}
      {loading && <Loading label={t('common:loading')} />}
      {!loading && plantillas.length === 0 && <EmptyState title={t('formularios:builder.empty')} />}

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', marginTop: '1rem' }}>
        {gruposPorTipo.map(({ tipo, actual, anteriores }) => {
          const abierto = historialAbierto[tipo] ?? false;
          return (
            <div
              key={tipo}
              className="card"
              style={{
                padding: '1rem',
                cursor: 'pointer',
                border: selected?.id === actual.id ? '2px solid #14B8A6' : undefined,
                opacity: actual.activa ? 1 : 0.55,
              }}
              onClick={() => openPlantilla(actual)}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#14B8A6', textTransform: 'uppercase' }}>
                {t(`formularios:tipos.${actual.tipoFormulario}`)} · {t('formularios:builder.version', { version: actual.version })}
              </div>
              <div style={{ fontWeight: 600, margin: '4px 0' }}>{actual.nombre}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                {actual._count.campos} {t('formularios:builder.campos.title').toLowerCase()} · {t('formularios:builder.respuestas', { count: actual._count.respuestas })} ·{' '}
                {actual.activa ? t('formularios:builder.active') : t('formularios:builder.inactive')}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: '0.8rem' }} onClick={e => e.stopPropagation()}>
                <button className="btn-link" onClick={() => duplicar(actual)}>{t('formularios:builder.duplicate')}</button>
                <button className="btn-link" onClick={() => toggleActiva(actual)}>
                  {actual.activa ? t('formularios:builder.deactivate') : t('formularios:builder.activate')}
                </button>
                {actual.tipoFormulario === 'diagnostico_inicial' && (
                  <Link className="btn-link" to="/admin/diagnostico-inicial-global">
                    {t('formularios:builder.ver_respuestas')}
                  </Link>
                )}
              </div>

              {anteriores.length > 0 && (
                <div style={{ marginTop: 10, borderTop: '1px solid var(--color-border)', paddingTop: 8 }} onClick={e => e.stopPropagation()}>
                  <button
                    className="btn-link"
                    style={{ fontSize: '0.78rem' }}
                    onClick={() => setHistorialAbierto(h => ({ ...h, [tipo]: !abierto }))}
                  >
                    {abierto ? '▾' : '▸'} {t('formularios:builder.versiones_anteriores', { count: anteriores.length })}
                  </button>
                  {abierto && (
                    <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                      {anteriores.map(v => (
                        <div
                          key={v.id}
                          onClick={() => openPlantilla(v)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                            fontSize: '0.78rem', padding: '4px 6px', borderRadius: 6,
                            background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))',
                            cursor: 'pointer', opacity: v.activa ? 1 : 0.7,
                          }}
                        >
                          <span>
                            {t('formularios:builder.version', { version: v.version })} · {t('formularios:builder.respuestas', { count: v._count.respuestas })}
                            {v.activa ? ` · ${t('formularios:builder.active')}` : ''}
                          </span>
                          <span style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                            <button className="btn-link" onClick={() => toggleActiva(v)}>
                              {v.activa ? t('formularios:builder.deactivate') : t('formularios:builder.activate')}
                            </button>
                            <button className="btn-link" onClick={() => duplicar(v)}>{t('formularios:builder.duplicate')}</button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
            <div style={{ marginTop: 10 }}>
              <Alert variant="warning">{t('formularios:builder.immutable_hint')}</Alert>
            </div>
          )}
          {campos.length === 0 && <EmptyState title={t('formularios:builder.campos.empty')} />}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {campos.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px', marginLeft: c.campoPadreId ? 24 : 0 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-secondary)', minWidth: 90 }}>
                  {t(`formularios:tipos_campo.${c.tipoCampo}`)}
                </span>
                <span style={{ flex: 1, fontSize: '0.9rem' }}>
                  {c.etiqueta}
                  {c.esObligatorio && <span style={{ color: 'var(--color-danger)' }}> *</span>}
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
                    <button className="btn-link btn-link-danger" onClick={() => borrarCampo(c)}>
                      {t('formularios:builder.campos.delete')}
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>

          {campoForm && !inmutable && (
            <div style={{ marginTop: 16, borderTop: '1px solid var(--color-border)', paddingTop: 16, maxWidth: 640 }}>
              <Field label={t('formularios:builder.campos.tipo')}>
                <select
                  className="input"
                  value={campoForm.tipoCampo}
                  onChange={e => setCampoForm({ ...campoForm, tipoCampo: e.target.value })}
                >
                  {TIPOS_CAMPO.map(tc => (
                    <option key={tc} value={tc}>{t(`formularios:tipos_campo.${tc}`)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('formularios:builder.campos.etiqueta')}>
                <input
                  className="input"
                  value={campoForm.etiqueta}
                  onChange={e => setCampoForm({ ...campoForm, etiqueta: e.target.value })}
                />
              </Field>
              <Field label={t('formularios:builder.campos.descripcion')}>
                <input
                  className="input"
                  value={campoForm.descripcion}
                  onChange={e => setCampoForm({ ...campoForm, descripcion: e.target.value })}
                />
              </Field>
              <Field label={t('formularios:builder.campos.dimension')}>
                <input
                  className="input"
                  value={campoForm.dimension}
                  onChange={e => setCampoForm({ ...campoForm, dimension: e.target.value })}
                  placeholder={t('formularios:builder.campos.dimension_hint')}
                />
              </Field>
              {grupos.length > 0 && (
                <Field label={t('formularios:builder.campos.padre')}>
                  <select
                    className="input"
                    value={campoForm.campoPadreId}
                    onChange={e => setCampoForm({ ...campoForm, campoPadreId: e.target.value })}
                  >
                    <option value="">{t('formularios:builder.campos.sin_padre')}</option>
                    {grupos.filter(g => g.id !== campoForm.id).map(g => (
                      <option key={g.id} value={g.id}>{g.etiqueta}</option>
                    ))}
                  </select>
                </Field>
              )}
              <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                <input
                  type="checkbox"
                  checked={campoForm.esObligatorio}
                  onChange={e => setCampoForm({ ...campoForm, esObligatorio: e.target.checked })}
                />
                {t('formularios:builder.campos.obligatorio')}
              </label>
              <Field label={t('formularios:builder.campos.config')} hint={configHint}>
                <textarea
                  className="textarea"
                  value={campoForm.configText}
                  onChange={e => setCampoForm({ ...campoForm, configText: e.target.value })}
                  rows={5}
                  style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}
                />
              </Field>
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

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('formularios:builder.form.title_new')}
        maxWidth={420}
        footer={
          <>
            <button className="btn-link" onClick={() => setModalOpen(false)}>{t('formularios:builder.form.cancel')}</button>
            <button className="btn" disabled={saving || !nueva.nombre.trim()} onClick={crearPlantilla}>
              {t('formularios:builder.form.save')}
            </button>
          </>
        }
      >
        <Field label={t('formularios:builder.form.tipo')}>
          <select
            className="input"
            value={nueva.tipoFormulario}
            onChange={e => setNueva({ ...nueva, tipoFormulario: e.target.value })}
          >
            {TIPOS_FORMULARIO.map(tf => (
              <option key={tf} value={tf}>{t(`formularios:tipos.${tf}`)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('formularios:builder.form.nombre')}>
          <input
            className="input"
            value={nueva.nombre}
            onChange={e => setNueva({ ...nueva, nombre: e.target.value })}
          />
        </Field>
        <Field label={t('formularios:builder.form.descripcion')}>
          <textarea
            className="textarea"
            value={nueva.descripcion}
            onChange={e => setNueva({ ...nueva, descripcion: e.target.value })}
            rows={3}
          />
        </Field>
      </Modal>
    </div>
  );
}
