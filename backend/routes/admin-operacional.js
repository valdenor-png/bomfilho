'use strict';

const express = require('express');
const logger = require('../lib/logger');
const { parsePositiveInt, montarPaginacao } = require('../lib/helpers');

// Mapeamento status → coluna de timestamp (métricas operacionais)
const STATUS_TIMESTAMP_COLUNA = Object.freeze({
  pago: 'pago_em',
  preparando: 'em_preparo_em',
  pronto_para_retirada: 'pronto_em',
  enviado: 'saiu_entrega_em',
  entregue: 'entregue_em',
  retirado: 'retirado_em',
  cancelado: 'cancelado_em'
});

// Calcula métricas de tempo operacional a partir dos timestamps do pedido
function calcularMetricasTempoOperacional(pedido) {
  if (!pedido || typeof pedido !== 'object') return {};

  const ts = (campo) => {
    const val = pedido[campo];
    if (!val) return null;
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  };

  const base = ts('pago_em') || ts('criado_em');
  const prontoMs = ts('pronto_em');
  const saiuMs = ts('saiu_entrega_em');
  const entregueMs = ts('entregue_em');
  const retiradoMs = ts('retirado_em');
  const canceladoMs = ts('cancelado_em');

  const diff = (a, b) => (a && b && a > b ? a - b : null);

  const metricas = {};
  metricas.tempo_ate_preparo_ms = diff(prontoMs, base);

  // Entrega
  metricas.tempo_aguardando_coleta_ms = diff(saiuMs, prontoMs);
  metricas.tempo_de_rota_ms = diff(entregueMs, saiuMs);
  metricas.tempo_total_entrega_ms = diff(entregueMs, base);

  // Retirada
  metricas.tempo_espera_retirada_ms = diff(retiradoMs, prontoMs);
  metricas.tempo_total_retirada_ms = diff(retiradoMs, base);

  // Cancelamento
  metricas.tempo_ate_cancelamento_ms = diff(canceladoMs, base);

  return metricas;
}

function calcularPeriodoDashboard(periodo, inicioCustom, fimCustom) {
  const agora = new Date();
  const hojeFim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
  const hojeInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

  let inicio, fim;

  switch (periodo) {
    case 'ontem': {
      const ontem = new Date(hojeInicio);
      ontem.setDate(ontem.getDate() - 1);
      inicio = ontem;
      fim = new Date(hojeInicio.getTime() - 1);
      break;
    }
    case '7d': {
      const d = new Date(hojeInicio);
      d.setDate(d.getDate() - 6);
      inicio = d;
      fim = hojeFim;
      break;
    }
    case '30d': {
      const d = new Date(hojeInicio);
      d.setDate(d.getDate() - 29);
      inicio = d;
      fim = hojeFim;
      break;
    }
    case 'mes': {
      inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
      fim = hojeFim;
      break;
    }
    case 'custom': {
      if (inicioCustom) {
        inicio = new Date(inicioCustom + 'T00:00:00');
      } else {
        inicio = hojeInicio;
      }
      if (fimCustom) {
        fim = new Date(fimCustom + 'T23:59:59.999');
      } else {
        fim = hojeFim;
      }
      break;
    }
    default: // hoje
      inicio = hojeInicio;
      fim = hojeFim;
  }
  // Período anterior de mesma duração
  const duracao = fim.getTime() - inicio.getTime();
  const anteriorFim = new Date(inicio.getTime() - 1);
  const anteriorInicio = new Date(anteriorFim.getTime() - duracao);

  return { inicio, fim, anteriorInicio, anteriorFim };
}

