'use strict';

const logger = require('../lib/logger');

function validarTokenWebhookPagBank({
  tokenHeader,
  tokenQuery,
  webhookToken,
  isProduction,
  compararTextoSegura
} = {}) {
  const headerNormalizado = String(tokenHeader || '').trim();
  const queryNormalizada = String(tokenQuery || '').trim();
  const webhookTokenNormalizado = String(webhookToken || '').trim();
  const compararSeguro = typeof compararTextoSegura === 'function'
    ? compararTextoSegura
    : (valorA, valorB) => String(valorA || '') === String(valorB || '');

  if (!webhookTokenNormalizado) {
    return !isProduction;
  }

  if (headerNormalizado && compararSeguro(headerNormalizado, webhookTokenNormalizado)) {
    return true;
  }

  // Compatibilidade: notification_url gerada pelo backend usa ?token=...
  if (queryNormalizada && compararSeguro(queryNormalizada, webhookTokenNormalizado)) {
    return true;
  }

  return false;
}

function mapearStatusPedido(statusPagBank) {
  if (statusPagBank === 'PAID') return 'pago';
  if (statusPagBank === 'WAITING' || statusPagBank === 'IN_ANALYSIS') return 'pendente';
  if (statusPagBank === 'DECLINED' || statusPagBank === 'CANCELED') return 'cancelado';
  return 'pendente';
}

function mapearStatusPorEventoPagBank(evento) {
  const eventoUpper = String(evento || '').trim().toUpperCase();

  if (!eventoUpper) {
    return '';
  }

  if (['CHARGE.PAID', 'ORDER.PAID', 'CHARGE.CAPTURED'].includes(eventoUpper)) {
    return 'PAID';
  }

  if (['CHARGE.DECLINED', 'ORDER.CANCELED', 'CHARGE.CANCELED', 'ORDER.DECLINED'].includes(eventoUpper)) {
    return 'DECLINED';
  }

  if (['CHARGE.IN_ANALYSIS', 'ORDER.IN_ANALYSIS'].includes(eventoUpper)) {
    return 'IN_ANALYSIS';
  }

  if (['ORDER.CREATED', 'CHARGE.CREATED', 'ORDER.WAITING', 'CHARGE.WAITING'].includes(eventoUpper)) {
    return 'WAITING';
  }

  return '';
}

function extrairStatusThreeDSPagBank(chargePrincipal = {}) {
  const candidatos = [
    chargePrincipal?.threeds?.status,
    chargePrincipal?.three_ds?.status,
    chargePrincipal?.authentication_method?.status,
    chargePrincipal?.payment_method?.authentication_method?.status,
    chargePrincipal?.payment_method?.card?.threeds?.status,
    chargePrincipal?.payment_method?.card?.three_ds?.status
  ];

  for (const candidato of candidatos) {
    const valor = String(candidato || '').trim().toUpperCase();
    if (valor) {
      return valor;
    }
  }

  return '';
}

function extrairStatusPagamentoPagBank(payload = {}, evento) {
  const charges = Array.isArray(payload?.charges) ? payload.charges : [];
  const chargePrincipal = charges[0] || null;
  const chargeStatus = String(chargePrincipal?.status || '').trim().toUpperCase();
  const chargeThreeDSStatus = extrairStatusThreeDSPagBank(chargePrincipal);
  const orderStatus = String(payload?.status || '').trim().toUpperCase();
  const eventStatus = mapearStatusPorEventoPagBank(evento);
  const statusResolvido = chargeStatus || eventStatus || orderStatus || 'WAITING';

  let fonteStatus = 'fallback';
  if (chargeStatus) {
    fonteStatus = 'charge';
  } else if (eventStatus) {
    fonteStatus = 'event';
  } else if (orderStatus) {
    fonteStatus = 'order';
  }

  return {
    statusResolvido,
    fonteStatus,
    orderStatus,
    chargeStatus,
    eventStatus,
    chargeThreeDSStatus,
    chargePrincipal,
    charges
  };
}

