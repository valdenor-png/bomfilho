'use strict';

const path = require('path');
const express = require('express');
const logger = require('../lib/logger');
const { ADMIN_USER } = require('../lib/config');
const {
  enriquecerProdutoParaCatalogo,
  resolveVisibilidadePublica
} = require('../lib/produtoCatalogoRules');
const {
  parseBooleanInput,
  parsePositiveInt,
  parseOverwriteImageModeInput,
  parseJsonObjectInput
} = require('../lib/helpers');
const {
  ensureAdminCatalogSchema,
  getAdminProdutosDashboard,
  listarProdutosAdmin,
  atualizarProdutoAdmin,
  enriquecerProdutoPorId,
  obterMetricasEnriquecimento,
  dispararEnriquecimentoPendentesJob,
  obterJobEnriquecimentoPorId,
  reprocessarFalhasEnriquecimento,
  enriquecerProdutosSemImagem,
  enriquecerProdutosImportacaoRecente,
  listarEnrichmentLogs,
  listarImportLogs,
  registrarProductImportLog,
  exportarProdutosParaExcel
} = require('../services/admin/catalogoAdminService');
const {
  validarArquivoImportacao,
  MENSAGEM_FORMATO_ARQUIVO_IMPORTACAO_INVALIDO,
  construirModeloImportacaoProdutosCsv,
  importarProdutosPlanilha,
  listarImportacoesProdutos
} = require('../services/produtosImportacao');

/**
 * @param {object} deps
 * @param {Function} deps.autenticarAdminToken
 * @param {Function} deps.exigirAcessoLocalAdmin
 * @param {object}   deps.pool
 * @param {object}   deps.barcodeLookupService
 * @param {Function} deps.obterColunasProdutos
 * @param {Function} deps.limparCacheProdutos
 * @param {Function} deps.middlewareUploadImportacaoProdutos
 * @param {Function} deps.limparCacheColunaProdutos
 */
