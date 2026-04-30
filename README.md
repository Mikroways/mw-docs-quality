# @mikroways/cspell-config

Configuración base de cSpell compartida entre todos los proyectos de Mikroways.
Incluye diccionarios temáticos con vocabulario que no está cubierto por los
diccionarios estándar de cSpell.

## Uso en un proyecto

En el `.cspell.json` del proyecto, importar este archivo:

```jsonc
{
  "version": "0.2",
  // Desarrollo local (ruta relativa al repo):
  "import": ["../../cspell-config/cspell.base.json"],
  // Producción (una vez publicado en GitLab):
  // "import": ["https://gitlab.com/mikroways/cspell-config/-/raw/main/cspell.base.json"],
  "language": "es,en",
  "ignorePaths": [".venv/**", "node_modules/**", "site/**", "uv.lock"],
  "words": []
}
```

El import activa automáticamente:

* `es-es` y `es-ar` — español peninsular y rioplatense
* `aws`, `k8s`, `bash`, `docker`, `softwareTerms`, `software-tools`, `cpp` —
  vocabulario técnico estándar
* Los cinco diccionarios custom de Mikroways (ver abajo)

## Diccionarios

| Archivo | Dict name | Contenido |
|---|---|---|
| `dictionaries/español-tech.txt` | `mw-español-tech` | Sustantivos/adjetivos técnicos en español, spanglish conjugado |
| `dictionaries/voseo-rioplatense.txt` | `mw-voseo` | Formas verbales del voseo rioplatense (imperativo y presente) |
| `dictionaries/kubernetes.txt` | `mw-kubernetes` | CRDs, recursos K8s nativos, CLI tools del ecosistema |
| `dictionaries/devops-tools.txt` | `mw-devops-tools` | Herramientas DevOps/SRE, infra, monitoreo, shell |
| `dictionaries/databases.txt` | `mw-databases` | Herramientas, comandos y variables de bases de datos |

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

## Instalación

```bash
npm install
```

Instala `cspell` y los diccionarios de español (`@cspell/dict-es-es`, `dictionary-es-ar`)
en el `node_modules` local, que es el que usa `cspell.base.json` para resolver sus paths.
