'use strict';

const express = require('express');
const logger = require('../lib/logger');
const { criarErroHttp, toMoney } = require('../lib/helpers');
const { buildErrorPayload } = require('../lib/apiError');
const {
  RECAPTCHA_CHECKOUT_PROTECTION_ENABLED,
  TAXA_SERVICO_PERCENTUAL,
  DISTRIBUTED_IDEMPOTENCY_ENABLED,
  IS_PRODUCTION,
  DB_DIALECT
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
const {
  resolveUnidadeVenda,
  resolveConfiguracaoPeso,
  resolveVisibilidadePublica,
  isProdutoAlcoolico,
  normalizarPesoSelecionadoParaPedido,
  formatarPesoSelecionado
} = require('../lib/produtoCatalogoRules');

const LOG_PARAM_MAX_LENGTH = 200;
const ESCALA_PRECO_CACHE_TTL_MS = 5 * 60 * 1000;
let escalaPrecoCheckoutCache = 1;
let escalaPrecoCheckoutCacheExpiraEm = 0;

function truncateForLog(value) {
  const text = String(value || '');
  if (text.length <= LOG_PARAM_MAX_LENGTH) {
    return text;
  }
  return `${text.slice(0, LOG_PARAM_MAX_LENGTH)}...`;
}

function sanitizeValueForLog(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return truncateForLog(value);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 30).map((entry) => sanitizeValueForLog(entry));
  }

  if (typeof value === 'object') {
    const output = {};
    Object.entries(value).forEach(([key, entryValue]) => {
      output[key] = sanitizeValueForLog(entryValue);
    });
    return output;
  }

  return truncateForLog(value);
}

function sanitizeParamsForLog(params = []) {
  if (!Array.isArray(params)) {
    return [];
  }

  return params.map((param) => sanitizeValueForLog(param));
}

