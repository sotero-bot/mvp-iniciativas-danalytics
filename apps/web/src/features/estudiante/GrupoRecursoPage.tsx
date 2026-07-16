import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Campo, CampoRenderer } from './FormularioResponderPage';
import { Loading } from '../../components/ui';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface RecursoGrupo {
  grupo: { id: string; nombre: string; programaId: string };
  bloqueada?: boolean;
  plantillaId: string;
  tipoFormulario: string;
  nombre: string;
  descripcion: string | null;
  campos: Campo[];
  respuesta: {
    estado: string;
    datos: Record<string, unknown>;
    ultimaEdicionEn: string | null;
    ultimoEditor: { id: string; nombre: string } | null;
  } | null;
}

type Datos = Record<string, unknown>;

const AUTOSAVE_MS = 30_000; // RNF-09

// Fase 3 (RF-16/RF-30/RF-31, RNF-09): editor GRUPAL de bitácora / plantilla del
// proyecto. Sin submit: el recurso es editable siempre (draft permanente);
// cualquier miembro edita y se registra el último editor. Reutiliza el
// renderer de campos del formulario individual (Fase 2).
export function GrupoRecursoPage({ recurso }: { recurso: 'bitacora' | 'plantilla-proyecto' }) {
  const { grupoId = '' } = useParams();
  const { t, i18n } = useTranslation(['formularios', 'common']);
  const [formulario, setFormulario] = useState<RecursoGrupo | null>(null);
  const [datos, setDatos] = useState<Datos>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [autosaveInfo, setAutosaveInfo] = useState<string | null>(null);
  const [ultimaEdicion, setUltimaEdicion] = useState<{ nombre: string; fecha: string } | null>(null);
  // Bloqueado (solo lectura) cuando el grupo ya entregó la presentación final.
  const [bloqueada, setBloqueada] = useState(false);

  // Autosave: refs para que el intervalo lea el estado vigente sin re-crearse.
  // Guard de StrictMode: solo useRef (bug conocido del proyecto), sin AbortController.
  const datosRef = useRef<Datos>({});
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);

  useEffect(() => {
    datosRef.current = datos;
  }, [datos]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/grupos/${grupoId}/${recurso}?locale=${i18n.language}`)
      .then((res) => res.json())
      .then((data: RecursoGrupo) => {
        if (cancelled) return;
        setFormulario(data);
        setBloqueada(!!data.bloqueada);
        if (data.respuesta) {
          setDatos((data.respuesta.datos as Datos) ?? {});
          if (data.respuesta.ultimoEditor && data.respuesta.ultimaEdicionEn) {
            setUltimaEdicion({
              nombre: data.respuesta.ultimoEditor.nombre,
              fecha: new Date(data.respuesta.ultimaEdicionEn).toLocaleString(),
            });
          }
        }
      })
      .catch((err) => { if (!cancelled) setToast(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [grupoId, recurso, i18n.language]);

  const guardarDraft = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await fetchWithErrorMapping(`${API_URL}/grupos/${grupoId}/${recurso}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datos: datosRef.current }),
      });
      dirtyRef.current = false;
      setAutosaveInfo(t('formularios:estudiante.autosave_saved'));
      setTimeout(() => setAutosaveInfo(null), 3000);
    } catch (err) {
      setToast(translateError(err));
    } finally {
      savingRef.current = false;
    }
  }, [grupoId, recurso, t]);

  // RNF-09: guardar draft cada 30 s si hay cambios sin persistir.
  useEffect(() => {
    if (bloqueada) return;
    const id = setInterval(() => {
      if (dirtyRef.current) guardarDraft();
    }, AUTOSAVE_MS);
    return () => clearInterval(id);
  }, [guardarDraft, bloqueada]);

  const setValor = (campoId: string, valor: unknown) => {
    dirtyRef.current = true;
    setDatos(prev => ({ ...prev, [campoId]: valor }));
  };

  const topLevel = (formulario?.campos ?? []).filter(c => !c.campoPadreId);
  const hijosDe = (id: string) => (formulario?.campos ?? []).filter(c => c.campoPadreId === id);

  return (
    <div className="gform-container">
      <Link to="/estudiante/grupo" style={{ fontSize: '0.85rem' }}>
        {t('formularios:grupo.back')}
      </Link>
      {toast && <div className="toast">{toast}</div>}
      {loading && <Loading label={t('common:loading')} />}

      {formulario && (
        <>
          <div className="gform-header">
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#14B8A6', textTransform: 'uppercase' }}>
              {formulario.grupo.nombre}
            </div>
            <h1>{formulario.nombre}</h1>
            {formulario.descripcion && <p className="gform-desc">{formulario.descripcion}</p>}
            {/* RF-16: recurso colaborativo del grupo — se muestra quién editó por última vez. */}
            {ultimaEdicion && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 6 }}>
                {t('formularios:grupo.ultima_edicion', { nombre: ultimaEdicion.nombre, fecha: ultimaEdicion.fecha })}
              </div>
            )}
          </div>

          {bloqueada && (
            <div style={{ fontSize: '0.85rem', color: '#0D9488', margin: '10px 0', fontWeight: 600 }}>
              🔒 {t('formularios:grupo.cerrado_banner')}
            </div>
          )}

          {/* fieldset disabled deshabilita TODOS los controles internos en solo lectura. */}
          <fieldset disabled={bloqueada} style={{ border: 'none', padding: 0, margin: 0 }}>
            {topLevel.map(campo => (
              <React.Fragment key={campo.id}>
                {campo.configPublica?.seccion && (
                  <div className="gform-section">{campo.configPublica.seccion}</div>
                )}
                <CampoRenderer
                  campo={campo}
                  hijos={hijosDe(campo.id)}
                  valor={datos[campo.id]}
                  onChange={v => setValor(campo.id, v)}
                  t={t}
                />
              </React.Fragment>
            ))}
          </fieldset>

          {!bloqueada && (
            <div className="gform-footer">
              <button className="gform-submit" onClick={guardarDraft}>
                {t('formularios:grupo.guardar')}
              </button>
              {autosaveInfo && <span className="gform-autosave">✓ {autosaveInfo}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
