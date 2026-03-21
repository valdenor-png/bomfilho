'use strict';

const express = require('express');
const { pool } = require('../lib/db');
const logger = require('../lib/logger');

/**
 * @param {object} deps
 * @param {Function} deps.autenticarToken
 * @param {Function} deps.toMoney
 */
module.exports = function createCuponsRoutes({ autenticarToken, toMoney }) {
  const router = express.Router();

  // Validar cupom
  router.post('/api/cupons/validar', autenticarToken, async (req, res) => {
    try {
      const { codigo, valorPedido } = req.body;

      // Buscar cupom
      const [cupons] = await pool.query(
        `SELECT id, codigo, descricao, tipo, valor, valor_minimo, uso_atual, uso_maximo
         FROM cupons
         WHERE codigo = ?
         AND ativo = TRUE
         AND (validade IS NULL OR validade >= CURDATE())
         AND (uso_maximo IS NULL OR uso_atual < uso_maximo)`,
        [codigo.toUpperCase()]
      );

      if (cupons.length === 0) {
        return res.status(404).json({ erro: 'Cupom inválido ou expirado.' });
      }

      const cupom = cupons[0];

      // Verificar valor mínimo
      const valorMinimoCupom = Number(cupom.valor_minimo || 0);
      if (valorPedido < valorMinimoCupom) {
        return res.status(400).json({
          erro: `Valor mínimo do pedido para este cupom: R$ ${valorMinimoCupom.toFixed(2)}`
        });
      }

      // Verificar se usuário já usou
      const [usados] = await pool.query(
        'SELECT id FROM cupons_usados WHERE cupom_id = ? AND usuario_id = ?',
        [cupom.id, req.usuario.id]
      );

      if (usados.length > 0) {
        return res.status(400).json({ erro: 'Este cupom já foi utilizado nesta conta.' });
      }

      // Calcular desconto
      const valorPedidoNum = toMoney(Number(valorPedido || 0));
      let desconto = 0;
      if (cupom.tipo === 'percentual') {
        desconto = toMoney(valorPedidoNum * (Number(cupom.valor || 0) / 100));
      } else {
        desconto = toMoney(Number(cupom.valor || 0));
      }

      // Garantir que desconto não seja maior que o valor do pedido
      if (desconto > valorPedidoNum) {
        desconto = valorPedidoNum;
      }

      res.json({
        valido: true,
        cupom_id: cupom.id,
        codigo: cupom.codigo,
        descricao: cupom.descricao,
        tipo: cupom.tipo,
        valor: Number(cupom.valor || 0),
        desconto,
        total_com_desconto: toMoney(valorPedidoNum - desconto)
      });
    } catch (erro) {
      logger.error('Erro ao validar cupom:', erro);
      res.status(500).json({ erro: 'Não foi possível validar o cupom. Tente novamente.' });
    }
  });

  // Listar cupons ativos (para mostrar na página)
  router.get('/api/cupons/disponiveis', async (req, res) => {
    try {
      const [cupons] = await pool.query(
        `SELECT codigo, descricao, tipo, valor, valor_minimo, validade 
         FROM cupons 
         WHERE ativo = TRUE 
         AND (validade IS NULL OR validade >= CURDATE())
         AND (uso_maximo IS NULL OR uso_atual < uso_maximo)
         ORDER BY valor DESC`
      );

      res.json({ cupons: cupons });
    } catch (erro) {
      logger.error('Erro ao listar cupons:', erro);
      res.status(500).json({ erro: 'Não foi possível carregar os cupons disponíveis.' });
    }
  });

  return router;
};