function extrairPedidoIdReferencePagBank(referenceId) {
  if (!referenceId || !String(referenceId).startsWith('pedido_')) {
    return null;
  }

  const parsedPedidoId = Number.parseInt(String(referenceId).replace('pedido_', ''), 10);
  return Number.isInteger(parsedPedidoId) ? parsedPedidoId : null;
}

function possuiStatusUtilWebhook({ charges, orderStatus, eventType } = {}) {
  const possuiChargeStatus = Array.isArray(charges)
    && charges.some((charge) => String(charge?.status || '').trim().length > 0);
  const possuiOrderStatus = String(orderStatus || '').trim().length > 0;
  const possuiEventStatus = String(mapearStatusPorEventoPagBank(eventType) || '').trim().length > 0;

  return {
    possuiChargeStatus,
    possuiOrderStatus,
    possuiEventStatus,
    suficiente: possuiChargeStatus || possuiOrderStatus || possuiEventStatus
  };
}

async function resolverDadosWebhookPagBank({
  notificacao,
  pagbankToken,
  isProduction,
  obterPedidoPagBank,
  eventType
} = {}) {
  if (!notificacao || !notificacao.id) {
    return {
      erroResposta: {
        status: 400,
        mensagem: 'Notificação inválida'
      }
    };
  }

  const orderId = String(notificacao.id).trim();
  let referenceId = notificacao.reference_id;
  let charges = Array.isArray(notificacao.charges) ? notificacao.charges : [];
  let orderStatus = String(notificacao?.status || '').trim().toUpperCase();
  let detalhesOrder = null;
  const consultaPagBank = {
    tentou: false,
    sucesso: false,
    erro: null
  };

  if (pagbankToken && typeof obterPedidoPagBank === 'function') {
    consultaPagBank.tentou = true;
    try {
      detalhesOrder = await obterPedidoPagBank(orderId);
      consultaPagBank.sucesso = Boolean(detalhesOrder);
    } catch (errConsulta) {
      consultaPagBank.erro = errConsulta?.message || 'Falha ao consultar pedido no PagBank';
      logger.error('Erro ao consultar pedido no PagBank', { erro: consultaPagBank.erro });
    }
  }

  if (detalhesOrder) {
    referenceId = detalhesOrder?.reference_id || referenceId;
    charges = Array.isArray(detalhesOrder?.charges) && detalhesOrder.charges.length
      ? detalhesOrder.charges
      : charges;
    orderStatus = String(detalhesOrder?.status || orderStatus || '').trim().toUpperCase();
  }

  const statusPayloadInfo = possuiStatusUtilWebhook({ charges, orderStatus, eventType });
  if (!statusPayloadInfo.suficiente) {
    const consultaFalhou = consultaPagBank.tentou && !consultaPagBank.sucesso;
    const statusErro = consultaFalhou && isProduction ? 502 : 422;

    return {
      erroResposta: {
        status: statusErro,
        mensagem: consultaFalhou
          ? 'Webhook recebido sem status útil e não foi possível enriquecer os dados no PagBank.'
          : 'Webhook recebido sem status útil para atualizar o pedido local.'
      },
      consultaPagBank
    };
  }

  return {
    erroResposta: null,
    orderId,
    referenceId,
    charges,
    orderStatus,
    detalhesOrder,
    consultaPagBank
  };
}

