# Restricciones

## Compliance

- Por definir. Al manejar datos de personas naturales de empresas colombianas podría aplicar **Ley 1581 de 2012** (protección de datos personales). No hay requisito formal establecido para el MVP.

## Presupuesto

- Infraestructura mensual: máximo **$50–$200 USD/mes** (Vercel Pro + Supabase Pro + AWS S3 + OpenAI API).

## Deadlines

- Sin fechas duras. El ritmo de entrega avanza con cada prueba con clientes reales.

## Restricciones técnicas no negociables

- El deploy en Vercel ejecuta `prisma db push --accept-data-loss` — cualquier migración destructiva (drop de columna, alter de tipo) requiere respaldo previo de la BD.
- El modelo OpenAI **no debe estar hardcodeado** en el código; siempre se lee de la variable de entorno `OPENAI_MODEL`.
- Los archivos subidos por participantes y los PDFs generados van **siempre a S3**, nunca al sistema de archivos local (Vercel es stateless).
- Los enlaces de acceso a talleres se distribuyen **manualmente** por el consultor (copiar desde `/admin/instancias`). No hay servicio de email — no implementar envío automático sin decisión explícita.
