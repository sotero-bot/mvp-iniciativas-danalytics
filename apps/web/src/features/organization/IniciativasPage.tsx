import React, { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function IniciativasPage() {
  const [iniciativas, setIniciativas] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [empresaId, setEmpresaId] = useState('');

  useEffect(() => {
    fetchIniciativas();
    fetchEmpresas();
  }, []);

  const fetchIniciativas = () => {
    fetch(`${API_URL}/organization/iniciativas`)
      .then(res => res.json())
      .then(setIniciativas);
  };

  const fetchEmpresas = () => {
    fetch(`${API_URL}/organization/empresas`)
      .then(res => res.json())
      .then(setEmpresas);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetch(`${API_URL}/organization/iniciativas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion, empresaId })
    }).then(() => {
      setNombre('');
      setDescripcion('');
      fetchIniciativas();
    });
  };

  return (
    <div>
      <h1 style={{ marginBottom: 30 }}>Gestión de Iniciativas</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 30 }}>
        <div className="card">
          <h3 style={{ marginBottom: 20 }}>Nueva Iniciativa</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>Empresa</label>
              <select
                className="input"
                value={empresaId}
                onChange={e => setEmpresaId(e.target.value)}
                required
              >
                <option value="">Seleccione una empresa</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>Nombre</label>
              <input
                className="input"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Transformación Digital"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5 }}>Descripción</label>
              <textarea
                className="input"
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Descripción breve..."
                rows={3}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={!empresaId}>Crear Iniciativa</button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 20 }}>Lista de Iniciativas</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Empresa</th>
                <th>Descripción</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {iniciativas.map(ini => (
                <tr key={ini.id}>
                  <td><strong>{ini.nombre}</strong></td>
                  <td><span className="status-badge" style={{ backgroundColor: '#e2e8f0', color: '#475569' }}>{ini.empresa?.nombre}</span></td>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.9em' }}>{ini.descripcion || '-'}</td>
                  <td style={{ fontSize: '0.85em' }}>{new Date(ini.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {iniciativas.length === 0 && (
            <p style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-secondary)' }}>No hay iniciativas registradas.</p>
          )}
        </div>
      </div>
    </div>
  );
}
