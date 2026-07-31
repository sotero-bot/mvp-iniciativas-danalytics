import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Breadcrumb, Button, Loading, PageHeader } from '../../components/ui';
import type { BreadcrumbItem } from '../../components/ui';
import { toast } from '../../components/toast-store';
import { formatFechaHora } from '../../shared/formatDate';

// Clave reservada dentro de cada iteración de un grupo repetible para guardar
// automáticamente el instante en que se creó. No colisiona con los ids (UUID) de
// los campos hijos y nunca se renderiza como input.
const ITERACION_FECHA_KEY = '__creadaEn';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface ConfigPublica {
  opciones?: { valor: string; etiqueta: string }[];
  multiple?: boolean;
  min?: number;
  max?: number;
  etiquetaMin?: string;
  etiquetaMax?: string;
  columnas?: string[];
  seccion?: string;
}

export interface Campo {
  id: string;
  campoPadreId: string | null;
  tipoCampo: string;
  etiqueta: string;
  descripcion: string | null;
  esObligatorio: boolean;
  orden: number;
  configPublica: ConfigPublica;
}

interface Formulario {
  id: string;
  tipoFormulario: string;
  nombre: string;
  descripcion: string | null;
  campos: Campo[];
  respuesta: { estado: 'draft' | 'submitted'; datos: Record<string, unknown>; enviadoEn: string | null } | null;
}

type Datos = Record<string, unknown>;

const AUTOSAVE_MS = 30_000; // RNF-09

