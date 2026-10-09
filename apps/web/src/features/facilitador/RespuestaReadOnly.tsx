import { Campo } from '../estudiante/FormularioResponderPage';

// ─────────────────────────────────────────────────────────────
// Render de solo lectura de una respuesta contra sus campos.
// ─────────────────────────────────────────────────────────────

export function RespuestaReadOnly({ campos, datos }: { campos: Campo[]; datos: Record<string, unknown> }) {
  const topLevel = campos.filter(c => !c.campoPadreId);
  const hijosDe = (id: string) => campos.filter(c => c.campoPadreId === id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {topLevel.map(campo => (
        <div key={campo.id}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>{campo.etiqueta}</div>
          <ValorReadOnly campo={campo} hijos={hijosDe(campo.id)} valor={datos[campo.id]} />
        </div>
      ))}
    </div>
  );
}

function ValorReadOnly({ campo, hijos, valor }: { campo: Campo; hijos: Campo[]; valor: unknown }) {
  const vacio = <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>—</span>;
  if (valor === undefined || valor === null || valor === '') return vacio;
  const config = campo.configPublica ?? {};

  switch (campo.tipoCampo) {
    case 'opcion_multiple': {
      const etiquetaDe = (v: unknown) =>
        (config.opciones ?? []).find(op => op.valor === v)?.etiqueta ?? String(v);
      const valores = Array.isArray(valor) ? valor : [valor];
      if (valores.length === 0) return vacio;
      return <div style={{ fontSize: '0.85rem' }}>{valores.map(etiquetaDe).join(', ')}</div>;
    }

    case 'tabla': {
      const columnas = config.columnas ?? [];
      const filas = Array.isArray(valor) ? (valor as Record<string, string>[]) : [];
      if (filas.length === 0) return vacio;
      return (
        <div style={{ overflowX: 'auto' }}>
          <table className="gform-table">
            <thead>
              <tr>{columnas.map(col => <th key={col}>{col}</th>)}</tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i}>
                  {columnas.map(col => <td key={col} style={{ fontSize: '0.85rem' }}>{fila[col] ?? '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'grupo_repetible': {
      const iteraciones = Array.isArray(valor) ? (valor as Record<string, unknown>[]) : [];
      if (iteraciones.length === 0) return vacio;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {iteraciones.map((iteracion, i) => (
            <div key={i} className="gform-iteracion">
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                #{i + 1}
              </div>
              {hijos.map(hijo => (
                <div key={hijo.id} style={{ marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{hijo.etiqueta}: </span>
                  <ValorReadOnly campo={hijo} hijos={[]} valor={iteracion[hijo.id]} />
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }

    default:
      return <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{String(valor)}</div>;
  }
}
