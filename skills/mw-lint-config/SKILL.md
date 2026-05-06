---
name: mw-lint-config
version: 1.5.0
description: |
  Verifica y aplica la configuración estándar de markdownlint y cSpell en un
  repositorio de documentación de Mikroways. Detecta configuraciones faltantes,
  inconsistentes o desactualizadas, y puede aplicar la configuración base del
  repo compartido (mikroways/cspell-config).
  Usar cuando se quiera auditar o configurar el linting de Markdown en un repo.
  Triggers: "verificar lint", "configurar cspell", "aplicar lint config",
  "revisar markdownlint", "mw-lint-config".
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

# mw-lint-config — Verificar y aplicar configuración de linting

Auditá y/o configurá markdownlint y cSpell en el repositorio actual.

## Fase 1 — Detectar estado actual

### 1.1 cSpell

```bash
# Existencia
ls .cspell.json 2>/dev/null || echo "FALTA"

# Warnings actuales (top 20 palabras)
npx cspell "**/*.md" --no-progress 2>/dev/null \
  | grep -oP "Unknown word \(\K[^)]+" | sort | uniq -c | sort -rn | head -20

# Total
npx cspell "**/*.md" --no-progress 2>/dev/null | grep -c "Unknown word" || echo "0"
```

Leer `.cspell.json`. Verificar:

- [ ] `"import"` es `["./node_modules/@mikroways/cspell-config/cspell.base.json"]`
- [ ] **No** tiene `dictionaryDefinitions` ni `dictionaries` propios (vienen del base config vía import)
- [ ] **No** tiene `ignoreRegExpList` propio (viene del base config)
- [ ] `words` contiene **solo** términos específicos del proyecto (no vocabulario genérico)
- [ ] `ignorePaths` excluye `.venv/`, `node_modules/`, `site/`, lockfiles

```bash
cat package.json 2>/dev/null | grep -E "cspell-config|markdownlint"
cat .npmrc 2>/dev/null || echo ".npmrc FALTA"
```

- [ ] `@mikroways/cspell-config: "*"` en `devDependencies` (las deps de diccionarios son transitivas)
- [ ] `markdownlint-cli2` en `devDependencies`
- [ ] `.npmrc` existe con `@mikroways:registry=https://gitlab.com/api/v4/packages/npm/`
- [ ] `package-lock.json` en `.gitignore` (se usa `npm install`, no `npm ci`)

### 1.2 markdownlint

```bash
ls .markdownlint.json .markdownlint.yaml .markdownlint.yml .markdownlintrc 2>/dev/null || echo "FALTA"
# Ejecutar SIN argumentos: pasar "**/*.md" como arg se combina con los globs del
# .markdownlint-cli2.yaml de forma aditiva, ignorando los excludes y escaneando
# node_modules. Sin args, usa solo los globs del archivo de config.
npx markdownlint-cli2 2>/dev/null | tail -3
```

### 1.3 Localizar el repo compartido cspell-config

El repo compartido se consume como **paquete npm** (`@mikroways/cspell-config`), no como
ruta relativa local. Verificar que el import no use rutas locales (`../../cspell-config/`),
que son un antipatrón — solo funcionan en desarrollo local y rompen en CI.

```bash
# Verificar que el import usa la ruta npm correcta
grep '"import"' .cspell.json

# Si npm install ya corrió, verificar que el paquete esté instalado
ls node_modules/@mikroways/cspell-config/cspell.base.json 2>/dev/null || echo "paquete no instalado"

# El repo fuente (para editar diccionarios) suele estar en:
ls /home/juanpsm/mw/cspell-config/dictionaries/ 2>/dev/null \
  || echo "repo fuente no encontrado localmente"
```

Si el paquete no está instalado, ejecutar `npm install` antes de las fases de auditoría.

---

## Fase 2 — Auditoría de diccionarios (si el repo compartido está disponible)

### 2.1 Detectar solapamientos entre diccionarios custom

```bash
CSPELL_REPO=$(find ~ -maxdepth 5 -name "cspell.base.json" -path "*/mw-cspell-config/*" 2>/dev/null | head -1 | xargs -r dirname)
DICT_DIR="$CSPELL_REPO/dictionaries"
# Detectar duplicados entre todos los diccionarios custom
sort "$DICT_DIR"/*.txt | grep -v "^#" | grep -v "^$" | uniq -d
```

Si hay duplicados: reportar en qué archivos aparece cada uno y cuál es el lugar
correcto según la taxonomía:

