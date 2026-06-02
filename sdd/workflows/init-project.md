# Workflow: `/init-project`

> **Required reading antes de ejecutar:**
> - [`../README.md`](../README.md) (índice maestro)
> - [`../concepts/principles.md`](../concepts/principles.md)
> - [`../templates/docs/vision.md`](../templates/docs/vision.md), [`../templates/docs/tech-stack.md`](../templates/docs/tech-stack.md), [`../templates/docs/personas.md`](../templates/docs/personas.md), [`../templates/docs/constraints.md`](../templates/docs/constraints.md)
> - [`../reference/migrations-by-framework.md`](../reference/migrations-by-framework.md)

Bootstrapea un proyecto nuevo (greenfield) o introduce la metodología a un repo existente (brownfield, ver [`../reference/adoption-roadmap.md`](../reference/adoption-roadmap.md)).

## Precondiciones

- Carpeta vacía (greenfield) o repo existente sin esta metodología.
- Git inicializado (`git init` si no lo está).

## Pasos

### Fase 1 — Verificar `docs/`

1. La IA verifica si existe `docs/` con los 4 archivos obligatorios rellenos:
   - `docs/vision.md`
   - `docs/tech-stack.md`
   - `docs/personas.md`
   - `docs/constraints.md`

2. Si no existen, **crearlos vacíos** desde las plantillas y **DETENERSE**:
   ```
   docs/ creada con plantillas vacías.
   Rellena las 4 plantillas (vision, tech-stack, personas, constraints)
   antes de continuar. Cuando termines, vuelve a ejecutar /init-project.
   ```

3. Si existen pero alguno está vacío o solo contiene la plantilla sin rellenar: detenerse con el mismo mensaje.

**Razón:** sin estos 4 documentos rellenos, la IA no tiene base para generar requisitos consistentes con el dominio del producto.

### Fase 2 — Configurar el proyecto

Una vez `docs/` está poblada:

4. **Preguntar idioma** de la documentación generada (REQs, errores, ledger). Default sugerido: español. Opciones: ES / EN / otro.

5. **Detectar sistema de migraciones.** Leer `docs/tech-stack.md` y cruzarlo con la tabla de [`../reference/migrations-by-framework.md`](../reference/migrations-by-framework.md).
   - Si match exacto → registrar el sistema.
   - Si no hay match → preguntar al usuario, ofreciendo opciones similares a Django (declarativo con `makemigrations`).

6. **Crear estructura** (carpetas y archivos esqueleto):
   ```
   requirements/
   database/schema.sql              (vacío o con esquema inicial)
   brand/colors.md                  (plantilla)
   brand/typography.md              (plantilla)
   brand/voice-tone.md              (plantilla)
   brand/logos/                     (vacío)
   decisions/                       (vacío)
   ledger.md                        (cabecera, sin filas)
   CLAUDE.md                        (ver paso 7)
   sdd/                             (esta metodología — copiar del template)
   .claude/agents/                  (vacío por ahora)
   .claude/commands/                (vacío por ahora)
   ```

7. **Generar `CLAUDE.md`** específico del proyecto con:
   - Apuntador a `sdd/README.md` como entrada de la metodología.
   - Las 5 reglas duras (ver [`../concepts/principles.md`](../concepts/principles.md)).
   - Resumen del stack desde `docs/tech-stack.md`.
   - Sección "Errores conocidos a tener en cuenta" (inicialmente vacía, se llena con el tiempo).

8. **Configurar GitHub Action del diagrama ER.** Ver [`../reference/github-actions.md`](../reference/github-actions.md). Crear `.github/workflows/sync-schema.yml` según corresponda (Prisma o SQL plano).

### Fase 3 — Entrevista para primeros REQs

9. La IA lee `docs/vision.md` y `docs/personas.md` y **propone** los primeros REQs candidatos a partir de los casos de uso de cada persona. Para cada uno propone:
   - ID (dominio + número).
   - Título corto.
   - Entidades de BD esperadas.
   - Componentes UI esperados.
   - Dependencias con otros REQs candidatos.

10. El usuario revisa: aprueba, ajusta, descarta, añade.

11. Por cada REQ aprobado, invocar [`/new-req`](new-req.md) para crear su carpeta.

## Outputs

- Estructura completa de carpetas creada.
- 4 archivos `docs/` rellenados (por el usuario, no por la IA).
- `CLAUDE.md` específico del proyecto.
- GitHub Action de diagrama ER configurado.
- Primeros REQs (carpetas) creados en estado `draft`.
- Fila `init` en `ledger.md` global.

## Errores comunes

- **`docs/` incompleto.** La IA debe **bloquear** la operación, no continuar con plantillas vacías. Es la razón por la que existe la fase 1.
- **Stack desconocido en migraciones.** Preguntar siempre, no asumir. Si el usuario tampoco sabe → recomendar Flyway como fallback genérico SQL-based.
- **No copiar `sdd/`.** Si el proyecto no tiene la carpeta `sdd/`, los agentes futuros no podrán cargar la metodología. Es obligatorio.
