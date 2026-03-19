'use strict';

const express = require('express');
const logger = require('../lib/logger');
const { queryWithRetry } = require('../lib/db');
const { SERVICE_NAME, API_VERSION } = require('../lib/config');

module.exports = function createHealthRoutes(deps) {
  const router = express.Router();
  const { protegerMetrics } = deps;

  router.get('/api', (req, res) => {
    res.json({
      mensagem: '🛒 API Bom Filho Supermercado',
      versao: API_VERSION,
      status: 'online'
    });
  });

  router.get('/health', (req, res) => {
    try {
      return res.status(200).json({
        status: 'ok',
        service: SERVICE_NAME,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      });
    } catch (erro) {
      logger.error('Erro no health check:', erro);
      return res.status(500).json({
        status: 'error',
        service: SERVICE_NAME,
        timestamp: new Date().toISOString()
      });
    }
  });

  router.get('/ready', async (req, res) => {
    try {
      await queryWithRetry('SELECT 1 AS ok');

      return res.status(200).json({
        status: 'ready',
        service: SERVICE_NAME,
        timestamp: new Date().toISOString()
      });
    } catch (erro) {
      logger.error('Erro no readiness check:', erro);
      return res.status(503).json({
        status: 'not-ready',
        service: SERVICE_NAME,
        timestamp: new Date().toISOString(),
        erro: 'Falha na conexão com MySQL'
      });
    }
  });

  router.get('/metrics', protegerMetrics, (req, res) => {
    try {
      const memory = process.memoryUsage();

      return res.status(200).json({
        service: SERVICE_NAME,
        uptime: Number(process.uptime().toFixed(2)),
        memory: {
          rss: memory.rss,
          heapTotal: memory.heapTotal,
          heapUsed: memory.heapUsed
        },
        timestamp: new Date().toISOString()
      });
    } catch (erro) {
      logger.error('Erro ao coletar métricas:', erro);
      return res.status(500).json({
        status: 'error',
        service: SERVICE_NAME,
        timestamp: new Date().toISOString()
      });
    }
  });

  router.get('/version', (req, res) => {
    try {
      return res.status(200).json({
        service: SERVICE_NAME,
        version: API_VERSION,
        timestamp: new Date().toISOString()
      });
    } catch (erro) {
      logger.error('Erro ao consultar versão:', erro);
      return res.status(500).json({
        status: 'error',
        service: SERVICE_NAME,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
};
