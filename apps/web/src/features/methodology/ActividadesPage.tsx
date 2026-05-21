import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmModal } from '../../components/ConfirmModal';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type PlantillaOption = { id: string; nombre: string; _count: { pasos: number } };

export function ActividadesPage() {
  const [list, setList] = useState<any[]>([]);
  const [iniciativas, setIniciativas] = useState<any[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaOption[]>([]);
  const [wasValidated, setWasValidated] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string; nombre: string } | null>(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', iniciativaId: '', plantillaId: '' });
  const [toast, setToast] = useState<string | null>(null);
  const [empresaFiltro, setEmpresaFiltro] = useState('');

  const [editModal, setEditModal] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '', descripcion: '', iniciativaId: '' });
  const [editWasValidated, setEditWasValidated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const empresas = React.useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; nombre: string }[] = [];
    for (const ini of iniciativas) {
      if (ini.empresa && !seen.has(ini.empresa.id)) {
        seen.add(ini.empresa.id);
        result.push({ id: ini.empresa.id, nombre: ini.empresa.nombre });
      }
    }
    return result;
  }, [iniciativas]);

  const iniciativasFiltradas = empresaFiltro
    ? iniciativas.filter(ini => ini.empresa?.id === empresaFiltro)
    : iniciativas;

  const listFiltrada = empresaFiltro
    ? list.filter(a => a.iniciativa?.empresa?.id === empresaFiltro)
    : list;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    const res = await fetch(`${API_URL}/methodology/actividades`);
    if (res.ok) setList(await res.json());
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/methodology/actividades`).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/organization/iniciativas`).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/admin/plantillas`).then(r => r.ok ? r.json() : []),
    ]).then(([acts, inis, plts]) => {
      setList(acts);
      setIniciativas(inis);
      setPlantillas(plts);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (empresaFiltro && form.iniciativaId) {
      const valida = iniciativasFiltradas.some(ini => ini.id === form.iniciativaId);
      if (!valida) setForm(prev => ({ ...prev, iniciativaId: '' }));
    }
  }, [empresaFiltro]);

  const create = async () => {
    if (!form.iniciativaId) return;
    try {
      const body: any = { nombre: form.nombre, descripcion: form.descripcion, iniciativaId: form.iniciativaId };
      if (form.plantillaId) body.plantillaId = form.plantillaId;
      const res = await fetch(`${API_URL}/methodology/actividades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        load();
        setForm({ nombre: '', descripcion: '', iniciativaId: form.iniciativaId, plantillaId: '' });
        setWasValidated(false);
        if (form.plantillaId) {
          const p = plantillas.find(p => p.id === form.plantillaId);
          showToast(`Actividad creada con ${p?._count.pasos ?? 0} pasos copiados de "${p?.nombre}"`);
        } else {
          showToast('Actividad creada correctamente');
        }
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || 'Error al crear la actividad');
      }
    } catch { showToast('Error al crear la actividad'); }
  };

  const openEdit = (a: any) => {
    setEditModal(a);
    setEditForm({ nombre: a.nombre, descripcion: a.descripcion || '', iniciativaId: a.iniciativaId });
    setEditWasValidated(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formEl = e.currentTarget as HTMLFormElement;
    setEditWasValidated(true);
    if (!formEl.checkValidity()) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/methodology/actividades/${editModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editForm.nombre, descripcion: editForm.descripcion, iniciativaId: editForm.iniciativaId }),
      });
      load();
      setEditModal(null);
      showToast('Actividad actualizada');
    } catch { showToast('Error al actualizar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    await fetch(`${API_URL}/methodology/actividades/${deleteModal.id}`, { method: 'DELETE' });
    setDeleteModal(null);
    load();
    showToast('Actividad eliminada');
  };

  const plantillaSeleccionada = plantillas.find(p => p.id === form.plantillaId);

  return (
    <div>
      {toast && <div className="toast">{toast}</div>}

      <ConfirmModal
        isOpen={!!deleteModal}
        title="¿Eliminar Actividad?"
        message={`Se desactivarán también los pasos y ejecuciones de "${deleteModal?.nombre}".`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(null)}
      />

      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Editar Actividad</h3>
              <button onClick={() => setEditModal(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '1.25rem', color: 'var(--color-text-secondary)', lineHeight: 1, padding: 4,
              }}>×</button>
            </div>
            <form
              className={editWasValidated ? 'was-validated' : ''}
              onSubmit={handleEdit}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              noValidate
            >
              <div>
                <label className="required-label" style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>Iniciativa</label>
                <select className="input" required value={editForm.iniciativaId}
                  onChange={e => setEditForm({ ...editForm, iniciativaId: e.target.value })}>
                  <option value="">Seleccione una iniciativa</option>
                  {iniciativas.map(ini => (
                    <option key={ini.id} value={ini.id}>{ini.nombre} ({ini.empresa?.nombre})</option>
                  ))}
                </select>
                <div className="invalid-feedback">Seleccione una iniciativa.</div>
              </div>
              <div>
                <label className="required-label" style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>Nombre</label>
                <input className="input" required value={editForm.nombre}
                  onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} />
                <div className="invalid-feedback">El nombre es necesario.</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: '0.875rem' }}>Descripción</label>
                <textarea className="input" rows={4} value={editForm.descripcion}
                  onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>Actividades</h1>
          <p className="page-description">
            Paso 3 de 4 — Define los flujos de trabajo paso a paso que los participantes ejecutarán.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
          <Link to="/admin/plantillas" className="btn btn-secondary"
            style={{ textDecoration: 'none', fontSize: '0.8rem' }}>
            📋 Gestionar plantillas
          </Link>
          {list.length > 0 && (
            <Link to="/admin/instancias" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              Siguiente: Ejecuciones →
            </Link>
          )}
        </div>
      </div>

      {/* Filtro por empresa */}
      {loaded && empresas.length > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: 'white', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', padding: '0.625rem 1rem',
          marginBottom: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>🏢</span>
          <label style={{
            fontWeight: 600, fontSize: '0.875rem',
            color: 'var(--color-text-main)', whiteSpace: 'nowrap',
          }}>
            Empresa
          </label>
          <select
            className="input"
            style={{ flex: 1, maxWidth: 320, marginBottom: 0 }}
            value={empresaFiltro}
            onChange={e => setEmpresaFiltro(e.target.value)}
          >
            <option value="">Todas las empresas</option>
            {empresas.map(e => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
          {empresaFiltro ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
              {listFiltrada.length} {listFiltrada.length === 1 ? 'actividad' : 'actividades'}
            </span>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
              {list.length} en total
            </span>
          )}
        </div>
      )}

      {/* Prerequisite warning */}
      {loaded && iniciativas.length === 0 && (
        <div className="prereq-banner">
          <span className="prereq-banner-icon">⚠️</span>
          <div className="prereq-banner-body">
            <p className="prereq-banner-title">Primero necesitas crear una iniciativa</p>
            <p className="prereq-banner-text">
              Las actividades pertenecen a una iniciativa. Ve al paso anterior y crea al menos una.
            </p>
          </div>
          <Link to="/admin/iniciativas" className="btn btn-secondary"
            style={{ textDecoration: 'none', flexShrink: 0, fontSize: '0.8125rem' }}>
            Ir a Iniciativas →
          </Link>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>

        {/* Create form */}
        <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: '20px' }}>
          <h3 style={{ margin: '0 0 4px' }}>Nueva Actividad</h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.8125rem' }}>
            Cada actividad contiene pasos con instrucciones y, opcionalmente, asistencia de IA.
          </p>
          <form
            className={wasValidated ? 'was-validated' : ''}
            onSubmit={(e) => { e.preventDefault(); const formEl = e.currentTarget; setWasValidated(true); if (formEl.checkValidity()) create(); }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            noValidate
          >
            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 5 }}>Iniciativa</label>
              <select className="input" required value={form.iniciativaId}
                onChange={e => setForm({ ...form, iniciativaId: e.target.value })}
                disabled={iniciativasFiltradas.length === 0}>
                <option value="">{iniciativasFiltradas.length === 0 ? 'Sin iniciativas disponibles' : 'Seleccione una Iniciativa'}</option>
                {iniciativasFiltradas.map(ini => (
                  <option key={ini.id} value={ini.id}>{ini.nombre}{!empresaFiltro && ini.empresa ? ` (${ini.empresa.nombre})` : ''}</option>
                ))}
              </select>
              <div className="invalid-feedback">Seleccione una iniciativa.</div>
            </div>

            {/* Selector de plantilla */}
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>Plantilla <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(opcional)</span></label>
              {plantillas.length === 0 ? (
                <>
                  <select className="input" disabled>
                    <option>No hay plantillas creadas aún</option>
                  </select>
                  <div style={{ marginTop: 4, fontSize: '0.78rem' }}>
                    <Link to="/admin/plantillas" style={{ color: 'var(--color-primary)' }}>Crear plantillas →</Link>
                  </div>
                </>
              ) : (
                <>
                  <select className="input" value={form.plantillaId}
                    onChange={e => setForm({ ...form, plantillaId: e.target.value })}
                    disabled={iniciativasFiltradas.length === 0}>
                    <option value="">Sin plantilla — crear desde cero</option>
                    {plantillas.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} ({p._count.pasos} pasos)</option>
                    ))}
                  </select>
                  {plantillaSeleccionada && (
                    plantillaSeleccionada._count.pasos > 0 ? (
                      <div style={{ marginTop: 6, padding: '8px 12px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: '#166534' }}>
                        ✓ Se copiarán <strong>{plantillaSeleccionada._count.pasos} pasos</strong> automáticamente al guardar
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, padding: '8px 12px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: '#92400E' }}>
                        ⚠️ Esta plantilla no tiene pasos. Podrás agregarlos después de crear la actividad.
                      </div>
                    )
                  )}
                </>
              )}
            </div>

            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 5 }}>Nombre</label>
              <input className="input" required placeholder="Ej: Análisis de Brechas"
                value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                disabled={iniciativasFiltradas.length === 0} />
              <div className="invalid-feedback">Ingrese el nombre de la actividad.</div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>Descripción <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(opcional)</span></label>
              <textarea className="input" placeholder="¿Qué se espera lograr en esta actividad?"
                value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                rows={4} disabled={iniciativasFiltradas.length === 0} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={iniciativasFiltradas.length === 0}>
              Guardar Actividad
            </button>
          </form>
        </div>

        {/* List */}
        <div>
          {listFiltrada.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">⚡</div>
                <p className="empty-state-title">
                  {empresaFiltro ? 'No hay actividades para esta empresa' : 'Aún no hay actividades'}
                </p>
                <p className="empty-state-desc">
                  {iniciativas.length === 0
                    ? 'Necesitas una iniciativa antes de crear actividades.'
                    : empresaFiltro
                      ? 'Crea la primera actividad para esta empresa usando el formulario.'
                      : 'Crea tu primera actividad usando el formulario de la izquierda. Luego podrás agregar pasos e instrucciones.'}
                </p>
                {iniciativas.length === 0 && (
                  <Link to="/admin/iniciativas" className="btn btn-secondary" style={{ textDecoration: 'none', marginTop: 4, fontSize: '0.8125rem' }}>
                    Ir a Iniciativas →
                  </Link>
                )}
              </div>
            </div>
          ) : (
            listFiltrada.map((a: any) => (
              <div key={a.id} className="card" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                      <span className="status-badge status-info" style={{ fontSize: '0.7rem' }}>
                        {a.iniciativa?.empresa?.nombre}
                      </span>
                      <span className="status-badge status-neutral" style={{ fontSize: '0.7rem' }}>
                        {a.iniciativa?.nombre}
                      </span>
                      {a.plantillaOrigenId && (
                        <span className="status-badge" style={{ fontSize: '0.7rem', background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE' }}>
                          📋 Desde plantilla
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: '0 0 4px', color: 'var(--color-text-main)', fontSize: '1rem' }}>{a.nombre}</h3>
                    {a.descripcion && (
                      <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.8125rem', lineHeight: 1.5 }}>
                        {a.descripcion}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '0.82rem' }}
                      onClick={() => openEdit(a)}>
                      Editar
                    </button>
                    <Link to={`/admin/actividades/${a.id}/pasos`} className="btn btn-primary"
                      style={{ padding: '5px 12px', fontSize: '0.82rem', textDecoration: 'none' }}>
                      ⚙️ Configurar pasos
                    </Link>
                    <button className="btn btn-danger" style={{ padding: '5px 8px', fontSize: '0.875rem' }}
                      onClick={() => setDeleteModal({ id: a.id, nombre: a.nombre })} title="Eliminar">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Next step hint */}
      {list.length > 0 && (
        <div style={{
          marginTop: '1.25rem',
          padding: '0.875rem 1.25rem',
          background: '#F0F9FF',
          border: '1px solid #BAE6FD',
          borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', gap: '0.875rem',
        }}>
          <span style={{ fontSize: '1rem' }}>💡</span>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#0369A1' }}>
            <strong>Siguiente paso:</strong> Configura los pasos de cada actividad, luego ve a Ejecuciones para generar enlaces.
          </p>
          <Link to="/admin/instancias" className="btn btn-secondary"
            style={{ textDecoration: 'none', flexShrink: 0, padding: '4px 12px', fontSize: '0.8rem' }}>
            Ir a Ejecuciones →
          </Link>
        </div>
      )}
    </div>
  );
}
