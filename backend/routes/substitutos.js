'use strict';
const express = require('express');
const { queryWithRetry } = require('../lib/db');

module.exports = function createSubstitutosRoutes() {
  const router = express.Router();

  // GET /api/produtos/:id/substitutos
  router.get('/api/produtos/:id/substitutos', async (req, res) => {
    try {
      const produtoId = parseInt(req.params.id, 10);
      if (isNaN(produtoId)) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      // 1. Fetch the original product
      const { rows: origRows } = await queryWithRetry(
        'SELECT id, nome, preco, categoria, estoque, ativo FROM produtos WHERE id = $1',
        [produtoId]
      );

      if (origRows.length === 0) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      const original = origRows[0];
      const preco = parseFloat(original.preco);

      // 2. Find up to 3 substitutes in the same category within ±30% price
      const precoMin = preco * 0.7;
      const precoMax = preco * 1.3;

      const { rows: substitutos } = await queryWithRetry(
        `SELECT id, nome, preco, imagem_url
         FROM produtos
         WHERE ativo = TRUE
           AND estoque > 0
           AND id != $1
           AND categoria = $2
           AND preco BETWEEN $3 AND $4
         ORDER BY ABS(preco - $5) ASC
         LIMIT 3`,
        [produtoId, original.categoria, precoMin, precoMax, preco]
      );

      // 3. Format the diferenca field
      const formatado = substitutos.map((s) => {
        const diff = parseFloat(s.preco) - preco;
        let diferenca;
        if (diff > 0) {
          diferenca = `+R$ ${diff.toFixed(2).replace('.', ',')}`;
        } else if (diff < 0) {
          diferenca = `-R$ ${Math.abs(diff).toFixed(2).replace('.', ',')}`;
        } else {
          diferenca = 'Mesmo preco';
        }
        return {
          id: s.id,
          nome: s.nome,
          preco: parseFloat(s.preco),
          imagem_url: s.imagem_url,
          diferenca,
        };
      });

      return res.json({
        produto_original: {
          id: original.id,
          nome: original.nome,
          preco,
          categoria: original.categoria,
        },
        substitutos: formatado,
      });
    } catch (err) {
      console.error('[substitutos] Erro:', err.message);
      return res.status(500).json({ error: 'Erro ao buscar substitutos' });
    }
  });

  return router;
};
