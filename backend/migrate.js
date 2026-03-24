'use strict';

/**
 * Migration runner para PostgreSQL com compat layer para SQL legado em MySQL.
 * Uso: node migrate.js [--dry-run]
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
if (!DATABASE_URL) {
  console.error('DATABASE_URL nao configurada.');
  process.exit(1);
}

if (!/^postgres(ql)?:\/\//i.test(DATABASE_URL)) {
  console.error('Este runner esta configurado para PostgreSQL. DATABASE_URL atual nao e postgres://');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function splitSqlStatements(sql) {
  return String(sql)
    .split(/;\s*\n/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeAlterAddColumn(sql) {
  const normalized = sql
    .replace(/\s+AFTER\s+\w+/gi, '')
    .replace(/\bDATETIME\b/gi, 'TIMESTAMP')
    .replace(/\bTINYINT\s*\(\s*1\s*\)/gi, 'SMALLINT')
    .replace(/\bLONGTEXT\b/gi, 'TEXT')
    .replace(/\bMEDIUMTEXT\b/gi, 'TEXT')
    .replace(/\bJSON\b/gi, 'JSONB')
    .replace(/\bENUM\s*\([^)]*\)/gi, 'VARCHAR(64)')
    .replace(/\bUNSIGNED\b/gi, '')
    .trim();

  const multiAdd = normalized.match(/^ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ADD\s+COLUMN\s+([\s\S]+)$/i);
  if (!multiAdd) {
    return normalized.replace(/ADD\s+COLUMN\s+/i, 'ADD COLUMN IF NOT EXISTS ');
  }

  const tableName = multiAdd[1];
  const columnsPart = multiAdd[2];
  const columnDefs = columnsPart
    .split(/\s*,\s*ADD\s+COLUMN\s+/i)
    .map((c) => c.trim())
    .filter(Boolean);

  return columnDefs
    .map((def) => `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${def}`)
    .join(';\n');
}

function normalizeCreateIndex(sql) {
  return sql
    .replace(/^CREATE\s+INDEX\s+/i, 'CREATE INDEX IF NOT EXISTS ')
    .trim();
}

function normalizeAlterTable(sql) {
  const trimmed = String(sql || '').trim();
  const addIndex = trimmed.match(/^ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ADD\s+(?:INDEX|KEY)\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)$/i);
  if (addIndex) {
    return `CREATE INDEX IF NOT EXISTS ${addIndex[2]} ON ${addIndex[1]} (${addIndex[3]})`;
  }

  if (/^ALTER\s+TABLE\s+[a-zA-Z0-9_]+\s+ADD\s+COLUMN\s+/i.test(trimmed)) {
    return normalizeAlterAddColumn(trimmed);
  }

  return trimmed;
}

function transformCreateTableBlock(sql) {
  const indexStatements = [];

  const transformed = sql.replace(/CREATE TABLE IF NOT EXISTS\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*((?:ENGINE\s*=\s*InnoDB[^;]*)?);/gi, (_full, tableName, rawBody, suffix) => {
    const lines = rawBody.split('\n');
    const kept = [];

    for (const line of lines) {
      const hadComma = /,\s*$/.test(line.trim());
      const trimmed = line.trim().replace(/,$/, '');

      if (!trimmed) {
        kept.push(line);
        continue;
      }

      const uniqueKey = trimmed.match(/^UNIQUE\s+KEY\s+([a-zA-Z0-9_]+)\s*\((.+)\)$/i);
      if (uniqueKey) {
        kept.push(`  CONSTRAINT ${uniqueKey[1]} UNIQUE (${uniqueKey[2]})${hadComma ? ',' : ''}`);
        continue;
      }

      const normalKey = trimmed.match(/^(INDEX|KEY)\s+([a-zA-Z0-9_]+)\s*\((.+)\)$/i);
      if (normalKey) {
        indexStatements.push(`CREATE INDEX IF NOT EXISTS ${normalKey[2]} ON ${tableName} (${normalKey[3]})`);
        continue;
      }

      kept.push(line);
    }

    const bodyNoTrailingComma = kept
      .join('\n')
      .replace(/,\s*$/m, (match, offset, source) => {
        const tail = source.slice(offset + match.length);
        return tail.trim() ? match : '';
      })
      .replace(/,\s*$/, '');

    const suffixNormalized = String(suffix || '')
      .replace(/ENGINE\s*=\s*InnoDB/gi, '')
      .replace(/DEFAULT\s+CHARSET\s*=\s*utf8mb4/gi, '')
      .replace(/COLLATE\s*=\s*[a-zA-Z0-9_]+/gi, '')
      .trim();

    const ending = suffixNormalized ? ` ${suffixNormalized}` : '';
    return `CREATE TABLE IF NOT EXISTS ${tableName} (${bodyNoTrailingComma})${ending};`;
  });

  const appended = indexStatements.length ? `\n${indexStatements.join(';\n')};\n` : '\n';
  return `${transformed}${appended}`;
}

function transformLegacyMysqlToPostgres(sql) {
  let out = String(sql || '');
  const dynamicStatements = [];

  out = out
    .replace(/^\s*USE\s+[^;]+;\s*$/gim, '')
    .replace(/`/g, '');

  // Extrai blocos dinamicos MySQL com @sql + PREPARE/EXECUTE e converte em SQL direto.
  out = out.replace(
    /SET\s+@\w+\s*:?=\s*[\s\S]*?;\s*PREPARE\s+\w+\s+FROM\s+@\w+;\s*EXECUTE\s+\w+;\s*(?:DEALLOCATE\s+PREPARE\s+\w+;\s*)?/gi,
    (block) => {
      const quotedSql = [...String(block).matchAll(/'((?:[^']|(?:''))*)'/g)]
        .map((m) => String(m[1] || '').replace(/''/g, "'").trim())
        .filter((candidate) => /^(ALTER\s+TABLE|CREATE\s+INDEX|CREATE\s+UNIQUE\s+INDEX)/i.test(candidate));

      for (const candidate of quotedSql) {
        if (/^ALTER\s+TABLE/i.test(candidate)) {
          dynamicStatements.push(normalizeAlterTable(candidate));
        } else if (/^CREATE\s+/i.test(candidate)) {
          dynamicStatements.push(normalizeCreateIndex(candidate));
        }
      }

      return '';
    }
  );

  out = out.replace(
    /SET\s+@\w+\s*:=?\s*\([^]*?COLUMN_NAME\s*=\s*'[^']+'[^]*?\);\s*SET\s+@sql\s*:=?\s*IF\s*\([^]*?'(ALTER TABLE[^']+ADD COLUMN[^']+)'[^]*?\);\s*PREPARE\s+stmt\s+FROM\s+@sql;\s*EXECUTE\s+stmt;\s*DEALLOCATE\s+PREPARE\s+stmt;?/gim,
    (_match, alterSql) => `${normalizeAlterAddColumn(alterSql)};`
  );

  out = out.replace(
    /SET\s+@\w+\s*=\s*\([^]*?INDEX_NAME\s*=\s*'[^']+'[^]*?\);\s*SET\s+@sql\s*=\s*IF\s*\([^]*?'(CREATE INDEX[^']+)'[^]*?\);\s*PREPARE\s+stmt\s+FROM\s+@sql;\s*EXECUTE\s+stmt;\s*DEALLOCATE\s+PREPARE\s+stmt;?/gim,
    (_match, createIndexSql) => `${normalizeCreateIndex(createIndexSql)};`
  );

  // Remove sobras de comandos de variavel/scripting do MySQL.
  out = out
    .replace(/^\s*SET\s+@[^;]+;\s*$/gim, '')
    .replace(/^\s*PREPARE\s+\w+\s+FROM\s+@\w+;\s*$/gim, '')
    .replace(/^\s*EXECUTE\s+\w+;\s*$/gim, '')
    .replace(/^\s*DEALLOCATE\s+PREPARE\s+\w+;\s*$/gim, '');

  out = transformCreateTableBlock(out)
    .replace(/ALTER\s+TABLE\s+[a-zA-Z0-9_]+\s+ADD\s+COLUMN[\s\S]*?(?=;)/gi, (statement) => normalizeAlterAddColumn(statement))
    .replace(/ALTER\s+TABLE\s+[a-zA-Z0-9_]+\s+ADD\s+(?:INDEX|KEY)\s+[a-zA-Z0-9_]+\s*\([^)]+\)/gi, (statement) => normalizeAlterTable(statement))
    .replace(/\bBIGINT\s+UNSIGNED\s+NOT\s+NULL\s+AUTO_INCREMENT\b/gi, 'BIGINT GENERATED BY DEFAULT AS IDENTITY NOT NULL')
    .replace(/\bBIGINT\s+UNSIGNED\s+AUTO_INCREMENT\b/gi, 'BIGINT GENERATED BY DEFAULT AS IDENTITY')
    .replace(/\bINT\s+AUTO_INCREMENT\b/gi, 'INTEGER GENERATED BY DEFAULT AS IDENTITY')
    .replace(/\bBIGINT\s+AUTO_INCREMENT\b/gi, 'BIGINT GENERATED BY DEFAULT AS IDENTITY')
    .replace(/\bAUTO_INCREMENT\b/gi, 'GENERATED BY DEFAULT AS IDENTITY')
    .replace(/\bUNSIGNED\b/gi, '')
    .replace(/\bLONGTEXT\b/gi, 'TEXT')
    .replace(/\bMEDIUMTEXT\b/gi, 'TEXT')
    .replace(/\bTINYINT\s*\(\s*1\s*\)/gi, 'SMALLINT')
    .replace(/\bDATETIME\b/gi, 'TIMESTAMP')
    .replace(/\bJSON\b/gi, 'JSONB')
    .replace(/\bENUM\s*\(([^)]*)\)/gi, 'VARCHAR(64)')
    .replace(/\bON\s+UPDATE\s+CURRENT_TIMESTAMP\b/gi, '')
    .replace(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+([\s\S]*?)\s+WHERE\s+([\s\S]*?)\s+LIMIT\s+(\d+)/gi, (_m, table, setPart, wherePart, limit) => {
      return `UPDATE ${table} SET ${setPart} WHERE ctid IN (SELECT ctid FROM ${table} WHERE ${wherePart} LIMIT ${limit})`;
    })
    .replace(/\)\s*ENGINE\s*=\s*InnoDB\s*DEFAULT\s*CHARSET\s*=\s*utf8mb4\s*COLLATE\s*=\s*[a-zA-Z0-9_]+/gi, ')')
    .replace(/\bDATE_ADD\s*\(\s*CURDATE\s*\(\s*\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi, "(CURRENT_DATE + ($1 || ' days')::interval)")
    .replace(/\bCURDATE\s*\(\s*\)/gi, 'CURRENT_DATE');

  if (dynamicStatements.length) {
    out = `${dynamicStatements.join(';\n')};\n${out}`;
  }

  return out;
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW(),
      execution_time_ms INTEGER DEFAULT 0
    )
  `);

  await client.query('CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename ON schema_migrations (filename)');
}

async function run() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    ssl: String(process.env.DB_SSL || '').trim().toLowerCase() === 'true'
      ? { rejectUnauthorized: false }
      : undefined
  });

  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);

    const appliedResult = await client.query('SELECT filename, checksum FROM schema_migrations ORDER BY id ASC');
    const appliedMap = new Map((appliedResult.rows || []).map((r) => [r.filename, r.checksum]));

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.log('Pasta migrations/ nao encontrada. Nada a fazer.');
      return;
    }

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('Nenhum arquivo .sql em migrations/. Nada a fazer.');
      return;
    }

    let executadas = 0;
    let ignoradas = 0;

    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const checksum = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);

      if (appliedMap.has(file)) {
        const prevChecksum = appliedMap.get(file);
        if (prevChecksum !== checksum) {
          console.warn(`AVISO: ${file} ja aplicada, mas checksum mudou (${prevChecksum} -> ${checksum}).`);
        }
        ignoradas += 1;
        continue;
      }

      const transformed = transformLegacyMysqlToPostgres(content);
      const statements = splitSqlStatements(transformed);

      if (DRY_RUN) {
        console.log(`[DRY-RUN] Executaria: ${file} (${statements.length} statements)`);
        executadas += 1;
        continue;
      }

      console.log(`Executando: ${file}...`);
      const start = Date.now();
      let currentStatement = '';

      try {
        await client.query('BEGIN');
        for (const statement of statements) {
          currentStatement = statement;
          await client.query(statement);
        }

        const elapsed = Date.now() - start;
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum, execution_time_ms) VALUES ($1, $2, $3)',
          [file, checksum, elapsed]
        );
        await client.query('COMMIT');
        console.log(`OK: ${file} (${elapsed}ms)`);
        executadas += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        const elapsed = Date.now() - start;
        console.error(`FALHA: ${file} apos ${elapsed}ms -> ${err.message}`);
        if (currentStatement) {
          console.error('Statement com erro:');
          console.error(currentStatement);
        }
        console.error('Abortando para manter consistencia.');
        process.exit(1);
      }
    }

    console.log(`Resumo: ${executadas} executada(s), ${ignoradas} ignorada(s), ${files.length} total.`);
    if (DRY_RUN) {
      console.log('Modo dry-run: nenhuma alteracao foi aplicada.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Erro fatal no migration runner:', err);
  process.exit(1);
});