const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true'
    ? {
      rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').trim().toLowerCase() !== 'false',
      ...(process.env.DB_CA_CERT ? { ca: process.env.DB_CA_CERT } : {})
    }
    : undefined
});

async function run() {
  const ids = JSON.parse(fs.readFileSync('../tmp/ids_atualizar.json', 'utf8'));
  console.log('Atualizando estoque de', ids.length, 'produtos para 30...');

  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500).map(Number);
    const result = await pool.query(
      'UPDATE produtos SET estoque = 30 WHERE id = ANY($1::int[])',
      [batch]
    );
    console.log('  Batch', Math.floor(i / 500) + 1, ':', result.rowCount, 'atualizados');
  }

  const novos = JSON.parse(fs.readFileSync('../tmp/novos_categorizados.json', 'utf8'));
  console.log('Inserindo', novos.length, 'produtos novos...');

  for (const p of novos) {
    try {
      const result = await pool.query(
        'INSERT INTO produtos (nome, categoria, estoque, preco, unidade) VALUES ($1, $2, 30, 0, $3) RETURNING id',
        [p.nome, p.cat, 'un']
      );
      console.log('  OK:', p.nome, '-> ID:', result.rows[0].id, '| Cat:', p.cat);
    } catch (err) {
      console.error('  ERRO:', p.nome, '-', err.message);
    }
  }

  const total = await pool.query('SELECT COUNT(*) as total FROM produtos');
  const comEstoque = await pool.query('SELECT COUNT(*) as total FROM produtos WHERE estoque > 0');
  console.log('=== RESULTADO ===');
  console.log('Total produtos:', total.rows[0].total);
  console.log('Com estoque > 0:', comEstoque.rows[0].total);

  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