async function persistirAtualizacaoPedidoWebhookPagBank({
  pool,
  pedidoId,
  orderId,
  statusInterno,
  statusPagBank,
  chargeId,
  endpointLog,
  registrarLogPagBank
} = {}) {
  if (!pool || typeof pool.query !== 'function') {
    throw new Error('Pool de conexao nao informada para persistencia do webhook PagBank.');
  }

  const registrarLog = typeof registrarLogPagBank === 'function'
    ? registrarLogPagBank
    : () => {};

  const montarResultado = ({
    ok,
    persistido,
    parcial,
    modoPersistencia,
    lookup,
    linhasAfetadas,
    mensagem,
    httpStatus,
    retryable
  }) => ({
    ok: Boolean(ok),
    persistido: Boolean(persistido),
    parcial: Boolean(parcial),
    modoPersistencia: String(modoPersistencia || 'desconhecido'),
    lookup: String(lookup || 'desconhecido'),
    linhasAfetadas: Number(linhasAfetadas || 0),
    mensagem: String(mensagem || ''),
    httpStatus: Number(httpStatus || 500),
    retryable: Boolean(retryable)
  });

  if (pedidoId) {
    try {
      let resultadoUpdate = null;
      let modoPersistencia = 'completo';

      try {
        const [resultadoCompleto] = await pool.query(
          'UPDATE pedidos SET status = ?, pix_status = ?, pix_id = ?, pago_em = COALESCE(pago_em, IF(? = \'pago\', NOW(), pago_em)) WHERE id = ?',
          [statusInterno, statusPagBank, orderId, statusInterno, pedidoId]
        );
        resultadoUpdate = resultadoCompleto;
      } catch (erroUpdateCompleto) {
        const colunaAusente = /unknown column\s+'(?:pix_status|pix_id|pago_em)'/i.test(String(erroUpdateCompleto?.message || ''));
        if (!colunaAusente) {
          throw erroUpdateCompleto;
        }

        const [resultadoFallback] = await pool.query(
          'UPDATE pedidos SET status = ? WHERE id = ?',
          [statusInterno, pedidoId]
        );
        resultadoUpdate = resultadoFallback;
        modoPersistencia = 'fallback_sem_colunas_pix';
        logger.warn('Coluna pix_status/pix_id/pago_em ausente — persistindo webhook PagBank em modo fallback por status');
      }

      const linhasAfetadas = Number(resultadoUpdate?.affectedRows || 0);
      const persistido = linhasAfetadas > 0;
      const parcial = modoPersistencia !== 'completo';

      registrarLog({
        operacao: 'webhook.pagbank.persistencia',
        endpoint: endpointLog,
        method: 'POST',
        responsePayload: {
          pedido_id: pedidoId,
          order_id: orderId,
          charge_id: chargeId,
          persist_mode: modoPersistencia,
          status_interno: statusInterno,
          status_pagbank: statusPagBank,
          linhas_afetadas: linhasAfetadas,
          persistencia_ok: persistido,
          persistencia_parcial: parcial
        }
      });

      if (!persistido) {
        return montarResultado({
          ok: false,
          persistido: false,
          parcial,
          modoPersistencia,
          lookup: 'pedido_id',
          linhasAfetadas,
          mensagem: `Evento recebido, mas nenhum pedido foi atualizado para pedido_id=${pedidoId}.`,
          httpStatus: 503,
          retryable: true
        });
      }

      logger.info(`Pedido #${pedidoId} atualizado para status: ${statusInterno}`);
      return montarResultado({
        ok: true,
        persistido: true,
        parcial,
        modoPersistencia,
        lookup: 'pedido_id',
        linhasAfetadas,
        mensagem: parcial
          ? `Pedido #${pedidoId} atualizado apenas com status interno (modo fallback).`
          : `Pedido #${pedidoId} atualizado com status PagBank completo.`,
        httpStatus: parcial ? 202 : 200,
        retryable: false
      });
    } catch (err) {
      logger.error('Erro ao atualizar pedido', { pedidoId, orderId, erro: err.message });
      registrarLog({
        operacao: 'webhook.pagbank.persistencia.erro',
        endpoint: endpointLog,
        method: 'POST',
        responsePayload: {
          pedido_id: pedidoId,
          order_id: orderId,
          charge_id: chargeId,
          erro: err?.message || 'Erro ao atualizar pedido por pedido_id',
          status_interno: statusInterno,
          status_pagbank: statusPagBank
        }
      });

      return montarResultado({
        ok: false,
        persistido: false,
        parcial: false,
        modoPersistencia: 'erro',
        lookup: 'pedido_id',
        linhasAfetadas: 0,
        mensagem: err?.message || 'Erro ao atualizar pedido por pedido_id.',
        httpStatus: 500,
        retryable: true
      });
    }
  }

  try {
    let resultadoUpdate = null;
    let modoPersistencia = 'completo';

    try {
      const [resultadoCompleto] = await pool.query(
        'UPDATE pedidos SET status = ?, pix_status = ?, pago_em = COALESCE(pago_em, IF(? = \'pago\', NOW(), pago_em)) WHERE pix_id = ?',
        [statusInterno, statusPagBank, statusInterno, orderId]
      );
      resultadoUpdate = resultadoCompleto;
    } catch (erroUpdateCompleto) {
      const colunaAusente = /unknown column\s+'(?:pix_status|pix_id|pago_em)'/i.test(String(erroUpdateCompleto?.message || ''));
      if (!colunaAusente) {
        throw erroUpdateCompleto;
      }

      modoPersistencia = 'fallback_sem_colunas_pix_sem_lookup';
      logger.warn('Coluna pix_status/pix_id ausente e sem pedido_id no reference_id — persistência do webhook não aplicada');
      return montarResultado({
        ok: false,
        persistido: false,
        parcial: false,
        modoPersistencia,
        lookup: 'pix_id',
        linhasAfetadas: 0,
        mensagem: 'Colunas pix_id/pix_status ausentes e sem pedido_id no reference_id para fallback seguro.',
        httpStatus: 503,
        retryable: true
      });
    }

    const linhasAfetadas = Number(resultadoUpdate?.affectedRows || 0);
    const persistido = linhasAfetadas > 0;

    registrarLog({
      operacao: 'webhook.pagbank.persistencia',
      endpoint: endpointLog,
      method: 'POST',
      responsePayload: {
        pix_id: orderId,
        order_id: orderId,
        charge_id: chargeId,
        persist_mode: modoPersistencia,
        status_interno: statusInterno,
        status_pagbank: statusPagBank,
        linhas_afetadas: linhasAfetadas,
        persistencia_ok: persistido,
        persistencia_parcial: false
      }
    });

    if (!persistido) {
      return montarResultado({
        ok: false,
        persistido: false,
        parcial: false,
        modoPersistencia,
        lookup: 'pix_id',
        linhasAfetadas,
        mensagem: `Evento recebido, mas nenhum pedido foi atualizado para pix_id=${orderId}.`,
        httpStatus: 503,
        retryable: true
      });
    }

    logger.info(`Pedido com pix_id ${orderId} atualizado para status: ${statusInterno}`);
    return montarResultado({
      ok: true,
      persistido: true,
      parcial: false,
      modoPersistencia,
      lookup: 'pix_id',
      linhasAfetadas,
      mensagem: `Pedido com pix_id=${orderId} atualizado com sucesso.`,
      httpStatus: 200,
      retryable: false
    });
  } catch (err) {
    logger.error('Erro ao atualizar pedido por pix_id', { orderId, chargeId, erro: err.message });
    registrarLog({
      operacao: 'webhook.pagbank.persistencia.erro',
      endpoint: endpointLog,
      method: 'POST',
      responsePayload: {
        pix_id: orderId,
        order_id: orderId,
        charge_id: chargeId,
        erro: err?.message || 'Erro ao atualizar pedido por pix_id',
        status_interno: statusInterno,
        status_pagbank: statusPagBank
      }
    });

    return montarResultado({
      ok: false,
      persistido: false,
      parcial: false,
      modoPersistencia: 'erro',
      lookup: 'pix_id',
      linhasAfetadas: 0,
      mensagem: err?.message || 'Erro ao atualizar pedido por pix_id.',
      httpStatus: 500,
      retryable: true
    });
  }
}

module.exports = {
  extrairStatusPagamentoPagBank,
  extrairPedidoIdReferencePagBank,
  mapearStatusPedido,
  validarTokenWebhookPagBank,
  persistirAtualizacaoPedidoWebhookPagBank,
  resolverDadosWebhookPagBank
};
