# @mikroways/cspell-config

Configuración compartida de **cSpell** y **markdownlint** para los proyectos de
documentación de Mikroways. Provee:

- Diccionarios temáticos con vocabulario que no está cubierto por los
  diccionarios estándar de cSpell.
- Configuración base de cSpell (`cspell.base.json`) con `ignorePaths` y
  `ignoreRegExpList` listos para usar.
- Configuración base de markdownlint (`markdownlint.json`) extensible vía
  `extends:`.
- Template de GitLab CI (`.gitlab/ci/lint.yml`) con los jobs `validate-lint` y
  `validate-spelling` listos para incluir en cualquier proyecto.

## Setup mínimo en un proyecto consumidor

El proyecto consumidor necesita 4 archivos:

### 1. `package.json`

```json
{
  "private": true,
  "devDependencies": {
    "@mikroways/cspell-config": "*",
    "markdownlint-cli2": "^0.21.0"
  }
}
```

### 2. `.npmrc`

Le dice a npm cómo resolver el scope `@mikroways` desde el GitLab Package
Registry de Mikroways:

```
@mikroways:registry=https://gitlab.com/api/v4/packages/npm/
```

### 3. `.cspell.json`

Importa la base + define palabras específicas del proyecto:

```json
{
  "version": "0.2",
  "import": ["./node_modules/@mikroways/cspell-config/cspell.base.json"],
  "language": "es,en",
  "words": []
}
```

`ignorePaths`, `dictionaries`, `dictionaryDefinitions` y `ignoreRegExpList`
vienen del `cspell.base.json` importado. Solo agregar `ignorePaths` extra si
el proyecto tiene paths que no están cubiertos por la base (`node_modules/**`,
`.venv/**`, `.agents/**`, `.planning/**`, `.claude/**`, `site/**`,
`public/**`, `docs/todo-list.md`, `package-lock.json`, `uv.lock`).

### 4. `.markdownlint-cli2.yaml`

Define los globs y extiende la config compartida:

```yaml
globs:
  - "**/*.md"
  - "!node_modules/**"
config:
  extends: ./node_modules/@mikroways/cspell-config/markdownlint.json
```

Para sobreescribir alguna regla de la base, agregarla bajo `config:` del lado
del proyecto (es prioritaria sobre lo extendido).

## Instalación

```bash
npm install
```

Para forzar la última versión del paquete (cuando `node_modules/` ya existe,
`npm install` no actualiza porque cualquier versión satisface `"*"`):

```bash
npm install @mikroways/cspell-config@latest
```

## Comandos locales

```bash
# Markdownlint (formato)
npx markdownlint-cli2

# Cspell (ortografía) — siempre con la última versión del paquete
npm install @mikroways/cspell-config@latest && npx cspell "**/*.md"
```

## GitLab CI

Para agregar los jobs `validate-lint` y `validate-spelling` al pipeline,
incluir el template compartido:

```yaml
include:
  - project: 'mikroways/tools/mw-cspell-config'
    file: '/.gitlab/ci/lint.yml'
    ref: main

stages:
  - validate
```

El template provee:

- `validate-lint`: corre `markdownlint-cli2` con caché de `node_modules`.
- `validate-spelling`: instala `@mikroways/cspell-config@latest` sin caché en
  cada ejecución para garantizar que los diccionarios estén siempre
  actualizados.

Ambos jobs usan `allow_failure: true` para no bloquear el pipeline durante la
adopción inicial.

## Diccionarios

| Archivo | Dict name | Contenido |
|---|---|---|
| `dictionaries/español-tech.txt` | `mw-español-tech` | Sustantivos/adjetivos técnicos en español, spanglish conjugado |
| `dictionaries/voseo-rioplatense.txt` | `mw-voseo` | Formas verbales del voseo rioplatense (imperativo y presente) |
| `dictionaries/kubernetes.txt` | `mw-kubernetes` | CRDs, recursos K8s nativos, CLI tools del ecosistema |
| `dictionaries/devops-tools.txt` | `mw-devops-tools` | Herramientas DevOps/SRE, infra, monitoreo, shell |
| `dictionaries/databases.txt` | `mw-databases` | Herramientas, comandos y variables de bases de datos |
| `dictionaries/mikroways.txt` | `mw-mikroways` | Términos y nombres propios exclusivos de Mikroways |

Cada archivo tiene un comentario al inicio con las palabras que ya están
cubiertas por dicts estándar y no deben duplicarse.

### Criterio para agregar palabras

Antes de agregar una palabra a un dict custom, verificar si ya está cubierta por
algún dict estándar usando el entorno de prueba (ver abajo). Solo agregar si el
resultado es `NOT FOUND`.

Si muchas palabras de una categoría están en un mismo dict estándar no activo,
la solución correcta es habilitar ese dict en el proyecto, no copiar las
palabras.

## Entorno de prueba (`cspell-test/`)

El directorio `cspell-test/` contiene un `.cspell.json` con solo los dicts
estándar (sin los custom de Mikroways). Sirve para auditar si una palabra de un
dict custom está cubierta por algún dict estándar.

### Auditar un diccionario completo

```bash
cd cspell-test

# Un diccionario — solo dicts activos
./audit-dict.sh databases.txt

# Un diccionario — todos los dicts, incluidos inactivos (para decidir si
# conviene habilitar alguno)
./audit-dict.sh --all databases.txt

# Todos los diccionarios
for dict in $(ls ../dictionaries); do
  echo "=== $dict ==="
  ./audit-dict.sh "$dict"
  echo ""
done
```

### Trazar una palabra puntual

```bash
cd cspell-test
../node_modules/.bin/cspell trace --no-color <palabra>
```

La columna `F` muestra `*` si la palabra fue encontrada en ese diccionario.
Los dicts con `*` al final del nombre están activos en la config de prueba.

## Publicar una nueva versión

La publicación es automática vía CI al crear un tag `v*`. Pasos:

1. Actualizar `version` en `package.json`
2. Commitear y crear el tag:

```bash
git add package.json dictionaries/
git commit -m "feat(dicts): <descripción>"
git tag v<version>
git push origin main --tags
```

El pipeline de GitLab detecta el tag y ejecuta `npm publish` al registro de GitLab.

## Desarrollo local

```bash
npm install
```

Instala `cspell` y los diccionarios de español en `node_modules`, que es lo que usa
`cspell.base.json` para resolver sus paths relativos.

## Skill de Claude Code

Este repo incluye el skill `mw-lint-config` para Claude Code, que automatiza la
auditoría y configuración de cSpell y markdownlint en repositorios de Mikroways.

### Instalación del skill

```bash
git clone git@gitlab.com:mikroways/tools/mw-cspell-config.git
ln -s "$(pwd)/mw-cspell-config/skills/mw-lint-config" ~/.claude/skills/mw-lint-config
```

### Uso

Desde cualquier repositorio de documentación, invocar el skill en Claude Code:

```
/mw-lint-config
```

El skill detecta el estado actual de cSpell y markdownlint, reporta inconsistencias
con el estándar de Mikroways y puede aplicar correcciones si se lo pedís.

Para mantener el skill actualizado, hacer `git pull` en el repo clonado — el symlink
apunta siempre a la versión más reciente.

## Recursos externos

- [Documentación de cSpell](https://cspell.org)
- [Documentación de markdownlint](https://github.com/DavidAnson/markdownlint)
- [Reglas de markdownlint](https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md)
