'use strict';

/**
 * Migration runner simples com tabela schema_migrations.
 * Uso: node migrate.js [--dry-run]
 *
 * Executa os arquivos de backend/migrations/ em ordem numérica.
 * Registra execução na tabela schema_migrations para idempotência.
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const mysql = require('mysql2/promise');

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurada.');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function run() {
  const dbUrl = new URL(DATABASE_URL);
  const pool = mysql.createPool({
    host: dbUrl.hostname,
    port: dbUrl.port,
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.replace('/', ''),
    waitForConnections: true,
    connectionLimit: 2,
    multipleStatements: true,
  });

  try {
    // Criar tabela de controle se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        execution_time_ms INT DEFAULT 0,
        INDEX idx_filename (filename)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Listar migrations já aplicadas
    const [applied] = await pool.query('SELECT filename, checksum FROM schema_migrations ORDER BY id ASC');
    const appliedMap = new Map(applied.map((r) => [r.filename, r.checksum]));

    // Listar migrations disponíveis (ordem alfabética/numérica)
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.log('📂 Pasta migrations/ não encontrada. Nada a fazer.');
      await pool.end();
      return;
    }

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('📂 Nenhum arquivo .sql em migrations/. Nada a fazer.');
      await pool.end();
      return;
    }

    const crypto = require('crypto');
    let executadas = 0;
    let ignoradas = 0;

    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const checksum = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);

      if (appliedMap.has(file)) {
        const prevChecksum = appliedMap.get(file);
        if (prevChecksum !== checksum) {
          console.warn(`⚠️  ${file} — já aplicada mas conteúdo mudou (checksum anterior: ${prevChecksum}, atual: ${checksum})`);
        }
        ignoradas++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`🔍 [DRY-RUN] Executaria: ${file} (checksum: ${checksum})`);
        executadas++;
        continue;
      }

      console.log(`▶️  Executando: ${file}...`);
      const start = Date.now();

      try {
        await pool.query(content);
        const elapsed = Date.now() - start;
        await pool.query(
          'INSERT INTO schema_migrations (filename, checksum, execution_time_ms) VALUES (?, ?, ?)',
          [file, checksum, elapsed]
        );
        console.log(`✅ ${file} — OK (${elapsed}ms)`);
        executadas++;
      } catch (err) {
        const elapsed = Date.now() - start;
        console.error(`❌ ${file} — FALHOU após ${elapsed}ms:`, err.message);
        console.error('   Abortando. Corrija a migration e re-execute.');
        await pool.end();
        process.exit(1);
      }
    }

    console.log(`\n📊 Resumo: ${executadas} executada(s), ${ignoradas} já aplicada(s), ${files.length} total.`);
    if (DRY_RUN) {
      console.log('   (modo --dry-run, nenhuma alteração foi aplicada)');
    }
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error('❌ Erro fatal no migration runner:', err);
  process.exit(1);
});