| Diccionario | Contiene |
|---|---|
| `español-tech.txt` | Sustantivos/adjetivos técnicos en español, spanglish conjugado. **No** voseo. |
| `voseo-rioplatense.txt` | Formas verbales del voseo. Solo formas que no existen en español estándar. |
| `kubernetes.txt` | CRDs, recursos K8s nativos, nombres de operadores, CLI tools del ecosistema. |
| `devops-tools.txt` | Nombres de herramientas DevOps/SRE, infra, monitoring, shell. |
| `databases.txt` | Herramientas, comandos, variables de entorno de bases de datos. |

### 2.2 Detectar solapamientos con diccionarios built-in

**Principio**: los diccionarios custom deben contener **solo lo que no está disponible en dicts estándar**.
Si muchas palabras de una categoría están cubiertas por un dict built-in no activo, la solución
correcta es **habilitar ese dict en el proyecto**, no mantener esas palabras en un custom.

```bash
# Verificar qué diccionarios cubren cada palabra
# Formato de salida: <palabra> * <dict>  → encontrada en ese dict
#                   <dict>*             → el * final indica que el dict está activo en el proyecto
for word in $(cat <diccionario>.txt | grep -v "^#" | grep -v "^$"); do
  result=$(npx cspell trace --no-color "$word" 2>/dev/null | grep "^$word \* " | grep -v "mw-" | head -1)
  echo "$word: ${result:-NOT FOUND}"
done
```

Interpretar la salida:
- `palabra * dict-name` → encontrada en ese dict (si el dict tiene `*` al final, está activo en el proyecto)
- Si `dict-name` **no** tiene `*` al final → el dict está disponible pero no habilitado en `.cspell.json`

Criterio de decisión:
- La palabra está en un dict **ya activo** → eliminar del custom (redundante)
- La palabra está en un dict **no activo**, y ese dict cubre varias palabras de la misma categoría → **habilitar el dict** en `"dictionaries"` del `.cspell.json` del proyecto y eliminar esas palabras del custom
- La palabra **no está en ningún dict** → debe permanecer en el custom

Ejemplo real: `cpp` y `cpp-compound-words` cubren términos de bases de datos usados como identificadores
(`dbname`, `dbuser`, `dbpassword`, `appendonly`, `binlogs`, `mysqldump`, etc.). Habilitar esos dicts
en el proyecto evita mantenerlos manualmente.

**Importante**: `npx cspell trace` considera el contexto de `.cspell.json` activo.
Ejecutar desde el directorio del proyecto para que use la config completa.

---

## Fase 3 — Clasificar warnings residuales

Si quedan warnings después de aplicar la config, clasificar cada palabra desconocida:

**A — Typo real** → corregir directamente en el archivo fuente

**B — Término específico del proyecto** → agregar a `words` en `.cspell.json` del proyecto

**C — Término genérico reutilizable** → proponer agregarlo al diccionario correspondiente del repo compartido, según la taxonomía de la Fase 2

**D — Slug/identificador sin tilde** (en code block o path) → ya cubierto por `ignoreRegExpList`; si persiste, usar `<!-- cspell:disable-next-line -->` en el archivo

Para clasificar, usar `npx cspell trace <palabra>` — si no aparece en ningún
diccionario activo, confirmar categoría con el usuario antes de agregar.

---

## Fase 4 — Aplicar correcciones (solo si el usuario lo pide)

### 4.1 Agregar términos al repo compartido (Categoría C)

Para cada término categorizado como C, **primero verificar** si está cubierto por algún dict built-in
no activo (Fase 2.2). Si sí: habilitar ese dict en el proyecto en lugar de agregar al custom.
Solo si no está en ningún built-in, agregar al archivo `.txt` del repo compartido.

#### Cómo actualizar los diccionarios

**Paso 0 — Localizar el repo compartido**

```bash
CSPELL_REPO=$(find ~ -maxdepth 5 -name "cspell.base.json" -path "*/mw-cspell-config/*" 2>/dev/null | head -1 | xargs -r dirname)
echo "${CSPELL_REPO:-NO ENCONTRADO}"
```

Si no está clonado, clonarlo antes de continuar:

```bash
git clone git@gitlab.com:mikroways/tools/mw-cspell-config.git ~/mw/cspell-config
cd ~/mw/cspell-config && npm install
CSPELL_REPO=~/mw/cspell-config
```

**Paso 1 — Verificar que la palabra no está en dicts built-in**

```bash
cd "$CSPELL_REPO/cspell-test"
./audit-dict.sh --all <diccionario>.txt   # para auditar un dict completo
../node_modules/.bin/cspell trace --no-color <palabra>  # para una palabra puntual
```

La columna `F` muestra `*` si la palabra fue encontrada. Si aparece en algún dict
estándar, no agregarla al custom.

**Paso 2 — Elegir el archivo correcto**

