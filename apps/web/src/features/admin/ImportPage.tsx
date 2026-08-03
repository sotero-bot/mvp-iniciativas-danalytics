import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Breadcrumb, PageHeader, Field, Alert, EmptyState, Button, FormListLayout, StatCard } from '../../components/ui';
import { toast } from '../../components/toast-store';
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
      toast.success(t('admin:import.result_success', { empresa: data.empresa }));
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
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/admin/inicio' },
          { label: t('admin:import.page_title') },
        ]}
      />
      <PageHeader
        title={t('admin:import.page_title')}
        description={t('admin:import.page_description')}
      />

      <FormListLayout
        form={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

            {/* Selector de empresa */}
            <div className="card" style={{ padding: 'var(--space-4) var(--space-5)' }}>
              <Field
                label={t('admin:import.empresa_label')}
                required
                hint={empresas.length === 0 ? t('admin:import.empresas_empty') : undefined}
              >
                <select
                  className="input"
                  value={empresaId}
                  onChange={e => setEmpresaId(e.target.value)}
                >
                  <option value="">{t('admin:import.empresa_placeholder')}</option>
                  {empresas.map(e => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
              style={{
                border: `2px dashed ${dragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
                padding: 'var(--space-6) var(--space-5)',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragging ? 'var(--color-primary-light)' : 'var(--color-bg-subtle)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: '1.75rem', marginBottom: 'var(--space-2)' }}>📂</div>
              <p style={{ margin: '0 0 3px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-main)' }}>
                {fileName || t('admin:import.drop_zone_label')}
              </p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-tertiary)' }}>{t('admin:import.drop_zone_hint')}</p>
              <input ref={inputRef} type="file" accept=".json" style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files?.[0])} />
            </div>

            {parseError && (
              <Alert variant="danger">{parseError}</Alert>
            )}

            {/* Formato esperado */}
            <div className="card" style={{ padding: 'var(--space-4) var(--space-5)' }}>
              <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                {t('admin:import.format_label')}
              </p>
              <pre style={{
                margin: 0, fontSize: '0.72rem', lineHeight: 1.6,
                color: 'var(--color-text-secondary)', background: 'var(--color-bg-page)',
                border: '1px solid var(--color-border)',
                padding: 'var(--space-3)',
                overflowX: 'auto', whiteSpace: 'pre',
              }}>
                {EJEMPLO}
              </pre>
              <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                {t('admin:import.format_note')}
              </p>
            </div>
          </div>
        }
        list={
          <div>
            {result && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Alert variant="success" title={t('admin:import.result_success', { empresa: result.empresa })}>
                  <div className="stat-grid">
                    <StatCard label={t('admin:import.result_iniciativas_created')} value={result.iniciativasCreadas} />
                    <StatCard label={t('admin:import.result_actividades_created')} value={result.actividadesCreadas} />
                  </div>
                </Alert>

                {result.details.map((ini: any, i: number) => (
                  <div key={i} className="card" style={{ padding: 'var(--space-4) var(--space-5)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>📌 {ini.nombre}</div>
                    {ini.actividades.map((act: any, j: number) => (
                      <div key={j} style={{ paddingLeft: 'var(--space-4)', fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                        ⚡ {act.nombre}
                        {act.plantilla && (
                          <span className="chip" style={{ marginLeft: 'var(--space-2)', fontSize: '0.72rem', padding: '1px 6px' }}>
                            📋 {act.plantilla} ({act.pasosCopados})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}

                <div className="actions-end">
                  <Button variant="secondary" onClick={reset}>
                    {t('admin:import.import_another')}
                  </Button>
                </div>
              </div>
            )}

            {preview && !result && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Alert variant="info">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t('admin:import.preview_title')}</span>
                      <span style={{ marginLeft: 'var(--space-3)', fontSize: '0.82rem' }}>
                        {t('admin:import.preview_iniciativas', { count: preview.length })} · {t('admin:import.preview_actividades', { count: totalActividades })}
                      </span>
                      {empresaSeleccionada && (
                        <span className="chip" style={{ marginLeft: 'var(--space-3)' }}>
                          <span className="chip-dot" aria-hidden="true" />
                          {empresaSeleccionada.nombre}
                        </span>
                      )}
                    </div>
                    <Button variant="secondary" size="sm" onClick={reset}>
                      {t('admin:import.preview_clear')}
                    </Button>
                  </div>
                </Alert>

                {preview.map((ini, i) => (
                  <div key={i} className="card" style={{ padding: 'var(--space-4) var(--space-5)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                      📌 {ini.nombre}
                      {ini.descripcion && <span style={{ fontWeight: 400, fontSize: '0.82rem', color: 'var(--color-text-tertiary)', marginLeft: 'var(--space-2)' }}>— {ini.descripcion}</span>}
                    </div>
                    {(ini.actividades ?? []).map((act, j) => (
                      <div key={j} style={{ paddingLeft: 'var(--space-4)', fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)', borderLeft: '2px solid var(--color-border-strong)', paddingTop: 2, paddingBottom: 2 }}>
                        ⚡ {act.nombre}
                        {act.plantilla && (
                          <span className="chip" style={{ marginLeft: 'var(--space-2)', fontSize: '0.72rem', padding: '1px 6px' }}>
                            📋 {act.plantilla}
                          </span>
                        )}
                      </div>
                    ))}
                    {!ini.actividades?.length && (
                      <div style={{ paddingLeft: 'var(--space-4)', fontSize: '0.78rem', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>{t('admin:import.preview_no_activities')}</div>
                    )}
                  </div>
                ))}

                {!empresaId && (
                  <Alert variant="warning">{t('admin:import.select_empresa_warning')}</Alert>
                )}

                {apiError && (
                  <Alert variant="danger">{apiError}</Alert>
                )}

                <div className="form-footer">
                  <Button
                    variant="primary"
                    onClick={handleImport}
                    disabled={loading || !canImport}
                  >
                    {loading ? t('admin:import.importing') : t('admin:import.confirm_import')}
                  </Button>
                </div>
              </div>
            )}

            {!preview && !result && (
              <EmptyState icon="⬆" title={t('admin:import.empty_preview')} />
            )}
          </div>
        }
      />
    </div>
  );
}
