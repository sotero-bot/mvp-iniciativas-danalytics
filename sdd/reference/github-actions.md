# GitHub Action: diagrama ER autogenerado

> Cómo configurar el workflow de CI que regenera `database/diagram.mmd` automáticamente cada vez que cambia el schema.
>
> Configurado por [`/init-project`](../workflows/init-project.md). Versión local del mismo proceso: [`/sync-schema`](../workflows/sync-schema.md).

## Objetivo

Cada vez que `database/schema.sql` (o `prisma/schema.prisma`) cambia en `main`, regenerar automáticamente `database/diagram.mmd` y commitearlo de vuelta. El diagrama nunca se edita a mano — siempre se autogenera.

## Opción 1 — Stack con Prisma (Next.js, Nuxt, SvelteKit, RedwoodJS)

Aprovecha `prisma-erd-generator`, que ya genera Mermaid desde `schema.prisma`.

### Paso 1 — Añadir el generador en `prisma/schema.prisma`

```prisma
generator erd {
  provider = "prisma-erd-generator"
  output   = "../database/diagram.mmd"
  theme    = "default"
}
```

### Paso 2 — Crear `.github/workflows/sync-schema.yml`

```yaml
name: Regenerate ER diagram

on:
  push:
    branches: [main]
    paths:
      - 'prisma/schema.prisma'

jobs:
  regenerate:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx prisma generate
      - name: Commit diagram if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          if [ -n "$(git status --porcelain database/diagram.mmd)" ]; then
            git add database/diagram.mmd
            git commit -m "chore(db): regenerate ER diagram [skip ci]"
            git push
          fi
```

## Opción 2 — Stack con SQL plano (FastAPI/Alembic, Laravel, raw SQL)

Usa un script Python que parsea `schema.sql` y emite Mermaid. Ejemplo mínimo:

### `scripts/sql_to_mermaid.py`

```python
import re
from pathlib import Path

sql = Path('database/schema.sql').read_text()
tables = re.findall(r'CREATE TABLE\s+(\w+)\s*\((.*?)\);', sql, re.DOTALL | re.IGNORECASE)
fks = []
out = ['erDiagram']

for name, body in tables:
    columns = []
    for line in body.split(','):
        line = line.strip()
        if not line or line.upper().startswith(('PRIMARY KEY', 'CONSTRAINT', 'UNIQUE', 'INDEX', 'KEY')):
            continue
        m = re.match(r'(\w+)\s+([\w()]+)', line)
        if m:
            col, typ = m.groups()
            pk = ' PK' if 'PRIMARY KEY' in line.upper() else ''
            columns.append(f'    {typ} {col}{pk}')
        fk = re.search(r'REFERENCES\s+(\w+)', line, re.IGNORECASE)
        if fk:
            fks.append((name, fk.group(1)))
    out.append(f'  {name} {{')
    out.extend(columns)
    out.append('  }')

for a, b in fks:
    out.append(f'  {a} ||--o{{ {b} : "FK"')

Path('database/diagram.mmd').write_text('\n'.join(out))
print('diagram.mmd regenerated')
```

### `.github/workflows/sync-schema.yml`

```yaml
name: Regenerate ER diagram

on:
  push:
    branches: [main]
    paths:
      - 'database/schema.sql'

jobs:
  regenerate:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: python scripts/sql_to_mermaid.py
      - name: Commit diagram if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          if [ -n "$(git status --porcelain database/diagram.mmd)" ]; then
            git add database/diagram.mmd
            git commit -m "chore(db): regenerate ER diagram [skip ci]"
            git push
          fi
```

## Cómo visualizar `diagram.mmd`

- **VSCode:** instalar la extensión "Markdown Preview Mermaid Support". Abrir el archivo o embeberlo en cualquier `.md` con bloque ```` ```mermaid ```` ... ```` ``` ````.
- **GitHub:** GitHub renderiza Mermaid nativamente en archivos `.md`. Para ver el diagrama directamente en GitHub web, embeberlo en `database/README.md`:
  ````markdown
  # Esquema de BD

  ```mermaid
  <!-- contenido del diagram.mmd se copia aquí -->
  ```
  ````
  Alternativa: configurar el script generador para que sobrescriba `database/README.md` directamente con el bloque ```` ```mermaid ```` ya incluido (más cómodo para visualizar en GitHub web).

## Modo alternativo: bloquear merge si diagrama desactualizado

En lugar de autocommitear el diagrama, se puede bloquear merges cuando el diagrama está desactualizado en una PR. Para ello, cambiar el job para que falle si hay diff:

```yaml
      - name: Fail if diagram outdated
        run: |
          if [ -n "$(git status --porcelain database/diagram.mmd)" ]; then
            echo "::error::ER diagram is outdated. Run /sync-schema locally and commit."
            exit 1
          fi
```

Esto fuerza al dev a correr [`/sync-schema`](../workflows/sync-schema.md) local antes de pushear. Más estricto, más fricción por PR.

## Notas importantes

- **`[skip ci]` en el mensaje del commit del bot** es crítico: evita loops infinitos donde el commit del CI dispararía otro run del CI.
- **`permissions: contents: write`** es necesario para que el bot pueda commitear.
- **Custom para tu stack:** si usas otro generador (PlantUML, dbdiagram.io API, etc.), reemplaza el comando de generación. El esqueleto del workflow es el mismo.
