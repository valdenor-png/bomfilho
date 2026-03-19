'use strict';

const express = require('express');
const logger = require('../lib/logger');
const { LIMITE_BIKE_KM } = require('../lib/config');

/**
 * @param {object} deps
 * @param {Function} deps.calcularEntregaPorCep
 */
module.exports = function createFreteRoutes({ calcularEntregaPorCep }) {
  const router = express.Router();

  // Simular frete por CEP
  router.get('/api/frete/simular', async (req, res) => {
    try {
      const cep = String(req.query?.cep || '').trim();
      const numero = String(req.query?.numero || '').trim();
      const veiculo = String(req.query?.veiculo || 'moto').trim().toLowerCase();

      const entrega = await calcularEntregaPorCep({
        cepDestino: cep,
        veiculo,
        numeroDestino: numero
      });

      return res.json({
        mensagem: 'Frete calculado com sucesso',
        ...entrega,
        limite_bike_km: LIMITE_BIKE_KM
      });
    } catch (erro) {
      if (erro?.httpStatus) {
        return res.status(erro.httpStatus).json({ erro: erro.message });
      }

      logger.error('Erro ao simular frete por CEP:', erro);
      return res.status(500).json({ erro: 'Não foi possível calcular o frete no momento.' });
    }
  });

  return router;
};
