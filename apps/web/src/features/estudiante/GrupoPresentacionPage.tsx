import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Loading } from '../../components/ui';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface EstadoPresentacion {
  habilitada: boolean;
  desdeSesion: number | null;
  entrega: {
    urlPresentacion: string | null;
    archivoKey: string | null;
    archivoNombre: string | null;
    entregadoEn: string | null;
    entregadoPor: { id: string; nombre: string } | null;
  } | null;
}

// Fase 3 (RF-32): entrega de la presentación final del grupo — link O archivo
// (PDF/PPT vía presigned PUT a S3). Solo habilitada en fase de cierre
// (a partir de la sesión configurada en el programa). Reentrega = reemplazo.
export function GrupoPresentacionPage() {
  const { grupoId = '' } = useParams();
  const { t } = useTranslation(['formularios', 'common']);
  const [estado, setEstado] = useState<EstadoPresentacion | null>(null);
  const [url, setUrl] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const cargar = React.useCallback(() => {
    setLoading(true);
    return fetchWithErrorMapping(`${API_URL}/grupos/${grupoId}/presentacion-final`)
      .then((res) => res.json())
      .then((data: EstadoPresentacion) => {
        setEstado(data);
        setUrl(data.entrega?.urlPresentacion ?? '');
      })
      .catch((err) => setToast(translateError(err)))
      .finally(() => setLoading(false));
  }, [grupoId]);

  useEffect(() => {
    let cancelled = false;
    fetchWithErrorMapping(`${API_URL}/grupos/${grupoId}/presentacion-final`)
      .then((res) => res.json())
      .then((data: EstadoPresentacion) => {
        if (cancelled) return;
        setEstado(data);
        setUrl(data.entrega?.urlPresentacion ?? '');
      })
      .catch((err) => { if (!cancelled) setToast(translateError(err)); });
    return () => { cancelled = true; };
  }, [grupoId]);

  const entregar = async () => {
    if (!url.trim() && !archivo) {
      setToast(t('formularios:presentacion.falta_entrega'));
      return;
    }
    setEnviando(true);
    setToast(null);
    setOk(false);
    try {
      let archivoKey: string | undefined;
      if (archivo) {
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
        archivoKey = presign.key;
      }

      await fetchWithErrorMapping(`${API_URL}/grupos/${grupoId}/presentacion-final`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urlPresentacion: url.trim() || undefined,
          archivoKey,
        }),
      });
      setOk(true);
      setArchivo(null);
      if (fileRef.current) fileRef.current.value = '';
      await cargar();
    } catch (err) {
      setToast(translateError(err));
    } finally {
      setEnviando(false);
    }
  };

  const entrega = estado?.entrega ?? null;

  return (
    <div className="gform-container">
      <Link to="/estudiante/grupo" style={{ fontSize: '0.85rem' }}>
        {t('formularios:grupo.back')}
      </Link>
      {toast && <div className="toast">{toast}</div>}
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
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>✓ {t('formularios:presentacion.entregada')}</div>
                  {entrega.entregadoPor && entrega.entregadoEn && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                      {t('formularios:presentacion.entregada_por', {
                        nombre: entrega.entregadoPor.nombre,
                        fecha: new Date(entrega.entregadoEn).toLocaleString(),
                      })}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.85rem' }}>
                    {entrega.urlPresentacion && (
                      <a href={entrega.urlPresentacion} target="_blank" rel="noreferrer">
                        🔗 {t('formularios:presentacion.ver_link')}
                      </a>
                    )}
                    {entrega.archivoNombre && (
                      <span>📎 {t('formularios:presentacion.archivo_actual')}: {entrega.archivoNombre}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 8 }}>
                    {t('formularios:presentacion.reemplazar_hint')}
                  </div>
                </div>
              )}

              <div className="gform-card">
                <div className="gform-question">{t('formularios:presentacion.url_label')}</div>
                <div className="gform-answer">
                  <input
                    className="gform-input"
                    placeholder="https://…"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    aria-label={t('formularios:presentacion.url_label')}
                  />
                </div>
              </div>

              <div className="gform-card">
                <div className="gform-question">{t('formularios:presentacion.archivo_label')}</div>
                <div className="gform-answer">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.ppt,.pptx"
                    onChange={e => setArchivo(e.target.files?.[0] ?? null)}
                    aria-label={t('formularios:presentacion.archivo_label')}
                  />
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