| Archivo | Cuándo agregar aquí |
|---------|---------------------|
| `dictionaries/español-tech.txt` | Sustantivos/adjetivos técnicos en español, verbos spanglish conjugados |
| `dictionaries/voseo-rioplatense.txt` | Solo formas verbales del voseo que no existen en español estándar |
| `dictionaries/kubernetes.txt` | CRDs, recursos K8s, CLI tools del ecosistema |
| `dictionaries/devops-tools.txt` | Herramientas DevOps/SRE, infra, monitoring, shell |
| `dictionaries/databases.txt` | Herramientas, comandos, variables de entorno de bases de datos |
| `dictionaries/mikroways.txt` | Términos y nombres propios exclusivos de Mikroways |

**Paso 3 — Agregar la palabra**

Reglas:
1. Una sola forma en minúscula es suficiente (`caseSensitive: false` en la config base)
2. Mantener orden alfabético dentro de cada sección
3. Agregar en la sección temática correcta del archivo (cada `.txt` tiene secciones con comentarios `#`)

**Paso 4 — Publicar**

La publicación es automática vía CI al crear un tag. Primero bumping de versión en `package.json`,
luego:

```bash
cd "$CSPELL_REPO"
git add dictionaries/<archivo>.txt package.json
git commit -m "feat(dicts): agregar <descripción>"
git tag v<nueva-version>
git push origin main --tags
```

El CI de GitLab detecta el tag `v*` y ejecuta `npm publish` automáticamente.

### 4.2 Aplicar .cspell.json estándar

Si no existe o le faltan elementos clave, crear/actualizar con la forma mínima:

```json
{
  "version": "0.2",
  "import": ["./node_modules/@mikroways/cspell-config/cspell.base.json"],
  "language": "es,en",
  "ignorePaths": [
    ".venv/**",
    ".agents/**",
    "node_modules/**",
    "site/**",
    "uv.lock",
    "package-lock.json"
  ],
  "words": []
}
```

`dictionaryDefinitions`, `dictionaries` e `ignoreRegExpList` vienen del `cspell.base.json`
del paquete compartido — no repetirlos en el proyecto salvo que se quiera sobreescribir algo.

### 4.2.1 Aplicar .npmrc estándar

Si no existe:

```
@mikroways:registry=https://gitlab.com/api/v4/packages/npm/
```

### 4.2.2 Aplicar package.json estándar

```json
{
  "private": true,
  "devDependencies": {
    "@mikroways/cspell-config": "*",
    "markdownlint-cli2": "^0.21.0"
  }
}
```

Las deps de diccionarios (`@cspell/dict-es-es`, `dictionary-es-ar`) son transitivas del
paquete `@mikroways/cspell-config` — no agregarlas directamente.

El `"*"` asegura que se instale la versión latest en una instalación desde cero. No commitear
`package-lock.json`.

### 4.3 Instalar dependencias

```bash
npm install
```

> **Atención**: si `node_modules/` ya existe con cualquier versión de `@mikroways/cspell-config`,
> `npm install` no actualizará el paquete (cualquier versión satisface `"*"`). Para forzar la
> actualización usar:
> ```bash
> npm install @mikroways/cspell-config@latest
> ```

### 4.4 Aplicar .markdownlint.json estándar para MkDocs Material

Si no existe:

```json
{
  "default": true,
  "MD013": false,
  "MD046": { "style": "fenced" },
  "MD060": false
}
```

**Por qué `"style": "fenced"` y no `false`**: MkDocs Material requiere que el contenido
de admonitions (` !!! tip `) y tabs (`=== "..."`) esté indentado 4 espacios. CommonMark
trata los bloques con 4 espacios de indentación como "indented code blocks", no como
fenced, aunque tengan backticks. Deshabilitar MD046 globalmente es innecesario — basta
con fijar `"style": "fenced"` y usar `<!-- markdownlint-disable MD046 -->` /
`<!-- markdownlint-enable MD046 -->` alrededor de cada admonition o tab que contenga
código.

**Patrón per-bloque** (obligatorio, no deshabilitar globalmente):

```markdown
<!-- markdownlint-disable MD046 -->
!!! tip "Título"
    Texto del admonition.

    ```bash
    comando
    ```
<!-- markdownlint-enable MD046 -->
```

Lo mismo para tabs:

```markdown
<!-- markdownlint-disable MD046 -->
=== "macOS"

    ```bash
    brew install sops
    ```

=== "Linux"

    ```bash
    apt install sops
    ```
<!-- markdownlint-enable MD046 -->
```