module.exports = function createAdminCatalogoRoutes(deps) {
  const {
    autenticarAdminToken,
    exigirAcessoLocalAdmin,
    pool,
    barcodeLookupService,
    obterColunasProdutos,
    limparCacheProdutos,
    middlewareUploadImportacaoProdutos,
    limparCacheColunaProdutos
  } = deps;

  const router = express.Router();

  // ---- helpers locais ----

  async function responderBuscaProdutoPorCodigoBarrasAdmin(req, res) {
    try {
      const codigo = String(req.params.codigo || '').replace(/\D/g, '');
      if (codigo.length < 8) {
        return res.status(400).json({ erro: 'Informe um codigo de barras valido.' });
      }

      const force = parseBooleanInput(req.query?.force, false);
      const lookup = await barcodeLookupService.lookup(codigo, { force });

      if (lookup?.status === 'found' && lookup?.product) {
        return res.json({
          fonte: lookup.source,
          provider: lookup.provider,
          produto: {
            codigo_barras: codigo,
            nome: lookup.product.nome || '',
            marca: lookup.product.marca || '',
            descricao: lookup.product.descricao || '',
            imagem: lookup.product.imagem || ''
          },
          tentativas: lookup.attemptedProviders || []
        });
      }

      const colunas = await obterColunasProdutos();
      if (colunas.has('codigo_barras')) {
        const campoImagem = colunas.has('imagem_url') ? 'imagem_url AS imagem, ' : '';
        const [locais] = await pool.query(
          `SELECT id, nome, descricao, marca, categoria, emoji, ${campoImagem}codigo_barras
           FROM produtos
           WHERE codigo_barras = ?
           LIMIT 1`,
          [codigo]
        );

        if (locais.length > 0) {
          return res.json({
            fonte: 'local',
            provider: lookup?.provider || null,
            produto: locais[0],
            tentativas: lookup?.attemptedProviders || []
          });
        }
      }

      return res.status(404).json({
        erro: lookup?.message || 'Produto nao encontrado no catalogo e nas bases consultadas.',
        tentativas: lookup?.attemptedProviders || []
      });
    } catch (erro) {
      logger.error('Erro ao buscar produto por codigo de barras:', erro);
      return res.status(500).json({ erro: 'Nao foi possivel consultar o codigo de barras.' });
    }
  }

  async function processarImportacaoProdutosAdmin(req, res) {
    const nomeArquivo = req.file?.originalname || 'importacao_sem_arquivo.csv';
    const formatoArquivo = String(path.extname(nomeArquivo || '') || '').toLowerCase();
    const inicioProcessamentoMs = Date.now();

    try {
      if (!req.file || !Buffer.isBuffer(req.file.buffer)) {
        return res.status(400).json({ erro: 'Selecione um arquivo .xls, .xlsx ou .csv para importar.' });
      }

      try {
        validarArquivoImportacao({
          nomeArquivo: req.file?.originalname,
          mimeType: req.file?.mimetype
        });
      } catch (erroValidacaoArquivo) {
        return res.status(400).json({
          erro: erroValidacaoArquivo?.message || MENSAGEM_FORMATO_ARQUIVO_IMPORTACAO_INVALIDO
        });
      }

      await ensureAdminCatalogSchema(pool);

      const criarNovos = parseBooleanInput(req.body?.criar_novos, false);
      const atualizarEstoque = parseBooleanInput(req.body?.atualizar_estoque, false);
      const simular = parseBooleanInput(req.body?.simular, false);
      const overwriteImageMode = parseOverwriteImageModeInput(
        req.body?.overwrite_image_mode || req.body?.politica_imagem || req.query?.overwrite_image_mode,
        'if_empty'
      );
      const enriquecerPosImportacao = parseBooleanInput(
        req.body?.enriquecer_imagens_pos_importacao || req.body?.auto_enriquecer_imagens,
        false
      );
      const enriquecerApenasSemImagem = parseBooleanInput(req.body?.enriquecer_apenas_sem_imagem, true);
      const enriquecerLimite = parsePositiveInt(
        req.body?.enriquecer_limite || req.query?.enriquecer_limite,
        80,
        { min: 1, max: 800 }
      );
      const enriquecerConcorrencia = parsePositiveInt(
        req.body?.enriquecer_concorrencia || req.query?.enriquecer_concorrencia,
        3,
        { min: 1, max: 10 }
      );
      const enriquecerForceLookup = parseBooleanInput(
        req.body?.enriquecer_force_lookup || req.query?.enriquecer_force_lookup,
        false
      );
      const enriquecerJanelaMinutos = parsePositiveInt(
        req.body?.enriquecer_janela_minutos || req.query?.enriquecer_janela_minutos,
        180,
        { min: 5, max: 43200 }
      );
      const mapeamentoColunas = parseJsonObjectInput(
        req.body?.mapeamento_colunas || req.body?.column_mapping,
        null
      );

      const resultado = await importarProdutosPlanilha({
        pool,
        fileBuffer: req.file.buffer,
        originalName: nomeArquivo,
        createMissing: criarNovos,
        updateStock: atualizarEstoque,
        simulate: simular,
        columnMapping: mapeamentoColunas,
        barcodeLookupService,
        adminUser: req.admin?.usuario || ADMIN_USER,
        adminUserId: req.admin?.id || null
      });

      let resultadoEnriquecimentoPosImportacao = null;
      let avisoEnriquecimento = '';
      if (!simular && enriquecerPosImportacao) {
        try {
          const resultadoEnriquecimentoCompleto = await enriquecerProdutosImportacaoRecente(pool, barcodeLookupService, {
            sinceDate: new Date(inicioProcessamentoMs - 15000),
            windowMinutes: enriquecerJanelaMinutos,
            somenteSemImagem: enriquecerApenasSemImagem,
            limit: enriquecerLimite,
            concurrency: enriquecerConcorrencia,
            force: enriquecerForceLookup,
            overwriteImageMode,
            preferSpreadsheet: true
          });

          resultadoEnriquecimentoPosImportacao = {
            resumo: resultadoEnriquecimentoCompleto?.resumo || {},
            itens: Array.isArray(resultadoEnriquecimentoCompleto?.itens)
              ? resultadoEnriquecimentoCompleto.itens.slice(0, 80)
              : []
          };
        } catch (erroEnriquecimento) {
          logger.error('Falha no enriquecimento pos-importacao:', erroEnriquecimento);
          avisoEnriquecimento = erroEnriquecimento?.message || 'Importacao concluida, mas houve falha no enriquecimento pos-importacao.';
        }
      }

      const duracaoMs = Date.now() - inicioProcessamentoMs;
      const resultadoComMetadados = {
        ...resultado,
        arquivo_nome: nomeArquivo,
        formato_arquivo: formatoArquivo,
        duracao_ms: duracaoMs,
        configuracao_enriquecimento: {
          overwrite_image_mode: overwriteImageMode,
          pos_importacao_ativo: enriquecerPosImportacao,
          pos_importacao_apenas_sem_imagem: enriquecerApenasSemImagem,
          pos_importacao_limite: enriquecerLimite,
          pos_importacao_concorrencia: enriquecerConcorrencia
        },
        enriquecimento_pos_importacao: resultadoEnriquecimentoPosImportacao
      };

      let avisoLog = '';
      try {
        await registrarProductImportLog(pool, {
          arquivo_nome: nomeArquivo,
          total_linhas: Number(resultado?.total_linhas || 0),
          linhas_validas: Number(resultado?.total_validos || 0),
          linhas_com_erro: Number(resultado?.total_erros || 0),
          status: resultado?.status || (simular ? 'simulado' : 'concluido'),
          resumo: resultadoComMetadados,
          criado_por: req.admin?.usuario || ADMIN_USER
        });
      } catch (erroLog) {
        logger.error('Falha ao registrar log administrativo de importacao:', erroLog);
        avisoLog = 'Importacao concluida, mas nao foi possivel registrar no log administrativo.';
      }

      if (!simular) {
        limparCacheColunaProdutos();
        if (Number(resultado?.total_atualizados || 0) > 0 || Number(resultado?.total_criados || 0) > 0) {
          limparCacheProdutos();
        }

        if (Number(resultadoEnriquecimentoPosImportacao?.resumo?.total_atualizados || 0) > 0) {
          limparCacheProdutos();
        }
      }

      if (avisoLog || avisoEnriquecimento) {
        return res.status(200).json({
          ...resultadoComMetadados,
          aviso_log: avisoLog || undefined,
          aviso_enriquecimento: avisoEnriquecimento || undefined
        });
      }

      return res.status(200).json(resultadoComMetadados);
    } catch (erro) {
      const duracaoMs = Date.now() - inicioProcessamentoMs;
      const status = Number.isFinite(Number(erro?.httpStatus))
        ? Number(erro.httpStatus)
        : 500;

      if (status >= 500) {
        logger.error('Erro ao importar planilha de produtos:', erro);
      }

      const detalhesErro = erro?.extra && typeof erro.extra === 'object'
        ? {
          ...erro.extra,
          formato_arquivo: formatoArquivo,
          duracao_ms: duracaoMs
        }
        : {
          formato_arquivo: formatoArquivo,
          duracao_ms: duracaoMs
        };

      try {
        await registrarProductImportLog(pool, {
          arquivo_nome: nomeArquivo,
          total_linhas: 0,
          linhas_validas: 0,
          linhas_com_erro: 1,
          status: 'erro',
          resumo: {
            erro: erro?.message || 'Falha ao processar importacao.',
            formato_arquivo: formatoArquivo,
            duracao_ms: duracaoMs,
            detalhes: detalhesErro
          },
          criado_por: req.admin?.usuario || ADMIN_USER
        });
      } catch {
        // mantem erro original
      }

      const payloadErro = {
        erro: erro?.message || 'Nao foi possivel processar a importacao da planilha.',
        detalhes: {
          formato_arquivo: formatoArquivo,
          duracao_ms: duracaoMs
        }
      };

      return res.status(status).json(payloadErro);
    }
  }

  // ---- Rotas do catálogo admin ----

  router.get('/api/admin/catalogo/dashboard', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const dashboard = await getAdminProdutosDashboard(pool);
      return res.json({ dashboard });
    } catch (erro) {
      logger.error('Erro ao carregar dashboard de produtos admin:', erro);
      return res.status(500).json({ erro: 'Nao foi possivel carregar o dashboard administrativo.' });
    }
  });

  router.get('/api/admin/catalogo/produtos', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const resultado = await listarProdutosAdmin(pool, req.query || {});
      return res.json(resultado);
    } catch (erro) {
      logger.error('Erro ao listar produtos admin:', erro);
      return res.status(500).json({ erro: 'Nao foi possivel carregar a lista de produtos.' });
    }
  });

  router.patch('/api/admin/catalogo/produtos/:id', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const produto = await atualizarProdutoAdmin(pool, req.params.id, req.body || {});
      limparCacheProdutos();
      return res.json({
        mensagem: 'Produto atualizado com sucesso.',
        produto
      });
    } catch (erro) {
      const mensagem = erro?.message || 'Nao foi possivel atualizar o produto.';
      const status = /nao encontrado/i.test(mensagem)
        ? 404
        : (/invalido|valido|Nenhum campo/i.test(mensagem) ? 400 : 500);
      if (status >= 500) {
        logger.error('Erro ao atualizar produto admin:', erro);
      }
      return res.status(status).json({ erro: mensagem });
    }
  });

  router.get('/api/admin/catalogo/produtos/barcode/:codigo', exigirAcessoLocalAdmin, autenticarAdminToken, responderBuscaProdutoPorCodigoBarrasAdmin);

  router.post('/api/admin/catalogo/produtos/:id/enriquecer', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const force = parseBooleanInput(req.body?.force || req.query?.force, false);
      const preferSpreadsheet = parseBooleanInput(req.body?.prefer_spreadsheet, true);
      const overwriteImageMode = parseOverwriteImageModeInput(
        req.body?.overwrite_image_mode || req.query?.overwrite_image_mode,
        'if_empty'
      );
      const resultado = await enriquecerProdutoPorId(pool, barcodeLookupService, req.params.id, {
        force,
        preferSpreadsheet,
        overwriteImageMode
      });

      if (resultado?.atualizado) {
        limparCacheProdutos();
      }

      return res.json(resultado);
    } catch (erro) {
      const mensagem = erro?.message || 'Nao foi possivel reprocessar enriquecimento.';
      const status = /invalido|nao encontrado/i.test(mensagem) ? 400 : 500;
      if (status >= 500) {
        logger.error('Erro ao enriquecer produto por id:', erro);
      }
      return res.status(status).json({ erro: mensagem });
    }
  });

  router.get('/api/admin/catalogo/enriquecimento/metricas', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const includeNaoEncontrado = parseBooleanInput(
        req.query?.include_nao_encontrado || req.query?.includeNaoEncontrado,
        false
      );
      const limitMensagens = parsePositiveInt(
        req.query?.limit_mensagens || req.query?.limitMensagens,
        30,
        { min: 1, max: 200 }
      );

      console.info('[admin-enrichment] coletando metricas operacionais', {
        include_nao_encontrado: includeNaoEncontrado,
        limit_mensagens: limitMensagens
      });

      const resultado = await obterMetricasEnriquecimento(pool, {
        includeNaoEncontrado,
        limitMensagens
      });

      return res.json(resultado);
    } catch (erro) {
      logger.error('Erro ao coletar metricas de enriquecimento:', erro);
      return res.status(500).json({ erro: 'Nao foi possivel coletar metricas de enriquecimento.' });
    }
  });

  router.post('/api/admin/catalogo/produtos/enriquecer-pendentes', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const limit = parsePositiveInt(req.body?.limit || req.query?.limit, 100, { min: 1, max: 5000 });
      const concurrency = parsePositiveInt(req.body?.concurrency || req.query?.concurrency, 3, { min: 1, max: 12 });
      const allowDuplicate = parseBooleanInput(req.body?.allow_duplicate || req.query?.allow_duplicate, false);
      const dedupeWindowMinutes = parsePositiveInt(
        req.body?.dedupe_window_minutes || req.query?.dedupe_window_minutes,
        240,
        { min: 1, max: 1440 }
      );
      const itemMaxRetries = parsePositiveInt(
        req.body?.item_max_retries || req.query?.item_max_retries,
        1,
        { min: 0, max: 5 }
      );
      const jobTimeoutMs = parsePositiveInt(
        req.body?.job_timeout_ms || req.query?.job_timeout_ms || process.env.ENRICHMENT_JOB_TIMEOUT_MS,
        10 * 60 * 1000,
        { min: 1, max: 24 * 60 * 60 * 1000 }
      );
      const force = parseBooleanInput(req.body?.force || req.query?.force, false);
      const preferSpreadsheet = parseBooleanInput(req.body?.prefer_spreadsheet || req.query?.prefer_spreadsheet, true);
      const overwriteImageMode = parseOverwriteImageModeInput(
        req.body?.overwrite_image_mode || req.query?.overwrite_image_mode,
        'if_empty'
      );

      console.info('[admin-enrichment] solicitacao de job pendentes recebida', {
        limit,
        concurrency,
        allow_duplicate: allowDuplicate,
        dedupe_window_minutes: dedupeWindowMinutes,
        item_max_retries: itemMaxRetries,
        job_timeout_ms: jobTimeoutMs,
        force,
        prefer_spreadsheet: preferSpreadsheet,
        overwrite_image_mode: overwriteImageMode
      });

      const resultado = await dispararEnriquecimentoPendentesJob(pool, barcodeLookupService, {
        limit,
        concurrency,
        allowDuplicate,
        dedupeWindowMinutes,
        itemMaxRetries,
        jobTimeoutMs,
        force,
        preferSpreadsheet,
        overwriteImageMode
      });

      console.info('[admin-enrichment] job pendentes aceito', {
        job_id: resultado?.job?.job_id || null,
        status: resultado?.job?.status || null,
        reutilizado: Boolean(resultado?.reutilizado)
      });

      return res.json(resultado);
    } catch (erro) {
      logger.error('Erro ao disparar job de enriquecimento pendente:', erro);
      return res.status(500).json({ erro: 'Nao foi possivel iniciar o job de enriquecimento pendente.' });
    }
  });

  router.get('/api/admin/catalogo/produtos/enriquecimento-jobs/:jobId', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const jobId = String(req.params?.jobId || '').trim();
      if (!jobId) {
        return res.status(400).json({ erro: 'Informe um jobId valido.' });
      }

      const resultado = obterJobEnriquecimentoPorId(jobId);
      if (!resultado) {
        return res.status(404).json({ erro: 'Job de enriquecimento nao encontrado.' });
      }

      return res.json(resultado);
    } catch (erro) {
      logger.error('Erro ao consultar job de enriquecimento:', erro);
      return res.status(500).json({ erro: 'Nao foi possivel consultar o job de enriquecimento.' });
    }
  });

  router.post('/api/admin/catalogo/enriquecimento/reprocessar-falhas', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const limit = parsePositiveInt(req.body?.limit || req.query?.limit, 30, { min: 1, max: 200 });
      const concurrency = parsePositiveInt(req.body?.concurrency || req.query?.concurrency, 3, { min: 1, max: 10 });
      const overwriteImageMode = parseOverwriteImageModeInput(
        req.body?.overwrite_image_mode || req.query?.overwrite_image_mode,
        'if_empty'
      );

      const resultado = await reprocessarFalhasEnriquecimento(pool, barcodeLookupService, {
        limit,
        concurrency,
        overwriteImageMode
      });

      if (Number(resultado?.resumo?.total_enriquecidos || 0) > 0) {
        limparCacheProdutos();
      }

      return res.json(resultado);
    } catch (erro) {
      logger.error('Erro ao reprocessar falhas de enriquecimento:', erro);
      return res.status(500).json({ erro: 'Nao foi possivel reprocessar os itens com falha.' });
    }
  });

  router.post('/api/admin/catalogo/enriquecimento/sem-imagem', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const limit = parsePositiveInt(req.body?.limit || req.query?.limit, 80, { min: 1, max: 500 });
      const concurrency = parsePositiveInt(req.body?.concurrency || req.query?.concurrency, 3, { min: 1, max: 10 });
      const force = parseBooleanInput(req.body?.force || req.query?.force, false);
      const overwriteImageMode = parseOverwriteImageModeInput(
        req.body?.overwrite_image_mode || req.query?.overwrite_image_mode,
        'if_empty'
      );

      const resultado = await enriquecerProdutosSemImagem(pool, barcodeLookupService, {
        limit,
        concurrency,
        force,
        preferSpreadsheet: true,
        overwriteImageMode
      });

      if (Number(resultado?.resumo?.total_atualizados || 0) > 0) {
        limparCacheProdutos();
      }

      return res.json(resultado);
    } catch (erro) {
      logger.error('Erro ao enriquecer produtos sem imagem:', erro);
      return res.status(500).json({ erro: 'Nao foi possivel enriquecer produtos sem imagem agora.' });
    }
  });

  router.post('/api/admin/catalogo/enriquecimento/importacao-recente', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const limit = parsePositiveInt(req.body?.limit || req.query?.limit, 120, { min: 1, max: 800 });
      const concurrency = parsePositiveInt(req.body?.concurrency || req.query?.concurrency, 3, { min: 1, max: 10 });
      const force = parseBooleanInput(req.body?.force || req.query?.force, false);
      const somenteSemImagem = parseBooleanInput(req.body?.somente_sem_imagem || req.query?.somente_sem_imagem, true);
      const windowMinutes = parsePositiveInt(
        req.body?.window_minutes || req.body?.janela_minutos || req.query?.window_minutes || req.query?.janela_minutos,
        180,
        { min: 5, max: 43200 }
      );
      const overwriteImageMode = parseOverwriteImageModeInput(
        req.body?.overwrite_image_mode || req.query?.overwrite_image_mode,
        'if_empty'
      );

      const resultado = await enriquecerProdutosImportacaoRecente(pool, barcodeLookupService, {
        limit,
        concurrency,
        force,
        somenteSemImagem,
        windowMinutes,
        preferSpreadsheet: true,
        overwriteImageMode
      });

      if (Number(resultado?.resumo?.total_atualizados || 0) > 0) {
        limparCacheProdutos();
      }

      return res.json(resultado);
    } catch (erro) {
      logger.error('Erro ao enriquecer importacao recente:', erro);
      return res.status(500).json({ erro: 'Nao foi possivel enriquecer itens de importacao recente agora.' });
    }
  });

  router.get('/api/admin/catalogo/enriquecimento/logs', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const resultado = await listarEnrichmentLogs(pool, req.query || {});
      return res.json(resultado);
    } catch (erro) {
      logger.error('Erro ao listar logs de enriquecimento:', erro);
      return res.status(500).json({ erro: 'Nao foi possivel carregar os logs de enriquecimento.' });
    }
  });

  router.get('/api/admin/catalogo/importacoes', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const resultado = await listarImportLogs(pool, req.query || {});
      return res.json(resultado);
    } catch (erro) {
      logger.error('Erro ao listar logs de importacao (catalogo):', erro);
      return res.status(500).json({ erro: 'Nao foi possivel carregar os logs de importacao.' });
    }
  });

  router.get('/api/admin/catalogo/produtos/importacao/modelo', exigirAcessoLocalAdmin, autenticarAdminToken, (req, res) => {
    const csvModelo = construirModeloImportacaoProdutosCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="modelo-importacao-produtos.csv"');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(`\uFEFF${csvModelo}`);
  });

  router.post(
    '/api/admin/catalogo/produtos/importar',
    exigirAcessoLocalAdmin,
    autenticarAdminToken,
    middlewareUploadImportacaoProdutos,
    processarImportacaoProdutosAdmin
  );

  router.get('/api/admin/catalogo/produtos/exportar.xlsx', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const resultado = await exportarProdutosParaExcel(pool, req.query || {});
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${resultado.fileName}"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(resultado.buffer);
    } catch (erro) {
      logger.error('Erro ao exportar produtos para excel:', erro);
      return res.status(500).json({ erro: 'Nao foi possivel exportar os produtos agora.' });
    }
  });

  // ---- Rotas legacy /api/admin/produtos (compat) ----

  router.get('/api/admin/produtos/barcode/:codigo', exigirAcessoLocalAdmin, autenticarAdminToken, responderBuscaProdutoPorCodigoBarrasAdmin);

  // Buscar produto por ID (público)
  router.get('/api/produtos/:id', async (req, res) => {
    try {
      const colunas = await obterColunasProdutos();
      const campos = [
        'id',
        'nome',
        colunas.has('nome_externo') ? 'nome_externo' : 'NULL AS nome_externo',
        colunas.has('descricao') ? 'descricao' : 'NULL AS descricao',
        colunas.has('preco') ? 'preco' : '0 AS preco',
        colunas.has('preco_promocional') ? 'preco_promocional' : 'NULL AS preco_promocional',
        colunas.has('unidade') ? 'unidade' : 'NULL AS unidade',
        colunas.has('categoria') ? 'categoria' : 'NULL AS categoria',
        colunas.has('imagem_url') ? 'imagem_url' : 'NULL AS imagem_url',
        colunas.has('estoque') ? 'estoque' : '0 AS estoque',
        colunas.has('ativo') ? 'ativo' : 'TRUE AS ativo',
        colunas.has('codigo_barras') ? 'codigo_barras' : 'NULL AS codigo_barras',
        colunas.has('marca') ? 'marca' : 'NULL AS marca',
        colunas.has('peso_liquido') ? 'peso_liquido' : 'NULL AS peso_liquido',
        colunas.has('ingredientes') ? 'ingredientes' : 'NULL AS ingredientes',
        colunas.has('informacao_nutricional') ? 'informacao_nutricional' : 'NULL AS informacao_nutricional',
        colunas.has('origem') ? 'origem' : 'NULL AS origem',
        colunas.has('data_validade') ? 'data_validade' : 'NULL AS data_validade',
        colunas.has('unidade_venda') ? 'unidade_venda' : 'NULL AS unidade_venda',
        colunas.has('peso_min_gramas') ? 'peso_min_gramas' : 'NULL AS peso_min_gramas',
        colunas.has('peso_step_gramas') ? 'peso_step_gramas' : 'NULL AS peso_step_gramas',
        colunas.has('peso_padrao_gramas') ? 'peso_padrao_gramas' : 'NULL AS peso_padrao_gramas',
        colunas.has('permite_fracionado') ? 'permite_fracionado' : 'NULL AS permite_fracionado',
        colunas.has('requer_maioridade') ? 'requer_maioridade' : 'NULL AS requer_maioridade',
        colunas.has('visivel_no_site') ? 'visivel_no_site' : 'NULL AS visivel_no_site',
        colunas.has('oculto_catalogo') ? 'oculto_catalogo' : 'NULL AS oculto_catalogo',
        colunas.has('produto_controlado') ? 'produto_controlado' : 'NULL AS produto_controlado'
      ];

      const [produtos] = await pool.query(
        `SELECT ${campos.join(', ')}
         FROM produtos
         WHERE id = ? AND ativo = TRUE
         LIMIT 1`,
        [req.params.id]
      );

      if (produtos.length === 0) {
        return res.status(404).json({ erro: 'Produto nao encontrado.' });
      }

      const produto = enriquecerProdutoParaCatalogo(produtos[0]);
      const visibilidade = resolveVisibilidadePublica(produto);
      if (!visibilidade?.visivel_publico) {
        return res.status(404).json({ erro: 'Produto nao encontrado.' });
      }

      res.json({ produto });
    } catch (erro) {
      logger.error('Erro ao buscar produto:', erro);
      res.status(500).json({ erro: 'Nao foi possivel carregar este produto.' });
    }
  });
