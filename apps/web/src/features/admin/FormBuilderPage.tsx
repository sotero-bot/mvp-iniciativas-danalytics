import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Breadcrumb, PageHeader, Button, Field, Modal, Alert, Loading, EmptyState } from '../../components/ui';
import { ConfirmModal } from '../../components/ConfirmModal';
import { toast } from '../../components/toast-store';
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
  const { t } = useTranslation(['formularios', 'common', 'admin']);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [selected, setSelected] = useState<Plantilla | null>(null);
  const [campos, setCampos] = useState<Campo[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [nueva, setNueva] = useState({ tipoFormulario: 'diagnostico_inicial', nombre: '', descripcion: '' });
  const [campoForm, setCampoForm] = useState<CampoForm | null>(null);
  const [campoAEliminar, setCampoAEliminar] = useState<Campo | null>(null);
  const [saving, setSaving] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState<Record<string, boolean>>({});

  const loadPlantillas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/plantillas-formulario`);
      setPlantillas(await res.json());
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCampos = useCallback(async (plantillaId: string) => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/plantillas-formulario/${plantillaId}/campos`);
      setCampos(await res.json());
    } catch (err) {
      toast.error(translateError(err));
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
      toast.success(t('formularios:builder.toast.created'));
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  const duplicar = async (p: Plantilla) => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/plantillas-formulario/${p.id}/duplicar`, { method: 'POST' });
      setSelected(null);
      await loadPlantillas();
      toast.success(t('formularios:builder.toast.duplicated'));
    } catch (err) {
      toast.error(translateError(err));
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
      toast.success(t(p.activa ? 'formularios:builder.toast.deactivated' : 'formularios:builder.toast.activated'));
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const guardarCampo = async () => {
    if (!selected || !campoForm) return;
    let config: unknown;
    try {
      config = campoForm.configText.trim() ? JSON.parse(campoForm.configText) : {};
    } catch {
      toast.error(t('formularios:builder.campos.config_invalid_json'));
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
      toast.success(t('formularios:builder.toast.campo_saved'));
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  const borrarCampo = async (campo: Campo) => {
    if (!selected) return;
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/campos/${campo.id}`, { method: 'DELETE' });
      await loadCampos(selected.id);
      toast.success(t('formularios:builder.toast.campo_deleted'));
    } catch (err) {
      toast.error(translateError(err));
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
      toast.success(t('formularios:builder.toast.reordered'));
    } catch (err) {
      toast.error(translateError(err));
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
    <>
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/admin/inicio' },
          { label: t('admin:sidebar.formularios') },
        ]}
      />
      <PageHeader
        title={t('formularios:builder.title')}
        description={<><strong>{t('admin:sidebar.ia_en_accion_label')}</strong> — {t('formularios:builder.subtitle')}</>}
        actions={
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            + {t('formularios:builder.new')}
          </Button>
        }
      />
      {loading && <Loading label={t('common:loading')} />}
      {!loading && plantillas.length === 0 && <EmptyState title={t('formularios:builder.empty')} />}

      {!loading && plantillas.length > 0 && (
      <div className="section-card home-panel" style={{ marginTop: 'var(--space-4)' }}>
        <div className="section-card-header">
          <span className="section-card-title">{t('formularios:builder.list_title')}</span>
          <span className="count-badge">{gruposPorTipo.length}</span>
        </div>
        <div className="section-card-body">
      <div style={{ display: 'grid', gap: 'var(--space-3)', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {gruposPorTipo.map(({ tipo, actual, anteriores }) => {
          const abierto = historialAbierto[tipo] ?? false;
          return (
            <div
              key={tipo}
              className="card"
              style={{
                padding: 'var(--space-4)',
                cursor: 'pointer',
                border: selected?.id === actual.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                opacity: actual.activa ? 1 : 0.55,
              }}
              onClick={() => openPlantilla(actual)}
            >
              <div className="eyebrow">
                {t(`formularios:tipos.${actual.tipoFormulario}`)} · {t('formularios:builder.version', { version: actual.version })}
              </div>
              <div style={{ fontWeight: 600, margin: 'var(--space-1) 0' }}>{actual.nombre}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                {actual._count.campos} {t('formularios:builder.campos.title').toLowerCase()} · {t('formularios:builder.respuestas', { count: actual._count.respuestas })} ·{' '}
                {actual.activa ? t('formularios:builder.active') : t('formularios:builder.inactive')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }} onClick={e => e.stopPropagation()}>
                <Button variant="secondary" size="sm" onClick={() => duplicar(actual)}>{t('formularios:builder.duplicate')}</Button>
                <Button variant={actual.activa ? 'danger' : 'success'} size="sm" onClick={() => toggleActiva(actual)}>
                  {actual.activa ? t('formularios:builder.deactivate') : t('formularios:builder.activate')}
                </Button>
                {actual.tipoFormulario === 'diagnostico_inicial' && (
                  <Link className="btn btn-secondary btn-sm" to="/admin/diagnostico-inicial-global">
                    {t('formularios:builder.ver_respuestas')}
                  </Link>
                )}
              </div>

              {anteriores.length > 0 && (
                <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-2)' }} onClick={e => e.stopPropagation()}>
                  <button
                    className="btn-link"
                    style={{ fontSize: '0.78rem' }}
                    onClick={() => setHistorialAbierto(h => ({ ...h, [tipo]: !abierto }))}
                  >
                    {abierto ? '▾' : '▸'} {t('formularios:builder.versiones_anteriores', { count: anteriores.length })}
                  </button>
                  {abierto && (
                    <div style={{ marginTop: 'var(--space-2)', display: 'grid', gap: 'var(--space-2)' }}>
                      {anteriores.map(v => (
                        <div
                          key={v.id}
                          onClick={() => openPlantilla(v)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)',
                            fontSize: '0.78rem', padding: 'var(--space-1) var(--space-2)',
                            background: 'var(--color-bg-subtle)',
                            cursor: 'pointer', opacity: v.activa ? 1 : 0.7,
                          }}
                        >
                          <span>
                            {t('formularios:builder.version', { version: v.version })} · {t('formularios:builder.respuestas', { count: v._count.respuestas })}
                            {v.activa ? ` · ${t('formularios:builder.active')}` : ''}
                          </span>
                          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }} onClick={e => e.stopPropagation()}>
                            <Button variant={v.activa ? 'danger' : 'success'} size="sm" onClick={() => toggleActiva(v)}>
                              {v.activa ? t('formularios:builder.deactivate') : t('formularios:builder.activate')}
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => duplicar(v)}>{t('formularios:builder.duplicate')}</Button>
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
        </div>
      </div>
      )}

      {selected && (
        <div className="section-card home-panel" style={{ marginTop: 'var(--space-5)' }}>
          <div className="section-card-header">
            <span className="section-card-title">{t('formularios:builder.campos.title')} — {selected.nombre}</span>
            <span className="count-badge">{campos.length}</span>
            {!inmutable && (
              <Button
                variant="primary"
                size="sm"
                style={{ marginLeft: 'auto' }}
                onClick={() => setCampoForm({ ...EMPTY_CAMPO })}
              >
                + {t('formularios:builder.campos.new')}
              </Button>
            )}
          </div>
          <div className="section-card-body">
          {inmutable && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <Alert variant="warning">{t('formularios:builder.immutable_hint')}</Alert>
            </div>
          )}
          {campos.length === 0 && <EmptyState title={t('formularios:builder.campos.empty')} />}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {campos.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', border: '1px solid var(--color-border)', padding: 'var(--space-2) var(--space-3)', marginLeft: c.campoPadreId ? 'var(--space-5)' : 0 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-secondary)', minWidth: 90 }}>
                  {t(`formularios:tipos_campo.${c.tipoCampo}`)}
                </span>
                <span style={{ flex: 1, fontSize: '0.9rem' }}>
                  {c.etiqueta}
                  {c.esObligatorio && <span style={{ color: 'var(--color-danger)' }}> *</span>}
                  {c.dimension && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-accent)', marginLeft: 'var(--space-2)' }}>[{c.dimension}]</span>
                  )}
                </span>
                {!inmutable && (
                  <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={t('formularios:builder.campos.up')}
                      title={t('formularios:builder.campos.up')}
                      disabled={i === 0}
                      onClick={() => mover(i, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={t('formularios:builder.campos.down')}
                      title={t('formularios:builder.campos.down')}
                      disabled={i === campos.length - 1}
                      onClick={() => mover(i, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
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
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setCampoAEliminar(c)}>
                      {t('formularios:builder.campos.delete')}
                    </Button>
                  </span>
                )}
              </div>
            ))}
          </div>

          {campoForm && !inmutable && (
            <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', maxWidth: 640 }}>
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
              <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
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
              <div className="form-footer">
                <Button variant="secondary" onClick={() => setCampoForm(null)}>
                  {t('formularios:builder.campos.cancel')}
                </Button>
                <Button variant="primary" disabled={saving || !campoForm.etiqueta.trim()} onClick={guardarCampo}>
                  {t('formularios:builder.campos.save')}
                </Button>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('formularios:builder.form.title_new')}
        maxWidth={420}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('formularios:builder.form.cancel')}</Button>
            <Button variant="primary" disabled={saving || !nueva.nombre.trim()} onClick={crearPlantilla}>
              {t('formularios:builder.form.save')}
            </Button>
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

      <ConfirmModal
        isOpen={!!campoAEliminar}
        title={t('formularios:builder.campos.confirm_delete_title')}
        message={t('formularios:builder.campos.confirm_delete_message', { etiqueta: campoAEliminar?.etiqueta ?? '' })}
        confirmLabel={t('formularios:builder.campos.delete')}
        onConfirm={() => {
          if (campoAEliminar) borrarCampo(campoAEliminar);
          setCampoAEliminar(null);
        }}
        onCancel={() => setCampoAEliminar(null)}
      />
    </>
  );
}
