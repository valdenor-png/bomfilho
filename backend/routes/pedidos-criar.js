'use strict';

const express = require('express');
const logger = require('../lib/logger');
const { criarErroHttp, toMoney } = require('../lib/helpers');
const { buildErrorPayload } = require('../lib/apiError');
const {
  RECAPTCHA_CHECKOUT_PROTECTION_ENABLED,
  TAXA_SERVICO_PERCENTUAL,
  DISTRIBUTED_IDEMPOTENCY_ENABLED
} = require('../lib/config');
const {
  FORMAS_PAGAMENTO_PEDIDO_VALIDAS,
  normalizarItensPedidoInput,
  normalizarFormaPagamentoPedido,
  normalizarTipoEntregaPedidoInput,
  normalizarEntregaPedidoInput,
  extrairTaxIdDigits,
  itensPedidoSaoValidos
} = require('../services/pedidoPagamentoHelpers');
const {
  normalizarIdempotencyKey,
  iniciarOperacaoDistribuida,
  concluirOperacaoDistribuida,
  falharOperacaoDistribuida
} = require('../services/distributedIdempotencyService');
const {
  getTableColumns,
  hasColumn,
  montarFingerprintCriacaoPedido
} = require('../services/pedidoCriacaoService');

/**
 * @param {object} deps
 * @param {Function} deps.autenticarToken
 * @param {Function} deps.validarRecaptcha
 * @param {Function} deps.calcularEntregaPorCep
 * @param {Function} deps.enviarWhatsappPedido
 * @param {Function} deps.normalizarCep
 * @param {object}   deps.pool
 */
