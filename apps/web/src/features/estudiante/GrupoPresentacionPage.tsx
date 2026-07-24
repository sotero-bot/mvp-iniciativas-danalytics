import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Loading } from '../../components/ui';
import { toast } from '../../components/toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface EstadoPresentacion {
  habilitada: boolean;
  desdeSesion: number | null;
  entrega: {
    archivoKey: string | null;
    archivoNombre: string | null;
    entregadoEn: string | null;
    entregadoPor: { id: string; nombre: string } | null;
  } | null;
}

// Fase 3 (RF-32): entrega de la presentación final del grupo — archivo
// (PDF/PPT vía presigned PUT a S3). Solo habilitada en fase de cierre
// (a partir de la sesión configurada en el programa). Reentrega = reemplazo.
export function GrupoPresentacionPage() {
  const { grupoId = '' } = useParams();
  const [searchParams] = useSearchParams();
  // Al abrirse desde la vista de programa (?from=), "volver" regresa ahí.
  const backTo = searchParams.get('from') || '/estudiante/programas';
  const { t } = useTranslation(['formularios', 'common']);
  const [estado, setEstado] = useState<EstadoPresentacion | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const cargar = React.useCallback(() => {
    setLoading(true);
    return fetchWithErrorMapping(`${API_URL}/grupos/${grupoId}/presentacion-final`)
      .then((res) => res.json())
      .then((data: EstadoPresentacion) => {
        setEstado(data);
      })
      .catch((err) => toast.error(translateError(err)))
      .finally(() => setLoading(false));
  }, [grupoId]);

  useEffect(() => {
    let cancelled = false;
    fetchWithErrorMapping(`${API_URL}/grupos/${grupoId}/presentacion-final`)
      .then((res) => res.json())
      .then((data: EstadoPresentacion) => {
        if (cancelled) return;
        setEstado(data);
      })
      .catch((err) => { if (!cancelled) toast.error(translateError(err)); });
    return () => { cancelled = true; };
  }, [grupoId]);

  const entregar = async () => {
    if (!archivo) {
      toast.error(t('formularios:presentacion.falta_entrega'));
      return;
    }
    setEnviando(true);
    setOk(false);
    try {
      // 1) Presign (valida gating + formato server-side) → 2) PUT directo a S3.
      const presign = await fetchWithErrorMapping(`${API_URL}/grupos/${grupoId}/presentacion-final/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: archivo.name, contentType: archivo.type || 'application/octet-stream' }),
      }).then(r => r.json());
      const putRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': archivo.type || 'application/octet-stream' },
        body: archivo,
      });
      if (!putRes.ok) throw new Error('upload_failed');

      await fetchWithErrorMapping(`${API_URL}/grupos/${grupoId}/presentacion-final`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivoKey: presign.key }),
      });
      setOk(true);
      setArchivo(null);
      if (fileRef.current) fileRef.current.value = '';
      toast.success(t('formularios:presentacion.entregada'));
      await cargar();
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setEnviando(false);
    }
  };

  const entrega = estado?.entrega ?? null;

  return (
    <div className="gform-container">
      <Link to={backTo} className="btn-link">
        {t('formularios:grupo.back')}
      </Link>
      {loading && <Loading label={t('common:loading')} />}

      {estado && (
        <>
          <div className="gform-header">
            <h1>{t('formularios:presentacion.title')}</h1>
            <p className="gform-desc">{t('formularios:presentacion.hint')}</p>
          </div>

          {/* RF-32: bloqueada hasta la fase de cierre configurada en el programa. */}
          {!estado.habilitada ? (
            <div className="gform-card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
              🔒 {estado.desdeSesion
                ? t('formularios:presentacion.no_habilitada_sesion', { n: estado.desdeSesion })
                : t('formularios:presentacion.no_habilitada')}
            </div>
          ) : (
            <>
              {entrega && (
                <div className="gform-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
                  {/* gform-card es flex-row: envolvemos en gform-card-body (flex:1; min-width:0)
                      para que el contenido apile en columna y el nombre largo no se salga. */}
                  <div className="gform-card-body">
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>✓ {t('formularios:presentacion.entregada')}</div>
                    {entrega.entregadoPor && entrega.entregadoEn && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                        {t('formularios:presentacion.entregada_por', {
                          nombre: entrega.entregadoPor.nombre,
                          fecha: new Date(entrega.entregadoEn).toLocaleString(),
                        })}
                      </div>
                    )}
                    {entrega.archivoNombre && (
                      <div style={{ fontSize: '0.85rem', overflowWrap: 'anywhere' }}>
                        📎 {t('formularios:presentacion.archivo_actual')}: {entrega.archivoNombre}
                      </div>
                    )}
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 8 }}>
                      {t('formularios:presentacion.reemplazar_hint')}
                    </div>
                  </div>
                </div>
              )}

              <div className="gform-card">
                <div className="gform-question">
                  {t(entrega ? 'formularios:presentacion.archivo_label_reemplazar' : 'formularios:presentacion.archivo_label')}
                </div>
                <div className="gform-answer">
                  <label className="gform-file">
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.ppt,.pptx"
                      onChange={e => setArchivo(e.target.files?.[0] ?? null)}
                      aria-label={t(entrega ? 'formularios:presentacion.archivo_label_reemplazar' : 'formularios:presentacion.archivo_label')}
                    />
                    <span className="gform-file-btn">📎 {t('formularios:presentacion.seleccionar_archivo')}</span>
                    <span className={archivo ? 'gform-file-name' : 'gform-file-name gform-file-name--empty'}>
                      {archivo ? archivo.name : t('formularios:presentacion.ningun_archivo')}
                    </span>
                  </label>
                </div>
              </div>

              <div className="gform-footer">
                <button className="gform-submit" disabled={enviando} onClick={entregar}>
                  {enviando ? t('formularios:presentacion.subiendo') : t('formularios:presentacion.subir')}
                </button>
                {ok && <span className="gform-autosave">✓ {t('formularios:presentacion.entregada')}</span>}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
