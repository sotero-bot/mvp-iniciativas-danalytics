import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Field, InfoTooltip } from '../../components/ui';
import type { EstadoPrograma, EmpresaLite, FacilitadorLite, Programa, PlantillaGlobalLite, FormState } from './programas.types';
import { TIPOS_SNAPSHOT } from './programas.types';

// ─────────────────────────────────────────────────────────────
// Modal de creación/edición
// ─────────────────────────────────────────────────────────────
interface ProgramaFormModalProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  editing: Programa | null;
  empresas: EmpresaLite[];
  facilitadores: FacilitadorLite[];
  plantillasGlobales: PlantillaGlobalLite[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ProgramaFormModal({
  form, setForm, editing, empresas, facilitadores, plantillasGlobales, saving, onClose, onSubmit,
}: ProgramaFormModalProps) {
  const { t } = useTranslation(['admin', 'common', 'programa', 'formularios']);
  const [langTab, setLangTab] = useState<'es' | 'pt'>('es');

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
    color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
    fontWeight: 500,
    fontSize: '0.8rem',
  });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing ? t('admin:programas.modal.title_edit') : t('admin:programas.modal.title_create')}
      maxWidth={620}
    >
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="button" onClick={() => setLangTab('es')} className="btn-link" style={tabStyle(langTab === 'es')}>
              🇪🇸 {t('admin:programas.lang.es')}
            </button>
            <button type="button" onClick={() => setLangTab('pt')} className="btn-link" style={tabStyle(langTab === 'pt')}>
              🇧🇷 {t('admin:programas.lang.pt')}
            </button>
          </div>

          {langTab === 'es' ? (
            <>
              <Field label={t('admin:programas.fields.nombre')} required>
                <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
              </Field>
              <Field label={t('admin:programas.fields.descripcion')}>
                <textarea
                  className="input"
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  rows={3}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label={<>{t('admin:programas.fields.nombre')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(pt)</span></>}>
                <input
                  className="input"
                  value={form.traduccionesPt.nombre}
                  onChange={e => setForm(f => ({ ...f, traduccionesPt: { ...f.traduccionesPt, nombre: e.target.value } }))}
                  placeholder={form.nombre}
                />
              </Field>
              <Field label={<>{t('admin:programas.fields.descripcion')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(pt)</span></>}>
                <textarea
                  className="input"
                  value={form.traduccionesPt.descripcion}
                  onChange={e => setForm(f => ({ ...f, traduccionesPt: { ...f.traduccionesPt, descripcion: e.target.value } }))}
                  rows={3}
                  placeholder={form.descripcion || undefined}
                />
              </Field>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: -4 }}>
                {t('admin:programas.lang.hint')}
              </div>
            </>
          )}

          <div className="form-grid">
            <Field label={t('admin:programas.fields.empresa')} required>
              <select
                className="input"
                value={form.empresaId}
                onChange={e => setForm(f => ({ ...f, empresaId: e.target.value }))}
                required
                disabled={!!editing}
              >
                <option value="">—</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </Field>
            <Field label={t('admin:programas.fields.facilitadores')}>
              {/* C-01: N:M — selección múltiple de facilitadores. */}
              <div style={{
                maxHeight: 140, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 6,
                padding: '6px 10px',
              }}>
                {facilitadores.length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>{t('admin:programas.fields.sin_facilitadores')}</div>
                )}
                {facilitadores.map(f => {
                  const checked = form.facilitadorIds.includes(f.id);
                  return (
                    <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => setForm(fm => ({
                          ...fm,
                          facilitadorIds: e.target.checked
                            ? [...fm.facilitadorIds, f.id]
                            : fm.facilitadorIds.filter(id => id !== f.id),
                        }))}
                      />
                      {f.nombre}
                    </label>
                  );
                })}
              </div>
            </Field>
          </div>

          <div className="form-grid form-grid-3">
            <Field label={t('admin:programas.fields.estado')}>
              <select className="input" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value as EstadoPrograma }))}>
                <option value="borrador">{t('programa:estado.borrador')}</option>
                <option value="activo">{t('programa:estado.activo')}</option>
                <option value="finalizado">{t('programa:estado.finalizado')}</option>
                <option value="cancelado">{t('programa:estado.cancelado')}</option>
              </select>
            </Field>
            <Field label={t('admin:programas.fields.timezone')}>
              <input className="input" value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} />
            </Field>
            <Field label={<>{t('admin:programas.fields.dias_gracia')}<InfoTooltip label={t('admin:programas.fields.dias_gracia_hint')} /></>}>
              <input
                type="number"
                className="input"
                value={form.diasGracia}
                min={0}
                max={90}
                onChange={e => setForm(f => ({ ...f, diasGracia: Number(e.target.value) }))}
              />
            </Field>
          </div>

          {/* RF-01/RF-32: nº de sesiones esperadas + sesión desde la que se habilita
              la presentación final. La validación fina (rango, no exceder) es del backend. */}
          <div className="form-grid">
            <Field label={t('admin:programas.fields.total_sesiones')} hint={t('admin:programas.fields.total_sesiones_hint')}>
              <input
                type="number"
                className="input"
                value={form.totalSesionesEsperadas}
                min={1}
                placeholder={t('admin:programas.fields.sin_definir')}
                onChange={e => setForm(f => ({ ...f, totalSesionesEsperadas: e.target.value }))}
              />
            </Field>
            <Field label={t('admin:programas.fields.presentacion_desde_sesion')} hint={t('admin:programas.fields.presentacion_desde_sesion_hint')}>
              <input
                type="number"
                className="input"
                value={form.presentacionDesdeSesion}
                min={1}
                placeholder={t('admin:programas.fields.sin_definir')}
                onChange={e => setForm(f => ({ ...f, presentacionDesdeSesion: e.target.value }))}
              />
            </Field>
          </div>

          <div className="form-grid">
            <Field label={t('admin:programas.fields.fecha_inicio')}>
              <input type="date" className="input" value={form.fechaInicio} onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))} />
            </Field>
            <Field label={t('admin:programas.fields.fecha_fin')}>
              <input type="date" className="input" value={form.fechaFin} onChange={e => setForm(f => ({ ...f, fechaFin: e.target.value }))} />
            </Field>
          </div>

          {/* RF-46: selección de plantillas del snapshot — solo al crear (después el
              snapshot es inmutable). Una por tipo, opcional, default última versión. */}
          {!editing && (
            <Field label={t('admin:programas.plantillas.title')}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
                {t('admin:programas.plantillas.hint')}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {TIPOS_SNAPSHOT.map(tipo => {
                  const opciones = plantillasGlobales.filter(g => g.tipoFormulario === tipo);
                  if (opciones.length === 0) return null;
                  return (
                    <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ minWidth: 150, fontSize: '0.85rem' }}>{t(`formularios:tipos.${tipo}`)}</span>
                      <select
                        className="input"
                        value={form.plantillaSeleccion[tipo] ?? ''}
                        onChange={e => setForm(f => ({ ...f, plantillaSeleccion: { ...f.plantillaSeleccion, [tipo]: e.target.value } }))}
                      >
                        <option value="">{t('admin:programas.plantillas.ninguna')}</option>
                        {opciones.map(o => (
                          <option key={o.id} value={o.id}>
                            {o.nombre} · v{o.version}{o.activa ? '' : ` (${t('admin:programas.plantillas.inactiva')})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </Field>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              {t('common:buttons.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common:actions.saving') : t('common:buttons.save')}
            </button>
          </div>
        </form>
    </Modal>
  );
}
