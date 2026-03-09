import React, { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api'; // Ajustar según env

export function EmpresasPage() {
  const [empresas, setEmpresas] = useState([]);
  const [nombre, setNombre] = useState('');
  const [wasValidated, setWasValidated] = useState(false);

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
    setWasValidated(false);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1>Gestión de Empresas</h1>
      </div>

      <div className="card mb-4" style={{ maxWidth: '500px' }}>
        <label className="required-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Nueva Empresa</label>
        <form
          className={wasValidated ? 'was-validated' : ''}
          onSubmit={(e) => {
            e.preventDefault();
            setWasValidated(true);
            if (e.currentTarget.checkValidity()) {
              create();
            }
          }}
          noValidate
        >
          <div className="flex gap-2" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <input
                className="input"
                required
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Nombre de la empresa..."
                style={{ width: '100%' }}
              />
              <div className="invalid-feedback">El nombre de la empresa es requerido.</div>
            </div>
            <button type="submit" className="btn btn-primary">Crear</button>
          </div>
        </form>
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