module.exports = function createAdminOperacionalRoutes({ exigirAcessoLocalAdmin, autenticarAdminToken, pool, enviarWhatsappPedido, registrarAuditoria }) {
  const router = express.Router();

  // ============================================
  // Listar todos os pedidos (admin)
  // ============================================
  router.get('/api/admin/pedidos', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const usarPaginacao = ['page', 'pagina', 'limit', 'limite']
        .some((chave) => req.query?.[chave] !== undefined);
      const limite = parsePositiveInt(req.query?.limit || req.query?.limite, 200, { min: 1, max: 500 });
      const paginaSolicitada = parsePositiveInt(req.query?.page || req.query?.pagina, 1, { min: 1, max: 500000 });

      let pedidosBase = [];
      let paginacao = null;

      if (usarPaginacao) {
        const [[countRow]] = await pool.query('SELECT COUNT(*) AS total FROM pedidos');
        const total = Number(countRow?.total || 0);
        paginacao = montarPaginacao(total, paginaSolicitada, limite);
        const offset = (paginacao.pagina - 1) * paginacao.limite;

        [pedidosBase] = await pool.query(
          `SELECT
            p.*,
            u.nome AS cliente_nome,
            u.email AS cliente_email,
            u.telefone AS cliente_telefone
           FROM pedidos p
           LEFT JOIN usuarios u ON p.usuario_id = u.id
           ORDER BY p.criado_em DESC
           LIMIT ? OFFSET ?`,
          [paginacao.limite, offset]
        );
      } else {
        [pedidosBase] = await pool.query(`
          SELECT
            p.*,
            u.nome AS cliente_nome,
            u.email AS cliente_email,
            u.telefone AS cliente_telefone
          FROM pedidos p
          LEFT JOIN usuarios u ON p.usuario_id = u.id
          ORDER BY p.criado_em DESC
        `);
      }

      if (pedidosBase.length === 0) {
        if (paginacao) {
          return res.json({ pedidos: [], paginacao });
        }
        return res.json({ pedidos: [] });
      }

      const pedidoIds = pedidosBase
        .map((pedido) => Number(pedido.id))
        .filter((id) => Number.isInteger(id) && id > 0);
      const usuariosIds = [...new Set(
        pedidosBase
          .map((pedido) => Number(pedido.usuario_id))
          .filter((id) => Number.isInteger(id) && id > 0)
      )];

      const itensPorPedido = new Map();
      if (pedidoIds.length > 0) {
        const placeholdersPedidos = pedidoIds.map(() => '?').join(', ');
        const [itensRows] = await pool.query(
          `SELECT * FROM pedido_itens WHERE pedido_id IN (${placeholdersPedidos}) ORDER BY pedido_id, id`,
          pedidoIds
        );

        for (const item of itensRows) {
          const pedidoId = Number(item.pedido_id);
          const atual = itensPorPedido.get(pedidoId) || [];
          atual.push(item);
          itensPorPedido.set(pedidoId, atual);
        }
      }

      const enderecosPorUsuario = new Map();
      if (usuariosIds.length > 0) {
        const placeholdersUsuarios = usuariosIds.map(() => '?').join(', ');
        const [enderecosRows] = await pool.query(
          `SELECT * FROM enderecos WHERE usuario_id IN (${placeholdersUsuarios}) ORDER BY usuario_id, atualizado_em DESC`,
          usuariosIds
        );

        for (const endereco of enderecosRows) {
          const usuarioId = Number(endereco.usuario_id);
          if (!enderecosPorUsuario.has(usuarioId)) {
            enderecosPorUsuario.set(usuarioId, endereco);
          }
        }
      }

      const pedidos = pedidosBase.map((pedido) => {
        const pedidoId = Number(pedido.id);
        const usuarioId = Number(pedido.usuario_id);
        const tipoEntrega = String(pedido?.tipo_entrega || '').trim().toLowerCase() === 'retirada'
          ? 'retirada'
          : 'entrega';
        return {
          ...pedido,
          tipo_entrega: tipoEntrega,
          itens: itensPorPedido.get(pedidoId) || [],
          endereco: tipoEntrega === 'retirada'
            ? null
            : (enderecosPorUsuario.get(usuarioId) || null),
          ...calcularMetricasTempoOperacional(pedido)
        };
      });

      if (paginacao) {
        return res.json({ pedidos, paginacao });
      }

      return res.json({ pedidos });
    } catch (erro) {
      logger.error('Erro ao buscar pedidos (admin):', erro);
      res.status(500).json({ erro: 'Não foi possível carregar os pedidos no painel.' });
    }
  });

  // ============================================
  // DASHBOARD EXECUTIVO — Agregações server-side
  // ============================================
  router.get('/api/admin/dashboard/resumo', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const periodo = String(req.query.periodo || 'hoje').trim();
      const canal = String(req.query.canal || 'todos').trim();
      const pagamento = String(req.query.pagamento || 'todos').trim();
      const inicioCustom = req.query.inicio || null;
      const fimCustom = req.query.fim || null;

      const { inicio, fim, anteriorInicio, anteriorFim } = calcularPeriodoDashboard(periodo, inicioCustom, fimCustom);

      // Build dynamic WHERE clause
      const filtrosExtra = [];
      const paramsExtra = [];
      if (canal !== 'todos') {
        filtrosExtra.push('p.tipo_entrega = ?');
        paramsExtra.push(canal);
      }
      if (pagamento !== 'todos') {
        filtrosExtra.push('p.forma_pagamento = ?');
        paramsExtra.push(pagamento);
      }
      const filtroStr = filtrosExtra.length > 0 ? ' AND ' + filtrosExtra.join(' AND ') : '';

      const paramsPeriodo = [inicio, fim, ...paramsExtra];
      const paramsAnterior = [anteriorInicio, anteriorFim, ...paramsExtra];

      // 1. KPIs do período atual
      const [[kpisRow]] = await pool.query(
        `SELECT
          COUNT(*) AS total_pedidos,
          SUM(CASE WHEN p.status NOT IN ('cancelado','pendente') THEN 1 ELSE 0 END) AS pedidos_pagos,
          SUM(CASE WHEN p.status IN ('entregue','retirado') THEN 1 ELSE 0 END) AS pedidos_concluidos,
          SUM(CASE WHEN p.status = 'cancelado' THEN 1 ELSE 0 END) AS pedidos_cancelados,
          SUM(CASE WHEN p.status = 'pendente' THEN 1 ELSE 0 END) AS pedidos_pendentes,
          COALESCE(SUM(CASE WHEN p.status NOT IN ('cancelado') THEN p.total ELSE 0 END), 0) AS faturamento_bruto,
          AVG(CASE WHEN p.status NOT IN ('cancelado') THEN p.total ELSE NULL END) AS ticket_medio
         FROM pedidos p
         WHERE p.criado_em BETWEEN ? AND ?${filtroStr}`,
        paramsPeriodo
      );

      // 2. KPIs do período anterior (comparativo)
      const [[kpisAnteriorRow]] = await pool.query(
        `SELECT
          COUNT(*) AS total_pedidos,
          COALESCE(SUM(CASE WHEN p.status NOT IN ('cancelado') THEN p.total ELSE 0 END), 0) AS faturamento_bruto
         FROM pedidos p
         WHERE p.criado_em BETWEEN ? AND ?${filtroStr}`,
        paramsAnterior
      );

      // 3. Por forma de pagamento
      const [porPagamento] = await pool.query(
        `SELECT p.forma_pagamento AS forma, COUNT(*) AS quantidade,
          COALESCE(SUM(p.total), 0) AS total_valor
         FROM pedidos p
         WHERE p.status NOT IN ('cancelado') AND p.criado_em BETWEEN ? AND ?${filtroStr}
         GROUP BY p.forma_pagamento ORDER BY total_valor DESC`,
        paramsPeriodo
      );

      // 4. Por canal
      const [porCanal] = await pool.query(
        `SELECT p.tipo_entrega AS canal, COUNT(*) AS quantidade,
          COALESCE(SUM(p.total), 0) AS total_valor
         FROM pedidos p
         WHERE p.status NOT IN ('cancelado') AND p.criado_em BETWEEN ? AND ?${filtroStr}
         GROUP BY p.tipo_entrega ORDER BY total_valor DESC`,
        paramsPeriodo
      );

      // 5. Por status
      const [porStatus] = await pool.query(
        `SELECT p.status, COUNT(*) AS quantidade
         FROM pedidos p
         WHERE p.criado_em BETWEEN ? AND ?${filtroStr}
         GROUP BY p.status ORDER BY quantidade DESC`,
        paramsPeriodo
      );

      // 6. Vendas por hora
      const [vendasPorHora] = await pool.query(
        `SELECT HOUR(p.criado_em) AS hora, COUNT(*) AS quantidade,
          COALESCE(SUM(CASE WHEN p.status != 'cancelado' THEN p.total ELSE 0 END), 0) AS total_valor
         FROM pedidos p
         WHERE p.criado_em BETWEEN ? AND ?${filtroStr}
         GROUP BY HOUR(p.criado_em) ORDER BY hora`,
        paramsPeriodo
      );

      // 7. Vendas por dia
      const [vendasPorDia] = await pool.query(
        `SELECT DATE(p.criado_em) AS dia, COUNT(*) AS quantidade,
          COALESCE(SUM(CASE WHEN p.status != 'cancelado' THEN p.total ELSE 0 END), 0) AS total_valor
         FROM pedidos p
         WHERE p.criado_em BETWEEN ? AND ?${filtroStr}
         GROUP BY DATE(p.criado_em) ORDER BY dia`,
        paramsPeriodo
      );

      // 8. Top 10 produtos
      const [topProdutos] = await pool.query(
        `SELECT pi.nome_produto AS nome, SUM(pi.quantidade) AS qtd_vendida,
          COALESCE(SUM(pi.subtotal), 0) AS faturamento
         FROM pedido_itens pi
         JOIN pedidos p ON pi.pedido_id = p.id
         WHERE p.status NOT IN ('cancelado') AND p.criado_em BETWEEN ? AND ?${filtroStr}
         GROUP BY pi.nome_produto ORDER BY faturamento DESC LIMIT 10`,
        paramsPeriodo
      );

      // 9. Top categorias
      const [topCategorias] = await pool.query(
        `SELECT pr.categoria, SUM(pi.quantidade) AS qtd_vendida,
          COALESCE(SUM(pi.subtotal), 0) AS faturamento
         FROM pedido_itens pi
         JOIN pedidos p ON pi.pedido_id = p.id
         JOIN produtos pr ON pi.produto_id = pr.id
         WHERE p.status NOT IN ('cancelado') AND p.criado_em BETWEEN ? AND ?${filtroStr}
         GROUP BY pr.categoria ORDER BY faturamento DESC LIMIT 10`,
        paramsPeriodo
      );

      // 10. Top bairros (from enderecos)
      let topBairros = [];
      try {
        const [bairrosRows] = await pool.query(
          `SELECT e.bairro, COUNT(*) AS quantidade,
            COALESCE(SUM(p.total), 0) AS total_valor
           FROM pedidos p
           JOIN enderecos e ON e.usuario_id = p.usuario_id
           WHERE p.status NOT IN ('cancelado') AND p.tipo_entrega = 'entrega'
             AND p.criado_em BETWEEN ? AND ?${filtroStr}
           GROUP BY e.bairro ORDER BY quantidade DESC LIMIT 8`,
          paramsPeriodo
        );
        topBairros = bairrosRows;
      } catch (_) { /* enderecos can be empty */ }

      // 11. Métricas SLA (timestamp columns can be absent)
      let sla = { tempo_medio_preparo_ms: null, tempo_medio_rota_ms: null, tempo_medio_total_ms: null, taxa_entrega_prazo: null };
      try {
        const [[slaRow]] = await pool.query(
          `SELECT
            AVG(CASE WHEN p.pronto_em IS NOT NULL AND COALESCE(p.pago_em, p.criado_em) IS NOT NULL
              THEN TIMESTAMPDIFF(SECOND, COALESCE(p.pago_em, p.criado_em), p.pronto_em) * 1000 ELSE NULL END) AS tempo_medio_preparo_ms,
            AVG(CASE WHEN p.entregue_em IS NOT NULL AND p.saiu_entrega_em IS NOT NULL
              THEN TIMESTAMPDIFF(SECOND, p.saiu_entrega_em, p.entregue_em) * 1000 ELSE NULL END) AS tempo_medio_rota_ms,
            AVG(CASE
              WHEN p.tipo_entrega = 'retirada' AND p.retirado_em IS NOT NULL
                THEN TIMESTAMPDIFF(SECOND, COALESCE(p.pago_em, p.criado_em), p.retirado_em) * 1000
              WHEN p.tipo_entrega != 'retirada' AND p.entregue_em IS NOT NULL
                THEN TIMESTAMPDIFF(SECOND, COALESCE(p.pago_em, p.criado_em), p.entregue_em) * 1000
              ELSE NULL END) AS tempo_medio_total_ms,
            SUM(CASE WHEN p.tipo_entrega != 'retirada' AND p.entregue_em IS NOT NULL
              AND TIMESTAMPDIFF(MINUTE, COALESCE(p.pago_em, p.criado_em), p.entregue_em) <= 45 THEN 1 ELSE 0 END) AS entregas_no_prazo,
            SUM(CASE WHEN p.tipo_entrega != 'retirada' AND p.entregue_em IS NOT NULL THEN 1 ELSE 0 END) AS total_entregas_concluidas
           FROM pedidos p
           WHERE p.status NOT IN ('cancelado','pendente') AND p.criado_em BETWEEN ? AND ?${filtroStr}`,
          paramsPeriodo
        );
        if (slaRow) {
          sla.tempo_medio_preparo_ms = slaRow.tempo_medio_preparo_ms != null ? Math.round(Number(slaRow.tempo_medio_preparo_ms)) : null;
          sla.tempo_medio_rota_ms = slaRow.tempo_medio_rota_ms != null ? Math.round(Number(slaRow.tempo_medio_rota_ms)) : null;
          sla.tempo_medio_total_ms = slaRow.tempo_medio_total_ms != null ? Math.round(Number(slaRow.tempo_medio_total_ms)) : null;
          const prazo = Number(slaRow.entregas_no_prazo || 0);
          const totalE = Number(slaRow.total_entregas_concluidas || 0);
          sla.taxa_entrega_prazo = totalE > 0 ? Math.round((prazo / totalE) * 10000) / 100 : null;
        }
      } catch (_) { /* timestamp columns may not exist */ }

      // 12. Alertas (real-time operational status)
      let alertas = [];
      try {
        // Pedidos fora do SLA (em andamento agora)
        const [[foraSlaNow]] = await pool.query(
          `SELECT COUNT(*) AS qtd FROM pedidos
           WHERE status IN ('preparando','pronto_para_retirada','enviado')
             AND TIMESTAMPDIFF(MINUTE, COALESCE(pago_em, criado_em), NOW()) > 45`
        );
        if (Number(foraSlaNow?.qtd || 0) > 0) {
          alertas.push({ tipo: 'perigo', titulo: `${foraSlaNow.qtd} pedido(s) acima do SLA agora`, descricao: 'Pedidos ativos com tempo total superior a 45 minutos.' });
        }

        // Prontos aguardando saída
        const [[aguardSaida]] = await pool.query(
          `SELECT COUNT(*) AS qtd FROM pedidos
           WHERE status IN ('pronto_para_retirada','preparando')
             AND pronto_em IS NOT NULL AND tipo_entrega = 'entrega'`
        );
        if (Number(aguardSaida?.qtd || 0) > 0) {
          alertas.push({ tipo: 'atencao', titulo: `${aguardSaida.qtd} pedido(s) pronto(s) aguardando saída`, descricao: 'Aguardando entregador para coleta.' });
        }

        // Em rota acima do esperado
        const [[rotaLonga]] = await pool.query(
          `SELECT COUNT(*) AS qtd FROM pedidos
           WHERE status = 'enviado'
             AND saiu_entrega_em IS NOT NULL
             AND TIMESTAMPDIFF(MINUTE, saiu_entrega_em, NOW()) > 25`
        );
        if (Number(rotaLonga?.qtd || 0) > 0) {
          alertas.push({ tipo: 'perigo', titulo: `${rotaLonga.qtd} entrega(s) em rota longa`, descricao: 'Entregas em rota há mais de 25 minutos.' });
        }
      } catch (_) { /* fallback if columns don't exist */ }

      // Alerta: aumento de cancelamento
      const cancelAtual = Number(kpisRow?.pedidos_cancelados || 0);
      const totalAtual = Number(kpisRow?.total_pedidos || 0);
      const taxaCancelAtual = totalAtual > 0 ? cancelAtual / totalAtual : 0;
      if (taxaCancelAtual > 0.15 && cancelAtual >= 3) {
        alertas.push({ tipo: 'perigo', titulo: `Taxa de cancelamento alta: ${(taxaCancelAtual * 100).toFixed(1)}%`, descricao: `${cancelAtual} cancelamentos no período.` });
      }

      // Alerta: queda de faturamento
      const fatAtual = Number(kpisRow?.faturamento_bruto || 0);
      const fatAnterior = Number(kpisAnteriorRow?.faturamento_bruto || 0);
      if (fatAnterior > 0 && fatAtual < fatAnterior * 0.7) {
        const queda = Math.round((1 - fatAtual / fatAnterior) * 100);
        alertas.push({ tipo: 'atencao', titulo: `Faturamento caiu ${queda}% vs período anterior`, descricao: `R$ ${fatAtual.toFixed(2)} atual vs R$ ${fatAnterior.toFixed(2)} anterior.` });
      }

      // 13. Produtos muito vendidos sem imagem
      try {
        const [prodsSemImg] = await pool.query(
          `SELECT pi.nome_produto, SUM(pi.quantidade) AS qtd
           FROM pedido_itens pi
           JOIN pedidos p ON pi.pedido_id = p.id
           JOIN produtos pr ON pi.produto_id = pr.id
           WHERE p.status NOT IN ('cancelado') AND p.criado_em BETWEEN ? AND ?
             AND (pr.imagem_url IS NULL OR pr.imagem_url = '')
           GROUP BY pi.nome_produto, pi.produto_id
           ORDER BY qtd DESC LIMIT 5`,
          [inicio, fim]
        );
        if (prodsSemImg.length > 0) {
          alertas.push({ tipo: 'atencao', titulo: `${prodsSemImg.length} produto(s) vendido(s) sem imagem`, descricao: prodsSemImg.map(p => p.nome_produto).slice(0, 3).join(', ') });
        }
      } catch (_) { /* imagem_url column may not exist */ }

      // Build response
      const kpis = {
        faturamento_bruto: Number(kpisRow?.faturamento_bruto || 0),
        pedidos_pagos: Number(kpisRow?.pedidos_pagos || 0),
        pedidos_concluidos: Number(kpisRow?.pedidos_concluidos || 0),
        pedidos_cancelados: Number(kpisRow?.pedidos_cancelados || 0),
        pedidos_pendentes: Number(kpisRow?.pedidos_pendentes || 0),
        ticket_medio: kpisRow?.ticket_medio != null ? Number(Number(kpisRow.ticket_medio).toFixed(2)) : 0,
        taxa_cancelamento: totalAtual > 0 ? Math.round((cancelAtual / totalAtual) * 10000) / 100 : 0,
        total_pedidos: Number(kpisRow?.total_pedidos || 0),
        ...sla
      };

      const comparativo = {
        faturamento_anterior: Number(kpisAnteriorRow?.faturamento_bruto || 0),
        pedidos_anterior: Number(kpisAnteriorRow?.total_pedidos || 0),
        variacao_faturamento: fatAnterior > 0 ? Math.round(((fatAtual - fatAnterior) / fatAnterior) * 10000) / 100 : null,
        variacao_pedidos: Number(kpisAnteriorRow?.total_pedidos || 0) > 0
          ? Math.round(((totalAtual - Number(kpisAnteriorRow.total_pedidos)) / Number(kpisAnteriorRow.total_pedidos)) * 10000) / 100
          : null
      };

      res.json({
        periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
        kpis,
        comparativo,
        por_forma_pagamento: porPagamento.map(r => ({ forma: r.forma || 'outros', quantidade: Number(r.quantidade), total: Number(r.total_valor) })),
        por_canal: porCanal.map(r => ({ canal: r.canal || 'entrega', quantidade: Number(r.quantidade), total: Number(r.total_valor) })),
        por_status: porStatus.map(r => ({ status: r.status, quantidade: Number(r.quantidade) })),
        vendas_por_hora: vendasPorHora.map(r => ({ hora: Number(r.hora), quantidade: Number(r.quantidade), total: Number(r.total_valor) })),
        vendas_por_dia: vendasPorDia.map(r => ({ dia: r.dia, quantidade: Number(r.quantidade), total: Number(r.total_valor) })),
        top_produtos: topProdutos.map(r => ({ nome: r.nome, quantidade: Number(r.qtd_vendida), faturamento: Number(r.faturamento) })),
        top_categorias: topCategorias.map(r => ({ categoria: r.categoria || 'Sem categoria', quantidade: Number(r.qtd_vendida), faturamento: Number(r.faturamento) })),
        top_bairros: topBairros.map(r => ({ bairro: r.bairro || 'N/A', quantidade: Number(r.quantidade), total: Number(r.total_valor) })),
        alertas
      });
    } catch (erro) {
      logger.error('Erro no dashboard resumo:', erro);
      res.status(500).json({ erro: 'Não foi possível carregar o resumo do dashboard.' });
    }
  });

  // ============================================
  // Aprovar revisão do pedido (libera para pagamento)
  // ============================================
  router.put('/api/admin/pedidos/:id/aprovar-revisao', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const pedidoId = req.params.id;
      const { observacao } = req.body || {};

      const [pedidos] = await pool.query('SELECT id, status, usuario_id, revisao_em, revisao_aprovada_em FROM pedidos WHERE id = ? LIMIT 1', [pedidoId]);
      if (!pedidos.length) {
        return res.status(404).json({ erro: 'Pedido não encontrado.' });
      }

      const statusAtual = String(pedidos[0].status || '').trim().toLowerCase();
      const revisaoAbertaEmPendente = statusAtual === 'pendente'
        && Boolean(pedidos[0].revisao_em)
        && !pedidos[0].revisao_aprovada_em;

      if (statusAtual !== 'aguardando_revisao' && !revisaoAbertaEmPendente) {
        return res.status(400).json({ erro: `Pedido não está aguardando revisão (status atual: ${pedidos[0].status}).` });
      }

      // Atualizar para pendente (liberado para pagamento)
      const obsCurada = String(observacao || '').trim().slice(0, 500) || null;
      await pool.query(
        'UPDATE pedidos SET status = ?, revisao_aprovada_em = NOW(), revisao_obs = ? WHERE id = ?',
        ['pendente', obsCurada, pedidoId]
      );

      // Notificar cliente por WhatsApp
      try {
        const [dados] = await pool.query(
          `SELECT p.total, p.forma_pagamento, u.nome, u.telefone, u.whatsapp_opt_in
           FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id
           WHERE p.id = ? LIMIT 1`,
          [pedidoId]
        );

        if (dados.length && dados[0].whatsapp_opt_in) {
          await enviarWhatsappPedido({
            telefone: dados[0].telefone,
            nome: dados[0].nome,
            pedidoId,
            total: dados[0].total,
            pixCodigo: null,
            mensagemExtra: '✅ Seu pedido foi revisado e aprovado! Agora é só realizar o pagamento para prosseguirmos com a separação.'
          });
        }
      } catch (errNotifica) {
        logger.error('Falha ao notificar aprovação por WhatsApp:', errNotifica.message);
      }

      registrarAuditoria(pool, {
        acao: 'aprovar_revisao_pedido',
        entidade: 'pedido',
        entidade_id: pedidoId,
        detalhes: { observacao: obsCurada },
        admin_usuario: 'admin',
        ip: req.ip
      });

      res.json({ mensagem: 'Pedido aprovado e liberado para pagamento.', status: 'pendente' });
    } catch (erro) {
      logger.error('Erro ao aprovar revisão:', erro);
      res.status(500).json({ erro: 'Não foi possível aprovar a revisão do pedido.' });
    }
  });

  // ============================================
  // Rejeitar revisão do pedido (cancela + restaura estoque)
  // ============================================
  router.put('/api/admin/pedidos/:id/rejeitar-revisao', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const pedidoId = req.params.id;
      const { motivo } = req.body || {};

      const [pedidos] = await pool.query('SELECT id, status, usuario_id FROM pedidos WHERE id = ? LIMIT 1', [pedidoId]);
      if (!pedidos.length) {
        return res.status(404).json({ erro: 'Pedido não encontrado.' });
      }

      if (pedidos[0].status !== 'aguardando_revisao') {
        return res.status(400).json({ erro: `Pedido não está aguardando revisão (status atual: ${pedidos[0].status}).` });
      }

      const motivoCurado = String(motivo || 'Revisão rejeitada pela equipe').trim().slice(0, 500);

      // Restaurar estoque em transação
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const [itensPedido] = await connection.query(
          'SELECT produto_id, quantidade FROM pedido_itens WHERE pedido_id = ?',
          [pedidoId]
        );

        for (const item of itensPedido) {
          await connection.query(
            'UPDATE produtos SET estoque = estoque + ? WHERE id = ?',
            [item.quantidade, item.produto_id]
          );
        }

        await connection.query(
          'UPDATE pedidos SET status = ?, revisao_obs = ?, cancelado_em = NOW() WHERE id = ?',
          ['cancelado', motivoCurado, pedidoId]
        );

        await connection.commit();
      } catch (errTx) {
        await connection.rollback();
        throw errTx;
      } finally {
        connection.release();
      }

      // Notificar cliente
      try {
        const [dados] = await pool.query(
          `SELECT p.total, u.nome, u.telefone, u.whatsapp_opt_in
           FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id
           WHERE p.id = ? LIMIT 1`,
          [pedidoId]
        );

        if (dados.length && dados[0].whatsapp_opt_in) {
          await enviarWhatsappPedido({
            telefone: dados[0].telefone,
            nome: dados[0].nome,
            pedidoId,
            total: dados[0].total,
            pixCodigo: null,
            mensagemExtra: `❌ Infelizmente não pudemos confirmar seu pedido: ${motivoCurado}. Tente novamente ou entre em contato.`
          });
        }
      } catch (errNotifica) {
        logger.error('Falha ao notificar rejeição por WhatsApp:', errNotifica.message);
      }

      registrarAuditoria(pool, {
        acao: 'rejeitar_revisao_pedido',
        entidade: 'pedido',
        entidade_id: pedidoId,
        detalhes: { motivo: motivoCurado },
        admin_usuario: 'admin',
        ip: req.ip
      });

      res.json({ mensagem: 'Pedido rejeitado e estoque restaurado.', status: 'cancelado' });
    } catch (erro) {
      logger.error('Erro ao rejeitar revisão:', erro);
      res.status(500).json({ erro: 'Não foi possível rejeitar a revisão do pedido.' });
    }
  });

  // ============================================
  // Atualizar status do pedido (admin)
  // ============================================
  router.put('/api/admin/pedidos/:id/status', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const { status } = req.body;
      const pedidoId = req.params.id;

      const statusValidos = ['pendente', 'aguardando_revisao', 'preparando', 'enviado', 'entregue', 'cancelado', 'pronto_para_retirada', 'retirado'];
      
      if (!statusValidos.includes(status)) {
        return res.status(400).json({ erro: 'Selecione um status de pedido válido.' });
      }

      // Buscar status atual para restauração condicional de estoque
      const [pedidoAtual] = await pool.query('SELECT status FROM pedidos WHERE id = ? LIMIT 1', [pedidoId]);
      if (!pedidoAtual.length) {
        return res.status(404).json({ erro: 'Pedido não encontrado.' });
      }
      const statusAnterior = pedidoAtual[0].status;

      // Restaurar estoque se mudando para cancelado (e não estava cancelado antes) — Q042
      if (status === 'cancelado' && statusAnterior !== 'cancelado') {
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();

          const [itensPedido] = await connection.query(
            'SELECT produto_id, quantidade FROM pedido_itens WHERE pedido_id = ?',
            [pedidoId]
          );

          for (const item of itensPedido) {
            await connection.query(
              'UPDATE produtos SET estoque = estoque + ? WHERE id = ?',
              [item.quantidade, item.produto_id]
            );
          }

          // Atualizar status e timestamp na mesma transação
          const colunaTimestamp = STATUS_TIMESTAMP_COLUNA[status];
          if (colunaTimestamp) {
            try {
              await connection.query(
                `UPDATE pedidos SET status = ?, ${colunaTimestamp} = COALESCE(${colunaTimestamp}, NOW()) WHERE id = ?`,
                [status, pedidoId]
              );
            } catch (errTs) {
              logger.warn(`⚠️ Timestamp ${colunaTimestamp} não gravado (migration pendente?):`, errTs.message);
              await connection.query('UPDATE pedidos SET status = ? WHERE id = ?', [status, pedidoId]);
            }
          } else {
            await connection.query('UPDATE pedidos SET status = ? WHERE id = ?', [status, pedidoId]);
          }

          await connection.commit();
          logger.info(`Estoque restaurado para pedido #${pedidoId} (${itensPedido.length} itens).`);
        } catch (errEstoque) {
          await connection.rollback();
          throw errEstoque;
        } finally {
          connection.release();
        }
      } else {
        // Gravar timestamp da etapa (sem sobrescrever se já existir)
        const colunaTimestamp = STATUS_TIMESTAMP_COLUNA[status];
        if (colunaTimestamp) {
          try {
            await pool.query(
              `UPDATE pedidos SET status = ?, ${colunaTimestamp} = COALESCE(${colunaTimestamp}, NOW()) WHERE id = ?`,
              [status, pedidoId]
            );
          } catch (errTs) {
            logger.warn(`⚠️ Timestamp ${colunaTimestamp} não gravado (migration pendente?):`, errTs.message);
            await pool.query('UPDATE pedidos SET status = ? WHERE id = ?', [status, pedidoId]);
          }
        } else {
          await pool.query('UPDATE pedidos SET status = ? WHERE id = ?', [status, pedidoId]);
        }
      }

      // Notificar cliente via WhatsApp se estiver configurado e houver opt-in
      if (status === 'preparando' || status === 'enviado' || status === 'entregue' || status === 'pronto_para_retirada' || status === 'retirado') {
        try {
          const [dados] = await pool.query(
            `SELECT p.id, p.total, p.forma_pagamento, u.nome, u.telefone, u.whatsapp_opt_in
               FROM pedidos p
               JOIN usuarios u ON p.usuario_id = u.id
              WHERE p.id = ?
              LIMIT 1`,
            [pedidoId]
          );

          if (dados.length && dados[0].whatsapp_opt_in) {
            const mensagemStatus = status === 'preparando'
              ? 'Seu pedido está sendo separado! Em breve estará pronto.'
              : status === 'enviado'
                ? 'Seu pedido saiu pra entrega! Acompanhe em tempo real pelo app.'
                : status === 'entregue'
                  ? 'Seu pedido foi entregue. Obrigado pela preferência!'
                  : status === 'pronto_para_retirada'
                    ? 'Seu pedido está preparado e pronto para retirada na loja!'
                    : 'Seu pedido foi retirado com sucesso. Obrigado!';

            await enviarWhatsappPedido({
              telefone: dados[0].telefone,
              nome: dados[0].nome,
              pedidoId: pedidoId,
              total: dados[0].total,
              pixCodigo: null,
              mensagemExtra: mensagemStatus
            });
          }
        } catch (errNotifica) {
          logger.error('Falha ao notificar por WhatsApp:', errNotifica.message);
        }
      }

      // Registrar auditoria da mudança de status
      registrarAuditoria(pool, { acao: 'alterar_status_pedido', entidade: 'pedido', entidade_id: pedidoId, detalhes: { novo_status: status }, admin_usuario: 'admin', ip: req.ip });

      res.json({ mensagem: 'Status do pedido atualizado com sucesso.', status: status });
    } catch (erro) {
      logger.error('Erro ao atualizar status:', erro);
      res.status(500).json({ erro: 'Não foi possível atualizar o status do pedido.' });
    }
  });

  // ============================================
  // Fila operacional
  // ============================================
  router.get('/api/admin/fila-operacional', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const filas = {};

      // Aguardando revisão do mercado (novo fluxo)
      let aguardandoRevisao = [];
      try {
        const [rows] = await pool.query(
          `SELECT p.id, p.total, p.forma_pagamento, p.tipo_entrega, p.criado_em, p.status, p.revisao_em, p.revisao_aprovada_em,
                  u.nome AS cliente_nome, u.telefone AS cliente_telefone,
                  TIMESTAMPDIFF(MINUTE, COALESCE(p.revisao_em, p.criado_em), NOW()) AS minutos_parado
           FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
           WHERE p.status = 'aguardando_revisao'
              OR (p.status = 'pendente' AND p.revisao_em IS NOT NULL AND p.revisao_aprovada_em IS NULL)
           ORDER BY COALESCE(p.revisao_em, p.criado_em) ASC LIMIT 50`
        );
        aguardandoRevisao = rows;
      } catch (_) {
        // Fallback para bases antigas sem colunas de revisão.
        try {
          const [rowsFallback] = await pool.query(
            `SELECT p.id, p.total, p.forma_pagamento, p.tipo_entrega, p.criado_em, p.status,
                    u.nome AS cliente_nome, u.telefone AS cliente_telefone,
                    TIMESTAMPDIFF(MINUTE, p.criado_em, NOW()) AS minutos_parado
             FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
             WHERE p.status = 'aguardando_revisao'
             ORDER BY p.criado_em ASC LIMIT 50`
          );
          aguardandoRevisao = rowsFallback;
        } catch (_) {}
      }
      filas.aguardando_revisao = aguardandoRevisao;

      // Pendentes de pagamento
      const [pendPag] = await pool.query(
        `SELECT p.id, p.total, p.forma_pagamento, p.tipo_entrega, p.criado_em, p.status,
                u.nome AS cliente_nome, u.telefone AS cliente_telefone,
                TIMESTAMPDIFF(MINUTE, p.criado_em, NOW()) AS minutos_parado
         FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
         WHERE p.status = 'pendente' ORDER BY p.criado_em ASC LIMIT 50`
      );
      filas.pendentes_pagamento = pendPag;

      // Pagos aguardando preparo
      const [pagosAguardando] = await pool.query(
        `SELECT p.id, p.total, p.forma_pagamento, p.tipo_entrega, p.criado_em, p.status,
                u.nome AS cliente_nome,
                TIMESTAMPDIFF(MINUTE, COALESCE(p.pago_em, p.criado_em), NOW()) AS minutos_parado
         FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
         WHERE p.status = 'pago' ORDER BY p.criado_em ASC LIMIT 50`
      );
      filas.pagos_aguardando_preparo = pagosAguardando;

      // Em separação (status = preparando)
      let emSeparacao = [];
      try {
        const [rows] = await pool.query(
          `SELECT p.id, p.total, p.forma_pagamento, p.tipo_entrega, p.criado_em, p.status,
                  u.nome AS cliente_nome,
                  TIMESTAMPDIFF(MINUTE, COALESCE(p.em_preparo_em, p.criado_em), NOW()) AS minutos_parado
           FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
           WHERE p.status = 'preparando'
           ORDER BY p.em_preparo_em ASC LIMIT 50`
        );
        emSeparacao = rows;
      } catch (_) {}
      filas.em_separacao = emSeparacao;

      // Prontos aguardando saída (entrega)
      let prontosAguardandoSaida = [];
      try {
        const [rows] = await pool.query(
          `SELECT p.id, p.total, p.tipo_entrega, p.criado_em, p.pronto_em, p.status,
                  u.nome AS cliente_nome,
                  TIMESTAMPDIFF(MINUTE, p.pronto_em, NOW()) AS minutos_parado
           FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
           WHERE p.status IN ('pronto_para_retirada','preparando') AND p.pronto_em IS NOT NULL AND p.tipo_entrega = 'entrega'
           ORDER BY p.pronto_em ASC LIMIT 50`
        );
        prontosAguardandoSaida = rows;
      } catch (_) {}
      filas.prontos_aguardando_saida = prontosAguardandoSaida;

      // Em rota (todos os pedidos em entrega)
      let emRota = [];
      try {
        const [rows] = await pool.query(
          `SELECT p.id, p.total, p.tipo_entrega, p.criado_em, p.saiu_entrega_em, p.status,
                  u.nome AS cliente_nome, u.telefone AS cliente_telefone,
                  TIMESTAMPDIFF(MINUTE, p.saiu_entrega_em, NOW()) AS minutos_rota
           FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
           WHERE p.status = 'enviado' AND p.saiu_entrega_em IS NOT NULL
             AND TIMESTAMPDIFF(MINUTE, p.saiu_entrega_em, NOW()) <= 25
           ORDER BY p.saiu_entrega_em ASC LIMIT 50`
        );
        emRota = rows;
      } catch (_) {}
      filas.em_rota = emRota;

      // Em rota acima do SLA
      let emRotaLonga = [];
      try {
        const [rows] = await pool.query(
          `SELECT p.id, p.total, p.tipo_entrega, p.criado_em, p.saiu_entrega_em, p.status,
                  u.nome AS cliente_nome,
                  TIMESTAMPDIFF(MINUTE, p.saiu_entrega_em, NOW()) AS minutos_rota
           FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
           WHERE p.status = 'enviado' AND p.saiu_entrega_em IS NOT NULL
             AND TIMESTAMPDIFF(MINUTE, p.saiu_entrega_em, NOW()) > 25
           ORDER BY p.saiu_entrega_em ASC LIMIT 50`
        );
        emRotaLonga = rows;
      } catch (_) {}
      filas.em_rota_acima_sla = emRotaLonga;

      // Retiradas prontas aguardando cliente
      let retiradasProntas = [];
      try {
        const [rows] = await pool.query(
          `SELECT p.id, p.total, p.tipo_entrega, p.criado_em, p.pronto_em, p.status,
                  u.nome AS cliente_nome, u.telefone AS cliente_telefone,
                  TIMESTAMPDIFF(MINUTE, p.pronto_em, NOW()) AS minutos_parado
           FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
           WHERE p.status = 'pronto_para_retirada' AND p.tipo_entrega = 'retirada'
           ORDER BY p.pronto_em ASC LIMIT 50`
        );
        retiradasProntas = rows;
      } catch (_) {}
      filas.retiradas_prontas_aguardando = retiradasProntas;

      // Pedidos travados (>60min no mesmo status sem ser terminal)
      const [travados] = await pool.query(
        `SELECT p.id, p.total, p.status, p.tipo_entrega, p.criado_em, p.atualizado_em,
                u.nome AS cliente_nome,
                TIMESTAMPDIFF(MINUTE, p.atualizado_em, NOW()) AS minutos_parado
         FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
         WHERE p.status NOT IN ('entregue','retirado','cancelado')
           AND TIMESTAMPDIFF(MINUTE, p.atualizado_em, NOW()) > 60
         ORDER BY p.atualizado_em ASC LIMIT 50`
      );
      filas.travados = travados;

      // Contadores
      filas.contadores = {
        aguardando_revisao: aguardandoRevisao.length,
        pendentes_pagamento: pendPag.length,
        pagos_aguardando_preparo: pagosAguardando.length,
        em_separacao: emSeparacao.length,
        prontos_aguardando_saida: prontosAguardandoSaida.length,
        em_rota: emRota.length,
        em_rota_acima_sla: emRotaLonga.length,
        retiradas_prontas_aguardando: retiradasProntas.length,
        travados: travados.length
      };

      res.json(filas);
    } catch (erro) {
      logger.error('Erro fila operacional:', erro);
      res.status(500).json({ erro: 'Falha ao carregar fila operacional.' });
    }
  });

  // ============================================
  // Clientes
  // ============================================
  router.get('/api/admin/clientes', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const ordenar = String(req.query.ordenar || 'gasto_desc').trim();
      const limite = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const pagina = Math.max(Number(req.query.page) || 1, 1);
      const offset = (pagina - 1) * limite;
      const busca = String(req.query.busca || '').trim().slice(0, 200);
      const segmento = String(req.query.segmento || 'todos').trim();

      let orderBy = 'total_gasto DESC';
      if (ordenar === 'pedidos_desc') orderBy = 'total_pedidos DESC';
      else if (ordenar === 'recente') orderBy = 'ultimo_pedido DESC';
      else if (ordenar === 'antigo') orderBy = 'ultimo_pedido ASC';
      else if (ordenar === 'ticket_desc') orderBy = 'ticket_medio DESC';

      let filtroSegmento = '';
      if (segmento === 'novos') filtroSegmento = 'HAVING total_pedidos = 1';
      else if (segmento === 'recorrentes') filtroSegmento = 'HAVING total_pedidos >= 3';
      else if (segmento === 'vip') filtroSegmento = 'HAVING total_gasto >= 500 AND total_pedidos >= 5';
      else if (segmento === 'inativos') filtroSegmento = 'HAVING DATEDIFF(NOW(), ultimo_pedido) > 60';
      else if (segmento === 'risco_churn') filtroSegmento = 'HAVING total_pedidos >= 2 AND DATEDIFF(NOW(), ultimo_pedido) > 30';

      let filtroBusca = '';
      const paramsBusca = [];
      if (busca) {
        filtroBusca = 'AND (u.nome LIKE ? OR u.telefone LIKE ? OR u.email LIKE ?)';
        const like = `%${busca}%`;
        paramsBusca.push(like, like, like);
      }

      const [[countRow]] = await pool.query(
        `SELECT COUNT(DISTINCT u.id) AS total FROM usuarios u
         JOIN pedidos p ON p.usuario_id = u.id
         WHERE 1=1 ${filtroBusca}`, paramsBusca);
      const totalClientes = Number(countRow?.total || 0);

      const [clientes] = await pool.query(
        `SELECT u.id, u.nome, u.email, u.telefone, u.criado_em AS cliente_desde,
          COUNT(p.id) AS total_pedidos,
          COALESCE(SUM(CASE WHEN p.status != 'cancelado' THEN p.total ELSE 0 END), 0) AS total_gasto,
          ROUND(AVG(CASE WHEN p.status != 'cancelado' THEN p.total ELSE NULL END), 2) AS ticket_medio,
          MAX(p.criado_em) AS ultimo_pedido,
          SUM(CASE WHEN p.status = 'cancelado' THEN 1 ELSE 0 END) AS total_cancelamentos,
          (SELECT p2.forma_pagamento FROM pedidos p2 WHERE p2.usuario_id = u.id AND p2.status != 'cancelado'
           GROUP BY p2.forma_pagamento ORDER BY COUNT(*) DESC LIMIT 1) AS pagamento_favorito,
          (SELECT p3.tipo_entrega FROM pedidos p3 WHERE p3.usuario_id = u.id AND p3.status != 'cancelado'
           GROUP BY p3.tipo_entrega ORDER BY COUNT(*) DESC LIMIT 1) AS canal_favorito
         FROM usuarios u
         JOIN pedidos p ON p.usuario_id = u.id
         WHERE 1=1 ${filtroBusca}
         GROUP BY u.id
         ${filtroSegmento}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        [...paramsBusca, limite, offset]
      );

      res.json({
        clientes: clientes.map(c => ({
          ...c,
          total_gasto: Number(c.total_gasto),
          ticket_medio: Number(c.ticket_medio || 0),
          total_pedidos: Number(c.total_pedidos),
          total_cancelamentos: Number(c.total_cancelamentos),
          dias_desde_ultimo: c.ultimo_pedido ? Math.floor((Date.now() - new Date(c.ultimo_pedido).getTime()) / 86400000) : null
        })),
        paginacao: { pagina, limite, total: totalClientes, total_paginas: Math.ceil(totalClientes / limite) }
      });
    } catch (erro) {
      logger.error('Erro ao listar clientes:', erro);
      res.status(500).json({ erro: 'Não foi possível carregar os clientes.' });
    }
  });

  // ============================================
  // Detalhe do cliente
  // ============================================
  router.get('/api/admin/clientes/:id', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const clienteId = Number(req.params.id);
      if (!Number.isInteger(clienteId) || clienteId <= 0) {
        return res.status(400).json({ erro: 'ID de cliente inválido.' });
      }

      const [[cliente]] = await pool.query(
        `SELECT u.id, u.nome, u.email, u.telefone, u.criado_em AS cliente_desde,
          COUNT(p.id) AS total_pedidos,
          COALESCE(SUM(CASE WHEN p.status != 'cancelado' THEN p.total ELSE 0 END), 0) AS total_gasto,
          ROUND(AVG(CASE WHEN p.status != 'cancelado' THEN p.total ELSE NULL END), 2) AS ticket_medio,
          MAX(p.criado_em) AS ultimo_pedido,
          SUM(CASE WHEN p.status = 'cancelado' THEN 1 ELSE 0 END) AS total_cancelamentos
         FROM usuarios u
         LEFT JOIN pedidos p ON p.usuario_id = u.id
         WHERE u.id = ?
         GROUP BY u.id`,
        [clienteId]
      );

      if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

      const [pedidos] = await pool.query(
        `SELECT id, total, status, forma_pagamento, tipo_entrega, criado_em
         FROM pedidos WHERE usuario_id = ? ORDER BY criado_em DESC LIMIT 50`,
        [clienteId]
      );

      const [enderecos] = await pool.query(
        `SELECT bairro, cidade, rua, numero FROM enderecos WHERE usuario_id = ? ORDER BY atualizado_em DESC LIMIT 5`,
        [clienteId]
      );

      res.json({
        ...cliente,
        total_gasto: Number(cliente.total_gasto),
        ticket_medio: Number(cliente.ticket_medio || 0),
        total_pedidos: Number(cliente.total_pedidos),
        total_cancelamentos: Number(cliente.total_cancelamentos),
        dias_desde_ultimo: cliente.ultimo_pedido ? Math.floor((Date.now() - new Date(cliente.ultimo_pedido).getTime()) / 86400000) : null,
        pedidos,
        enderecos
      });
    } catch (erro) {
      logger.error('Erro detalhe cliente:', erro);
      res.status(500).json({ erro: 'Não foi possível carregar o cliente.' });
    }
  });

  // ============================================
  // Conciliação financeira
  // ============================================
  router.get('/api/admin/financeiro/conciliacao', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const dias = Math.min(Math.max(Number(req.query.dias) || 7, 1), 90);
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);

      // Pagamentos pendentes por mais de 30 minutos
      const [pendentesLongo] = await pool.query(
        `SELECT p.id, p.total, p.forma_pagamento, p.pix_status, p.criado_em, p.status,
                u.nome AS cliente_nome,
                TIMESTAMPDIFF(MINUTE, p.criado_em, NOW()) AS minutos_pendente
         FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
         WHERE p.status = 'pendente' AND TIMESTAMPDIFF(MINUTE, p.criado_em, NOW()) > 30
         ORDER BY p.criado_em ASC LIMIT 50`
      );

      // Pedidos pago no sistema mas sem confirmação PIX
      const [semConfirmacao] = await pool.query(
        `SELECT p.id, p.total, p.forma_pagamento, p.pix_status, p.pix_id, p.criado_em, p.status,
                u.nome AS cliente_nome
         FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
         WHERE p.status NOT IN ('pendente','cancelado') AND p.forma_pagamento = 'pix'
           AND (p.pix_status IS NULL OR p.pix_status NOT IN ('PAID','CONCLUIDA'))
           AND p.criado_em >= ?
         ORDER BY p.criado_em DESC LIMIT 50`,
        [desde]
      );

      // Pedidos cancelados que tinham pagamento confirmado
      const [canceladosPagos] = await pool.query(
        `SELECT p.id, p.total, p.forma_pagamento, p.pix_status, p.criado_em, p.status,
                u.nome AS cliente_nome
         FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
         WHERE p.status = 'cancelado'
           AND (p.pix_status IN ('PAID','CONCLUIDA') OR p.forma_pagamento IN ('credito','debito','dinheiro'))
           AND p.criado_em >= ?
         ORDER BY p.criado_em DESC LIMIT 50`,
        [desde]
      );

      // Pedidos pagos ainda não concluídos (não entregues/retirados)
      const [pagosNaoConcluidos] = await pool.query(
        `SELECT p.id, p.total, p.status, p.forma_pagamento, p.tipo_entrega, p.criado_em,
                u.nome AS cliente_nome,
                TIMESTAMPDIFF(MINUTE, p.criado_em, NOW()) AS minutos_desde_criacao
         FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
         WHERE p.status NOT IN ('pendente','cancelado','entregue','retirado')
           AND p.criado_em >= ?
         ORDER BY p.criado_em ASC LIMIT 50`,
        [desde]
      );

      // Resumo de contadores
      const contadores = {
        pendentes_longo: pendentesLongo.length,
        sem_confirmacao_pix: semConfirmacao.length,
        cancelados_pagos: canceladosPagos.length,
        pagos_nao_concluidos: pagosNaoConcluidos.length
      };

      res.json({ contadores, pendentes_longo: pendentesLongo, sem_confirmacao_pix: semConfirmacao, cancelados_pagos: canceladosPagos, pagos_nao_concluidos: pagosNaoConcluidos });
    } catch (erro) {
      logger.error('Erro conciliação:', erro);
      res.status(500).json({ erro: 'Falha ao carregar conciliação.' });
    }
  });

  // ============================================
  // Fechamento diário
  // ============================================
  router.get('/api/admin/financeiro/fechamento', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const data = req.query.data || new Date().toISOString().slice(0, 10);
      const inicio = data + ' 00:00:00';
      const fim = data + ' 23:59:59';

      const [[resumo]] = await pool.query(
        `SELECT
          COUNT(*) AS total_pedidos,
          SUM(CASE WHEN status NOT IN ('cancelado','pendente') THEN 1 ELSE 0 END) AS pagos,
          SUM(CASE WHEN status IN ('entregue','retirado') THEN 1 ELSE 0 END) AS concluidos,
          SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END) AS cancelados,
          SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) AS pendentes,
          COALESCE(SUM(CASE WHEN status NOT IN ('cancelado') THEN total ELSE 0 END), 0) AS faturamento_bruto,
          AVG(CASE WHEN status NOT IN ('cancelado') THEN total ELSE NULL END) AS ticket_medio
         FROM pedidos WHERE criado_em BETWEEN ? AND ?`,
        [inicio, fim]
      );

      const [porPagamento] = await pool.query(
        `SELECT forma_pagamento AS forma, COUNT(*) AS quantidade, COALESCE(SUM(total), 0) AS valor
         FROM pedidos WHERE status NOT IN ('cancelado') AND criado_em BETWEEN ? AND ?
         GROUP BY forma_pagamento ORDER BY valor DESC`,
        [inicio, fim]
      );

      const [porCanal] = await pool.query(
        `SELECT tipo_entrega AS canal, COUNT(*) AS quantidade, COALESCE(SUM(total), 0) AS valor
         FROM pedidos WHERE status NOT IN ('cancelado') AND criado_em BETWEEN ? AND ?
         GROUP BY tipo_entrega ORDER BY valor DESC`,
        [inicio, fim]
      );

      // SLA do dia
      let sla = { dentro_prazo: null, total_concluidos: null, pct: null };
      try {
        const [[slaRow]] = await pool.query(
          `SELECT
            SUM(CASE WHEN tipo_entrega != 'retirada' AND entregue_em IS NOT NULL
              AND TIMESTAMPDIFF(MINUTE, COALESCE(pago_em, criado_em), entregue_em) <= 45 THEN 1 ELSE 0 END) AS dentro_prazo,
            SUM(CASE WHEN (tipo_entrega != 'retirada' AND entregue_em IS NOT NULL) OR (tipo_entrega = 'retirada' AND retirado_em IS NOT NULL) THEN 1 ELSE 0 END) AS total_concluidos
           FROM pedidos WHERE criado_em BETWEEN ? AND ? AND status NOT IN ('cancelado','pendente')`,
          [inicio, fim]
        );
        if (slaRow) {
          sla.dentro_prazo = Number(slaRow.dentro_prazo || 0);
          sla.total_concluidos = Number(slaRow.total_concluidos || 0);
          sla.pct = sla.total_concluidos > 0 ? Math.round((sla.dentro_prazo / sla.total_concluidos) * 10000) / 100 : null;
        }
      } catch (_) {}

      // Pendências financeiras do dia
      const [[pendenciasRow]] = await pool.query(
        `SELECT COUNT(*) AS qtd FROM pedidos WHERE status = 'pendente' AND criado_em BETWEEN ? AND ?`,
        [inicio, fim]
      );

      res.json({
        data,
        ...resumo,
        faturamento_bruto: Number(resumo?.faturamento_bruto || 0),
        ticket_medio: resumo?.ticket_medio != null ? Number(Number(resumo.ticket_medio).toFixed(2)) : 0,
        por_pagamento: porPagamento.map(r => ({ forma: r.forma, quantidade: Number(r.quantidade), valor: Number(r.valor) })),
        por_canal: porCanal.map(r => ({ canal: r.canal, quantidade: Number(r.quantidade), valor: Number(r.valor) })),
        sla,
        pendencias_financeiras: Number(pendenciasRow?.qtd || 0)
      });
    } catch (erro) {
      logger.error('Erro fechamento diário:', erro);
      res.status(500).json({ erro: 'Falha ao gerar fechamento diário.' });
    }
  });

  // ============================================
  // Auditoria: listar log
  // ============================================
  router.get('/api/admin/auditoria', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const limite = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const pagina = Math.max(Number(req.query.page) || 1, 1);
      const offset = (pagina - 1) * limite;
      const acao = String(req.query.acao || '').trim();
      const entidade = String(req.query.entidade || '').trim();

      let where = '1=1';
      const params = [];
      if (acao) { where += ' AND acao = ?'; params.push(acao); }
      if (entidade) { where += ' AND entidade = ?'; params.push(entidade); }

      const [[countRow]] = await pool.query(`SELECT COUNT(*) AS total FROM admin_audit_log WHERE ${where}`, params);
      const total = Number(countRow?.total || 0);

      const [logs] = await pool.query(
        `SELECT * FROM admin_audit_log WHERE ${where} ORDER BY criado_em DESC LIMIT ? OFFSET ?`,
        [...params, limite, offset]
      );

      res.json({
        logs: logs.map(l => ({ ...l, detalhes: l.detalhes ? (typeof l.detalhes === 'string' ? JSON.parse(l.detalhes) : l.detalhes) : null })),
        paginacao: { pagina, limite, total, total_paginas: Math.ceil(total / limite) }
      });
    } catch (erro) {
      if (erro.code === 'ER_NO_SUCH_TABLE') {
        return res.json({ logs: [], paginacao: { pagina: 1, limite: 50, total: 0, total_paginas: 0 }, aviso: 'Tabela de auditoria ainda não foi criada. Execute migrate_admin_fase2.sql.' });
      }
      logger.error('Erro auditoria:', erro);
      res.status(500).json({ erro: 'Falha ao carregar auditoria.' });
    }
  });

  // ============================================
  // Relatórios / Exportação
  // ============================================
  router.get('/api/admin/relatorios/vendas', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const periodo = String(req.query.periodo || 'hoje').trim();
      const canal = String(req.query.canal || 'todos').trim();
      const pagamento = String(req.query.pagamento || 'todos').trim();
      const formato = String(req.query.formato || 'json').trim();

      // Calcular datas: reuse logic from dashboard
      const agora = new Date();
      const hojeI = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      const hojeF = new Date(hojeI); hojeF.setHours(23, 59, 59, 999);
      let ini = hojeI, fi = hojeF;
      if (periodo === '7d') { ini = new Date(hojeI); ini.setDate(ini.getDate() - 6); }
      else if (periodo === '30d') { ini = new Date(hojeI); ini.setDate(ini.getDate() - 29); }
      else if (periodo === 'mes') { ini = new Date(agora.getFullYear(), agora.getMonth(), 1); }
      else if (periodo === 'custom' && req.query.inicio) { ini = new Date(req.query.inicio + 'T00:00:00'); if (req.query.fim) fi = new Date(req.query.fim + 'T23:59:59.999'); }

      const filtros = [];
      const params = [ini, fi];
      if (canal !== 'todos') { filtros.push('p.tipo_entrega = ?'); params.push(canal); }
      if (pagamento !== 'todos') { filtros.push('p.forma_pagamento = ?'); params.push(pagamento); }
      const filtroStr = filtros.length > 0 ? ' AND ' + filtros.join(' AND ') : '';

      const [rows] = await pool.query(
        `SELECT p.id, p.total, p.status, p.forma_pagamento, p.tipo_entrega, p.criado_em,
                u.nome AS cliente_nome, u.telefone AS cliente_telefone
         FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
         WHERE p.criado_em BETWEEN ? AND ?${filtroStr}
         ORDER BY p.criado_em DESC LIMIT 2000`,
        params
      );

      if (formato === 'csv') {
        const header = 'Pedido,Data,Cliente,Telefone,Status,Pagamento,Canal,Valor\n';
        const csv = rows.map(r =>
          `${r.id},"${(r.criado_em || '').toString().slice(0, 19)}","${(r.cliente_nome || '').replace(/"/g, '""')}","${r.cliente_telefone || ''}","${r.status}","${r.forma_pagamento}","${r.tipo_entrega}",${Number(r.total || 0).toFixed(2)}`
        ).join('\n');

        await registrarAuditoria(pool, { acao: 'exportar_relatorio', entidade: 'pedidos', detalhes: { periodo, canal, pagamento, qtd: rows.length }, admin_usuario: 'admin', ip: req.ip });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=vendas_${periodo}_${Date.now()}.csv`);
        return res.send('\uFEFF' + header + csv);
      }

      res.json({ pedidos: rows, total: rows.length, periodo: { inicio: ini.toISOString(), fim: fi.toISOString() } });
    } catch (erro) {
      logger.error('Erro relatório vendas:', erro);
      res.status(500).json({ erro: 'Falha ao gerar relatório.' });
    }
  });

  // ============================================
  // Central de comando: resumo vivo
  // ============================================
  router.get('/api/admin/central/vivo', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const agora = new Date();
      const hojeI = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      const hojeF = new Date(hojeI); hojeF.setHours(23, 59, 59, 999);
      const ontemI = new Date(hojeI); ontemI.setDate(ontemI.getDate() - 1);
      const ontemF = new Date(ontemI); ontemF.setHours(23, 59, 59, 999);

      // KPIs hoje
      const [[kpiHoje]] = await pool.query(
        `SELECT COUNT(*) AS pedidos, COALESCE(SUM(CASE WHEN status NOT IN ('cancelado') THEN total ELSE 0 END),0) AS faturamento,
          SUM(CASE WHEN status NOT IN ('cancelado','pendente') THEN 1 ELSE 0 END) AS pagos,
          SUM(CASE WHEN status IN ('entregue','retirado') THEN 1 ELSE 0 END) AS concluidos,
          SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END) AS cancelados,
          SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) AS pendentes,
          AVG(CASE WHEN status NOT IN ('cancelado') THEN total ELSE NULL END) AS ticket_medio
         FROM pedidos WHERE criado_em BETWEEN ? AND ?`, [hojeI, hojeF]);

      // KPIs ontem (comparação)
      const [[kpiOntem]] = await pool.query(
        `SELECT COUNT(*) AS pedidos, COALESCE(SUM(CASE WHEN status NOT IN ('cancelado') THEN total ELSE 0 END),0) AS faturamento,
          SUM(CASE WHEN status NOT IN ('cancelado','pendente') THEN 1 ELSE 0 END) AS pagos,
          SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END) AS cancelados
         FROM pedidos WHERE criado_em BETWEEN ? AND ?`, [ontemI, ontemF]);

      // Em aberto agora (não-terminais)
      const [[abertos]] = await pool.query(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN status='pendente' THEN 1 ELSE 0 END) AS pendentes,
          SUM(CASE WHEN status='pago' OR status='preparando' THEN 1 ELSE 0 END) AS em_preparo,
          SUM(CASE WHEN status='enviado' THEN 1 ELSE 0 END) AS em_rota,
          SUM(CASE WHEN status='pronto_para_retirada' THEN 1 ELSE 0 END) AS aguardando_retirada
         FROM pedidos WHERE status NOT IN ('entregue','retirado','cancelado')`);

      // Atrasados (>45min sem conclusão)
      let atrasados = 0;
      try {
        const [[atr]] = await pool.query(
          `SELECT COUNT(*) AS total FROM pedidos WHERE status NOT IN ('entregue','retirado','cancelado','pendente')
           AND TIMESTAMPDIFF(MINUTE, COALESCE(pago_em, criado_em), NOW()) > 45`);
        atrasados = Number(atr?.total || 0);
      } catch (_) {}

      // SLA hoje
      let sla = { dentro: 0, total_concl: 0, pct: null };
      try {
        const [[s]] = await pool.query(
          `SELECT SUM(CASE WHEN entregue_em IS NOT NULL AND TIMESTAMPDIFF(MINUTE, COALESCE(pago_em, criado_em), entregue_em) <= 45 THEN 1
            WHEN retirado_em IS NOT NULL AND TIMESTAMPDIFF(MINUTE, COALESCE(pago_em, criado_em), retirado_em) <= 20 THEN 1 ELSE 0 END) AS dentro,
            SUM(CASE WHEN entregue_em IS NOT NULL OR retirado_em IS NOT NULL THEN 1 ELSE 0 END) AS total_concl
           FROM pedidos WHERE criado_em BETWEEN ? AND ? AND status NOT IN ('cancelado','pendente')`, [hojeI, hojeF]);
        sla.dentro = Number(s?.dentro || 0);
        sla.total_concl = Number(s?.total_concl || 0);
        sla.pct = sla.total_concl > 0 ? Math.round((sla.dentro / sla.total_concl) * 10000) / 100 : null;
      } catch (_) {}

      // Últimos 30 min — mini feed
      const ultimos30min = new Date(agora.getTime() - 30 * 60000);
      const [recentes] = await pool.query(
        `SELECT p.id, p.status, p.total, p.forma_pagamento, p.tipo_entrega, p.criado_em, p.atualizado_em,
          u.nome AS cliente FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
         WHERE p.atualizado_em >= ? OR p.criado_em >= ? ORDER BY GREATEST(p.atualizado_em, p.criado_em) DESC LIMIT 20`,
        [ultimos30min, ultimos30min]);

      // Hora corrente — volume por hora
      const [porHora] = await pool.query(
        `SELECT HOUR(criado_em) AS hora, COUNT(*) AS qtd, COALESCE(SUM(CASE WHEN status!='cancelado' THEN total ELSE 0 END),0) AS valor
         FROM pedidos WHERE criado_em BETWEEN ? AND ? GROUP BY HOUR(criado_em) ORDER BY hora`, [hojeI, hojeF]);

      // Calcular variações
      const varFat = kpiOntem.faturamento > 0 ? ((Number(kpiHoje.faturamento) - Number(kpiOntem.faturamento)) / Number(kpiOntem.faturamento) * 100) : null;
      const varPed = kpiOntem.pedidos > 0 ? ((Number(kpiHoje.pedidos) - Number(kpiOntem.pedidos)) / Number(kpiOntem.pedidos) * 100) : null;

      res.json({
        kpis: {
          faturamento: Number(kpiHoje.faturamento), pedidos: Number(kpiHoje.pedidos), pagos: Number(kpiHoje.pagos || 0),
          concluidos: Number(kpiHoje.concluidos || 0), cancelados: Number(kpiHoje.cancelados || 0),
          pendentes: Number(kpiHoje.pendentes || 0), ticket_medio: kpiHoje.ticket_medio ? Number(Number(kpiHoje.ticket_medio).toFixed(2)) : 0,
          taxa_cancelamento: kpiHoje.pedidos > 0 ? Math.round(Number(kpiHoje.cancelados || 0) / Number(kpiHoje.pedidos) * 10000) / 100 : 0,
          taxa_aprovacao: kpiHoje.pedidos > 0 ? Math.round(Number(kpiHoje.pagos || 0) / Number(kpiHoje.pedidos) * 10000) / 100 : 0,
          var_faturamento: varFat != null ? Number(varFat.toFixed(1)) : null,
          var_pedidos: varPed != null ? Number(varPed.toFixed(1)) : null
        },
        operacao: { ...abertos, atrasados, em_preparo: Number(abertos?.em_preparo || 0), em_rota: Number(abertos?.em_rota || 0), aguardando_retirada: Number(abertos?.aguardando_retirada || 0) },
        sla,
        recentes: recentes.map(r => ({ ...r, total: Number(r.total) })),
        por_hora: porHora.map(h => ({ hora: h.hora, qtd: Number(h.qtd), valor: Number(h.valor) }))
      });
    } catch (erro) {
      logger.error('Erro central vivo:', erro);
      res.status(500).json({ erro: 'Falha ao carregar dados ao vivo.' });
    }
  });

  // ============================================
  // Feed de atividade recente
  // ============================================
  router.get('/api/admin/feed', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const limite = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
      const eventos = [];

      // Pedidos recentes (últimas 2h)
      const desde = new Date(Date.now() - 2 * 3600000);
      const [pedRecentes] = await pool.query(
        `SELECT p.id, p.status, p.total, p.forma_pagamento, p.criado_em, p.atualizado_em, u.nome AS cliente
         FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id=u.id
         WHERE p.criado_em >= ? OR p.atualizado_em >= ? ORDER BY GREATEST(p.criado_em, p.atualizado_em) DESC LIMIT ?`,
        [desde, desde, limite]);

      for (const p of pedRecentes) {
        const ts = new Date(Math.max(new Date(p.criado_em).getTime(), new Date(p.atualizado_em || p.criado_em).getTime()));
        let tipo = 'pedido_criado', icone = '🛒', cor = '#3b82f6';
        if (p.status === 'cancelado') { tipo = 'pedido_cancelado'; icone = '❌'; cor = '#ef4444'; }
        else if (p.status === 'entregue' || p.status === 'retirado') { tipo = 'pedido_concluido'; icone = '✅'; cor = '#22c55e'; }
        else if (p.status === 'enviado') { tipo = 'pedido_em_rota'; icone = '🚗'; cor = '#06b6d4'; }
        else if (p.status === 'preparando') { tipo = 'pedido_preparo'; icone = '👨‍🍳'; cor = '#f59e0b'; }
        else if (p.status === 'pago') { tipo = 'pagamento_aprovado'; icone = '💰'; cor = '#22c55e'; }
        else if (p.status === 'pronto_para_retirada') { tipo = 'pedido_pronto'; icone = '📦'; cor = '#8b5cf6'; }

        eventos.push({
          tipo, icone, cor, ts: ts.toISOString(),
          titulo: tipo === 'pedido_criado' ? `Novo pedido #${p.id}` : `Pedido #${p.id} → ${p.status}`,
          detalhe: `${p.cliente || 'Cliente'} • R$ ${Number(p.total).toFixed(2)} • ${p.forma_pagamento || ''}`,
          entidade: 'pedido', entidade_id: p.id
        });
      }

      // Auditoria recente
      try {
        const [auditRecente] = await pool.query(
          `SELECT * FROM admin_audit_log WHERE criado_em >= ? ORDER BY criado_em DESC LIMIT 10`, [desde]);
        for (const a of auditRecente) {
          let det = a.detalhes;
          if (typeof det === 'string') try { det = JSON.parse(det); } catch (_) {}
          eventos.push({
            tipo: 'admin_acao', icone: '⚙️', cor: '#64748b', ts: new Date(a.criado_em).toISOString(),
            titulo: `Admin: ${a.acao}`, detalhe: a.entidade ? `${a.entidade} #${a.entidade_id || ''}` : '',
            entidade: a.entidade, entidade_id: a.entidade_id
          });
        }
      } catch (_) {}

      // Ordenar por timestamp desc
      eventos.sort((a, b) => new Date(b.ts) - new Date(a.ts));

      res.json({ eventos: eventos.slice(0, limite) });
    } catch (erro) {
      logger.error('Erro feed:', erro);
      res.status(500).json({ erro: 'Falha ao carregar feed.' });
    }
  });

  // ============================================
  // Alertas e incidentes
  // ============================================
  router.get('/api/admin/alertas', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const alertas = [];
      const agora = new Date();
      const hojeI = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

      // Pedidos fora do SLA (>45min)
      try {
        const [[r]] = await pool.query(
          `SELECT COUNT(*) AS total FROM pedidos WHERE status NOT IN ('entregue','retirado','cancelado','pendente')
           AND TIMESTAMPDIFF(MINUTE, COALESCE(pago_em, criado_em), NOW()) > 45`);
        if (r.total > 0) alertas.push({ id: 'sla_fora', severidade: 'critico', tipo: 'operacional', titulo: 'Pedidos fora do SLA', descricao: `${r.total} pedido(s) acima de 45min sem conclusão`, valor: r.total, cta: { tab: 'operacao' } });
      } catch (_) {}

      // Pedidos travados (>60min sem mudança)
      const [[trav]] = await pool.query(
        `SELECT COUNT(*) AS total FROM pedidos WHERE status NOT IN ('entregue','retirado','cancelado')
         AND TIMESTAMPDIFF(MINUTE, atualizado_em, NOW()) > 60`);
      if (trav.total > 0) alertas.push({ id: 'travados', severidade: 'critico', tipo: 'operacional', titulo: 'Pedidos travados', descricao: `${trav.total} pedido(s) sem atualização há +60min`, valor: trav.total, cta: { tab: 'operacao' } });

      // Cancelamentos acima do normal (>15% hoje)
      const [[canc]] = await pool.query(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN status='cancelado' THEN 1 ELSE 0 END) AS cancelados
         FROM pedidos WHERE criado_em >= ?`, [hojeI]);
      const taxaCanc = canc.total > 3 ? (Number(canc.cancelados) / Number(canc.total) * 100) : 0;
      if (taxaCanc > 15) alertas.push({ id: 'cancelamentos_alto', severidade: 'atencao', tipo: 'financeiro', titulo: 'Cancelamentos acima do normal', descricao: `${taxaCanc.toFixed(1)}% de cancelamento hoje (${canc.cancelados}/${canc.total})`, valor: taxaCanc, cta: { tab: 'fin-avancado' } });

      // Pagamentos pendentes há +30min
      const [[pend]] = await pool.query(
        `SELECT COUNT(*) AS total FROM pedidos WHERE status='pendente' AND TIMESTAMPDIFF(MINUTE, criado_em, NOW()) > 30`);
      if (pend.total > 0) alertas.push({ id: 'pag_pendente_longo', severidade: 'atencao', tipo: 'financeiro', titulo: 'Pagamentos pendentes prolongados', descricao: `${pend.total} pagamento(s) pendentes há +30min`, valor: pend.total, cta: { tab: 'fin-avancado' } });

      // Produtos sem preço ou inativos com vendas
      try {
        const [[semPreco]] = await pool.query(`SELECT COUNT(*) AS total FROM produtos WHERE (preco IS NULL OR preco<=0) AND ativo=1`);
        if (semPreco.total > 0) alertas.push({ id: 'produto_sem_preco', severidade: 'atencao', tipo: 'catalogo', titulo: 'Produtos sem preço', descricao: `${semPreco.total} item(ns) ativo(s) sem preço definido`, valor: semPreco.total, cta: { tab: 'catalogo' } });
      } catch (_) {}

      // Produtos sem imagem
      try {
        const [[semImg]] = await pool.query(`SELECT COUNT(*) AS total FROM produtos WHERE (imagem_url IS NULL OR imagem_url='') AND ativo=1`);
        if (semImg.total > 0 && semImg.total > 5) alertas.push({ id: 'produto_sem_imagem', severidade: 'info', tipo: 'catalogo', titulo: 'Produtos sem imagem', descricao: `${semImg.total} produto(s) ativo(s) sem imagem`, valor: semImg.total, cta: { tab: 'catalogo' } });
      } catch (_) {}

      // Fila parada — pagos sem preparo há +15min
      try {
        const [[fila]] = await pool.query(
          `SELECT COUNT(*) AS total FROM pedidos WHERE status='pago' AND TIMESTAMPDIFF(MINUTE, COALESCE(pago_em, criado_em), NOW()) > 15`);
        if (fila.total > 0) alertas.push({ id: 'fila_parada', severidade: 'critico', tipo: 'operacional', titulo: 'Fila parada — preparo atrasado', descricao: `${fila.total} pedido(s) pago(s) aguardando preparo há +15min`, valor: fila.total, cta: { tab: 'operacao' } });
      } catch (_) {}

      alertas.sort((a, b) => { const sev = { critico: 0, atencao: 1, info: 2 }; return (sev[a.severidade] || 9) - (sev[b.severidade] || 9); });

      res.json({ alertas, total: alertas.length, criticos: alertas.filter(a => a.severidade === 'critico').length });
    } catch (erro) {
      logger.error('Erro alertas:', erro);
      res.status(500).json({ erro: 'Falha ao carregar alertas.' });
    }
  });

  // ============================================
  // Saúde do catálogo
  // ============================================
  router.get('/api/admin/catalogo/saude', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const [[totais]] = await pool.query(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN ativo=1 THEN 1 ELSE 0 END) AS ativos, SUM(CASE WHEN ativo=0 THEN 1 ELSE 0 END) AS inativos FROM produtos`);

      let semImagem = 0, semPreco = 0, semDescricao = 0;
      try { const [[r]] = await pool.query(`SELECT COUNT(*) AS t FROM produtos WHERE (imagem_url IS NULL OR imagem_url='') AND ativo=1`); semImagem = Number(r.t); } catch (_) {}
      try { const [[r]] = await pool.query(`SELECT COUNT(*) AS t FROM produtos WHERE (preco IS NULL OR preco<=0) AND ativo=1`); semPreco = Number(r.t); } catch (_) {}
      try { const [[r]] = await pool.query(`SELECT COUNT(*) AS t FROM produtos WHERE (descricao IS NULL OR descricao='') AND ativo=1`); semDescricao = Number(r.t); } catch (_) {}

      const ativos = Number(totais.ativos || 0);
      const coberturaImagem = ativos > 0 ? Math.round((ativos - semImagem) / ativos * 100) : 100;
      const coberturaDescricao = ativos > 0 ? Math.round((ativos - semDescricao) / ativos * 100) : 100;

      // Top vendidos nos últimos 30 dias
      const [topVendidos] = await pool.query(
        `SELECT pi.produto_id AS id, pi.nome_produto AS nome, COUNT(DISTINCT pi.pedido_id) AS pedidos, SUM(pi.quantidade) AS quantidade,
          SUM(pi.subtotal) AS receita, p2.imagem_url, p2.ativo
         FROM pedido_itens pi JOIN pedidos ped ON pi.pedido_id=ped.id LEFT JOIN produtos p2 ON pi.produto_id=p2.id
         WHERE ped.criado_em >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND ped.status NOT IN ('cancelado')
         GROUP BY pi.produto_id ORDER BY receita DESC LIMIT 10`);

      // Produtos sem saída (ativos mas sem vendas em 30 dias)
      const [semSaida] = await pool.query(
        `SELECT p.id, p.nome, p.preco, p.categoria FROM produtos p
         WHERE p.ativo=1 AND p.id NOT IN (SELECT DISTINCT pi.produto_id FROM pedido_itens pi JOIN pedidos ped ON pi.pedido_id=ped.id WHERE ped.criado_em >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND ped.status NOT IN ('cancelado'))
         LIMIT 20`);

      // Campeões com cadastro fraco (top vendidos sem imagem ou sem descrição)
      const campeoesFrageis = topVendidos.filter(t => !t.imagem_url || t.imagem_url === '').map(t => ({ id: t.id, nome: t.nome, receita: Number(t.receita), problema: 'sem_imagem' }));

      res.json({
        total: Number(totais.total), ativos, inativos: Number(totais.inativos || 0),
        sem_imagem: semImagem, sem_preco: semPreco, sem_descricao: semDescricao,
        cobertura_imagem: coberturaImagem, cobertura_descricao: coberturaDescricao,
        top_vendidos: topVendidos.map(t => ({ ...t, receita: Number(t.receita), quantidade: Number(t.quantidade) })),
        sem_saida: semSaida,
        campeoes_frageis: campeoesFrageis,
        score: Math.round((coberturaImagem * 0.4 + coberturaDescricao * 0.3 + (semPreco === 0 ? 30 : Math.max(0, 30 - semPreco * 3))) )
      });
    } catch (erro) {
      logger.error('Erro saúde catálogo:', erro);
      res.status(500).json({ erro: 'Falha ao verificar saúde do catálogo.' });
    }
  });

  // ============================================
  // Espelho/nota do pedido para impressão térmica
  // ============================================
  router.get('/api/admin/pedidos/:id/espelho', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const pedidoId = parsePositiveInt(req.params.id);
      if (!pedidoId) {
        return res.status(400).json({ erro: 'ID do pedido inválido.' });
      }

      const [[pedido]] = await pool.query(
        `SELECT p.*, u.nome AS cliente_nome, u.email AS cliente_email, u.telefone AS cliente_telefone
         FROM pedidos p
         LEFT JOIN usuarios u ON p.usuario_id = u.id
         WHERE p.id = ? LIMIT 1`,
        [pedidoId]
      );

      if (!pedido) {
        return res.status(404).json({ erro: 'Pedido não encontrado.' });
      }

      const [itens] = await pool.query(
        'SELECT nome_produto, quantidade, preco, subtotal FROM pedido_itens WHERE pedido_id = ?',
        [pedidoId]
      );

      let endereco = null;
      if (pedido.usuario_id && pedido.tipo_entrega !== 'retirada') {
        const [endRows] = await pool.query(
          'SELECT rua, logradouro, numero, complemento, bairro, cidade, estado, cep, referencia FROM enderecos WHERE usuario_id = ? ORDER BY atualizado_em DESC LIMIT 1',
          [pedido.usuario_id]
        );
        endereco = endRows[0] || null;
      }

      const { gerarEspelhoPedido } = require('../services/espelhoPedido');
      const texto = gerarEspelhoPedido({
        pedido,
        cliente: {
          nome: pedido.cliente_nome,
          telefone: pedido.cliente_telefone,
          email: pedido.cliente_email
        },
        endereco,
        itens,
        desconto: Number(pedido.desconto_aplicado || 0),
        instrucoes: pedido.instrucoes || null,
        tipo_entrega: pedido.tipo_entrega
      });

      res.type('text/plain; charset=utf-8').send(texto);
    } catch (erro) {
      logger.error('Erro ao gerar espelho do pedido:', erro);
      res.status(500).json({ erro: 'Falha ao gerar espelho do pedido.' });
    }
  });

  return router;
};
