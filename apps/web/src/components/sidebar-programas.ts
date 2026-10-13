export interface EntradaPrograma {
  key: string;
  to: string;
}

// HU-01 / HU-15: entradas del menú lateral para el programa elegido, por rol. Los roles
// sin entradas (admin, desconocidos) no muestran el desplegable "Programas".
// - estudiante: "Sesiones" es la vista de trabajo del programa (HU-12 no crea una ruta
//   /estudiante/programas/:id), por eso no hay una entrada "Programa" aparte.
// - cliente: usuario_cliente tiene las mismas entradas que cliente_admin; qué programas ve
//   lo decide el servidor (C-07), no el menú.
export function construirEntradasPrograma(role: string, programaId: string): EntradaPrograma[] {
  switch (role) {
    case 'estudiante': {
      const base = `/estudiante/programas/${programaId}`;
      return [
        { key: 'programa_sesiones', to: `${base}/sesiones` },
        { key: 'programa_grupo', to: `${base}/grupo` },
        { key: 'programa_pendientes', to: `${base}/pendientes` },
      ];
    }
    case 'facilitador': {
      const base = `/facilitador/programas/${programaId}`;
      return [
        { key: 'programa_sesiones', to: `${base}/sesiones` },
        { key: 'programa_grupos', to: `${base}/grupos` },
        { key: 'programa_participantes', to: `${base}/participantes` },
        { key: 'programa_reto', to: `${base}/reto` },
        { key: 'programa_observaciones', to: `${base}/observaciones` },
        { key: 'programa_resultados', to: `${base}/resultados` },
      ];
    }
    case 'cliente_admin':
    case 'usuario_cliente': {
      const base = `/portal/programas/${programaId}`;
      return [
        { key: 'programa_resumen', to: base },
        { key: 'programa_participantes', to: `${base}/participantes` },
      ];
    }
    default:
      return [];
  }
}
