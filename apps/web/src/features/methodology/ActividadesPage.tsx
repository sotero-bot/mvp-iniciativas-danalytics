import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function ActividadesPage() {
  const [list, setList] = useState<any[]>([]);
  const [iniciativas, setIniciativas] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [wasValidated, setWasValidated] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    iniciativaId: ''
  });

  const load = async () => {
    const res = await fetch(`${API_URL}/methodology/actividades`);
    setList(await res.json());
  };

  const loadIniciativas = async () => {
    const res = await fetch(`${API_URL}/organization/iniciativas`);
    setIniciativas(await res.json());
  };

  useEffect(() => {
    load();
    loadIniciativas();
  }, []);

  const create = async () => {
    if (!form.iniciativaId) {
      alert('Debe seleccionar una Iniciativa');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/methodology/actividades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          descripcion: form.descripcion,
          iniciativaId: form.iniciativaId
        })
      });

      if (res.ok) {
        load();
        setForm({
          nombre: '',
          descripcion: '',
          iniciativaId: form.iniciativaId
        });
      }
    } catch (e) {
      alert('Error en el servidor');
    }
  };

  const update = async () => {
    if (!form.iniciativaId || !editingId) {
      alert('Debe seleccionar una Iniciativa y estar editando una actividad');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/methodology/actividades/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          descripcion: form.descripcion,
          iniciativaId: form.iniciativaId
        })
      });

      if (res.ok) {
        load();
        cancelEdit();
      }
    } catch (e) {
      alert('Error en el servidor al actualizar');
    }
  };

  const edit = (a: any) => {
    setEditingId(a.id);
    setForm({
      nombre: a.nombre,
      descripcion: a.descripcion || '',
      iniciativaId: a.iniciativaId
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({
      nombre: '',
      descripcion: '',
      iniciativaId: form.iniciativaId
    });
    setWasValidated(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1>Diseño de Metodología</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>

        {/* Formulario (Left) */}
        <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: '20px' }}>
          <h3>{editingId ? 'Editar Actividad' : 'Nueva Actividad'}</h3>
          <form
            className={wasValidated ? 'was-validated' : ''}
            onSubmit={(e) => {
              e.preventDefault();
              setWasValidated(true);
              if (e.currentTarget.checkValidity()) {
                editingId ? update() : create();
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}
            noValidate
          >
            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 5 }}>Iniciativa</label>
              <select
                className="input"
                required
                value={form.iniciativaId}
                onChange={e => setForm({ ...form, iniciativaId: e.target.value })}
              >
                <option value="">Seleccione una Iniciativa</option>
                {iniciativas.map(ini => (
                  <option key={ini.id} value={ini.id}>{ini.nombre} ({ini.empresa?.nombre})</option>
                ))}
              </select>
              <div className="invalid-feedback">Seleccione una iniciativa.</div>
            </div>
            <div>
              <label className="required-label" style={{ display: 'block', marginBottom: 5 }}>Nombre de Actividad</label>
              <input
                className="input"
                required
                placeholder="Ej: Análisis de Brechas"
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
              />
              <div className="invalid-feedback">Ingrese el nombre de la actividad.</div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>Descripción</label>
              <textarea
                className="input"
                placeholder="¿Qué se espera en esta actividad?"
                value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
                rows={4}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {editingId ? 'Guardar Cambios' : 'Guardar Actividad'}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={cancelEdit}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Listado (Right) */}
        <div>
          {list.map((a: any) => (
            <div key={a.id} className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 5 }}>
                    <span className="status-badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '0.7em' }}>
                      {a.iniciativa?.empresa?.nombre}
                    </span>
                    <span className="status-badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.7em' }}>
                      {a.iniciativa?.nombre}
                    </span>
                    <span className="status-badge status-neutral" style={{ fontSize: '0.7em' }}>
                      {a.estado}
                    </span>
                  </div>
                  <h3 style={{ margin: 0, color: 'var(--color-primary)' }}>{a.nombre}</h3>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '0.85rem' }} onClick={() => edit(a)}>
                    ✏️ Editar
                  </button>
                  <Link to={`/admin/actividades/${a.id}/pasos`} className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '0.85rem' }}>
                    ⚙️ Gestionar Pasos
                  </Link>
                </div>
              </div>
              <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.8rem', fontSize: '0.95em' }}>{a.descripcion}</p>
            </div>
          ))}
          {list.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
              No hay actividades configuradas. Comience seleccionando una iniciativa y creando una nueva actividad.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

