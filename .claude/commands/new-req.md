---
description: Crea un nuevo requisito desde una descripción en lenguaje natural. Detecta automáticamente dominio, entidades de BD, componentes UI y dependencias.
---

# /new-req — Crear requisito

## Carga obligatoria

1. `CLAUDE.md`
2. `sdd/README.md`
3. `sdd/workflows/new-req.md` (manual completo, pasos 1-8)
4. `sdd/templates/initial.md`
5. `sdd/templates/INDEX.md`
6. `sdd/concepts/conventions.md` (IDs, naming, estados)

## Tu rol

Recibes una descripción del REQ en lenguaje natural (puede venir directa del usuario o invocada por `/init-project` con datos ya estructurados). Tu trabajo:

1. Inferir dominio, título, descripción funcional y criterios de aceptación.
2. Detectar entidades de BD candidatas (cruzar con `database/schema.sql`).
3. Detectar componentes UI candidatos (búsqueda heurística en código existente).
4. Detectar dependencias con REQs existentes.
5. Generar la carpeta completa del REQ.

## Setup de git (antes de todo)

Si el proyecto está versionado con git (`git rev-parse --git-dir` retorna sin error):
1. Verificar árbol limpio. Si hay cambios sin commitear, preguntar al usuario.
2. Asegurar estar en rama base (`main`).
3. Crear y cambiar a `req/<REQ-ID>-<slug>` antes de crear archivos.

Si NO hay git, saltar este setup. Ver `sdd/workflows/new-req.md` sección "Setup de git".

## Pasos

Sigue estrictamente los pasos 1-8 de `sdd/workflows/new-req.md`:

1. Pedir/inferir: dominio, título, descripción, criterios de aceptación.
2. Calcular ID `REQ-<DOMINIO>-<NNN>` siguiendo `sdd/concepts/conventions.md`.
3. Detectar entidades de BD candidatas.
4. Detectar componentes UI candidatos.
5. Detectar dependencias.
6. Crear la carpeta del REQ:
   ```
   requirements/<dominio>/REQ-<DOMINIO>-<NNN>-<slug>/
   ├── initial.md       (desde plantilla, rellenado con info recopilada)
   ├── INDEX.md         (current_state: initial, status: draft)
   ├── ledger.md        (cabecera vacía)
   ├── manifest.md      (vacío con frontmatter)
   └── errors/          (carpeta vacía)
   ```
7. Actualizar dependencias bidireccionales: si el REQ depende de otros, añadirlo a su `needed_by`.
8. Añadir fila tipo `nuevo` al `ledger.md` global.

## Modo de operación

El usuario describe el REQ en una frase ("quiero un requisito para login con Google"). Tú:

1. **Inferes al máximo** posible la información necesaria de esa frase + `docs/vision.md` + `docs/personas.md`.
2. **Propones la estructura completa** del REQ con valores rellenos.
3. **Preguntas solo lo que sea CRÍTICO** y no se puede inferir (ej. si no hay criterios de aceptación claros).
4. **Ejecutas** una vez aprobado.

No interrogues. Complementa.

## Output

```
Creado REQ-AUTH-001-login-google en requirements/auth/.

Status: draft
Entidades BD: users, sessions, oauth_accounts
Componentes UI: LoginPage, OAuthButton, AuthCallback
Dependencias: ninguna

(Si hay git) Rama creada: req/REQ-AUTH-001-login-google
Commit inicial: feat(REQ-AUTH-001): crear requisito login-google

Próximos pasos sugeridos:
- Revisar el `initial.md` generado.
- Cuando esté listo, cambiar status a `aprobado` para implementar.
- O ejecutar `/change-req REQ-AUTH-001 implementar` para llevarlo a código directamente.
- (Si hay git) git push -u origin <branch> y abrir PR cuando esté listo. Tras mergear → /cleanup-branches.
```

## Restricciones

- **No implementes código.** Solo creas la documentación del REQ.
- **No marques `status: implementado`.** Inicialmente es `draft`. El usuario decide cuándo pasarlo a `aprobado`.
- **Respeta convenciones de IDs** estrictamente (ver `sdd/concepts/conventions.md`).
