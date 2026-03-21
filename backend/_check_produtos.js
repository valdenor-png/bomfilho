require('dotenv').config();
const { pool } = require('./lib/db');

(async () => {
  try {
    const [recentes] = await pool.query(
      `SELECT id, nome, estoque, preco, categoria, ativo, criado_em 
       FROM produtos WHERE criado_em >= '2026-03-20' ORDER BY criado_em DESC`
    );
    console.log('=== Produtos criados desde 20/03 ===');
    console.table(recentes);

    const [totais] = await pool.query(
      `SELECT COUNT(*) as total, 
              SUM(CASE WHEN estoque > 0 THEN 1 ELSE 0 END) as com_estoque 
       FROM produtos WHERE ativo = 1`
    );
    console.log('Totais:', totais[0]);

    const [comEstoque] = await pool.query(
      `SELECT id, nome, nome_externo, estoque, preco, categoria, criado_em 
       FROM produtos WHERE estoque > 0 AND ativo = 1 ORDER BY criado_em DESC`
    );
    console.log('=== Todos com estoque > 0 ===');
    console.table(comEstoque);

    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
