import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = 'http://127.0.0.1:3000';

export function ActividadesPage() {
  const [list, setList] = useState<any[]>([]);
  const [iniciativas, setIniciativas] = useState<any[]>([]);
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

  return (
    <div>
       <div className="flex justify-between items-center mb-4">
        <h1>Diseño de Metodología</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>
        
        {/* Formulario (Left) */}
        <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: '20px' }}>
          <h3>Nueva Actividad</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>Iniciativa</label>
              <select 
                className="input"
                value={form.iniciativaId}
                onChange={e => setForm({...form, iniciativaId: e.target.value})}
              >
                <option value="">Seleccione una Iniciativa</option>
                {iniciativas.map(ini => (
                  <option key={ini.id} value={ini.id}>{ini.nombre} ({ini.empresa?.nombre})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>Nombre de Actividad</label>
              <input 
                className="input"
                placeholder="Ej: Análisis de Brechas" 
                value={form.nombre}
                onChange={e => setForm({...form, nombre: e.target.value})}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>Descripción</label>
              <textarea 
                className="input"
                placeholder="¿Qué se espera en esta actividad?" 
                value={form.descripcion}
                onChange={e => setForm({...form, descripcion: e.target.value})}
                rows={4}
              />
            </div>
            <button className="btn btn-primary" onClick={create} disabled={!form.iniciativaId || !form.nombre}>
              Guardar Actividad
            </button>
          </div>
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

