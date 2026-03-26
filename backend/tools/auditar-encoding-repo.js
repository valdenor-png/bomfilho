'use strict';

/**
 * Auditoria de encoding/mojibake no repositório.
 * Uso:
 *   node scripts/auditar-encoding-repo.js
 *   node scripts/auditar-encoding-repo.js --fail-on-match
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const FAIL_ON_MATCH = process.argv.includes('--fail-on-match');
const IGNORE_DIRS = new Set(['.git', '.agents', 'node_modules', 'dist', 'logs']);
const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.sql', '.md',
  '.yml', '.yaml', '.ps1', '.bat', '.env', '.txt', '.html', '.csv', '.sh'
]);

const MOJIBAKE_REGEX = /\u00C3[\u00A0-\u00BF]|\u00C2[\u00A0-\u00BF]|\u00E2(?:\u20AC|\u201A|\u0192|\u201E|\u2026|\u2020|\u2021|\u02C6|\u2030|\u0160|\u2039|\u0152|\u017D|\u2018|\u2019|\u201C|\u201D|\u2022|\u2013|\u2014|\u02DC|\u2122|\u0161|\u203A|\u0153|\u017E|\u0178)|\u00F0\u0178|\uFFFD|[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath);
  return TEXT_EXTENSIONS.has(ext) || base.endsWith('.env.example') || base === 'Dockerfile';
}

function walk(dirPath, files) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (isTextFile(fullPath)) files.push(fullPath);
  }
}

function hasUtf8Bom(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
}

const files = [];
walk(ROOT, files);

const findings = [];

for (const filePath of files) {
  let buffer;
  try {
    buffer = fs.readFileSync(filePath);
  } catch {
    continue;
  }

  const bom = hasUtf8Bom(buffer);
  const content = buffer.toString('utf8');
  const hits = content.match(MOJIBAKE_REGEX) || [];

  if (bom || hits.length > 0) {
    findings.push({
      file: path.relative(ROOT, filePath).replace(/\\/g, '/'),
      bom,
      hits: hits.length
    });
  }
}

if (!findings.length) {
  console.log('OK: nenhum indício de mojibake, controle inválido ou BOM UTF-8 encontrado.');
  process.exit(0);
}

console.log('Arquivos com indício de encoding inconsistente:');
for (const item of findings) {
  const flags = [];
  if (item.bom) flags.push('BOM');
  if (item.hits > 0) flags.push(`mojibake=${item.hits}`);
  console.log(`- ${item.file} (${flags.join(', ')})`);
}

if (FAIL_ON_MATCH) {
  process.exit(1);
}