// RF-28/RF-29/RNF-09: render dinámico por tipo de campo + autosave + submit,
// con estética tipo Google Forms (clases .gform-* en index.css). El backend
// nunca envía configJson ni scores (RNF-04); aquí solo llega configPublica.
export function FormularioResponderPage() {
  const { plantillaId = '' } = useParams();
  const [searchParams] = useSearchParams();
  // Al abrirse desde la vista de programa (?from=), el enlace de "volver" regresa
  // ahí; si no, cae a "Mis programas".
  const backTo = searchParams.get('from') || '/estudiante/programas';
  const { t, i18n } = useTranslation(['formularios', 'common']);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [datos, setDatos] = useState<Datos>({});
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [autosaveInfo, setAutosaveInfo] = useState<string | null>(null);

  // Autosave: refs para que el intervalo lea el estado vigente sin re-crearse.
  // Guard de StrictMode: solo useRef (bug conocido del proyecto), sin AbortController.
  const datosRef = useRef<Datos>({});
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const enviadoRef = useRef(false);

  useEffect(() => {
    datosRef.current = datos;
  }, [datos]);
  useEffect(() => {
    enviadoRef.current = enviado;
  }, [enviado]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/formularios/${plantillaId}?locale=${i18n.language}`)
      .then((res) => res.json())
      .then((data: Formulario) => {
        if (cancelled) return;
        setFormulario(data);
        if (data.respuesta) {
          setDatos((data.respuesta.datos as Datos) ?? {});
          setEnviado(data.respuesta.estado === 'submitted');
        }
      })
      .catch((err) => { if (!cancelled) toast.error(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [plantillaId, i18n.language]);

  const guardarDraft = useCallback(async () => {
    if (savingRef.current || enviadoRef.current) return;
    savingRef.current = true;
    try {
      await fetchWithErrorMapping(`${API_URL}/formularios/${plantillaId}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datos: datosRef.current }),
      });
      dirtyRef.current = false;
      setAutosaveInfo(t('formularios:estudiante.autosave_saved'));
      setTimeout(() => setAutosaveInfo(null), 3000);
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      savingRef.current = false;
    }
  }, [plantillaId, t]);

  // RNF-09: guardar draft cada 30 s si hay cambios sin persistir.
  useEffect(() => {
    const id = setInterval(() => {
      if (dirtyRef.current) guardarDraft();
    }, AUTOSAVE_MS);
    return () => clearInterval(id);
  }, [guardarDraft]);

  const setValor = (campoId: string, valor: unknown) => {
    dirtyRef.current = true;
    setDatos(prev => ({ ...prev, [campoId]: valor }));
  };

  const camposFaltantes = (): Campo[] =>
    (formulario?.campos ?? []).filter(
      c =>
        c.esObligatorio &&
        !c.campoPadreId &&
        c.tipoCampo !== 'grupo_repetible' &&
        (datos[c.id] === undefined || datos[c.id] === null || datos[c.id] === '' ||
          (Array.isArray(datos[c.id]) && (datos[c.id] as unknown[]).length === 0)),
    );

  const enviar = async () => {
    if (camposFaltantes().length > 0) {
      toast.error(t('formularios:estudiante.missing_required'));
      return;
    }
    setEnviando(true);
    try {
      await fetchWithErrorMapping(`${API_URL}/formularios/${plantillaId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datos }),
      });
      dirtyRef.current = false;
      setEnviado(true);
      toast.success(t('formularios:estudiante.success'));
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setEnviando(false);
    }
  };

  const topLevel = (formulario?.campos ?? []).filter(c => !c.campoPadreId);
  const hijosDe = (id: string) => (formulario?.campos ?? []).filter(c => c.campoPadreId === id);

  const breadcrumbItems: BreadcrumbItem[] = [{ label: t('formularios:estudiante.title'), to: backTo }];
  if (formulario) breadcrumbItems.push({ label: formulario.nombre });

  return (
    <div className="gform-container">
      <Breadcrumb items={breadcrumbItems} />
      {loading && <Loading label={t('common:loading')} />}

      {formulario && (
        <>
          <PageHeader
            eyebrow={t(`formularios:tipos.${formulario.tipoFormulario}`)}
            title={formulario.nombre}
            description={formulario.descripcion ?? undefined}
          />
          {!enviado && (
            <div className="gform-required-note">{t('formularios:estudiante.required_note')}</div>
          )}

          {enviado ? (
            <div className="gform-sent">✓ {t('formularios:estudiante.submitted_banner')}</div>
          ) : (
            <>
              <CamposSecciones campos={topLevel} hijosDe={hijosDe} datos={datos} onChange={setValor} t={t} />

              <div className="form-footer">
                {autosaveInfo && <span className="gform-autosave">✓ {autosaveInfo}</span>}
                <Button variant="secondary" onClick={guardarDraft}>
                  {t('formularios:estudiante.draft_save')}
                </Button>
                <Button variant="primary" disabled={enviando} onClick={enviar}>
                  {enviando ? t('formularios:estudiante.submitting') : t('formularios:estudiante.submit')}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Render por tipo de campo (RF-24; checkboxes = opcion_multiple + multiple).
// Exportado para reutilizarlo en los recursos de grupo de Fase 3
// (bitácora / plantilla del proyecto).
// ─────────────────────────────────────────────────────────────

interface CampoRendererProps {
  campo: Campo;
  hijos: Campo[];
  valor: unknown;
  onChange: (valor: unknown) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
  numero?: number;
}

// Agrupa los campos top-level en secciones. Un campo con `configPublica.seccion`
// inicia una nueva sección cuyo encabezado (barra verde) es ese texto; los campos
// siguientes sin `seccion` pertenecen a ella. Cada sección se renderiza como un
// ÚNICO bloque conectado (encabezado + preguntas separadas por divisores internos),
// para que se lea como una sola cosa y no como cajas sueltas independientes.
interface CamposSeccionesProps {
  campos: Campo[];
  hijosDe: (id: string) => Campo[];
  datos: Record<string, unknown>;
  onChange: (campoId: string, valor: unknown) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

export function CamposSecciones({ campos, hijosDe, datos, onChange, t }: CamposSeccionesProps) {
  const grupos: { seccion: string | null; campos: Campo[] }[] = [];
  for (const campo of campos) {
    const seccion = campo.configPublica?.seccion || null;
    if (seccion || grupos.length === 0) {
      grupos.push({ seccion, campos: [campo] });
    } else {
      grupos[grupos.length - 1].campos.push(campo);
    }
  }

  // Numeración continua a lo largo de todo el formulario (1, 2, 3…), sin
  // reiniciar por sección, para que cada pregunta tenga un índice único claro.
  let numero = 0;
  return (
    <>
      {grupos.map((grupo, i) => (
        <div key={i} className="gform-section-group">
          <div className="gform-section">{grupo.seccion || t('formularios:seccion_general')}</div>
          {grupo.campos.map(campo => {
            numero += 1;
            return (
              <CampoRenderer
                key={campo.id}
                campo={campo}
                hijos={hijosDe(campo.id)}
                valor={datos[campo.id]}
                onChange={v => onChange(campo.id, v)}
                t={t}
                numero={numero}
              />
            );
          })}
        </div>
      ))}
    </>
  );
}

export function CampoRenderer({ campo, hijos, valor, onChange, t, numero }: CampoRendererProps) {
  return (
    <div className="gform-card">
      {numero !== undefined && <div className="gform-num">{numero}</div>}
      <div className="gform-card-body">
        <div className="gform-question">
          {campo.etiqueta}
          {campo.esObligatorio && (
            <span className="gform-req" title={t('formularios:estudiante.obligatorio')}>*</span>
          )}
        </div>
        {campo.descripcion && <div className="gform-help">{campo.descripcion}</div>}
        <div className="gform-answer">
          <CampoInput campo={campo} hijos={hijos} valor={valor} onChange={onChange} t={t} />
        </div>
      </div>
    </div>
  );
}

function CampoInput({ campo, hijos, valor, onChange, t }: CampoRendererProps) {
  const config = campo.configPublica ?? {};

  switch (campo.tipoCampo) {
    case 'texto_corto':
      return (
        <input
          className="gform-input gform-input--short"
          placeholder={t('formularios:estudiante.placeholder_texto')}
          value={(valor as string) ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      );

    case 'texto_largo':
      return (
        <textarea
          className="gform-input"
          placeholder={t('formularios:estudiante.placeholder_texto')}
          value={(valor as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          rows={3}
        />
      );

    case 'numero':
      return (
        <input
          className="gform-input gform-input--num"
          type="number"
          min={config.min}
          max={config.max}
          placeholder={t('formularios:estudiante.placeholder_numero')}
          value={valor === undefined || valor === null ? '' : String(valor)}
          onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      );

    case 'likert': {
      const min = config.min ?? 1;
      const max = config.max ?? 5;
      const escala = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      return (
        <div className="gform-likert">
          {config.etiquetaMin && <span className="gform-likert-extreme">{config.etiquetaMin}</span>}
          {escala.map(n => (
            <label key={n} className="gform-likert-opt">
              <span>{n}</span>
              <input type="radio" name={campo.id} checked={valor === n} onChange={() => onChange(n)} />
            </label>
          ))}
          {config.etiquetaMax && (
            <span className="gform-likert-extreme gform-likert-extreme--max">{config.etiquetaMax}</span>
          )}
        </div>
      );
    }

    case 'opcion_multiple': {
      const opciones = config.opciones ?? [];
      if (config.multiple) {
        const seleccion = Array.isArray(valor) ? (valor as string[]) : [];
        const toggle = (v: string) =>
          onChange(seleccion.includes(v) ? seleccion.filter(x => x !== v) : [...seleccion, v]);
        return (
          <div className="gform-options">
            {opciones.map(op => (
              <label key={op.valor} className="gform-option">
                <input type="checkbox" checked={seleccion.includes(op.valor)} onChange={() => toggle(op.valor)} />
                {op.etiqueta}
              </label>
            ))}
          </div>
        );
      }
      return (
        <div className="gform-options">
          {opciones.map(op => (
            <label key={op.valor} className="gform-option">
              <input type="radio" name={campo.id} checked={valor === op.valor} onChange={() => onChange(op.valor)} />
              {op.etiqueta}
            </label>
          ))}
        </div>
      );
    }

    case 'tabla': {
      const columnas = config.columnas ?? [];
      const filas = Array.isArray(valor) ? (valor as Record<string, string>[]) : [];
      const setFila = (i: number, col: string, v: string) => {
        const copia = filas.map(f => ({ ...f }));
        copia[i] = { ...copia[i], [col]: v };
        onChange(copia);
      };
      return (
        <div style={{ overflowX: 'auto' }}>
          <table className="gform-table">
            <thead>
              <tr>
                {columnas.map(col => (
                  <th key={col}>{col}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i}>
                  {columnas.map(col => (
                    <td key={col}>
                      <input
                        className="gform-input"
                        value={fila[col] ?? ''}
                        onChange={e => setFila(i, col, e.target.value)}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      className="btn-link btn-link-danger"
                      onClick={() => onChange(filas.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="gform-add" onClick={() => onChange([...filas, {}])}>
            + {t('formularios:estudiante.add_fila')}
          </button>
        </div>
      );
    }

    case 'grupo_repetible': {
      const iteraciones = Array.isArray(valor) ? (valor as Record<string, unknown>[]) : [];
      const setIteracion = (i: number, campoHijoId: string, v: unknown) => {
        const copia = iteraciones.map(it => ({ ...it }));
        copia[i] = { ...copia[i], [campoHijoId]: v };
        onChange(copia);
      };
      return (
        <div>
          {iteraciones.map((iteracion, i) => {
            const fechaIso = typeof iteracion[ITERACION_FECHA_KEY] === 'string'
              ? (iteracion[ITERACION_FECHA_KEY] as string)
              : null;
            return (
              <div key={i} className="gform-iteracion">
                <div className="gform-iteracion-head">
                  <div>
                    <div className="gform-iteracion-titulo">
                      {t('formularios:estudiante.iteracion_semana', { n: i + 1 })}
                    </div>
                    {fechaIso && (
                      <div className="gform-iteracion-fecha">
                        {t('formularios:estudiante.iteracion_fecha', { fecha: formatFechaHora(fechaIso) })}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn-link btn-link-danger"
                    onClick={() => onChange(iteraciones.filter((_, j) => j !== i))}
                  >
                    {t('formularios:estudiante.quitar')}
                  </button>
                </div>
                {hijos.map(hijo => (
                  <div key={hijo.id} style={{ marginBottom: 'var(--space-3)' }}>
                    <div className="gform-question" style={{ fontSize: '0.875rem', marginBottom: 'var(--space-2)' }}>
                      {hijo.etiqueta}
                    </div>
                    <CampoInput
                      campo={hijo}
                      hijos={[]}
                      valor={iteracion[hijo.id]}
                      onChange={v => setIteracion(i, hijo.id, v)}
                      t={t}
                    />
                  </div>
                ))}
              </div>
            );
          })}
          <button
            className="gform-add"
            onClick={() => onChange([...iteraciones, { [ITERACION_FECHA_KEY]: new Date().toISOString() }])}
          >
            + {t('formularios:estudiante.add_iteracion')}
          </button>
        </div>
      );
    }

    default:
      return null;
  }
}