async function obterEscalaPrecoCheckout(connection) {
  const agora = Date.now();
  if (agora < escalaPrecoCheckoutCacheExpiraEm) {
    return escalaPrecoCheckoutCache;
  }

  try {
    const [statsRows] = await connection.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN preco >= 100 THEN 1 ELSE 0 END) AS ge_100,
         SUM(CASE WHEN ABS(preco - ROUND(preco)) <= 0.0001 THEN 1 ELSE 0 END) AS inteiros,
         AVG(preco) AS avg_preco
       FROM produtos
       WHERE ativo = TRUE`
    );
    const stats = Array.isArray(statsRows) && statsRows.length ? statsRows[0] : null;
    const total = Number(stats?.total || 0);
    const ge100 = Number(stats?.ge_100 || 0);
    const inteiros = Number(stats?.inteiros || 0);
    const avgPreco = Number(stats?.avg_preco || 0);
    const ratioGe100 = total > 0 ? (ge100 / total) : 0;
    const ratioInteiros = total > 0 ? (inteiros / total) : 0;
    const datasetComCaraDeCentavos = (
      total >= 100
      && avgPreco >= 200
      && ratioGe100 >= 0.9
      && ratioInteiros >= 0.95
    );

    escalaPrecoCheckoutCache = datasetComCaraDeCentavos ? 100 : 1;
  } catch (error) {
    logger.warn('Falha ao detectar escala de preco na criacao de pedido. Mantendo escala padrao.', {
      code: error?.code,
      message: error?.message
    });
    escalaPrecoCheckoutCache = 1;
  } finally {
    escalaPrecoCheckoutCacheExpiraEm = agora + ESCALA_PRECO_CACHE_TTL_MS;
  }

  return escalaPrecoCheckoutCache;
}

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
    let etapa = 'IN';
    let connection = null;
    let transacaoAberta = false;

    try {
      logger.info('[PEDIDOS][IN]', {
        request_id: requestId,
        method: req.method,
        path: req.originalUrl || req.url
      });
      logger.info('[PEDIDOS][AUTH]', {
        request_id: requestId,
        usuario_id: req.usuario?.id || null,
        autenticado: Boolean(req.usuario?.id)
      });
      logger.info('[PEDIDOS][BODY]', {
        request_id: requestId,
        body: sanitizeValueForLog(req.body || {}),
        body_json: truncateForLog(JSON.stringify(req.body || {}, null, 2))
      });

      etapa = 'CONEXAO_DB';
      connection = await pool.getConnection();

      logger.info('checkout.pedido_criacao.iniciada', {
        request_id: requestId,
        usuario_id: req.usuario?.id,
        itens: Array.isArray(req.body?.itens) ? req.body.itens.length : 0,
        possui_cupom: Boolean(req.body?.cupom_id),
        tipo_entrega: req.body?.tipo_entrega || null,
        forma_pagamento: req.body?.forma_pagamento || null,
        idempotency_key_informada: Boolean(chaveIdempotencia)
      });

      etapa = 'IDEMPOTENCIA';
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

      etapa = 'RECAPTCHA';
      if (RECAPTCHA_CHECKOUT_PROTECTION_ENABLED) {
        await validarRecaptcha({
          token: req.body?.recaptcha_token,
          req,
          action: 'checkout_pedido'
        });
      }

      etapa = 'LEITURA_BODY';
      const { itens, forma_pagamento, cupom_id, entrega, tipo_entrega } = req.body || {};
      let usuarioPedido = null;
      etapa = 'CARREGAR_SCHEMA';
      const pedidosColumns = await getTableColumns(connection, 'pedidos');
      const usuariosColumns = await getTableColumns(connection, 'usuarios');
      const produtosColumns = await getTableColumns(connection, 'produtos');
      const pedidoItensColumns = await getTableColumns(connection, 'pedido_itens');

      etapa = 'VALIDACAO_ITENS';
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
      logger.info('[PEDIDOS][VALIDACAO]', {
        request_id: requestId,
        itens_recebidos: Array.isArray(itens) ? itens.length : 0,
        itens_normalizados: itensNormalizados.length,
        forma_pagamento: formaPagamento,
        tipo_entrega: tipoEntrega,
        tax_id_digits: taxIdDigits.length,
        cupom_informado: Boolean(cupom_id)
      });

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
        if (!Number.isFinite(Number(item.quantidade || 0)) || Number(item.quantidade || 0) <= 0) {
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

      etapa = 'REGRAS_ENTREGA';
      logger.info('[PEDIDOS][REGRAS_ENTREGA]', {
        request_id: requestId,
        tipo_entrega: tipoEntrega,
        valida_endereco: tipoEntrega === 'entrega'
      });
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
      logger.info('[PEDIDOS][REGRAS_ENTREGA]', {
        request_id: requestId,
        tipo_entrega: tipoEntrega,
        frete_entrega: freteEntrega,
        estimate_id_entrega: estimateIdEntrega
      });

      etapa = 'CARREGAR_USUARIO';
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

      etapa = 'TRANSACAO_INICIO';
      await connection.beginTransaction();
      transacaoAberta = true;

      etapa = 'BLOQUEAR_PRODUTOS';
      const camposProdutoSelect = ['id', 'nome', 'preco', 'estoque', 'categoria', 'unidade'];
      if (hasColumn(produtosColumns, 'departamento')) {
        camposProdutoSelect.push('departamento');
      }
      if (hasColumn(produtosColumns, 'produto_controlado')) {
        camposProdutoSelect.push('produto_controlado');
      }
      if (hasColumn(produtosColumns, 'unidade_venda')) {
        camposProdutoSelect.push('unidade_venda');
      }
      if (hasColumn(produtosColumns, 'tipo_venda')) {
        camposProdutoSelect.push('tipo_venda');
      }
      if (hasColumn(produtosColumns, 'vendido_por_peso')) {
        camposProdutoSelect.push('vendido_por_peso');
      }
      if (hasColumn(produtosColumns, 'categoria_operacional')) {
        camposProdutoSelect.push('categoria_operacional');
      }
      if (hasColumn(produtosColumns, 'peso_min_gramas')) {
        camposProdutoSelect.push('peso_min_gramas');
      }
      if (hasColumn(produtosColumns, 'peso_step_gramas')) {
        camposProdutoSelect.push('peso_step_gramas');
      }
      if (hasColumn(produtosColumns, 'peso_padrao_gramas')) {
        camposProdutoSelect.push('peso_padrao_gramas');
      }
      if (hasColumn(produtosColumns, 'permite_fracionado')) {
        camposProdutoSelect.push('permite_fracionado');
      }
      if (hasColumn(produtosColumns, 'requer_maioridade')) {
        camposProdutoSelect.push('requer_maioridade');
      }
      if (hasColumn(produtosColumns, 'visivel_no_site')) {
        camposProdutoSelect.push('visivel_no_site');
      }
      if (hasColumn(produtosColumns, 'oculto_catalogo')) {
        camposProdutoSelect.push('oculto_catalogo');
      }

      const [produtos] = await connection.query(
        `SELECT ${camposProdutoSelect.join(', ')}
         FROM produtos
         WHERE ativo = TRUE AND id IN (${placeholdersProdutos})
         FOR UPDATE`,
        idsProdutos
      );

      if (produtos.length !== idsProdutos.length) {
        throw criarErroHttp(400, 'Um ou mais produtos do carrinho estão indisponíveis.');
      }

      const escalaPrecoProdutos = await obterEscalaPrecoCheckout(connection);
      const produtosPorId = new Map(produtos.map((produto) => [Number(produto.id), produto]));
      itensCalculados = itensNormalizados.map((item) => {
        const produto = produtosPorId.get(item.produto_id);
        const visibilidadeProduto = resolveVisibilidadePublica(produto);
        if (!visibilidadeProduto.visivel_publico) {
          throw criarErroHttp(400, `O item ${produto.nome} está indisponível para venda online.`);
        }

        const precoUnitario = toMoney(Number(produto.preco || 0) / Number(escalaPrecoProdutos || 1));
        const estoqueDisponivel = Math.max(0, Number(produto.estoque || 0));
        const unidadeVenda = resolveUnidadeVenda(produto);
        const quantidadeInformada = Math.max(1, Math.floor(Number(item.quantidade || 1)));

        if (unidadeVenda === 'peso') {
          const configuracaoPeso = resolveConfiguracaoPeso(produto, unidadeVenda);
          const pesoNormalizado = normalizarPesoSelecionadoParaPedido(item.peso_gramas, configuracaoPeso);
          if (!pesoNormalizado.ok) {
            if (pesoNormalizado.motivo === 'peso_step') {
              throw criarErroHttp(
                400,
                `Peso inválido para ${produto.nome}. Use incrementos de ${configuracaoPeso.peso_step_gramas}g.`
              );
            }

            throw criarErroHttp(
              400,
              `Peso inválido para ${produto.nome}. Peso mínimo: ${configuracaoPeso.peso_min_gramas}g.`
            );
          }

          if (estoqueDisponivel <= 0) {
            throw criarErroHttp(409, `Estoque insuficiente para ${produto.nome}.`);
          }

          const pesoSelecionado = Number(pesoNormalizado.peso_gramas || 0);
          const subtotalUnitario = toMoney(precoUnitario * (pesoSelecionado / 1000));
          const subtotal = toMoney(subtotalUnitario * quantidadeInformada);
          const nomeComPeso = `${produto.nome} - ${formatarPesoSelecionado(pesoSelecionado)}`;

          return {
            produto_id: item.produto_id,
            nome: nomeComPeso,
            nome_base: produto.nome,
            preco: precoUnitario,
            quantidade: quantidadeInformada,
            unidade_venda: unidadeVenda,
            peso_gramas: pesoSelecionado,
            preco_por_kg: precoUnitario,
            requer_maioridade: isProdutoAlcoolico(produto),
            descontar_estoque_unidades: false,
            subtotal
          };
        }

        if (quantidadeInformada > estoqueDisponivel) {
          throw criarErroHttp(409, `Estoque insuficiente para ${produto.nome}. Disponível: ${estoqueDisponivel}.`);
        }

        const subtotal = toMoney(precoUnitario * quantidadeInformada);

        return {
          produto_id: item.produto_id,
          nome: produto.nome,
          nome_base: produto.nome,
          preco: precoUnitario,
          quantidade: quantidadeInformada,
          unidade_venda: unidadeVenda,
          peso_gramas: null,
          preco_por_kg: null,
          requer_maioridade: isProdutoAlcoolico(produto),
          descontar_estoque_unidades: true,
          subtotal
        };
      });
      total = toMoney(itensCalculados.reduce((acumulado, item) => acumulado + item.subtotal, 0));
      if (!Number.isFinite(total) || total <= 0) {
        throw criarErroHttp(400, 'Não foi possível calcular o total do pedido.');
      }

      let descontoAplicado = 0;
      let cupomIdValidado = null;

      etapa = 'VALIDACAO_CUPOM';
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
      etapa = 'TOTALIZACAO';
      logger.info('[PEDIDOS][TOTALIZACAO]', {
        request_id: requestId,
        escala_preco_produtos: escalaPrecoProdutos,
        subtotal_itens: total,
        desconto_aplicado: descontoAplicado,
        total_produtos: totalProdutos,
        taxa_servico: taxaServico,
        frete_entrega: freteEntrega,
        total_final: totalFinal
      });

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

      etapa = 'SQL_PEDIDO';
      const insertPedidoSqlBase = `INSERT INTO pedidos (${insertColumns.join(', ')}) VALUES (${insertValuesSql.join(', ')})`;
      const insertPedidoSql = DB_DIALECT === 'postgres'
        ? `${insertPedidoSqlBase} RETURNING id`
        : insertPedidoSqlBase;
      logger.info('[PEDIDOS][SQL_PEDIDO]', {
        request_id: requestId,
        sql: insertPedidoSql,
        params: sanitizeParamsForLog(insertParams)
      });
      const [pedidoResultadoRows] = await connection.query(
        insertPedidoSql,
        insertParams
      );

      let pedidoId = 0;
      if (DB_DIALECT === 'postgres') {
        pedidoId = Number(pedidoResultadoRows?.[0]?.id || 0);
      } else {
        pedidoId = Number(pedidoResultadoRows?.insertId || 0);
      }

      if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
        throw criarErroHttp(500, 'Falha ao obter o identificador do pedido gerado.');
      }

      // Batch insert de itens do pedido
      if (itensCalculados.length > 0) {
        etapa = 'SQL_ITENS';
        const colunasItens = ['pedido_id', 'produto_id', 'nome_produto', 'preco', 'quantidade', 'subtotal'];
        if (hasColumn(pedidoItensColumns, 'unidade_venda')) {
          colunasItens.push('unidade_venda');
        }
        if (hasColumn(pedidoItensColumns, 'peso_gramas')) {
          colunasItens.push('peso_gramas');
        }
        if (hasColumn(pedidoItensColumns, 'preco_por_kg')) {
          colunasItens.push('preco_por_kg');
        }

        const valuesPlaceholders = itensCalculados.map(() => `(${colunasItens.map(() => '?').join(', ')})`).join(', ');
        const valuesParams = itensCalculados.flatMap((item) => {
          const paramsBase = [pedidoId, item.produto_id, item.nome, item.preco, item.quantidade, item.subtotal];
          if (hasColumn(pedidoItensColumns, 'unidade_venda')) {
            paramsBase.push(item.unidade_venda || 'unidade');
          }
          if (hasColumn(pedidoItensColumns, 'peso_gramas')) {
            paramsBase.push(item.peso_gramas || null);
          }
          if (hasColumn(pedidoItensColumns, 'preco_por_kg')) {
            paramsBase.push(item.preco_por_kg || null);
          }
          return paramsBase;
        });
        const insertItensSql = `INSERT INTO pedido_itens (${colunasItens.join(', ')}) VALUES ${valuesPlaceholders}`;
        logger.info('[PEDIDOS][SQL_ITENS]', {
          request_id: requestId,
          total_itens: itensCalculados.length,
          sql: insertItensSql,
          params: sanitizeParamsForLog(valuesParams)
        });
        await connection.query(
          insertItensSql,
          valuesParams
        );
      }

      // Atualizar estoque
      etapa = 'ATUALIZAR_ESTOQUE';
      for (const item of itensCalculados) {
        if (!item.descontar_estoque_unidades) {
          continue;
        }

        const updateEstoqueSql = DB_DIALECT === 'postgres'
          ? 'UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND estoque >= ? RETURNING id'
          : 'UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND estoque >= ?';
        const [resultadoEstoque] = await connection.query(
          updateEstoqueSql,
          [item.quantidade, item.produto_id, item.quantidade]
        );

        const estoqueAtualizado = DB_DIALECT === 'postgres'
          ? Array.isArray(resultadoEstoque) && resultadoEstoque.length > 0
          : Number(resultadoEstoque?.affectedRows || 0) > 0;
        if (!estoqueAtualizado) {
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
      etapa = 'PIX';
      logger.info('[PEDIDOS][PIX]', {
        request_id: requestId,
        forma_pagamento: formaPagamento,
        fluxo: 'deferred_after_review',
        mensagem: 'Pedido aguardando revisão; criação de cobrança PIX ocorre em etapa posterior.'
      });

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
      logger.info('[PEDIDOS][OUT]', {
        request_id: requestId,
        pedido_id: pedidoId,
        status: 'aguardando_revisao',
        tipo_entrega: tipoEntrega,
        forma_pagamento: formaPagamento,
        total: totalFinal,
        duration_ms: Date.now() - requestStart
      });

      res.status(201).json(respostaSucesso);
    } catch (erro) {
      if (usarIdempotenciaDistribuida && idempotenciaAdquirida) {
        try {
          await falharOperacaoDistribuida({
            pool,
            scope: 'pedido_criacao',
            idempotencyKey: chaveIdempotencia,
            userId: req.usuario.id,
            httpStatus: Number(erro?.httpStatus || 500),
            errorMessage: erro?.message || 'erro_pedido',
            failureTtlSeconds: 90
          });
        } catch (erroIdempotencia) {
          logger.error('[PEDIDOS][ERRO]', {
            request_id: requestId,
            etapa: `${etapa}:FALHA_IDEMPOTENCIA`,
            message: erroIdempotencia?.message || 'falha_idempotencia',
            stack: String(erroIdempotencia?.stack || ''),
            code: erroIdempotencia?.code || null,
            errno: erroIdempotencia?.errno || null,
            sqlMessage: erroIdempotencia?.sqlMessage || null,
            sqlState: erroIdempotencia?.sqlState || null
          });
        }
      }
      if (transacaoAberta && connection) {
        try {
          await connection.rollback();
        } catch (erroRollback) {
          logger.error('[PEDIDOS][ERRO]', {
            request_id: requestId,
            etapa: `${etapa}:ROLLBACK`,
            message: erroRollback?.message || 'falha_rollback',
            stack: String(erroRollback?.stack || ''),
            code: erroRollback?.code || null,
            errno: erroRollback?.errno || null,
            sqlMessage: erroRollback?.sqlMessage || null,
            sqlState: erroRollback?.sqlState || null
          });
        }
      }

      if (erro?.httpStatus) {
        logger.warn('[PEDIDOS][ERRO]', {
          request_id: requestId,
          etapa,
          message: erro?.message || 'erro_negocio',
          stack: String(erro?.stack || ''),
          code: erro?.code || null,
          errno: erro?.errno || null,
          sqlMessage: erro?.sqlMessage || null,
          sqlState: erro?.sqlState || null,
          status: Number(erro?.httpStatus || 400)
        });
        logger.warn('checkout.pedido_criacao.falha_negocio', {
          request_id: requestId,
          usuario_id: req.usuario?.id,
          status: erro.httpStatus,
          erro: erro.message,
          duration_ms: Date.now() - requestStart
        });
        return res.status(erro.httpStatus).json(buildErrorPayload(erro.message));
      }

      logger.error('[PEDIDOS][ERRO]', {
        request_id: requestId,
        etapa,
        message: erro?.message || 'erro_interno',
        stack: String(erro?.stack || ''),
        code: erro?.code || null,
        errno: erro?.errno || null,
        sqlMessage: erro?.sqlMessage || null,
        sqlState: erro?.sqlState || null
      });
      logger.error('checkout.pedido_criacao.falha_interna', {
        request_id: requestId,
        usuario_id: req.usuario?.id,
        erro: erro?.message || 'erro_interno',
        duration_ms: Date.now() - requestStart
      });
      const payloadErro = IS_PRODUCTION
        ? buildErrorPayload('Não foi possível finalizar seu pedido. Tente novamente.')
        : buildErrorPayload('Não foi possível finalizar seu pedido. Tente novamente.', {
          detalhe: erro?.message || 'erro_interno',
          etapa
        });
      res.status(500).json(payloadErro);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  });

  return router;
};


