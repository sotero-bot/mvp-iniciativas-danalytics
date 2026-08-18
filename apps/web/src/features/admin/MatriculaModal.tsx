import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Modal, Field } from '../../components/ui';
import { toast } from '../../components/toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// ─────────────────────────────────────────────────────────────
// Modal de matrícula
// ─────────────────────────────────────────────────────────────
interface EstudianteEmpresa {
  id: string;
  nombre: string;
  email: string | null;
  participaciones: { activo: boolean; programa: { id: string; nombre: string; estado: string; empresaId: string } }[];
}

interface ImportFilaReporte {
  fila: number;
  email: string;
  nombre: string;
  cargo: string | null;
  area: string | null;
  estado: 'ok' | 'error' | 'aviso';
  errores: string[];
}

interface ImportReporte {
  registrado: boolean;
  resumen: { total: number; ok: number; error: number };
  filas: ImportFilaReporte[];
  matriculados?: number;
}

export function MatriculaModal({
  modo, programaId, empresaId, onClose, onSaved,
}: {
  modo: 'individual' | 'masiva';
  programaId: string;
  empresaId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [estudiantes, setEstudiantes] = useState<EstudianteEmpresa[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [saving, setSaving] = useState(false);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [form, setForm] = useState({ email: '', nombre: '', cargo: '', area: '', enviarInvitacion: true });

  // --- Carga masiva vía Excel ---
  const [archivo, setArchivo] = useState<File | null>(null);
  const [validando, setValidando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [enviarInvitacionBulk, setEnviarInvitacionBulk] = useState(true);
  const [reporte, setReporte] = useState<ImportReporte | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const cargarEstudiantes = React.useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetchWithErrorMapping(
        `${API_URL}/admin/usuarios?role=estudiante&empresaId=${empresaId}&estado=activo&conProgramas=1`,
      );
      setEstudiantes(await res.json());
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setLoadingList(false);
    }
  }, [empresaId]);

  useEffect(() => { cargarEstudiantes(); }, [cargarEstudiantes]);

  // Programas de ESTA empresa donde el estudiante ya participa (activo).
  const programasEmpresa = (est: EstudianteEmpresa) =>
    est.participaciones.filter(p => p.activo && p.programa.empresaId === empresaId);
  const yaEnEste = (est: EstudianteEmpresa) =>
    programasEmpresa(est).some(p => p.programa.id === programaId);

  const term = busqueda.trim().toLowerCase();
  // No mostrar estudiantes que ya están matriculados en ESTE programa: el picker
  // sirve para añadir nuevos, no para volver a listar a los que ya participan.
  const disponibles = estudiantes.filter(e => !yaEnEste(e));
  const filtrados = term
    ? disponibles.filter(e => e.nombre.toLowerCase().includes(term) || (e.email ?? '').toLowerCase().includes(term))
    : disponibles;
  // Si no queda ningún estudiante de la empresa por matricular en este programa,
  // no tiene sentido el buscador: se muestra directamente el formulario de registro.
  const sinDisponibles = !loadingList && disponibles.length === 0;

  const anadir = async (usuarioId: string) => {
    setAddingId(usuarioId);
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/participantes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId, enviarInvitacion: false }),
      });
      await cargarEstudiantes(); // refresca badges "ya matriculado"
      onSaved();
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setAddingId(null);
    }
  };

  const crearNuevo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/participantes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          nombre: form.nombre,
          cargo: form.cargo || null,
          area: form.area || null,
          enviarInvitacion: form.enviarInvitacion,
          locale: i18n.language,
        }),
      });
      setForm({ email: '', nombre: '', cargo: '', area: '', enviarInvitacion: true });
      setMostrarNuevo(false);
      await cargarEstudiantes();
      onSaved();
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  const descargarPlantilla = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/programas/participantes/plantilla`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla_matricula.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  // Sube el archivo al endpoint de importación. `validarSolo` → dry-run (preview);
  // en falso → registro transaccional "todo o nada".
  const subirArchivo = async (file: File, validarSolo: boolean): Promise<ImportReporte> => {
    const fd = new FormData();
    fd.append('archivo', file);
    fd.append('validarSolo', validarSolo ? '1' : '0');
    fd.append('enviarInvitacion', enviarInvitacionBulk ? '1' : '0');
    fd.append('locale', i18n.language);
    const res = await fetchWithErrorMapping(
      `${API_URL}/admin/programas/${programaId}/participantes/importar`,
      { method: 'POST', body: fd }, // sin Content-Type: el navegador pone el boundary
    );
    return res.json();
  };

  const onSeleccionArchivo = async (file: File | null) => {
    setReporte(null);
    setArchivo(file);
    if (!file) return;
    setValidando(true);
    try {
      setReporte(await subirArchivo(file, true));
    } catch (err) {
      setArchivo(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      const anyErr = err as { code?: string; details?: { columnasFaltantes?: string[] } };
      if (anyErr?.code === 'IMPORT_COLUMNAS_FALTANTES' && anyErr.details?.columnasFaltantes) {
        toast.error(
          t('admin:programas.participantes.import.columnas_faltantes', {
            cols: anyErr.details.columnasFaltantes.join(', '),
          }),
        );
      } else {
        toast.error(translateError(err));
      }
    } finally {
      setValidando(false);
    }
  };

  const registrarLote = async () => {
    if (!archivo) return;
    setRegistrando(true);
    try {
      const res = await subirArchivo(archivo, false);
      if (res.registrado) {
        await cargarEstudiantes();
        onSaved();
        onClose();
      } else {
        // El backend re-validó y encontró filas problemáticas: re-mostrar el preview.
        setReporte(res);
      }
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setRegistrando(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t(modo === 'masiva' ? 'admin:programas.participantes.modal.title_masiva' : 'admin:programas.participantes.modal.title')}
      maxWidth={560}
    >
      {modo === 'individual' && (<>
      {!sinDisponibles && (<>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 8 }}>
        {t('admin:programas.participantes.picker.registrados')}
      </div>
      <input
        className="input"
        placeholder={t('admin:programas.participantes.picker.buscar')}
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        style={{ marginBottom: 10 }}
      />

      {loadingList ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          {t('admin:programas.participantes.picker.loading')}
        </div>
      ) : filtrados.length === 0 ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', padding: '8px 0' }}>
          {t('admin:programas.participantes.picker.empty')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
          {filtrados.map(est => {
            const otros = programasEmpresa(est).filter(p => p.programa.id !== programaId);
            return (
              <div key={est.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{est.nombre}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{est.email}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                    {otros.length === 0
                      ? t('admin:programas.participantes.picker.sin_otros')
                      : <>{t('admin:programas.participantes.picker.otros_programas')} {otros.map(p => p.programa.nombre).join(', ')}</>}
                  </div>
                </div>
                <button className="btn" disabled={addingId === est.id} onClick={() => anadir(est.id)}>
                  {addingId === est.id ? t('common:actions.saving') : `+ ${t('admin:programas.participantes.picker.anadir')}`}
                </button>
              </div>
            );
          })}
        </div>
      )}
      </>)}

      <div style={sinDisponibles ? undefined : { marginTop: 14, paddingTop: 12 }}>
        {!mostrarNuevo && !sinDisponibles ? (
          <button className="btn-link" onClick={() => setMostrarNuevo(true)}>
            {t('admin:programas.participantes.picker.nuevo_toggle')}
          </button>
        ) : (
          <>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 8 }}>
              {t('admin:programas.participantes.picker.nuevo_title')}
            </div>
            <p style={{ marginTop: 0, color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
              {t('admin:programas.participantes.modal.hint')}
            </p>
            <form onSubmit={crearNuevo} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label={t('admin:programas.participantes.fields.email')} required>
                <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </Field>
              <Field label={t('admin:programas.participantes.fields.nombre')} required>
                <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
              </Field>
              <div className="form-grid">
                <Field label={t('admin:programas.participantes.fields.cargo')}>
                  <input className="input" value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
                </Field>
                <Field label={t('admin:programas.participantes.fields.area')}>
                  <input className="input" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} />
                </Field>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.enviarInvitacion} onChange={e => setForm(f => ({ ...f, enviarInvitacion: e.target.checked }))} />
                {t('admin:programas.participantes.fields.enviar_invitacion')}
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => sinDisponibles ? onClose() : setMostrarNuevo(false)} disabled={saving}>{t('common:buttons.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? t('common:actions.saving') : t('common:buttons.save')}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
      </>)}

      {modo === 'masiva' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ marginTop: 0, color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
            {t('admin:programas.participantes.import.hint')}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={descargarPlantilla}>
              {t('admin:programas.participantes.import.descargar_plantilla')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={validando || registrando}
            >
              {validando
                ? t('admin:programas.participantes.import.validando')
                : t('admin:programas.participantes.import.subir_archivo')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={e => onSeleccionArchivo(e.target.files?.[0] ?? null)}
            />
            {archivo && (
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{archivo.name}</span>
            )}
          </div>

          {reporte && (
            <>
              <div style={{ fontSize: '0.85rem' }}>
                {t('admin:programas.participantes.import.resumen', {
                  total: reporte.resumen.total,
                  ok: reporte.resumen.ok,
                  error: reporte.resumen.error,
                })}
              </div>

              {reporte.filas.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                  {t('admin:programas.participantes.import.sin_filas')}
                </div>
              ) : (
                <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)' }}>
                        <th style={{ padding: '6px 8px' }}>{t('admin:programas.participantes.import.col_fila')}</th>
                        <th style={{ padding: '6px 8px' }}>{t('admin:programas.participantes.import.col_email')}</th>
                        <th style={{ padding: '6px 8px' }}>{t('admin:programas.participantes.import.col_nombre')}</th>
                        <th style={{ padding: '6px 8px' }}>{t('admin:programas.participantes.import.col_estado')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reporte.filas.map(f => {
                        const color =
                          f.estado === 'ok' ? 'var(--color-success)'
                          : f.estado === 'aviso' ? 'var(--color-warning)'
                          : 'var(--color-danger)';
                        return (
                          <tr key={f.fila} style={{ borderTop: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '6px 8px' }}>{f.fila}</td>
                            <td style={{ padding: '6px 8px', wordBreak: 'break-all' }}>{f.email || '—'}</td>
                            <td style={{ padding: '6px 8px' }}>{f.nombre || '—'}</td>
                            <td style={{ padding: '6px 8px' }}>
                              <div style={{ fontWeight: 600, color }}>
                                {t(`admin:programas.participantes.import.estado_${f.estado}`)}
                              </div>
                              {f.errores.length > 0 && (
                                <div style={{ color: 'var(--color-text-secondary)', marginTop: 2 }}>
                                  {f.errores
                                    .map(code => t(`admin:programas.participantes.import.errores.${code}`))
                                    .join(' · ')}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enviarInvitacionBulk}
                  onChange={e => setEnviarInvitacionBulk(e.target.checked)}
                />
                {t('admin:programas.participantes.fields.enviar_invitacion')}
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={registrando || validando || reporte.resumen.error > 0 || reporte.resumen.ok === 0}
                  onClick={registrarLote}
                >
                  {registrando
                    ? t('common:actions.saving')
                    : t('admin:programas.participantes.import.registrar', { n: reporte.resumen.ok })}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
