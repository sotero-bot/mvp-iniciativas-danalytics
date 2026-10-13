import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping } from '../shared/api/fetchWithErrorMapping';
import { SidebarIcon } from './SidebarIcon';
import { construirEntradasPrograma } from './sidebar-programas';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const STORAGE_KEY = 'sidebar_programa';

interface ProgramaNav {
  id: string;
  nombre: string;
  fase?: { fase: 1 | 2 | 3; clave: string; completada?: true };
}

// Cache a nivel de módulo (mismo patrón que currentUserCache en App.tsx): el Layout se
// remonta en cada ruta y sin esto se pediría la lista de programas en cada clic.
// Se cachea por rol (cada rol usa un endpoint distinto) y se limpia en logout.
// `programasPendiente` evita una segunda petición si el Layout se remonta con la primera en vuelo.
const programasCache = new Map<string, ProgramaNav[]>();
const programasPendiente = new Map<string, Promise<ProgramaNav[]>>();
export function clearProgramasCache() {
  programasCache.clear();
  programasPendiente.clear();
}

// Clientes: GET /portal/programas devuelve { iaEnAccion, decisionIa }; solo se usa iaEnAccion
// (los de Decisión IA no tienen vistas de programa). Facilitador y estudiante: GET /programas.
const esCliente = (role: string) => role === 'cliente_admin' || role === 'usuario_cliente';

function cargarProgramas(role: string): Promise<ProgramaNav[]> {
  const cacheado = programasCache.get(role);
  if (cacheado) return Promise.resolve(cacheado);
  let pendiente = programasPendiente.get(role);
  if (!pendiente) {
    const url = esCliente(role) ? `${API_URL}/portal/programas` : `${API_URL}/programas`;
    const nueva: Promise<ProgramaNav[]> = fetchWithErrorMapping(url)
      .then((r) => r.json())
      .then((data) => {
        const lista: ProgramaNav[] = esCliente(role) ? (data?.iaEnAccion ?? []) : data;
        // Si se limpió el caché (logout) mientras volaba, no lo repoblamos con datos del usuario anterior.
        if (programasPendiente.get(role) === nueva) programasCache.set(role, lista);
        return lista;
      })
      .finally(() => {
        if (programasPendiente.get(role) === nueva) programasPendiente.delete(role);
      });
    programasPendiente.set(role, nueva);
    pendiente = nueva;
  }
  return pendiente;
}

function leerSeleccion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function guardarSeleccion(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* sin almacenamiento: la selección dura lo que dure el montaje */
  }
}

const PROGRAMA_EN_URL = /^\/(?:estudiante|facilitador|portal)\/programas\/([^/]+)(?:\/|$)/;

// HU-01 / HU-15: "Programas" desplegable en el sidebar para estudiante, facilitador y clientes.
// Además del acceso desde Inicio, lista los programas del usuario y, al elegir uno, las entradas de ese programa.
export function SidebarProgramasNav({ role }: { role: string }) {
  const { t } = useTranslation(['admin', 'common', 'programa']);
  const { pathname } = useLocation();
  const habilitado = construirEntradasPrograma(role, '_').length > 0;

  const [programas, setProgramas] = useState<ProgramaNav[] | null>(programasCache.get(role) ?? null);
  const [error, setError] = useState(false);
  const idEnUrl = PROGRAMA_EN_URL.exec(pathname)?.[1] ?? null;
  // La URL manda sobre lo guardado: un deep link o un refresco deben abrir el menú en su programa.
  const [seleccionado, setSeleccionado] = useState<string | null>(idEnUrl ?? leerSeleccion());
  const [abierto, setAbierto] = useState<boolean>(idEnUrl !== null);

  useEffect(() => {
    if (!habilitado || programasCache.has(role)) return;
    let cancelled = false;
    cargarProgramas(role)
      .then((data) => { if (!cancelled) setProgramas(data); })
      .catch(() => { if (!cancelled) setError(true); }); // degrada en silencio: el sidebar nunca rompe la app
    return () => { cancelled = true; };
  }, [habilitado, role]);

  // Sincronización inversa: navegar a /estudiante/programas/:id/... selecciona y abre.
  useEffect(() => {
    if (!idEnUrl) return;
    setSeleccionado(idEnUrl);
    setAbierto(true);
    guardarSeleccion(idEnUrl);
  }, [idEnUrl]);

  if (!habilitado) return null;

  const cargando = programas === null && !error;
  const vacio = programas !== null && programas.length === 0;
  const deshabilitado = cargando || error || vacio;
  const elegido = programas?.find((p) => p.id === seleccionado) ?? null;
  const entradas = elegido ? construirEntradasPrograma(role, elegido.id) : [];

  return (
    <nav className="nav-group" style={{ marginTop: '1.25rem' }}>
      <button
        type="button"
        className={`nav-item nav-group-toggle${abierto && !deshabilitado ? ' open' : ''}`}
        aria-expanded={abierto && !deshabilitado}
        aria-controls="sidebar-programas"
        aria-label={abierto ? t('common:a11y.collapse_programs') : t('common:a11y.expand_programs')}
        disabled={deshabilitado}
        aria-busy={cargando}
        title={vacio ? t('admin:sidebar.sin_programas') : undefined}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className="nav-group-icon"><SidebarIcon name="programas" size={11} /></span>
        <span className="nav-group-label">{t('admin:sidebar.programas_grupo')}</span>
        <span className={`nav-group-caret${abierto && !deshabilitado ? ' open' : ''}`} aria-hidden="true">›</span>
      </button>
      {vacio && <div className="nav-group-empty">{t('admin:sidebar.sin_programas')}</div>}

      <div id="sidebar-programas" className="nav-group-list" hidden={!abierto || deshabilitado}>
        {programas?.map((p) => {
          const activo = p.id === elegido?.id;
          return (
            <button
              key={p.id}
              type="button"
              className={`nav-sub-item nav-sub-programa${activo ? ' active' : ''}`}
              aria-pressed={activo}
              onClick={() => { setSeleccionado(p.id); guardarSeleccion(p.id); }}
            >
              <span className="nav-sub-programa-nombre">{p.nombre}</span>
              {p.fase && (
                <span className="nav-sub-programa-fase">
                  {t('programa:fase.paso', { n: p.fase.fase })}
                </span>
              )}
            </button>
          );
        })}

        {elegido ? (
          <div className="nav-group-entradas">
            {entradas.map((e) => (
              <NavLink key={e.key} to={e.to} className={({ isActive }) => `nav-sub-item${isActive ? ' active' : ''}`}>
                {t(`admin:sidebar.${e.key}`)}
              </NavLink>
            ))}
          </div>
        ) : (
          !deshabilitado && <div className="nav-group-empty">{t('admin:sidebar.elegir_programa')}</div>
        )}
      </div>
    </nav>
  );
}
