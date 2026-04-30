#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Uso: $0 [--all] <nombre-diccionario.txt>" >&2
  echo "" >&2
  echo "  --all   Muestra también palabras cubiertas por dicts inactivos" >&2
  echo "" >&2
  echo "Ejemplo: $0 databases.txt" >&2
  echo "         $0 --all databases.txt" >&2
  exit 1
}

ALL=false
if [[ "${1:-}" == "--all" ]]; then
  ALL=true
  shift
fi

[[ $# -ne 1 ]] && usage

DICT="../dictionaries/$1"

if [[ ! -f "$DICT" ]]; then
  echo "Error: no se encuentra $DICT" >&2
  exit 1
fi

CSPELL="../node_modules/.bin/cspell"

mapfile -t words < <(grep -v "^#" "$DICT" | grep -v "^$")

[[ ${#words[@]} -eq 0 ]] && exit 0

# Una sola invocación de cspell para todas las palabras
trace_output=$("$CSPELL" trace --no-color "${words[@]}" 2>/dev/null || true)

for word in "${words[@]}"; do
  if [[ "$ALL" == true ]]; then
    result=$(echo "$trace_output" | grep "^${word}[[:space:]].*\*[[:space:]]" | head -1 || true)
  else
    result=$(echo "$trace_output" | grep "^${word}[[:space:]].*\*[[:space:]].*\*" | head -1 || true)
  fi
  echo "$word: ${result:-NOT FOUND}"
done