module.exports = function createPedidoCriarRoute(deps) {
  const {
    autenticarToken,
    validarRecaptcha,
    calcularEntregaPorCep,
    enviarWhatsappPedido,
    normalizarCep,
    pool
  } = deps;

  const router = express.Router();

  router.post('/api/pedidos', autenticarToken, async (req, res) => {
    const requestId = String(req.requestId || '').trim() || null;
    const requestStart = Date.now();
    const chaveIdempotencia = normalizarIdempotencyKey(req.headers?.['x-idempotency-key']);
    const usarIdempotenciaDistribuida = DISTRIBUTED_IDEMPOTENCY_ENABLED && Boolean(chaveIdempotencia);
    const fingerprint = usarIdempotenciaDistribuida
      ? montarFingerprintCriacaoPedido(req.body || {})
      : '';
    let idempotenciaAdquirida = false;

    const connection = await pool.getConnection();
    let transacaoAberta = false;

    try {
      logger.info('checkout.pedido_criacao.iniciada', {
        request_id: requestId,
        usuario_id: req.usuario?.id,
        itens: Array.isArray(req.body?.itens) ? req.body.itens.length : 0,
        possui_cupom: Boolean(req.body?.cupom_id),
        tipo_entrega: req.body?.tipo_entrega || null,
        forma_pagamento: req.body?.forma_pagamento || null,
        idempotency_key_informada: Boolean(chaveIdempotencia)
      });

      if (usarIdempotenciaDistribuida) {
        const statusIdempotencia = await iniciarOperacaoDistribuida({
          pool,
          scope: 'pedido_criacao',
          idempotencyKey: chaveIdempotencia,
          userId: req.usuario.id,
          requestFingerprint: fingerprint,
          strictFingerprint: true,
          lockTtlSeconds: 35,
          operationTtlSeconds: 180
        });

        if (statusIdempotencia.state === 'replay' && statusIdempotencia.responsePayload) {
          return res.status(Number(statusIdempotencia.httpStatus || 201)).json(statusIdempotencia.responsePayload);
        }

        if (statusIdempotencia.state === 'in_progress') {
          return res.status(409).json(buildErrorPayload('Seu pedido já está sendo processado. Aguarde alguns segundos e atualize a tela.'));
        }

        if (statusIdempotencia.state === 'fingerprint_mismatch') {
          return res.status(409).json(buildErrorPayload('A chave de idempotência enviada não corresponde a esta solicitação.'));
        }

        idempotenciaAdquirida = statusIdempotencia.state === 'acquired';
      }

      if (RECAPTCHA_CHECKOUT_PROTECTION_ENABLED) {
        await validarRecaptcha({
          token: req.body?.recaptcha_token,
          req,
          action: 'checkout_pedido'
        });
      }

      const { itens, forma_pagamento, cupom_id, entrega, tipo_entrega } = req.body || {};
      let usuarioPedido = null;
      const pedidosColumns = await getTableColumns(connection, 'pedidos');
      const usuariosColumns = await getTableColumns(connection, 'usuarios');

      const itensNormalizados = normalizarItensPedidoInput(itens);
      if (itensNormalizados.length === 0) {
        throw criarErroHttp(400, 'Seu carrinho está vazio.');
      }

      if (itensNormalizados.length > 100) {
        throw criarErroHttp(400, 'Este pedido excede a quantidade máxima de itens permitida.');
      }

      const formaPagamento = normalizarFormaPagamentoPedido(forma_pagamento);
      if (!FORMAS_PAGAMENTO_PEDIDO_VALIDAS.has(formaPagamento)) {
        throw criarErroHttp(400, 'Forma de pagamento inválida para este pedido.');
      }

      const tipoEntrega = normalizarTipoEntregaPedidoInput(tipo_entrega);

      const taxIdDigits = extrairTaxIdDigits(req.body);

      // Validações de documento fiscal (necessário para pagamento futuro)
      const usaPagamentoOnline = ['pix', 'cartao', 'credito', 'debito'].includes(formaPagamento);
      if (usaPagamentoOnline && ![11, 14].includes(taxIdDigits.length)) {
        throw criarErroHttp(400, 'Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para pagamentos online.');
      }

      if (!itensPedidoSaoValidos(itensNormalizados)) {
        throw criarErroHttp(400, 'Há itens inválidos no carrinho.');
      }

      for (const item of itensNormalizados) {
        if (!Number.isInteger(item.produto_id) || item.produto_id <= 0) {
          throw criarErroHttp(400, 'Produto inválido no carrinho.');
        }
        if (!Number.isInteger(item.quantidade) || item.quantidade <= 0 || item.quantidade > 999) {
          throw criarErroHttp(400, 'Quantidade inválida no carrinho.');
        }
      }

      const idsProdutos = [...new Set(itensNormalizados.map((item) => item.produto_id))];
      const placeholdersProdutos = idsProdutos.map(() => '?').join(', ');
      let itensCalculados = [];
      let total = 0;

      let freteEntrega = 0;
      let entregaNormalizada = null;
      let estimateIdEntrega = null;

      if (tipoEntrega === 'entrega') {
        const entregaInput = normalizarEntregaPedidoInput(entrega, normalizarCep);
        if (!entregaInput) {
          throw criarErroHttp(400, 'Informe os dados de entrega para continuar.');
        }

        const veiculoEntrega = entregaInput.veiculo;
        const cepDestinoEntrega = entregaInput.cepDestino;
        const numeroDestinoEntrega = entregaInput.numeroDestino;

        if (cepDestinoEntrega.length !== 8) {
          throw criarErroHttp(400, 'Informe um CEP de entrega válido.');
        }

        const entregaCalculada = await calcularEntregaPorCep({
          cepDestino: cepDestinoEntrega,
          veiculo: veiculoEntrega,
          numeroDestino: numeroDestinoEntrega
        });

        freteEntrega = Number(entregaCalculada.frete || 0);
        estimateIdEntrega = String(entregaInput.estimate_id || entregaInput.estimateId || '').trim() || null;
        entregaNormalizada = {
          veiculo: entregaCalculada.veiculo,
          distancia_km: entregaCalculada.distancia_km,
          distancia_cobrada_km: entregaCalculada.distancia_cobrada_km,
          metodo_distancia: entregaCalculada.metodo_distancia,
          cep_origem: entregaCalculada.cep_origem,
          numero_origem: entregaCalculada.numero_origem,
          cep_destino: entregaCalculada.cep_destino,
          numero_destino: entregaCalculada.numero_destino
        };
      }

      const selectWhatsappOptIn = hasColumn(usuariosColumns, 'whatsapp_opt_in')
        ? 'whatsapp_opt_in'
        : '1 AS whatsapp_opt_in';
      const [usuarioPedidoRows] = await connection.query(
        `SELECT nome, email, telefone, ${selectWhatsappOptIn} FROM usuarios WHERE id = ? LIMIT 1`,
        [req.usuario.id]
      );
      usuarioPedido = usuarioPedidoRows.length ? usuarioPedidoRows[0] : null;

      if (!usuarioPedido) {
        throw criarErroHttp(404, 'Não encontramos a conta do usuário para este pedido.');
      }

      await connection.beginTransaction();
      transacaoAberta = true;

      const [produtos] = await connection.query(
        `SELECT id, nome, preco, estoque
         FROM produtos
         WHERE ativo = TRUE AND id IN (${placeholdersProdutos})
         FOR UPDATE`,
        idsProdutos
      );

      if (produtos.length !== idsProdutos.length) {
        throw criarErroHttp(400, 'Um ou mais produtos do carrinho estão indisponíveis.');
      }

      const produtosPorId = new Map(produtos.map((produto) => [Number(produto.id), produto]));
      itensCalculados = itensNormalizados.map((item) => {
        const produto = produtosPorId.get(item.produto_id);
        const precoUnitario = Number(produto.preco || 0);
        const estoqueDisponivel = Math.max(0, Number(produto.estoque || 0));

        if (item.quantidade > estoqueDisponivel) {
          throw criarErroHttp(409, `Estoque insuficiente para ${produto.nome}. Disponível: ${estoqueDisponivel}.`);
        }

        const subtotal = toMoney(precoUnitario * item.quantidade);

        return {
          produto_id: item.produto_id,
          nome: produto.nome,
          preco: precoUnitario,
          quantidade: item.quantidade,
          subtotal
        };
      });

      total = toMoney(itensCalculados.reduce((acumulado, item) => acumulado + item.subtotal, 0));
      if (!Number.isFinite(total) || total <= 0) {
        throw criarErroHttp(400, 'Não foi possível calcular o total do pedido.');
      }

      let descontoAplicado = 0;
      let cupomIdValidado = null;

      if (cupom_id !== undefined && cupom_id !== null && String(cupom_id).trim() !== '') {
        const cupomIdNumerico = Number(cupom_id);
        if (!Number.isInteger(cupomIdNumerico) || cupomIdNumerico <= 0) {
          throw criarErroHttp(400, 'Cupom inválido.');
        }

        const [cupons] = await connection.query(
          `SELECT id, tipo, valor, valor_minimo, uso_atual, uso_maximo
           FROM cupons
           WHERE id = ?
           AND ativo = TRUE
           AND (validade IS NULL OR validade >= CURRENT_DATE)
           AND (uso_maximo IS NULL OR uso_atual < uso_maximo)
           FOR UPDATE
           LIMIT 1`,
          [cupomIdNumerico]
        );

        if (cupons.length === 0) {
          throw criarErroHttp(400, 'Cupom inválido ou expirado.');
        }

        const cupom = cupons[0];
        const valorMinimo = Number(cupom.valor_minimo || 0);
        if (total < valorMinimo) {
          throw criarErroHttp(400, `Valor mínimo do pedido para este cupom: R$ ${valorMinimo.toFixed(2)}`);
        }

        const [usados] = await connection.query(
          'SELECT id FROM cupons_usados WHERE cupom_id = ? AND usuario_id = ? LIMIT 1',
          [cupom.id, req.usuario.id]
        );

        if (usados.length > 0) {
          throw criarErroHttp(400, 'Este cupom já foi utilizado nesta conta.');
        }

        if (cupom.tipo === 'percentual') {
          descontoAplicado = toMoney(total * (Number(cupom.valor || 0) / 100));
        } else {
          descontoAplicado = toMoney(Number(cupom.valor || 0));
        }

        if (descontoAplicado > total) {
          descontoAplicado = total;
        }
        cupomIdValidado = cupom.id;
      }

      const totalProdutos = toMoney(total - descontoAplicado);
      const taxaServico = toMoney(totalProdutos * (TAXA_SERVICO_PERCENTUAL / 100));
      const totalFinal = toMoney(totalProdutos + freteEntrega + taxaServico);

      if (!Number.isFinite(totalProdutos) || totalProdutos <= 0) {
        throw criarErroHttp(400, 'O valor dos produtos deve ser maior que zero após desconto.');
      }

      if (!Number.isFinite(totalFinal) || totalFinal <= 0) {
        throw criarErroHttp(400, 'O total do pedido deve ser maior que zero.');
      }

      const colunasObrigatoriasPedido = ['usuario_id', 'total', 'status', 'forma_pagamento', 'tipo_entrega'];
      const colunasAusentes = colunasObrigatoriasPedido.filter((coluna) => !hasColumn(pedidosColumns, coluna));
      if (colunasAusentes.length) {
        logger.error('Tabela pedidos sem colunas obrigatórias para criação.', { colunasAusentes });
        throw criarErroHttp(500, 'Estrutura de pedidos inválida no banco. Contate o suporte.');
      }

      // Criar pedido — entra como "aguardando_revisao" para que a equipe confira disponibilidade
      const insertColumns = [];
      const insertValuesSql = [];
      const insertParams = [];

      const appendInsertValue = (columnName, value) => {
        insertColumns.push(columnName);
        insertValuesSql.push('?');
        insertParams.push(value);
      };

      const appendInsertNow = (columnName) => {
        insertColumns.push(columnName);
        insertValuesSql.push('NOW()');
      };

      appendInsertValue('usuario_id', req.usuario.id);
      appendInsertValue('total', totalFinal);
      appendInsertValue('status', 'aguardando_revisao');
      appendInsertValue('forma_pagamento', formaPagamento);
      appendInsertValue('tipo_entrega', tipoEntrega);

      if (hasColumn(pedidosColumns, 'taxa_servico')) {
        appendInsertValue('taxa_servico', taxaServico);
      }

      if (hasColumn(pedidosColumns, 'frete_cobrado_cliente')) {
        appendInsertValue('frete_cobrado_cliente', freteEntrega);
      }

      if (hasColumn(pedidosColumns, 'uber_estimate_id')) {
        appendInsertValue('uber_estimate_id', estimateIdEntrega);
      }

      if (hasColumn(pedidosColumns, 'margem_pedido')) {
        appendInsertValue('margem_pedido', freteEntrega);
      }

      if (hasColumn(pedidosColumns, 'revisao_em')) {
        appendInsertNow('revisao_em');
      }

      const [pedidoResultado] = await connection.query(
        `INSERT INTO pedidos (${insertColumns.join(', ')}) VALUES (${insertValuesSql.join(', ')})`,
        insertParams
      );

      const pedidoId = pedidoResultado.insertId;

      // Batch insert de itens do pedido
      if (itensCalculados.length > 0) {
        const valuesPlaceholders = itensCalculados.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const valuesParams = itensCalculados.flatMap((item) => [
          pedidoId, item.produto_id, item.nome, item.preco, item.quantidade, item.subtotal
        ]);
        await connection.query(
          `INSERT INTO pedido_itens (pedido_id, produto_id, nome_produto, preco, quantidade, subtotal) VALUES ${valuesPlaceholders}`,
          valuesParams
        );
      }

      // Atualizar estoque
      for (const item of itensCalculados) {
        const [resultadoEstoque] = await connection.query(
          'UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND estoque >= ?',
          [item.quantidade, item.produto_id, item.quantidade]
        );

        if (!Number(resultadoEstoque?.affectedRows || 0)) {
          throw criarErroHttp(409, `Não foi possível reservar estoque para ${item.nome}.`);
        }
      }

      // Registrar uso do cupom
      if (cupomIdValidado) {
        await connection.query(
          'UPDATE cupons SET uso_atual = uso_atual + 1 WHERE id = ?',
          [cupomIdValidado]
        );

        await connection.query(
          'INSERT INTO cupons_usados (cupom_id, usuario_id, pedido_id) VALUES (?, ?, ?)',
          [cupomIdValidado, req.usuario.id, pedidoId]
        );
      }

      await connection.commit();
      transacaoAberta = false;

      // Notificar equipe que há novo pedido para revisão
      if (usuarioPedido && usuarioPedido.whatsapp_opt_in) {
        try {
          await enviarWhatsappPedido({
            telefone: usuarioPedido.telefone,
            nome: usuarioPedido.nome,
            pedidoId: pedidoId,
            total: totalFinal,
            pixCodigo: null,
            mensagemExtra: '📋 Seu pedido foi recebido e está aguardando revisão da equipe. Você será notificado quando for aprovado para pagamento.'
          });
        } catch (erro) {
          logger.error('Falha ao disparar WhatsApp do pedido:', erro.message);
        }
      }

      const respostaSucesso = {
        mensagem: 'Pedido recebido! Aguarde a revisão da equipe para prosseguir com o pagamento.',
        pedido_id: pedidoId,
        status: 'aguardando_revisao',
        tipo_entrega: tipoEntrega,
        total: totalFinal,
        total_produtos: totalProdutos,
        taxa_servico: taxaServico,
        frete_entrega: freteEntrega,
        estimate_id_entrega: estimateIdEntrega,
        veiculo_entrega: entregaNormalizada?.veiculo || null,
        distancia_entrega_km: entregaNormalizada?.distancia_km || null,
        cep_origem_entrega: entregaNormalizada?.cep_origem || null,
        numero_origem_entrega: entregaNormalizada?.numero_origem || null,
        cep_destino_entrega: entregaNormalizada?.cep_destino || null,
        endereco_entrega: tipoEntrega === 'retirada'
          ? null
          : {
            cep: entregaNormalizada?.cep_destino || null,
            numero: entregaNormalizada?.numero_destino || null
          },
        desconto_aplicado: descontoAplicado,
        forma_pagamento: formaPagamento
      };

      if (usarIdempotenciaDistribuida && idempotenciaAdquirida) {
        await concluirOperacaoDistribuida({
          pool,
          scope: 'pedido_criacao',
          idempotencyKey: chaveIdempotencia,
          userId: req.usuario.id,
          pedidoId,
          httpStatus: 201,
          responsePayload: respostaSucesso,
          successTtlSeconds: 300
        });
      }

      logger.info('checkout.pedido_criacao.concluida', {
        request_id: requestId,
        usuario_id: req.usuario?.id,
        pedido_id: pedidoId,
        status: 'aguardando_revisao',
        total: totalFinal,
        duration_ms: Date.now() - requestStart
      });

      res.status(201).json(respostaSucesso);
    } catch (erro) {
      if (usarIdempotenciaDistribuida && idempotenciaAdquirida) {
        await falharOperacaoDistribuida({
          pool,
          scope: 'pedido_criacao',
          idempotencyKey: chaveIdempotencia,
          userId: req.usuario.id,
          httpStatus: Number(erro?.httpStatus || 500),
          errorMessage: erro?.message || 'erro_pedido',
          failureTtlSeconds: 90
        });
      }
      if (transacaoAberta) {
        await connection.rollback();
      }

      if (erro?.httpStatus) {
        logger.warn('checkout.pedido_criacao.falha_negocio', {
          request_id: requestId,
          usuario_id: req.usuario?.id,
          status: erro.httpStatus,
          erro: erro.message,
          duration_ms: Date.now() - requestStart
        });
        return res.status(erro.httpStatus).json(buildErrorPayload(erro.message));
      }

      logger.error('checkout.pedido_criacao.falha_interna', {
        request_id: requestId,
        usuario_id: req.usuario?.id,
        erro: erro?.message || 'erro_interno',
        duration_ms: Date.now() - requestStart
      });
      res.status(500).json(buildErrorPayload('Não foi possível finalizar seu pedido. Tente novamente.'));
    } finally {
      connection.release();
    }
  });

  return router;
};
