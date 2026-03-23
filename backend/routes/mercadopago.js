'use strict';

/**
 * Rotas de pagamento via Mercado Pago.
 *
 * POST /api/mercadopago/criar-pix     — Gera pagamento PIX para pedido já aprovado
 * POST /api/mercadopago/criar-cartao  — Processa pagamento com cartão de crédito
 * GET  /api/mercadopago/status        — Health check do gateway
 */

const express = require('express');
const logger = require('../lib/logger');
const { MP_ACCESS_TOKEN, MP_ENV, MP_NOTIFICATION_URL, MP_WEBHOOK_SECRET } = require('../lib/config');

function extrairCausasMercadoPago(mpResponse = {}) {
  const causas = Array.isArray(mpResponse?.cause) ? mpResponse.cause : [];
  const mensagens = causas
    .map((item) => String(item?.description || item?.message || item?.code || '').trim())
    .filter(Boolean);

  return Array.from(new Set(mensagens));
}

module.exports = function createMercadoPagoRoutes(deps) {
  const {
    autenticarToken,
    mercadoPagoService,
    pool
  } = deps;

  const router = express.Router();

  // ============================================
  // CRIAR PIX via Mercado Pago
  // ============================================
  router.post('/api/mercadopago/criar-pix', autenticarToken, async (req, res) => {
    try {
      const { pedido_id, tax_id } = req.body || {};
      const pedidoId = Number(pedido_id);

      if (!Number.isFinite(pedidoId) || pedidoId <= 0) {
        return res.status(400).json({ error: 'Informe um pedido_id válido.' });
      }

      // Buscar pedido — só permite gerar PIX para pedido do próprio usuário com status pendente
      const [pedidos] = await pool.query(
        'SELECT id, usuario_id, total, status, gateway_pagamento, mp_payment_id_mp FROM pedidos WHERE id = ? LIMIT 1',
        [pedidoId]
      );

      if (!pedidos.length) {
        return res.status(404).json({ error: 'Pedido não encontrado.' });
      }

      const pedido = pedidos[0];

      if (Number(pedido.usuario_id) !== Number(req.usuario.id)) {
        return res.status(403).json({ error: 'Acesso negado a este pedido.' });
      }

      const podeGerarPix = ['pendente', 'pagamento_recusado'].includes(String(pedido.status || '').trim().toLowerCase());
      if (!podeGerarPix) {
        return res.status(400).json({ error: `Pedido já se encontra com status "${pedido.status}". Não é possível gerar PIX.` });
      }

      // Se já tem pagamento MP criado, retornar dados existentes
      if (pedido.mp_payment_id_mp) {
        try {
          const pagamento = await mercadoPagoService.consultarPagamento(pedido.mp_payment_id_mp);
          if (pagamento.status === 'pending' || pagamento.status === 'approved') {
            const [pixData] = await pool.query(
              'SELECT pix_codigo, pix_qrcode, pix_qr_base64 FROM pedidos WHERE id = ? LIMIT 1',
              [pedidoId]
            );
            return res.json({
              payment_id: pedido.mp_payment_id_mp,
              status: pagamento.status,
              pix_codigo: pixData[0]?.pix_codigo || '',
              pix_qrcode: pixData[0]?.pix_qrcode || '',
              qr_code_base64: pixData[0]?.pix_qr_base64 || ''
            });
          }
        } catch (err) {
          logger.warn(`[MP] Pagamento anterior ${pedido.mp_payment_id_mp} inválido, criando novo:`, err.message);
        }
      }

      // Buscar dados do usuário
      const [usuarios] = await pool.query(
        'SELECT nome, email FROM usuarios WHERE id = ? LIMIT 1',
        [req.usuario.id]
      );
      const usuario = usuarios[0] || {};
      const taxIdDigits = String(tax_id || '').replace(/\D/g, '');

      const resultado = await mercadoPagoService.criarPagamentoPix({
        pedidoId,
        valor: Number(pedido.total),
        descricao: `Pedido #${pedidoId} - Mercado BomFilho`,
        email: usuario.email || 'cliente@bomfilho.com.br',
        nome: usuario.nome || 'Cliente',
        cpf: taxIdDigits
      });

      // Salvar dados do PIX no pedido
      await pool.query(
        `UPDATE pedidos SET
          mp_payment_id_mp = ?,
          gateway_pagamento = 'mercadopago',
          pix_status = 'WAITING',
          pix_codigo = ?,
          pix_qrcode = ?,
          pix_qr_base64 = ?
         WHERE id = ?`,
        [
          String(resultado.payment_id),
          resultado.qr_code || '',
          resultado.qr_code || '',
          resultado.qr_code_base64 || '',
          pedidoId
        ]
      );

      res.json({
        payment_id: resultado.payment_id,
        status: resultado.status,
        pix_codigo: resultado.qr_code || '',
        pix_qrcode: resultado.qr_code || '',
        qr_code_base64: resultado.qr_code_base64 || '',
        ticket_url: resultado.ticket_url || ''
      });
    } catch (erro) {
      logger.error('[MP] Erro ao criar PIX:', erro.message);
      res.status(500).json({ error: 'Não foi possível gerar o pagamento PIX. Tente novamente.' });
    }
  });

  // ============================================
  // CRIAR PAGAMENTO COM CARTÃO via Mercado Pago
  // ============================================
  router.post('/api/mercadopago/criar-cartao', autenticarToken, async (req, res) => {
    try {
      const { pedido_id, token, parcelas, tax_id, payment_method_id, issuer_id } = req.body || {};
      const pedidoId = Number(pedido_id);

      if (!Number.isFinite(pedidoId) || pedidoId <= 0) {
        return res.status(400).json({ error: 'Informe um pedido_id válido.' });
      }

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Token do cartão é obrigatório.' });
      }

      const parcelasNum = Number(parcelas) || 1;
      if (parcelasNum < 1 || parcelasNum > 12) {
        return res.status(400).json({ error: 'Número de parcelas deve ser entre 1 e 12.' });
      }

      const taxIdDigits = String(tax_id || '').replace(/\D/g, '');
      if (taxIdDigits.length !== 11 && taxIdDigits.length !== 14) {
        return res.status(400).json({ error: 'Informe um CPF ou CNPJ válido para o pagamento com cartão.' });
      }

      // Buscar pedido
      const [pedidos] = await pool.query(
        'SELECT id, usuario_id, total, status FROM pedidos WHERE id = ? LIMIT 1',
        [pedidoId]
      );

      if (!pedidos.length) {
        return res.status(404).json({ error: 'Pedido não encontrado.' });
      }

      const pedido = pedidos[0];

      if (Number(pedido.usuario_id) !== Number(req.usuario.id)) {
        return res.status(403).json({ error: 'Acesso negado a este pedido.' });
      }

      const podeProcessarCartao = ['pendente', 'pagamento_recusado'].includes(String(pedido.status || '').trim().toLowerCase());
      if (!podeProcessarCartao) {
        return res.status(400).json({ error: `Pedido já se encontra com status "${pedido.status}". Não é possível processar pagamento.` });
      }

      // Buscar dados do usuário
      const [usuarios] = await pool.query(
        'SELECT nome, email FROM usuarios WHERE id = ? LIMIT 1',
        [req.usuario.id]
      );
      const usuario = usuarios[0] || {};

      const resultado = await mercadoPagoService.criarPagamentoCartao({
        pedidoId,
        valor: Number(pedido.total),
        descricao: `Pedido #${pedidoId} - Mercado BomFilho`,
        token,
        parcelas: parcelasNum,
        email: usuario.email || 'cliente@bomfilho.com.br',
        nome: usuario.nome || 'Cliente',
        cpf: taxIdDigits,
        paymentMethodId: String(payment_method_id || '').trim(),
        issuerId: Number(issuer_id)
      });

      const statusInterno = mercadoPagoService.mapearStatusPagamento(resultado.status);

      // Atualizar pedido com resultado
      await pool.query(
        `UPDATE pedidos SET
          mp_payment_id_mp = ?,
          gateway_pagamento = 'mercadopago',
          pix_status = ?,
          status = ?
         WHERE id = ?`,
        [
          String(resultado.payment_id),
          String(resultado.status).toUpperCase(),
          statusInterno,
          pedidoId
        ]
      );

      res.json({
        payment_id: resultado.payment_id,
        status: resultado.status,
        status_detail: resultado.status_detail,
        status_interno: statusInterno
      });
    } catch (erro) {
      const status = Number(erro?.status || 500);
      const causas = extrairCausasMercadoPago(erro?.mpResponse || {});
      const mensagem =
        erro?.mpResponse?.message
        || erro?.mpResponse?.error
        || erro?.message
        || 'Não foi possível processar o pagamento com cartão.';
      const mensagemDetalhada = causas.length
        ? `${mensagem} (${causas.join(' | ')})`
        : mensagem;

      logger.error('[MP] Erro ao processar cartão:', {
        status,
        message: erro?.message,
        causes: causas,
        mpResponse: erro?.mpResponse || null
      });

      res.status(status).json({
        error: mensagemDetalhada,
        message: mensagemDetalhada,
        causes: causas,
        details: erro?.mpResponse || null
      });
    }
  });

  // ============================================
  // STATUS / Health Check
  // ============================================
  router.get('/api/mercadopago/status', (req, res) => {
    res.json({
      gateway: 'mercadopago',
      configurado: Boolean(MP_ACCESS_TOKEN),
      env: MP_ENV,
      notification_url_configurada: Boolean(MP_NOTIFICATION_URL),
      webhook_secret_configurado: Boolean(MP_WEBHOOK_SECRET)
    });
  });

  return router;
};