// Cadastrar produto (admin)
  router.post('/api/admin/produtos', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const {
        nome,
        preco,
        unidade,
        categoria,
        emoji,
        estoque,
        descricao,
        marca,
        codigo_barras,
        imagem
      } = req.body;

      if (!nome || !preco || !unidade || !categoria) {
        return res.status(400).json({ erro: 'Preencha os campos obrigatórios do produto.' });
      }

      const colunas = await obterColunasProdutos();
      const insertCols = ['nome', 'preco', 'unidade', 'categoria', 'emoji', 'estoque', 'ativo'];
      const valores = [nome, preco, unidade, categoria, emoji || '📦', estoque || 0, true];

      if (colunas.has('descricao')) {
        insertCols.push('descricao');
        valores.push(descricao || null);
      }

      if (colunas.has('marca')) {
        insertCols.push('marca');
        valores.push(marca || null);
      }

      if (colunas.has('codigo_barras')) {
        insertCols.push('codigo_barras');
        valores.push(codigo_barras || null);
      }

      if (colunas.has('imagem_url')) {
        insertCols.push('imagem_url');
        valores.push(imagem || null);
      }

      const placeholders = insertCols.map(() => '?').join(', ');
      const [resultado] = await pool.query(
        `INSERT INTO produtos (${insertCols.join(', ')}) VALUES (${placeholders})`,
        valores
      );

      limparCacheProdutos();

      res.status(201).json({
        mensagem: 'Produto cadastrado com sucesso',
        produto_id: resultado.insertId
      });
    } catch (erro) {
      logger.error('Erro ao cadastrar produto:', erro);
      res.status(500).json({ erro: 'Não foi possível cadastrar o produto.' });
    }
  });

  // Importação em massa de produtos (admin)
  router.post('/api/admin/produtos/bulk', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    const connection = await pool.getConnection();

    try {
      const { produtos } = req.body;

      if (!produtos || !Array.isArray(produtos) || produtos.length === 0) {
        return res.status(400).json({ erro: 'Envie uma lista válida de produtos para importação.' });
      }

      await connection.beginTransaction();

      let importados = 0;
      for (const produto of produtos) {
        if (!produto.nome || !produto.preco || !produto.unidade || !produto.categoria) {
          continue;
        }

        await connection.query(
          'INSERT INTO produtos (nome, preco, unidade, categoria, emoji, estoque, ativo) VALUES (?, ?, ?, ?, ?, ?, TRUE)',
          [produto.nome, produto.preco, produto.unidade, produto.categoria, produto.emoji || '📦', produto.estoque || 0]
        );

        importados++;
      }

      await connection.commit();
      limparCacheProdutos();

      res.status(201).json({
        mensagem: 'Produtos importados com sucesso',
        total_importados: importados
      });
    } catch (erro) {
      await connection.rollback();
      logger.error('Erro ao importar produtos:', erro);
      res.status(500).json({ erro: 'Não foi possível importar os produtos.' });
    } finally {
      connection.release();
    }
  });

  router.get('/api/admin/produtos/importacao/modelo', exigirAcessoLocalAdmin, autenticarAdminToken, (req, res) => {
    const csvModelo = construirModeloImportacaoProdutosCsv();

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="modelo-importacao-produtos.csv"');
    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).send(`\uFEFF${csvModelo}`);
  });

  router.get('/api/admin/produtos/importacoes', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const page = parsePositiveInt(req.query?.page || req.query?.pagina, 1, { min: 1, max: 500000 });
      const limit = parsePositiveInt(req.query?.limit || req.query?.limite, 20, { min: 1, max: 100 });

      const resultado = await listarImportacoesProdutos({
        pool,
        page,
        limit
      });

      return res.json(resultado);
    } catch (erro) {
      logger.error('Erro ao listar histórico de importações de produtos:', erro);
      return res.status(500).json({
        erro: 'Não foi possível carregar o histórico de importações agora.'
      });
    }
  });

  router.post(
    '/api/admin/produtos/importar',
    exigirAcessoLocalAdmin,
    autenticarAdminToken,
    middlewareUploadImportacaoProdutos,
    processarImportacaoProdutosAdmin
  );

  // Excluir produto (admin) - soft delete
  router.delete('/api/admin/produtos/:id', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      await pool.query(
        'UPDATE produtos SET ativo = FALSE WHERE id = ?',
        [req.params.id]
      );

      limparCacheProdutos();

      res.json({ mensagem: 'Produto removido com sucesso.' });
    } catch (erro) {
      logger.error('Erro ao excluir produto:', erro);
      res.status(500).json({ erro: 'Não foi possível remover o produto.' });
    }
  });

  return router;
};

