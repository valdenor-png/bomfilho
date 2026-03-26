'use strict';

/**
 * Auditoria de possíveis textos corrompidos no banco (somente leitura).
 * Uso:
 *   node scripts/auditar-encoding-banco.js
 */

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '../.env' });

const { queryWithRetry, endPool } = require('../lib/db');

const PATTERNS = [
  `%\u00C3\u00A1%`, `%\u00C3\u00A2%`, `%\u00C3\u00A3%`, `%\u00C3\u00A7%`, `%\u00C3\u00A9%`, `%\u00C3\u00AA%`, `%\u00C3\u00AD%`, `%\u00C3\u00B3%`, `%\u00C3\u00B4%`, `%\u00C3\u00B5%`, `%\u00C3\u00BA%`,
  `%\u00C3\u0081%`, `%\u00C3\u0089%`, `%\u00C3\u0093%`, `%\u00C3\u009A%`, `%\u00C3\u0192%`, `%\u00C3\u201A%`,
  `%\u00C2\u00B7%`, `%\u00C2\u00BA%`, `%\u00C2\u00AA%`,
  `%\u00E2\u20AC\u00A2%`, `%\u00E2\u20AC\u201D%`, `%\u00E2\u20AC\u201C%`, `%\u00E2\u20AC\u00A6%`, `%\u00E2\u20AC\u0153%`, `%\u00E2\u20AC\u009D%`, `%\u00E2\u20AC\u02DC%`, `%\u00E2\u20AC\u2122%`
];

const TARGETS = {
  produtos: ['nome', 'nome_externo', 'descricao', 'marca', 'categoria', 'departamento', 'secao_exibicao', 'unidade', 'enrichment_last_error'],
  pedidos: ['status', 'forma_pagamento', 'tipo_entrega', 'observacoes', 'revisao_obs', 'delivery_status_internal', 'delivery_status_provider', 'delivery_recipient_name', 'delivery_recipient_note'],
  usuarios: ['nome', 'email']
};

async function tableExists(tableName) {
  const [rows] = await queryWithRetry(
    `SELECT COUNT(*) AS total
       FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_name = ?`,
    [tableName]
  );
  return Number(rows?.[0]?.total || 0) > 0;
}

async function columnExists(tableName, columnName) {
  const [rows] = await queryWithRetry(
    `SELECT COUNT(*) AS total
       FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_name = ?
        AND column_name = ?`,
    [tableName, columnName]
  );
  return Number(rows?.[0]?.total || 0) > 0;
}

async function run() {
  let encontrou = false;

  for (const [table, columns] of Object.entries(TARGETS)) {
    if (!(await tableExists(table))) {
      continue;
    }

    for (const column of columns) {
      if (!(await columnExists(table, column))) {
        continue;
      }

      const where = PATTERNS.map(() => `${column} LIKE ?`).join(' OR ');
      const [rows] = await queryWithRetry(
        `SELECT COUNT(*) AS total
           FROM ${table}
          WHERE ${column} IS NOT NULL
            AND (${where})`,
        PATTERNS
      );

      const total = Number(rows?.[0]?.total || 0);
      if (total <= 0) {
        continue;
      }

      encontrou = true;
      console.log(`${table}.${column}: ${total} registro(s) com possível mojibake`);

      const [samples] = await queryWithRetry(
        `SELECT id, ${column}
           FROM ${table}
          WHERE ${column} IS NOT NULL
            AND (${where})
          LIMIT 5`,
        PATTERNS
      );

      for (const sample of samples) {
        const value = String(sample[column] || '').slice(0, 180);
        console.log(`  - id=${sample.id} valor=${value}`);
      }
    }
  }

  if (!encontrou) {
    console.log('OK: nenhum indício de mojibake encontrado nas colunas auditadas.');
  }
}

run()
  .catch((error) => {
    console.error('Falha na auditoria de encoding do banco:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await endPool();
    } catch {
      // noop
    }
  });
