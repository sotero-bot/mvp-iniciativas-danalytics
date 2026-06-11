import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const EJEMPLO = `[
  {
    "nombre": "Diagnóstico de Madurez en Datos",
    "descripcion": "Descripción opcional",
    "actividades": [
      {
        "nombre": "Relevamiento de Fuentes de Datos",
        "descripcion": "Descripción opcional",
        "plantilla": "Nombre exacto de plantilla (opcional)"
      },
      {
        "nombre": "Análisis de Calidad de Datos"
      }
    ]
  }
]`;

interface ActividadInput { nombre: string; descripcion?: string; plantilla?: string }
interface IniciativaInput { nombre: string; descripcion?: string; actividades?: ActividadInput[] }

export function ImportPage() {
  const { t } = useTranslation(['admin', 'common']);
  const inputRef = useRef<HTMLInputElement>(null);
  const [empresas, setEmpresas] = useState<{ id: string; nombre: string }[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [preview, setPreview] = useState<IniciativaInput[] | null>(null);
  const [parseError, setParseError] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [apiError, setApiError] = useState('');
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/organization/empresas`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setEmpresas(data));
  }, []);

  const parseFile = (file: File) => {
    setResult(null);
    setApiError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        const items: IniciativaInput[] = Array.isArray(parsed) ? parsed : [parsed];
        if (!items[0]?.nombre) {
          setParseError(t('admin:import.error_missing_name'));
          setPreview(null);
          return;
        }
        setPreview(items);
        setParseError('');
      } catch {
        setParseError(t('admin:import.error_invalid_json'));
        setPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.endsWith('.json')) { setParseError(t('admin:import.error_invalid_extension')); return; }
    parseFile(file);
  };

  const handleImport = async () => {
    if (!preview || !empresaId) return;
    setLoading(true);
    setApiError('');
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, iniciativas: preview }),
      });
      const data = await res.json();
      setResult(data);
      setPreview(null);
      setFileName('');
    } catch (err) {
      setApiError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    setFileName('');
    setParseError('');
    setApiError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const totalActividades = preview?.reduce((s, i) => s + (i.actividades?.length ?? 0), 0) ?? 0;
  const empresaSeleccionada = empresas.find(e => e.id === empresaId);
  const canImport = !!preview && !!empresaId;

  return (
    <div className="layout-content">
      <div className="page-header">
        <div>
          <h1>{t('admin:import.page_title')}</h1>
          <p className="page-description">
            {t('admin:import.page_description')}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>

        {/* Izquierda: empresa + upload + formato */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Selector de empresa */}
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 8 }}>
              {t('admin:import.empresa_label')} <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              className="input"
              style={{ marginBottom: 0 }}
              value={empresaId}
              onChange={e => setEmpresaId(e.target.value)}
            >
              <option value="">{t('admin:import.empresa_placeholder')}</option>
              {empresas.map(e => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
            {empresas.length === 0 && (
              <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--color-text-tertiary)' }}>
                {t('admin:import.empresas_empty')}
              </p>
            )}
          </div>

          {/* Drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            style={{
              border: `2px dashed ${dragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '2rem 1.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? '#EFF6FF' : 'var(--color-bg-subtle)',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: '1.75rem', marginBottom: 6 }}>📂</div>
            <p style={{ margin: '0 0 3px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-main)' }}>
              {fileName || t('admin:import.drop_zone_label')}
            </p>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-tertiary)' }}>{t('admin:import.drop_zone_hint')}</p>
            <input ref={inputRef} type="file" accept=".json" style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0])} />
          </div>

          {parseError && (
            <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', color: '#DC2626', fontSize: '0.875rem' }}>
              ⚠ {parseError}
            </div>
          )}

          {/* Formato esperado */}
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              {t('admin:import.format_label')}
            </p>
            <pre style={{
              margin: 0, fontSize: '0.72rem', lineHeight: 1.6,
              color: '#334155', background: '#F8FAFC',
              border: '1px solid var(--color-border)',
              borderRadius: 6, padding: '0.75rem',
              overflowX: 'auto', whiteSpace: 'pre',
            }}>
              {EJEMPLO}
            </pre>
            <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
              {t('admin:import.format_note')}
            </p>
          </div>
        </div>

        {/* Derecha: preview o resultado */}
        <div>
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                background: '#ECFDF5', border: '1px solid #A7F3D0',
                borderRadius: 'var(--radius-md)', padding: '1.25rem 1.5rem',
              }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#065F46', marginBottom: 12 }}>
                  ✓ {t('admin:import.result_success', { empresa: result.empresa })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[
                    { label: t('admin:import.result_iniciativas_created'), val: result.iniciativasCreadas },
                    { label: t('admin:import.result_actividades_created'), val: result.actividadesCreadas },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ background: 'white', borderRadius: 8, padding: '0.625rem 0.875rem', border: '1px solid #D1FAE5' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>{val}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {result.details.map((ini: any, i: number) => (
                <div key={i} className="card" style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>📌 {ini.nombre}</div>
                  {ini.actividades.map((act: any, j: number) => (
                    <div key={j} style={{ paddingLeft: '1rem', fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                      ⚡ {act.nombre}
                      {act.plantilla && (
                        <span style={{ marginLeft: 6, fontSize: '0.72rem', background: '#EEF2FF', color: '#4338CA', padding: '1px 6px', borderRadius: 4 }}>
                          📋 {act.plantilla} ({act.pasosCopados})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              <button className="btn btn-secondary" onClick={reset} style={{ alignSelf: 'start' }}>
                {t('admin:import.import_another')}
              </button>
            </div>
          )}

          {preview && !result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                background: '#EFF6FF', border: '1px solid #BFDBFE',
                borderRadius: 'var(--radius-md)', padding: '0.875rem 1.25rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1D4ED8' }}>{t('admin:import.preview_title')}</span>
                  <span style={{ marginLeft: 10, fontSize: '0.82rem', color: '#3B82F6' }}>
                    {t('admin:import.preview_iniciativas', { count: preview.length })} · {t('admin:import.preview_actividades', { count: totalActividades })}
                  </span>
                  {empresaSeleccionada && (
                    <span style={{ marginLeft: 10, fontSize: '0.82rem', color: '#6B7280' }}>
                      → {empresaSeleccionada.nombre}
                    </span>
                  )}
                </div>
                <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 10px' }} onClick={reset}>
                  {t('admin:import.preview_clear')}
                </button>
              </div>

              {preview.map((ini, i) => (
                <div key={i} className="card" style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    📌 {ini.nombre}
                    {ini.descripcion && <span style={{ fontWeight: 400, fontSize: '0.82rem', color: 'var(--color-text-tertiary)', marginLeft: 8 }}>— {ini.descripcion}</span>}
                  </div>
                  {(ini.actividades ?? []).map((act, j) => (
                    <div key={j} style={{ paddingLeft: '1rem', fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 4, borderLeft: '2px solid #BFDBFE', paddingTop: 2, paddingBottom: 2 }}>
                      ⚡ {act.nombre}
                      {act.plantilla && (
                        <span style={{ marginLeft: 6, fontSize: '0.72rem', background: '#EEF2FF', color: '#4338CA', padding: '1px 6px', borderRadius: 4 }}>
                          📋 {act.plantilla}
                        </span>
                      )}
                    </div>
                  ))}
                  {!ini.actividades?.length && (
                    <div style={{ paddingLeft: '1rem', fontSize: '0.78rem', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>{t('admin:import.preview_no_activities')}</div>
                  )}
                </div>
              ))}

              {!empresaId && (
                <div style={{ padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 'var(--radius-sm)', color: '#92400E', fontSize: '0.875rem' }}>
                  ⚠ {t('admin:import.select_empresa_warning')}
                </div>
              )}

              {apiError && (
                <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', color: '#DC2626', fontSize: '0.875rem' }}>
                  ⚠ {apiError}
                </div>
              )}

              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={loading || !canImport}
                style={{ alignSelf: 'start', minWidth: 180 }}
              >
                {loading ? t('admin:import.importing') : t('admin:import.confirm_import')}
              </button>
            </div>
          )}

          {!preview && !result && (
            <div className="card" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: 10 }}>⬆</div>
              <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
                {t('admin:import.empty_preview')}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
