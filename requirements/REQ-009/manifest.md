---
req_id: REQ-009
title: Generación de entregables (PDF, Excel, ZIP)
---

# Manifest — REQ-009

## Archivos que implementan este REQ

### Backend / Lógica

- `apps/api/src/modules/execution/interfaces/pdfDetalleGenerator.ts`
- `apps/api/src/modules/execution/interfaces/pdfMarkdownRenderer.ts`
- `apps/api/src/modules/execution/interfaces/admin-execution.controller.ts` (endpoints PDF/Excel/ZIP/archivo-url)
- `apps/api/src/modules/execution/interfaces/execution.controller.ts` (endpoint `plantilla-prefilled`)
- `apps/api/src/modules/product/domain/IProductoGenerator.ts` (interfaz reservada para futuro pluggable generator)
- `apps/api/src/shared/utils/parseTableFromContent.ts`

### Frontend / UI

- `apps/web/src/features/execution/InstanciasPage.tsx` (acciones de descarga PDF/ZIP)
- `apps/web/src/features/execution/InstanciaDetallePage.tsx` (descarga PDF/ZIP/Excel por paso)
- `apps/web/src/features/execution/RunnerPage.tsx` (descarga de plantilla pre-rellenada)
- `apps/web/public/templates/plantilla-priorizacion-mapa-oportunidades.xlsx` (plantilla base)

### Configuración

- Dependencias: `pdfkit`, `exceljs`, `archiver`, `marked`
