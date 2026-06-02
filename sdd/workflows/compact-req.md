# Workflow: `/compact-req REQ-XXX`

> **Operación de mantenimiento opcional.**
>
> Compacta changes históricos de un REQ para reducir ruido en la carpeta y proteger el contexto cuando se carga tier 3 en raras ocasiones.
>
> **Required reading antes de ejecutar:**
> - [`../README.md`](../README.md)
> - [`../concepts/principles.md`](../concepts/principles.md)
> - [`../concepts/context-loading.md`](../concepts/context-loading.md) (§4 compactación)

## Cuándo usarlo

- Un REQ ha acumulado muchos `change-NNN.md` históricos (recomendación: > 10).
- La carpeta del REQ se ha vuelto difícil de navegar.
- Quieres preparar el REQ para una etapa nueva del producto (fin de quarter, fase 2, etc.).

**NO es obligatorio.** El día a día funciona sin compactar nunca.

## Lo que la compactación NO hace

- **NO** borra changes.
- **NO** modifica el `INDEX.md` (el "Estado consolidado actual" sigue intacto).
- **NO** afecta al `manifest.md` ni al código.

Solo **reubica** changes superados a una subcarpeta `archive/` para que no aparezcan al primer vistazo.

## Pasos

1. **Cargar tier 3 del REQ.** Leer todos los `change-NNN.md` de la carpeta del REQ + `initial.md`.

2. **Identificar punto de corte.** Por defecto: dejar los últimos 3 changes activos + el actual vigente; archivar el resto. El usuario puede ajustar el punto de corte.

3. **Generar `archive/consolidated-<fecha>.md`:**
   ```markdown
   ---
   id: REQ-AUTH-001
   compactado: 2026-09-01
   incluye_desde: initial
   incluye_hasta: change-007
   reemplaza: [initial.md, change-001.md, ..., change-007.md]
   ---

   # Consolidación de REQ-AUTH-001 — initial..change-007

   ## Resumen del periodo
   <Síntesis textual de qué cambió en este REQ entre initial y change-007.>

   ## Cambios principales
   - change-001 (YYYY-MM-DD): <resumen>
   - change-002 (YYYY-MM-DD): <resumen>
   - ...
   - change-007 (YYYY-MM-DD): <resumen>

   ## Estado al final del periodo
   <Descripción del estado del REQ al cierre de change-007. NO es el estado actual del REQ.>
   ```

4. **Mover los `change-NNN.md` compactados** a `requirements/<dominio>/REQ-XXX/archive/`. NO borrar.

5. **Actualizar el `INDEX.md`** del REQ:
   - Añadir nota: "Changes anteriores a `change-008` compactados en `archive/consolidated-YYYY-MM-DD.md`."
   - El "Estado consolidado actual" NO se modifica.
   - La tabla "Historial de versiones" puede mostrar las filas archivadas con un ícono "📦" o marca similar.

6. **Actualizar el `ledger.md` del REQ y el global** con fila tipo `compact`.

## Resultado

```
requirements/auth/REQ-AUTH-001-login-google/
├── initial.md                       (intocable, queda)
├── change-008.md                    (activos: últimos N + el vigente)
├── change-009.md
├── change-010.md (vigente)
├── INDEX.md                         (actualizado con referencia al archive)
├── ledger.md
├── manifest.md
├── errors/
└── archive/
    ├── consolidated-2026-09-01.md   (resumen de initial..change-007)
    ├── change-001.md                (movido aquí)
    ├── change-002.md
    └── ...
    └── change-007.md
```

## Para agentes después de compactar

- El `archive/` **no se carga en ningún tier por defecto** (ver [`../concepts/context-loading.md`](../concepts/context-loading.md)).
- Solo se consulta cuando alguien pregunta "¿cómo era este REQ antes?", "¿qué hubo en `change-003`?", o en `/rollback` si la versión objetivo está en el archive.
- El `consolidated-YYYY-MM-DD.md` sirve como TL;DR de toda la era compactada sin necesidad de leer cada change.

## Errores comunes

- **Borrar changes en lugar de moverlos.** Nunca. La inmutabilidad de los changes es absoluta. Solo se mueven a `archive/`.
- **Compactar el change vigente.** Nunca. Solo se compactan changes con `status: superseded`.
- **Olvidar actualizar el INDEX.** Sin la nota, futuros lectores no sabrán que existe el `archive/`. Siempre añadirla.
- **Compactar muy pronto.** Si solo hay 4 changes, compactar genera más overhead que beneficio. Esperar a > 10.
