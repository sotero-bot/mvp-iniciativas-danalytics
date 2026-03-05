import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { EmpresasPage } from './features/organization/EmpresasPage';
import { IniciativasPage } from './features/organization/IniciativasPage';
import { ActividadesPage } from './features/methodology/ActividadesPage';
import { InstanciasPage } from './features/execution/InstanciasPage';
import { InstanciaDetallePage } from './features/execution/InstanciaDetallePage';

import { RunnerPage } from './features/execution/RunnerPage';
import { EnlaceRunnerPage } from './features/execution/EnlaceRunnerPage';
import { ActividadPasosPage } from './features/methodology/ActividadPasosPage';

const Layout = ({ children }: { children: React.ReactNode }) => (
  <div className="layout-container">
    <aside className="sidebar">
      <div className="sidebar-title">
        <div style={{ width: 24, height: 24, background: 'var(--color-primary)', borderRadius: 6 }}></div>
        <span>Danalytics</span>
      </div>
      <nav>
        <NavLink to="/admin/empresas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          Empresas
        </NavLink>
        <NavLink to="/admin/iniciativas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          Iniciativas
        </NavLink>
        <NavLink to="/admin/actividades" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          Actividades
        </NavLink>
        <NavLink to="/admin/instancias" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          Instancias
        </NavLink>
      </nav>
    </aside>
    <main className="main-content">
      {children}
    </main>
  </div>
);

import { LoginPage } from './features/auth/LoginPage';

function App() {
  const [token, setToken] = React.useState<string | null>(localStorage.getItem('admin_token'));

  const handleLogin = (newToken: string) => {
    localStorage.setItem('admin_token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
  };

  // Wrapper para proteger rutas de admim
  const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    if (!token) return <LoginPage onLogin={handleLogin} />;
    return <>{children}</>;
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Routes (Protected) */}
        <Route path="/admin/empresas" element={<AdminRoute><Layout><EmpresasPage /></Layout></AdminRoute>} />
        <Route path="/admin/iniciativas" element={<AdminRoute><Layout><IniciativasPage /></Layout></AdminRoute>} />
        <Route path="/admin/actividades" element={<AdminRoute><Layout><ActividadesPage /></Layout></AdminRoute>} />
        <Route path="/admin/actividades/:id/pasos" element={<AdminRoute><Layout><ActividadPasosPage /></Layout></AdminRoute>} />
        <Route path="/admin/instancias" element={<AdminRoute><Layout><InstanciasPage /></Layout></AdminRoute>} />
        <Route path="/admin/instancias/:id" element={<AdminRoute><Layout><InstanciaDetallePage /></Layout></AdminRoute>} />

        {/* Public Runner Routes (No Auth) */}
        <Route path="/runner/enlace/:token" element={<EnlaceRunnerPage />} />
        <Route path="/runner/:token" element={<RunnerPage />} />

        {/* Login Route */}
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />

        {/* Default Redirect */}
        <Route path="*" element={
          token ?
            <Layout>
              <div className="card">
                <h2>Bienvenido al Panel de Administración</h2>
                <p>Seleccione una opción del menú.</p>
                <button className="btn btn-secondary" onClick={handleLogout} style={{ marginTop: 20 }}>Cerrar Sesión</button>
              </div>
            </Layout> :
            <LoginPage onLogin={handleLogin} />
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
