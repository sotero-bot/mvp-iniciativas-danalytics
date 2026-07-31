import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Campo, CamposSecciones } from './FormularioResponderPage';
import { Alert, Breadcrumb, Button, Loading, PageHeader } from '../../components/ui';
import type { BreadcrumbItem } from '../../components/ui';
import { toast } from '../../components/toast-store';

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
  const [searchParams] = useSearchParams();
  // Al abrirse desde la vista de programa (?from=), "volver" regresa ahí.
  const backTo = searchParams.get('from') || '/estudiante/programas';
  const { t, i18n } = useTranslation(['formularios', 'common']);
  const [formulario, setFormulario] = useState<RecursoGrupo | null>(null);
  const [datos, setDatos] = useState<Datos>({});
  const [loading, setLoading] = useState(false);
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
      .catch((err) => { if (!cancelled) toast.error(translateError(err)); })
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
      toast.error(translateError(err));
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

  // La entidad seleccionada es el grupo: aparece como segmento del breadcrumb
  // y como eyebrow del PageHeader (regla 01).
  const breadcrumbItems: BreadcrumbItem[] = [{ label: t('formularios:grupo.title'), to: backTo }];
  if (formulario) {
    breadcrumbItems.push({ label: formulario.grupo.nombre });
    breadcrumbItems.push({ label: formulario.nombre });
  }

  return (
    <div className="gform-container">
      <Breadcrumb items={breadcrumbItems} />
      {loading && <Loading label={t('common:loading')} />}

      {formulario && (
        <>
          <PageHeader
            eyebrow={formulario.grupo.nombre}
            title={formulario.nombre}
            description={formulario.descripcion ?? undefined}
          />

          {/* RF-16: recurso colaborativo del grupo — se muestra quién editó por última vez. */}
          {ultimaEdicion && (
            <p style={{ fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
              {t('formularios:grupo.ultima_edicion', { nombre: ultimaEdicion.nombre, fecha: ultimaEdicion.fecha })}
            </p>
          )}

          {bloqueada && (
            <Alert variant="info">{t('formularios:grupo.cerrado_banner')}</Alert>
          )}

          {/* fieldset disabled deshabilita TODOS los controles internos en solo lectura. */}
          <fieldset disabled={bloqueada} style={{ border: 'none', padding: 0, margin: 0 }}>
            <CamposSecciones campos={topLevel} hijosDe={hijosDe} datos={datos} onChange={setValor} t={t} />
          </fieldset>

          {!bloqueada && (
            <div className="form-footer">
              {autosaveInfo && <span className="gform-autosave">✓ {autosaveInfo}</span>}
              <Button variant="primary" onClick={guardarDraft}>
                {t('formularios:grupo.guardar')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
