// Las dimensiones del diagnóstico se guardan como slug (ej. "nivel_uso",
// "valor_percibido") porque las asigna el admin como texto libre al campo
// (RF-26). Para reportes de cara a dirección/cliente se muestran legibles:
// "Nivel Uso", "Valor Percibido" — sin guion bajo y con mayúscula inicial.
export function formatDimension(dimension: string): string {
  return dimension
    .split('_')
    .filter(Boolean)
    .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase())
    .join(' ');
}
