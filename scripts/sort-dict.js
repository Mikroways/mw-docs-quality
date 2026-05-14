#!/usr/bin/env node
// Sorts (or checks) words within each section of dictionary .txt files.
// Sections are delimited by comment lines (#) or blank lines.
// Uses Spanish locale via Intl.Collator for correct alphabetical ordering.
//
// Usage:
//   node scripts/sort-dict.js file.txt ...          # sort in place
//   node scripts/sort-dict.js --check file.txt ...  # check only, exit 1 if unsorted

'use strict';
const fs = require('fs');

const collator = new Intl.Collator('es', { sensitivity: 'base' });

function processFile(path, checkOnly) {
  const content = fs.readFileSync(path, 'utf8');
  const lines = content.split('\n');

  // strip trailing empty string from trailing newline
  if (lines.at(-1) === '') lines.pop();

  const result = [];
  let sectionWords = [];
  let sectionName = '(inicio)';
  let ok = true;

  function flush() {
    if (!sectionWords.length) return;
    const sorted = [...sectionWords].sort((a, b) => collator.compare(a, b));
    if (checkOnly) {
      const idx = sectionWords.findIndex((w, i) => w !== sorted[i]);
      if (idx !== -1) {
        process.stderr.write(
          `ERROR: ${path} (${sectionName}): '${sectionWords[idx]}' no está en orden alfabético\n`
        );
        ok = false;
      }
      result.push(...sectionWords);
    } else {
      result.push(...sorted);
    }
    sectionWords = [];
  }

  for (const line of lines) {
    if (!line || line.startsWith('#')) {
      flush();
      result.push(line);
      if (line.startsWith('#')) sectionName = line;
    } else {
      sectionWords.push(line);
    }
  }
  flush();

  if (!checkOnly) {
    fs.writeFileSync(path, result.join('\n') + '\n', 'utf8');
  }

  return ok;
}

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const files = args.filter(a => !a.startsWith('--'));

if (!files.length) {
  process.stderr.write('Usage: sort-dict.js [--check] file.txt ...\n');
  process.exit(1);
}

let allOk = true;
for (const file of files) {
  if (!processFile(file, checkOnly)) allOk = false;
  else if (!checkOnly) console.log(`sort-dict: ${file}`);
}

process.exit(allOk ? 0 : 1);
