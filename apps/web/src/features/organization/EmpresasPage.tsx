import React, { useEffect, useState } from 'react';

const API_URL = 'http://127.0.0.1:3000'; // Ajustar según env

export function EmpresasPage() {
  const [empresas, setEmpresas] = useState([]);
  const [nombre, setNombre] = useState('');

  const load = async () => {
    const res = await fetch(`${API_URL}/organization/empresas`);
    setEmpresas(await res.json());
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!nombre) return;
    await fetch(`${API_URL}/organization/empresas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre })
    });
    setNombre('');
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1>Gestión de Empresas</h1>
      </div>
      
      <div className="card mb-4" style={{ maxWidth: '500px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Nueva Empresa</label>
        <div className="flex gap-2">
          <input 
            className="input"
            value={nombre} 
            onChange={e => setNombre(e.target.value)} 
            placeholder="Nombre de la empresa..." 
          />
          <button className="btn btn-primary" onClick={create}>Crear</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table cellPadding={0} cellSpacing={0}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Creado</th>
              <th style={{ width: 100 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((e: any) => (
              <tr key={e.id}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8em', color: 'var(--color-text-secondary)' }}>{e.id.split('-')[0]}...</td>
                <td style={{ fontWeight: 500 }}>{e.nombre}</td>
                <td style={{ color: 'var(--color-text-secondary)' }}>{new Date(e.createdAt).toLocaleDateString()}</td>
                <td>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>Editar</button>
                </td>
              </tr>
            ))}
            {empresas.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '2rem' }}>
                  No hay empresas registradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