**Limitación del modo "consistent"**: si en un archivo el primer bloque de código está
dentro de un admonition (y markdownlint lo ve como "indented"), el modo `"consistent"`
marca todos los bloques fenced posteriores como incorrectos — incluso si se envuelven
los bloques del admonition con disable/enable. El disable/enable suprime el error del
bloque envuelto pero NO cambia el estilo esperado establecido por ese primer bloque.
La solución es usar `"style": "fenced"` en `.markdownlint.json` para que la regla espere
fenced en todos lados y solo flaggee los admonitions sin disable/enable.

### 4.5 Agregar jobs de lint al CI/CD (GitLab CI)

Si el repositorio tiene `.gitlab-ci.yml`, agregar el anchor `.npm` y los jobs
de lint. Primero leer el CI existente para ubicar la posición correcta (después
del anchor `.uv` si existe, antes de los jobs de validación de docs).

```yaml
.npm:
  image: node:22-alpine
  cache:
    - key:
        files:
          - package.json
      paths:
        - node_modules/
  before_script:
    - npm install

validate-lint:
  extends: .npm
  stage: validate
  allow_failure: true
  script:
    - npx markdownlint-cli2

validate-spelling:
  extends: .npm
  stage: validate
  allow_failure: true
  script:
    - npx cspell "**/*.md"
```

**Notas de CI**:
- Cache keyed on `package.json` (no `package-lock.json`) porque no se commitea el lockfile.
  `npm install` con `"*"` resuelve la versión latest solo en instalación desde cero (sin
  `node_modules/`). En desarrollo local, usar `npm install @mikroways/cspell-config@latest`
  para forzar actualización si ya existe una versión instalada.
- Se usa `npm install`, no `npm ci` — `npm ci` exige `package-lock.json` presente.
- `validate-lint` y `validate-spelling` usan `allow_failure: true` mientras se corrigen
  errores existentes. Quitar el flag cuando el repo tenga 0 errores.
- El job de markdownlint corre `npx markdownlint-cli2` **sin argumentos** — importante para
  que respete los excludes del `.markdownlint-cli2.yaml` (ver Fase 1.2).
- El `stage: validate` debe existir en `stages:`. Si no existe, agregarlo.
- El runner necesita acceso al GitLab Package Registry para descargar `@mikroways/cspell-config`.
  Los runners de GitLab.com tienen acceso por defecto si el paquete es público o el proyecto
  tiene el token CI configurado.

---

## Fase 5 — Verificación final

```bash
echo "=== cSpell ===" \
  && npx cspell "**/*.md" --no-progress 2>/dev/null | grep -c "Unknown word" || echo "0 warnings"
echo "=== markdownlint ===" \
  && npx markdownlint-cli2 "**/*.md" 2>/dev/null | tail -3
```

Reportar: warnings antes → warnings después.

---

## Formato del reporte

```markdown
# mw-lint-config: [nombre del repo]

## cSpell
- Warnings: N → M (después de correcciones)
- import compartido: ✓/✗
- Diccionarios es-es/es-ar: ✓/✗
- caseSensitive español: ✓/✗
- ignoreRegExpList completo: ✓/✗
- words solo específicos del proyecto: ✓/✗
- Dependencias npm: ✓/✗

## markdownlint
- Errores: N → M
- Config: ✓/✗ ([archivo detectado])

## Diccionarios — solapamientos
- Duplicados entre custom: N palabras → [lista]
- Redundantes con built-in: N palabras → [lista]

## Palabras pendientes de clasificar
| Palabra | Categoría | Acción sugerida |
|---------|-----------|-----------------|
| ...     | C         | Agregar a kubernetes.txt |

## Acciones realizadas
- [lista de cambios aplicados]
```

---

## Notas

- Ejecutar desde la **raíz del repositorio** a auditar.
- No modificar archivos que ya cumplen el estándar.
- `npx cspell trace` es la fuente de verdad para saber si una palabra ya está cubierta.
- No agregar a los diccionarios custom palabras que deberían seguir siendo flaggeadas
  (nombres propios que deben ir siempre en mayúscula, siglas de proyectos específicos, etc.).
- Antes de agregar al repo compartido, confirmar con el usuario si el término
  es realmente genérico y reutilizable entre proyectos.
- **cspell v10 requiere Node.js >=22.18.0**. Con Node 22.14.0 o menor, cspell falla
  silenciosamente (0 warnings locales aunque haya errores). Verificar versión local con
  `node --version` y asegurar `nodejs 22.18.0` en `.tool-versions`.
- **`@mikroways/cspell-config` se publica automáticamente vía CI** al hacer push de un tag
  `v*` en el repo `mikroways/cspell-config`. No ejecutar `npm publish` manualmente.
- **No usar rutas relativas locales** (`../../cspell-config/`) en el import de `.cspell.json` —
  solo funcionan en desarrollo local y rompen en CI. Siempre usar la ruta npm:
  `./node_modules/@mikroways/cspell-config/cspell.base.json`.
