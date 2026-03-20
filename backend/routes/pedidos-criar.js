'use strict';

const express = require('express');
const logger = require('../lib/logger');
const { criarErroHttp, toMoney } = require('../lib/helpers');
const {
  PAGBANK_TOKEN,
  PAGBANK_ENV,
  ALLOW_PIX_MOCK,
  RECAPTCHA_CHECKOUT_PROTECTION_ENABLED,
  TAXA_SERVICO_PERCENTUAL
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

/**
 * @param {object} deps
 * @param {Function} deps.autenticarToken
 * @param {Function} deps.validarRecaptcha
 * @param {Function} deps.calcularEntregaPorCep
 * @param {Function} deps.criarPagamentoPix
 * @param {Function} deps.enviarWhatsappPedido
 * @param {Function} deps.normalizarCep
 * @param {object}   deps.pool
 */
module.exports = function createPedidoCriarRoute(deps) {
  const {
    autenticarToken,
    validarRecaptcha,
    calcularEntregaPorCep,
    criarPagamentoPix,
    enviarWhatsappPedido,
    normalizarCep,
    pool
  } = deps;

  const router = express.Router();

  router.post('/api/pedidos', autenticarToken, async (req, res) => {
    const connection = await pool.getConnection();
    let transacaoAberta = false;

    try {
      if (RECAPTCHA_CHECKOUT_PROTECTION_ENABLED) {
        await validarRecaptcha({
          token: req.body?.recaptcha_token,
          req,
          action: 'checkout_pedido'
        });
      }

      const { itens, forma_pagamento, cupom_id, entrega, tipo_entrega } = req.body || {};
      let usuarioPedido = null;

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
      const pagbankProducao = PAGBANK_ENV === 'production';
      const usaPagbank = ['pix', 'cartao', 'credito', 'debito'].includes(formaPagamento);
      const pixMockPermitido = !pagbankProducao && ALLOW_PIX_MOCK;

      if (usaPagbank && pagbankProducao && !PAGBANK_TOKEN) {
        throw criarErroHttp(503, 'Esta forma de pagamento está temporariamente indisponível.');
      }

      if (formaPagamento === 'pix' && !PAGBANK_TOKEN && !pixMockPermitido) {
        throw criarErroHttp(503, 'O pagamento via PIX está temporariamente indisponível.');
      }

      if (usaPagbank && pagbankProducao && ![11, 14].includes(taxIdDigits.length)) {
        throw criarErroHttp(400, 'Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para pagamentos via PagBank.');
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

      const [usuarioPedidoRows] = await connection.query(
        'SELECT nome, email, telefone, whatsapp_opt_in FROM usuarios WHERE id = ? LIMIT 1',
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
          `SELECT * FROM cupons 
           WHERE id = ?
           AND ativo = TRUE
           AND (validade IS NULL OR validade >= CURDATE())
           AND (uso_maximo IS NULL OR uso_atual < uso_maximo)
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

      // Criar pedido
      const [pedidoResultado] = await connection.query(
        'INSERT INTO pedidos (usuario_id, total, status, forma_pagamento, tipo_entrega, taxa_servico) VALUES (?, ?, ?, ?, ?, ?)',
        [req.usuario.id, totalFinal, 'pendente', formaPagamento, tipoEntrega, taxaServico]
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

      // Gerar PIX real usando PagBank se for pagamento via PIX
      let pixCodigo = null;
      let pixQrCode = null;
      let pixId = null;
      let pixErro = null;
      const podeUsarPixMock = !pagbankProducao && ALLOW_PIX_MOCK;

      if (formaPagamento === 'pix' && PAGBANK_TOKEN) {
        try {
          const resultadoPix = await criarPagamentoPix({
            pedidoId: pedidoId,
            total: totalFinal,
            descricao: `Pedido #${pedidoId} - Bom Filho Supermercado`,
            email: usuarioPedido?.email || req.usuario?.email || 'cliente@example.com',
            nome: usuarioPedido?.nome || 'Cliente',
            taxId: taxIdDigits
          });

          if (resultadoPix && resultadoPix.qr_codes && resultadoPix.qr_codes.length > 0) {
            pixCodigo = resultadoPix.qr_codes[0].text;
            pixQrCode = resultadoPix.qr_codes[0].links?.[0]?.href;
            pixId = resultadoPix.id;

            try {
              await pool.query(
                'UPDATE pedidos SET pix_id = ?, pix_codigo = ?, pix_qrcode = ?, pix_status = ? WHERE id = ?',
                [pixId, pixCodigo, pixQrCode, 'WAITING', pedidoId]
              );
            } catch (errUpdate) {
              logger.warn('⚠️ Falha ao salvar dados PIX no pedido:', errUpdate.message);
            }
          }
        } catch (erro) {
          logger.error('Erro ao gerar PIX PagBank:', erro.message);
          pixErro = erro.message;

          if (podeUsarPixMock) {
            pixCodigo = '00020126580014BR.GOV.BCB.PIX' + pedidoId.toString().padStart(10, '0');
          }
        }
      } else if (formaPagamento === 'pix' && podeUsarPixMock) {
        pixCodigo = '00020126580014BR.GOV.BCB.PIX' + pedidoId.toString().padStart(10, '0');
      }

      if (usuarioPedido && usuarioPedido.whatsapp_opt_in) {
        try {
          await enviarWhatsappPedido({
            telefone: usuarioPedido.telefone,
            nome: usuarioPedido.nome,
            pedidoId: pedidoId,
            total: totalFinal,
            pixCodigo: pixCodigo
          });
        } catch (erro) {
          logger.error('Falha ao disparar WhatsApp do pedido:', erro.message);
        }
      }

      res.status(201).json({
        mensagem: 'Pedido confirmado com sucesso.',
        pedido_id: pedidoId,
        tipo_entrega: tipoEntrega,
        total: totalFinal,
        total_produtos: totalProdutos,
        taxa_servico: taxaServico,
        frete_entrega: freteEntrega,
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
        forma_pagamento: formaPagamento,
        pix_codigo: pixCodigo,
        pix_qrcode: pixQrCode,
        pix_id: pixId,
        pix_erro: pixErro
      });
    } catch (erro) {
      if (transacaoAberta) {
        await connection.rollback();
      }

      if (erro?.httpStatus) {
        return res.status(erro.httpStatus).json({ erro: erro.message });
      }

      logger.error('Erro ao criar pedido:', erro);
      res.status(500).json({ erro: 'Não foi possível finalizar seu pedido. Tente novamente.' });
    } finally {
      connection.release();
    }
  });

  return router;
};
