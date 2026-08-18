import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Modal, Field, InfoTooltip } from '../../components/ui';
import { toast } from '../../components/toast-store';
import type { Sesion } from './programas.types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// ─────────────────────────────────────────────────────────────
// Modal para crear/editar sesión
// ─────────────────────────────────────────────────────────────
export function SesionFormModal({
  programaId, editing, defaultNumero, fechaInicio, fechaFin, onClose, onSaved,
}: {
  programaId: string;
  editing: Sesion | null;
  defaultNumero: number;
  fechaInicio: string | null;
  fechaFin: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [saving, setSaving] = useState(false);
  const [langTab, setLangTab] = useState<'es' | 'pt'>('es');
  const [form, setForm] = useState({
    numeroSesion: editing?.numeroSesion ?? defaultNumero,
    titulo: editing?.titulo ?? '',
    descripcion: editing?.descripcion ?? '',
    fechaProgramada: editing?.fechaProgramada ? editing.fechaProgramada.slice(0, 16) : '',
    urlPresentacion: editing?.urlPresentacion ?? '',
    urlGrabacion: editing?.urlGrabacion ?? '',
    estado: editing?.estado ?? 'pendiente' as const,
    tituloPt: '',
    descripcionPt: '',
  });
  // La presentación puede ser un enlace (urlPresentacion) o un archivo (PDF/PPT/PPTX)
  // subido a S3. Guardamos la key persistida y el archivo pendiente de subir por separado.
  const [presentacionArchivoKey, setPresentacionArchivoKey] = useState<string | null>(
    editing?.presentacionArchivoKey ?? null,
  );
  const [archivo, setArchivo] = useState<File | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  const nombreArchivoActual = presentacionArchivoKey ? presentacionArchivoKey.split('/').pop() : null;

  // Quita el archivo ya persistido (S3 + BD) en modo edición.
  const quitarArchivo = async () => {
    if (!editing || !presentacionArchivoKey) {
      setPresentacionArchivoKey(null);
      setArchivo(null);
      if (archivoRef.current) archivoRef.current.value = '';
      return;
    }
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/sesiones/${editing.id}/presentacion-archivo`, { method: 'DELETE' });
      setPresentacionArchivoKey(null);
      setArchivo(null);
      if (archivoRef.current) archivoRef.current.value = '';
      toast.success(t('admin:programas.sesiones.presentacion_archivo_quitado'));
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  useEffect(() => {
    if (!editing) return;
    (async () => {
      try {
        const res = await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/traducciones/pt`);
        const data = await res.json();
        const sesion = data?.sesiones?.find((s: any) => s.numeroSesion === editing.numeroSesion);
        if (sesion?.campos) {
          setForm(f => ({
            ...f,
            tituloPt: sesion.campos.titulo ?? '',
            descripcionPt: sesion.campos.descripcion ?? '',
          }));
        }
      } catch {
        // Silencioso
      }
    })();
  }, [editing?.id]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
    color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
    fontWeight: 500,
    fontSize: '0.8rem',
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // La presentación es obligatoria pero satisfacible con enlace O archivo (uno basta):
    // hay enlace, un archivo pendiente de subir, o una key ya persistida.
    if (!form.urlPresentacion.trim() && !archivo && !presentacionArchivoKey) {
      toast.error(t('admin:programas.sesiones.presentacion.requerida'));
      return;
    }
    setSaving(true);
    try {
      const body = {
        numeroSesion: form.numeroSesion,
        titulo: form.titulo,
        descripcion: form.descripcion || null,
        fechaProgramada: form.fechaProgramada ? new Date(form.fechaProgramada).toISOString() : null,
        urlPresentacion: form.urlPresentacion || null,
        presentacionArchivoKey,
        urlGrabacion: form.urlGrabacion || null,
        estado: form.estado,
      };
      // Se guarda primero la sesión (POST/PATCH) para tener su id; la presign de la
      // presentación (skill s3-key-naming) lo necesita para construir la key.
      let sesionId = editing?.id ?? '';
      if (editing) {
        await fetchWithErrorMapping(`${API_URL}/admin/sesiones/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        const creada = await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/sesiones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then((r) => r.json());
        sesionId = creada.id;
      }

      // Si hay un archivo pendiente: presign (valida formato server-side) → PUT directo a
      // S3 → PATCH la sesión con la key resultante.
      if (archivo && sesionId) {
        const presign = await fetchWithErrorMapping(`${API_URL}/admin/sesiones/${sesionId}/presign-presentacion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: archivo.name, contentType: archivo.type || 'application/octet-stream' }),
        }).then((r) => r.json());
        const putRes = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': archivo.type || 'application/octet-stream' },
          body: archivo,
        });
        if (!putRes.ok) throw new Error('upload_failed');
        await fetchWithErrorMapping(`${API_URL}/admin/sesiones/${sesionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presentacionArchivoKey: presign.key }),
        });
      }

      const tituloPt = form.tituloPt.trim();
      const descripcionPt = form.descripcionPt.trim();
      if (tituloPt || descripcionPt) {
        await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/traducciones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locale: 'pt',
            sesiones: [{
              numeroSesion: form.numeroSesion,
              titulo: tituloPt,
              descripcion: descripcionPt,
            }],
          }),
        });
      }

      toast.success(t(editing ? 'admin:programas.toast.session_updated' : 'admin:programas.toast.session_created'));
      onSaved();
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing ? t('admin:programas.sesiones.modal.title_edit') : t('admin:programas.sesiones.modal.title_create')}
      maxWidth={520}
    >
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 12 }}>
                <Field
                  label={<>{t('admin:programas.sesiones.fields.numero')}<InfoTooltip label={t('admin:programas.sesiones.fields.numero_hint')} /></>}
                  required
                >
                  <input
                    type="number"
                    className="input"
                    value={form.numeroSesion}
                    min={1}
                    onChange={e => setForm(f => ({ ...f, numeroSesion: Number(e.target.value) }))}
                    required
                  />
                </Field>
                <Field label={t('admin:programas.sesiones.fields.titulo')} required>
                  <input className="input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} required />
                </Field>
              </div>
              <Field label={t('admin:programas.sesiones.fields.descripcion')}>
                <textarea
                  className="input"
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  rows={2}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label={<>{t('admin:programas.sesiones.fields.titulo')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(pt)</span></>}>
                <input
                  className="input"
                  value={form.tituloPt}
                  onChange={e => setForm(f => ({ ...f, tituloPt: e.target.value }))}
                  placeholder={form.titulo}
                />
              </Field>
              <Field label={<>{t('admin:programas.sesiones.fields.descripcion')} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(pt)</span></>}>
                <textarea
                  className="input"
                  value={form.descripcionPt}
                  onChange={e => setForm(f => ({ ...f, descripcionPt: e.target.value }))}
                  rows={2}
                  placeholder={form.descripcion || undefined}
                />
              </Field>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: -4 }}>
                {t('admin:programas.lang.hint')}
              </div>
            </>
          )}
          <Field label={t('admin:programas.sesiones.fields.fecha')} required>
            <input
              type="datetime-local"
              className="input"
              value={form.fechaProgramada}
              onChange={e => setForm(f => ({ ...f, fechaProgramada: e.target.value }))}
              min={fechaInicio ? `${fechaInicio.slice(0, 10)}T00:00` : undefined}
              max={fechaFin ? `${fechaFin.slice(0, 10)}T23:59` : undefined}
              required
            />
          </Field>
          <fieldset
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              padding: '12px 14px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              margin: 0,
              minWidth: 0,
            }}
          >
            <legend style={{ padding: '0 6px', fontSize: '0.85rem', fontWeight: 600 }}>
              {t('admin:programas.sesiones.presentacion.legend')}{' '}
              <span style={{ color: 'var(--color-danger)' }}>*</span>
            </legend>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: -4 }}>
              {t('admin:programas.sesiones.presentacion.hint')}
            </div>
            <Field
              label={<>{t('admin:programas.sesiones.fields.url_presentacion')}<InfoTooltip label={t('admin:programas.sesiones.fields.url_presentacion_hint')} /></>}
            >
              <input
                className="input"
                type="url"
                value={form.urlPresentacion}
                onChange={e => setForm(f => ({ ...f, urlPresentacion: e.target.value }))}
                placeholder="https://…"
              />
            </Field>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                margin: '-2px 0',
                color: 'var(--color-text-tertiary)',
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
              {t('admin:programas.sesiones.presentacion.o')}
              <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            </div>
            <Field label={t('admin:programas.sesiones.fields.archivo_presentacion')}>
            {nombreArchivoActual || archivo ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  background: 'var(--color-surface-2, var(--color-bg))',
                  minWidth: 0,
                  maxWidth: '100%',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', flex: 1, minWidth: 0 }}>
                  <span style={{ flexShrink: 0 }}>📎</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    {archivo ? archivo.name : nombreArchivoActual}
                  </span>
                </span>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => archivoRef.current?.click()}>
                    {t('admin:programas.sesiones.presentacion_archivo_cambiar')}
                  </button>
                  <button
                    type="button"
                    className="btn-link"
                    style={{ color: 'var(--color-danger)', fontSize: '0.8rem' }}
                    onClick={quitarArchivo}
                  >
                    {t('admin:programas.sesiones.presentacion_archivo_quitar')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => archivoRef.current?.click()}
              >
                ⬆️ {t('admin:programas.sesiones.presentacion_archivo_seleccionar')}
              </button>
            )}
            <input
              ref={archivoRef}
              type="file"
              accept=".pdf,.ppt,.pptx"
              style={{ display: 'none' }}
              onChange={e => setArchivo(e.target.files?.[0] ?? null)}
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
              {t('admin:programas.sesiones.presentacion_archivo_hint')}
            </div>
          </Field>
          </fieldset>
          <Field
            label={<>{t('admin:programas.sesiones.fields.url_grabacion')}<InfoTooltip label={t('admin:programas.sesiones.fields.url_grabacion_hint')} /></>}
          >
            <input
              className="input"
              type="url"
              value={form.urlGrabacion}
              onChange={e => setForm(f => ({ ...f, urlGrabacion: e.target.value }))}
              placeholder="https://…"
            />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>{t('common:buttons.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common:actions.saving') : t('common:buttons.save')}
            </button>
          </div>
        </form>
    </Modal>
  );
}
