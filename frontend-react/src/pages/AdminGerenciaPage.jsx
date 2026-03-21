import React, { useEffect, useMemo, useState } from 'react';
import {
  adminBaixarCatalogModeloImportacao,
  adminBaixarCatalogoExportacao,
  adminBuscarProdutoPorCodigoBarras,
  adminEnriquecerProdutoCatalogo,
  adminGetCatalogDashboard,
  adminGetCatalogImportLogs,
  adminGetEnriquecimentoLogs,
  adminGetMe,
  adminEnriquecerImportacaoRecente,
  adminEnriquecerProdutosSemImagem,
  adminImportarCatalogoPlanilha,
  adminListarCatalogoProdutos,
  adminLogin,
  adminLogout,
  adminReprocessarFalhasEnriquecimento,
  adminAtualizarProdutoCatalogo
} from '../lib/api';
import useDebouncedValue from '../hooks/useDebouncedValue';
import {
  PRODUTOS_POR_PAGINA,
  TABS,
  EXTENSOES_IMPORTACAO_ACEITAS_PADRAO,
  ESTADOS_FLUXO_IMPORTACAO,
  POLITICAS_IMAGEM,
  estadoInicialFiltro,
  estadoInicialEdicao,
  estadoInicialMapeamento,
  carregarModuloImportacaoPlanilha,
  formatarMoeda,
  formatarData,
  normalizarStatusEnriquecimento,
  extrairMensagemErro,
  isAuthApiError,
  dispararDownloadBrowser,
  formatarPercentual,
  formatarTamanhoArquivoFallback,
  gerarNomeRelatorioImportacao,
  normalizarNomeArquivoExibicao,
  construirMapeamentoPayload,
  validarMapeamentoObrigatorioFallback,
  gerarAssinaturaContextoImportacao,
  montarResumoDetalhesFalhaImportacao,
  clampInt
} from '../lib/adminGerenciaUtils';
import { GerenciaDashboardTab, GerenciaProdutosTab, GerenciaImportarTab, GerenciaExportarTab, GerenciaEnriquecimentoTab, GerenciaLogsTab } from '../components/admin/gerencia';

export default function AdminGerenciaPage() {
  const [adminUsuario, setAdminUsuario] = useState('admin');
  const [adminSenha, setAdminSenha] = useState('');
  const [adminAutenticado, setAdminAutenticado] = useState(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [tab, setTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [carregandoDashboard, setCarregandoDashboard] = useState(false);

  const [produtos, setProdutos] = useState([]);
  const [carregandoProdutos, setCarregandoProdutos] = useState(false);
  const [paginacaoProdutos, setPaginacaoProdutos] = useState({
    pagina: 1,
    limite: PRODUTOS_POR_PAGINA,
    total: 0,
    total_paginas: 1,
    tem_mais: false
  });
  const [filtros, setFiltros] = useState(estadoInicialFiltro);
  const buscaDebounced = useDebouncedValue(filtros.search, 350);

  const [edicaoProduto, setEdicaoProduto] = useState(estadoInicialEdicao);
  const [salvandoProduto, setSalvandoProduto] = useState(false);
  const [enriquecendoProdutoId, setEnriquecendoProdutoId] = useState(null);

  const [arquivoPlanilha, setArquivoPlanilha] = useState(null);
  const [importacaoCriarNovos, setImportacaoCriarNovos] = useState(true);
  const [importacaoAtualizarEstoque, setImportacaoAtualizarEstoque] = useState(false);
  const [mapeamentoColunas, setMapeamentoColunas] = useState(estadoInicialMapeamento);
  const [estadoFluxoImportacao, setEstadoFluxoImportacao] = useState(ESTADOS_FLUXO_IMPORTACAO.IDLE);
  const [passoImportacaoAtivo, setPassoImportacaoAtivo] = useState(1);
  const [leituraPlanilha, setLeituraPlanilha] = useState(null);
  const [erroLeituraPlanilha, setErroLeituraPlanilha] = useState('');
  const [previewImportacao, setPreviewImportacao] = useState(null);
  const [processandoLeituraPlanilha, setProcessandoLeituraPlanilha] = useState(false);
  const [dragUploadAtivo, setDragUploadAtivo] = useState(false);
  const [importandoPlanilha, setImportandoPlanilha] = useState(false);
  const [modoImportacaoAtual, setModoImportacaoAtual] = useState('');
  const [progressoImportacao, setProgressoImportacao] = useState(0);
  const [baixandoModelo, setBaixandoModelo] = useState(false);
  const [baixandoExportacao, setBaixandoExportacao] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState(null);
  const [assinaturaSimulacaoValida, setAssinaturaSimulacaoValida] = useState('');
  const [historicoImportacoesRecentes, setHistoricoImportacoesRecentes] = useState([]);
  const [carregandoHistoricoImportacao, setCarregandoHistoricoImportacao] = useState(false);

  const [barcodeManual, setBarcodeManual] = useState('');
  const [resultadoLookupManual, setResultadoLookupManual] = useState(null);
  const [buscandoBarcode, setBuscandoBarcode] = useState(false);
  const [overwriteImageMode, setOverwriteImageMode] = useState('if_empty');
  const [loteLimite, setLoteLimite] = useState(80);
  const [loteConcorrencia, setLoteConcorrencia] = useState(3);
  const [janelaImportacaoMinutos, setJanelaImportacaoMinutos] = useState(180);
  const [forcarLookupLote, setForcarLookupLote] = useState(false);
  const [somenteSemImagemImportacaoRecente, setSomenteSemImagemImportacaoRecente] = useState(true);
  const [enriquecerPosImportacao, setEnriquecerPosImportacao] = useState(false);
  const [enriquecerPosImportacaoSomenteSemImagem, setEnriquecerPosImportacaoSomenteSemImagem] = useState(true);
  const [reprocessandoFalhas, setReprocessandoFalhas] = useState(false);
  const [resultadoReprocessamento, setResultadoReprocessamento] = useState(null);
  const [executandoLoteSemImagem, setExecutandoLoteSemImagem] = useState(false);
  const [resultadoLoteSemImagem, setResultadoLoteSemImagem] = useState(null);
  const [executandoLoteImportacaoRecente, setExecutandoLoteImportacaoRecente] = useState(false);
  const [resultadoLoteImportacaoRecente, setResultadoLoteImportacaoRecente] = useState(null);

  const [importLogs, setImportLogs] = useState([]);
  const [enrichmentLogs, setEnrichmentLogs] = useState([]);
  const [carregandoLogs, setCarregandoLogs] = useState(false);
  const [importacaoUtils, setImportacaoUtils] = useState(null);
  const [carregandoImportacaoUtils, setCarregandoImportacaoUtils] = useState(false);
  const [falhaCarregamentoImportacaoUtils, setFalhaCarregamentoImportacaoUtils] = useState(false);

  const extensoesImportacaoAceitas = useMemo(() => {
    const extensoesDoModulo = importacaoUtils?.EXTENSOES_IMPORTACAO_ACEITAS;
    if (Array.isArray(extensoesDoModulo) && extensoesDoModulo.length > 0) {
      return extensoesDoModulo;
    }

    return EXTENSOES_IMPORTACAO_ACEITAS_PADRAO;
  }, [importacaoUtils]);

  const textoExtensoesImportacao = useMemo(
    () => extensoesImportacaoAceitas.join(', '),
    [extensoesImportacaoAceitas]
  );

  const camposImportacaoLabel = importacaoUtils?.CAMPOS_IMPORTACAO_LABEL || {};
  const formatarTamanhoArquivoImportacao = importacaoUtils?.formatarTamanhoArquivo || formatarTamanhoArquivoFallback;
  const extrairMapeamentoNormalizadoFn = importacaoUtils?.extrairMapeamentoNormalizado;
  const validarMapeamentoObrigatorioFn = importacaoUtils?.validarMapeamentoObrigatorio;

  const mapeamentoPayload = useMemo(
    () => construirMapeamentoPayload(mapeamentoColunas, extrairMapeamentoNormalizadoFn),
    [mapeamentoColunas, extrairMapeamentoNormalizadoFn]
  );

  const validacaoMapeamento = useMemo(
    () => {
      const validar = typeof validarMapeamentoObrigatorioFn === 'function'
        ? validarMapeamentoObrigatorioFn
        : validarMapeamentoObrigatorioFallback;

      return validar(mapeamentoPayload);
    },
    [mapeamentoPayload, validarMapeamentoObrigatorioFn]
  );

  const assinaturaImportacaoAtual = useMemo(
    () => gerarAssinaturaContextoImportacao({
      arquivo: arquivoPlanilha,
      mapeamento: mapeamentoPayload,
      criarNovos: importacaoCriarNovos,
      atualizarEstoque: importacaoAtualizarEstoque
    }),
    [arquivoPlanilha, mapeamentoPayload, importacaoCriarNovos, importacaoAtualizarEstoque]
  );

  const simulacaoOficialConcluida = useMemo(
    () => Boolean(assinaturaSimulacaoValida) && assinaturaSimulacaoValida === assinaturaImportacaoAtual,
    [assinaturaSimulacaoValida, assinaturaImportacaoAtual]
  );

  const progressoImportacaoFormatado = useMemo(
    () => formatarPercentual(progressoImportacao),
    [progressoImportacao]
  );

  const nomeArquivoExibicao = useMemo(() => {
    if (leituraPlanilha?.nomeArquivo) {
      return normalizarNomeArquivoExibicao(leituraPlanilha.nomeArquivo);
    }

    return normalizarNomeArquivoExibicao(arquivoPlanilha?.name || '');
  }, [arquivoPlanilha, leituraPlanilha]);

  const leituraConcluida = Boolean(leituraPlanilha);

  const podeAvancarPassoImportacao = useMemo(() => {
    if (processandoLeituraPlanilha) {
      return false;
    }

    switch (passoImportacaoAtivo) {
      case 1:
        return leituraConcluida;
      case 2:
        return leituraConcluida;
      case 3:
        return leituraConcluida && validacaoMapeamento.ok;
      case 4:
        return leituraConcluida && validacaoMapeamento.ok;
      case 5:
        return Boolean(resultadoImportacao);
      default:
        return false;
    }
  }, [
    processandoLeituraPlanilha,
    passoImportacaoAtivo,
    leituraConcluida,
    validacaoMapeamento.ok,
    resultadoImportacao
  ]);

  const passoImportacaoMaximoLiberado = useMemo(() => {
    switch (estadoFluxoImportacao) {
      case ESTADOS_FLUXO_IMPORTACAO.READ_SUCCESS:
        return 2;
      case ESTADOS_FLUXO_IMPORTACAO.MAPPING_READY:
        return 3;
      case ESTADOS_FLUXO_IMPORTACAO.PREVIEW_READY:
        return 4;
      case ESTADOS_FLUXO_IMPORTACAO.IMPORTING:
        return 5;
      case ESTADOS_FLUXO_IMPORTACAO.FINISHED:
        return 6;
      default:
        return 1;
    }
  }, [estadoFluxoImportacao]);

  async function garantirImportacaoUtils() {
    if (importacaoUtils) {
      return importacaoUtils;
    }

    setCarregandoImportacaoUtils(true);
    setFalhaCarregamentoImportacaoUtils(false);
    try {
      const modulo = await carregarModuloImportacaoPlanilha();
      setImportacaoUtils(modulo);
      return modulo;
    } catch {
      importacaoPlanilhaModulePromise = null;
      setFalhaCarregamentoImportacaoUtils(true);
      throw new Error('Nao foi possivel carregar os recursos de importacao de planilha.');
    } finally {
      setCarregandoImportacaoUtils(false);
    }
  }

  function tratarErroApi(error) {
    if (isAuthApiError(error)) {
      setAdminAutenticado(false);
      return;
    }

    setErro(extrairMensagemErro(error));
  }

  async function validarSessaoAdmin() {
    setCarregandoSessao(true);
    setErro('');

    try {
      const data = await adminGetMe();
      setAdminAutenticado(true);
      if (data?.admin?.usuario) {
        setAdminUsuario(String(data.admin.usuario));
      }
    } catch (error) {
      tratarErroApi(error);
    } finally {
      setCarregandoSessao(false);
    }
  }

  async function carregarDashboard() {
    if (adminAutenticado !== true) return;

    setCarregandoDashboard(true);
    try {
      const data = await adminGetCatalogDashboard();
      setDashboard(data?.dashboard || null);
    } catch (error) {
      tratarErroApi(error);
    } finally {
      setCarregandoDashboard(false);
    }
  }

  async function carregarProdutos(paginaDestino = 1) {
    if (adminAutenticado !== true) return;

    setCarregandoProdutos(true);
    setErro('');

    try {
      const data = await adminListarCatalogoProdutos({
        page: paginaDestino,
        limit: PRODUTOS_POR_PAGINA,
        search: buscaDebounced,
        com_imagem: filtros.com_imagem,
        enrichment_status: filtros.enrichment_status,
        com_erro: filtros.com_erro,
        com_preco: filtros.com_preco,
        orderBy: filtros.orderBy,
        orderDir: filtros.orderDir
      });

      setProdutos(Array.isArray(data?.produtos) ? data.produtos : []);
      setPaginacaoProdutos(data?.paginacao || {
        pagina: 1,
        limite: PRODUTOS_POR_PAGINA,
        total: 0,
        total_paginas: 1,
        tem_mais: false
      });
    } catch (error) {
      tratarErroApi(error);
    } finally {
      setCarregandoProdutos(false);
    }
  }

  async function carregarLogs() {
    if (adminAutenticado !== true) return;

    setCarregandoLogs(true);
    setErro('');

    try {
      const [logsImport, logsEnrichment] = await Promise.all([
        adminGetCatalogImportLogs({ page: 1, limit: 20 }),
        adminGetEnriquecimentoLogs({ page: 1, limit: 20 })
      ]);

      setImportLogs(Array.isArray(logsImport?.logs) ? logsImport.logs : []);
      setEnrichmentLogs(Array.isArray(logsEnrichment?.logs) ? logsEnrichment.logs : []);
    } catch (error) {
      tratarErroApi(error);
    } finally {
      setCarregandoLogs(false);
    }
  }

  async function carregarHistoricoImportacaoRecente() {
    if (adminAutenticado !== true) {
      return;
    }

    setCarregandoHistoricoImportacao(true);
    try {
      const data = await adminGetCatalogImportLogs({ page: 1, limit: 8 });
      setHistoricoImportacoesRecentes(Array.isArray(data?.logs) ? data.logs : []);
    } catch (error) {
      tratarErroApi(error);
    } finally {
      setCarregandoHistoricoImportacao(false);
    }
  }

  function limparEstadoWizardImportacao() {
    setArquivoPlanilha(null);
    setLeituraPlanilha(null);
    setErroLeituraPlanilha('');
    setPreviewImportacao(null);
    setMapeamentoColunas(estadoInicialMapeamento);
    setResultadoImportacao(null);
    setAssinaturaSimulacaoValida('');
    setImportandoPlanilha(false);
    setProcessandoLeituraPlanilha(false);
    setEstadoFluxoImportacao(ESTADOS_FLUXO_IMPORTACAO.IDLE);
    setProgressoImportacao(0);
    setModoImportacaoAtual('');
    setPassoImportacaoAtivo(1);
  }

  async function processarArquivoImportacaoSelecionado(file) {
    setErro('');
    setMensagem('');
    setResultadoImportacao(null);
    setAssinaturaSimulacaoValida('');

    if (!file) {
      limparEstadoWizardImportacao();
      return;
    }

    setLeituraPlanilha(null);
    setPreviewImportacao(null);
    setMapeamentoColunas(estadoInicialMapeamento);
    setErroLeituraPlanilha('');
    setImportandoPlanilha(false);
    setModoImportacaoAtual('');
    setProgressoImportacao(0);
    setEstadoFluxoImportacao(ESTADOS_FLUXO_IMPORTACAO.FILE_SELECTED);
    setArquivoPlanilha(file);
    setProcessandoLeituraPlanilha(true);
    setPassoImportacaoAtivo(1);

    try {
      setEstadoFluxoImportacao(ESTADOS_FLUXO_IMPORTACAO.READING);
      const utils = await garantirImportacaoUtils();
      const lerEValidarArquivoImportacaoFn = utils?.lerEValidarArquivoImportacao;

      if (typeof lerEValidarArquivoImportacaoFn !== 'function') {
        throw new Error('Nao foi possivel carregar o leitor de planilha.');
      }

      const leitura = await lerEValidarArquivoImportacaoFn(file);
      setLeituraPlanilha(leitura);

      const mapeamentoInicial = {
        ...estadoInicialMapeamento,
        ...(leitura?.mapeamentoSugerido || {})
      };

      setMapeamentoColunas(mapeamentoInicial);
      setErroLeituraPlanilha('');
      setEstadoFluxoImportacao(ESTADOS_FLUXO_IMPORTACAO.READ_SUCCESS);
      setMensagem('Planilha lida com sucesso. Revise o mapeamento antes de importar.');
      setPassoImportacaoAtivo(2);
    } catch (error) {
      const mensagemErro = extrairMensagemErro(error);
      setLeituraPlanilha(null);
      setPreviewImportacao(null);
      setErroLeituraPlanilha(mensagemErro);
      setEstadoFluxoImportacao(ESTADOS_FLUXO_IMPORTACAO.READ_ERROR);
      setPassoImportacaoAtivo(1);
      setErro(mensagemErro);
    } finally {
      setProcessandoLeituraPlanilha(false);
    }
  }

  function handleArquivoSelecionadoInput(event) {
    const file = event.target.files?.[0] || null;
    void processarArquivoImportacaoSelecionado(file);
    event.target.value = '';
  }

  function handleDragOverImportacao(event) {
    event.preventDefault();
    event.stopPropagation();
    setDragUploadAtivo(true);
  }

  function handleDragLeaveImportacao(event) {
    event.preventDefault();
    event.stopPropagation();
    setDragUploadAtivo(false);
  }

  function handleDropImportacao(event) {
    event.preventDefault();
    event.stopPropagation();
    setDragUploadAtivo(false);

    const file = event.dataTransfer?.files?.[0] || null;
    void processarArquivoImportacaoSelecionado(file);
  }

  function handleAtualizarMapeamento(campo, valor) {
    setAssinaturaSimulacaoValida('');
    setResultadoImportacao(null);
    setMapeamentoColunas((atual) => {
      const valorNormalizado = String(valor || '');
      const proximo = {
        ...atual,
        [campo]: valorNormalizado
      };

      // Permite reutilizar a mesma coluna para nome e descricao sem obrigar dupla selecao manual.
      if (campo === 'nome' && !proximo.descricao && valorNormalizado) {
        proximo.descricao = valorNormalizado;
      }

      if (campo === 'descricao' && !proximo.nome && valorNormalizado) {
        proximo.nome = valorNormalizado;
      }

      return proximo;
    });
  }

  async function handleBaixarRelatorioImportacao() {
    if (!resultadoImportacao) {
      setErro('Nao ha resultado de importacao para gerar relatorio.');
      return;
    }

    try {
      const utils = await garantirImportacaoUtils();
      const gerarCsvRelatorioImportacaoFn = utils?.gerarCsvRelatorioImportacao;

      if (typeof gerarCsvRelatorioImportacaoFn !== 'function') {
        throw new Error('Nao foi possivel gerar o relatorio da importacao.');
      }

      const relatorio = gerarCsvRelatorioImportacaoFn(resultadoImportacao, gerarNomeRelatorioImportacao());
      dispararDownloadBrowser(relatorio.blob, relatorio.fileName);
      setMensagem('Relatorio de importacao baixado com sucesso.');
    } catch (error) {
      setErro(extrairMensagemErro(error));
    }
  }

  function avancarPassoImportacao() {
    if (passoImportacaoAtivo === 1) {
      if (!arquivoPlanilha) {
        setErro(`Selecione um arquivo (${textoExtensoesImportacao}) para continuar.`);
        return;
      }

      if (processandoLeituraPlanilha || estadoFluxoImportacao === ESTADOS_FLUXO_IMPORTACAO.READING) {
        setErro('Aguarde a leitura da planilha terminar para continuar.');
        return;
      }

      if (!leituraConcluida) {
        setErro(erroLeituraPlanilha || 'Nao foi possivel concluir a leitura da planilha. Reenvie o arquivo.');
        return;
      }

      setPassoImportacaoAtivo(2);
      return;
    }

    if (passoImportacaoAtivo === 2) {
      if (!leituraConcluida) {
        setErro('Conclua a leitura da planilha para habilitar o mapeamento.');
        return;
      }

      setPassoImportacaoAtivo(3);
      return;
    }

    if (passoImportacaoAtivo === 3) {
      if (!validacaoMapeamento.ok) {
        setErro(validacaoMapeamento.pendencias[0] || 'Revise o mapeamento das colunas obrigatorias.');
        return;
      }

      setPassoImportacaoAtivo(4);
      return;
    }

    if (passoImportacaoAtivo === 4) {
      if (!leituraConcluida || !validacaoMapeamento.ok) {
        setErro('Revise leitura e mapeamento obrigatorio antes de abrir a etapa de importacao.');
        return;
      }

      setPassoImportacaoAtivo(5);
      return;
    }

    if (passoImportacaoAtivo === 5) {
      if (resultadoImportacao) {
        setPassoImportacaoAtivo(6);
        return;
      }

      setErro('Execute uma simulacao ou importacao para concluir o fluxo.');
      return;
    }

    setPassoImportacaoAtivo((atual) => Math.min(6, atual + 1));
  }

  function voltarPassoImportacao() {
    setPassoImportacaoAtivo((atual) => Math.max(1, atual - 1));
  }

  function irParaPassoImportacao(passo) {
    const destino = Number(passo || 1);
    if (!Number.isFinite(destino)) {
      return;
    }

    if (destino > passoImportacaoMaximoLiberado) {
      return;
    }

    setPassoImportacaoAtivo(Math.max(1, Math.min(6, destino)));
  }

  async function executarImportacao({ simular = false } = {}) {
    setErro('');
    setMensagem('');

    if (!arquivoPlanilha) {
      setErro(`Selecione um arquivo (${textoExtensoesImportacao}) para importar.`);
      return;
    }

    if (!leituraPlanilha) {
      setErro('Nao foi possivel preparar o arquivo. Refaça o upload da planilha.');
      return;
    }

    if (!validacaoMapeamento.ok) {
      setErro(validacaoMapeamento.pendencias[0] || 'Revise as colunas obrigatorias antes de importar.');
      return;
    }

    if (!simular && !simulacaoOficialConcluida) {
      setErro('Execute a simulacao oficial com o arquivo e mapeamento atuais antes da importacao final.');
      return;
    }

    const mapeamentoNormalizado = mapeamentoPayload;
    const assinaturaContextoAtual = assinaturaImportacaoAtual;
    const limiteProgresso = simular ? 92 : 95;
    const incremento = simular ? 6 : 4;

    setImportandoPlanilha(true);
    setEstadoFluxoImportacao(ESTADOS_FLUXO_IMPORTACAO.IMPORTING);
    setModoImportacaoAtual(simular ? 'simulacao' : 'importacao');
    setProgressoImportacao(simular ? 20 : 12);

    let timer = null;
    if (typeof window !== 'undefined') {
      timer = window.setInterval(() => {
        setProgressoImportacao((valorAtual) => {
          if (valorAtual >= limiteProgresso) {
            return valorAtual;
          }
          return Math.min(limiteProgresso, valorAtual + incremento);
        });
      }, 280);
    }

    try {
      const resultado = await adminImportarCatalogoPlanilha({
        arquivo: arquivoPlanilha,
        criarNovos: importacaoCriarNovos,
        simular,
        atualizarEstoque: importacaoAtualizarEstoque,
        mapeamentoColunas: Object.keys(mapeamentoNormalizado).length ? mapeamentoNormalizado : null,
        overwriteImageMode,
        enriquecerPosImportacao,
        enriquecerApenasSemImagem: enriquecerPosImportacaoSomenteSemImagem,
        enriquecerLimite: clampInt(loteLimite, 80, { min: 1, max: 800 }),
        enriquecerConcorrencia: clampInt(loteConcorrencia, 3, { min: 1, max: 10 }),
        enriquecerForceLookup: forcarLookupLote,
        enriquecerJanelaMinutos: clampInt(janelaImportacaoMinutos, 180, { min: 5, max: 43200 })
      });

      setResultadoImportacao(resultado);
      setProgressoImportacao(100);

      if (simular) {
        setAssinaturaSimulacaoValida(assinaturaContextoAtual);
        setMensagem('Simulacao concluida. Revise os indicadores antes da importacao final.');
        setEstadoFluxoImportacao(ESTADOS_FLUXO_IMPORTACAO.PREVIEW_READY);
        setPassoImportacaoAtivo(5);
      } else {
        setMensagem('Importacao concluida com sucesso.');
        setEstadoFluxoImportacao(ESTADOS_FLUXO_IMPORTACAO.FINISHED);
        setPassoImportacaoAtivo(6);
        await Promise.all([
          carregarProdutos(1),
          carregarDashboard(),
          carregarLogs(),
          carregarHistoricoImportacaoRecente()
        ]);
      }
    } catch (error) {
      if (leituraConcluida) {
        setEstadoFluxoImportacao(
          validacaoMapeamento.ok
            ? ESTADOS_FLUXO_IMPORTACAO.PREVIEW_READY
            : ESTADOS_FLUXO_IMPORTACAO.MAPPING_READY
        );
      }

      if (isAuthApiError(error)) {
        tratarErroApi(error);
      } else {
        const detalhes = error?.payload?.detalhes && typeof error.payload.detalhes === 'object'
          ? error.payload.detalhes
          : {};
        const resumoTecnico = montarResumoDetalhesFalhaImportacao(detalhes);
        const sufixo = resumoTecnico ? ` (${resumoTecnico})` : '';
        setErro(`Falha na importacao: ${extrairMensagemErroImportacaoReal(error)}${sufixo}`);
      }
    } finally {
      if (timer) {
        clearInterval(timer);
      }

      setImportandoPlanilha(false);
      setModoImportacaoAtual('');
      setTimeout(() => {
        setProgressoImportacao(0);
      }, 900);
    }
  }

  useEffect(() => {
    void validarSessaoAdmin();
  }, []);

  useEffect(() => {
    if (adminAutenticado !== true) return;
    void carregarDashboard();
  }, [adminAutenticado]);

  useEffect(() => {
    if (adminAutenticado !== true) return;
    void carregarProdutos(1);
  }, [adminAutenticado, buscaDebounced, filtros.com_imagem, filtros.enrichment_status, filtros.com_erro, filtros.com_preco, filtros.orderBy, filtros.orderDir]);

  useEffect(() => {
    if (adminAutenticado !== true) return;
    if (tab === 'logs') {
      void carregarLogs();
    }

    if (tab === 'importar') {
      void carregarHistoricoImportacaoRecente();

      if (!importacaoUtils && !carregandoImportacaoUtils && !falhaCarregamentoImportacaoUtils) {
        setCarregandoImportacaoUtils(true);
        void carregarModuloImportacaoPlanilha()
          .then((modulo) => {
            setImportacaoUtils(modulo);
          })
          .catch(() => {
            importacaoPlanilhaModulePromise = null;
            setFalhaCarregamentoImportacaoUtils(true);
          })
          .finally(() => {
            setCarregandoImportacaoUtils(false);
          });
      }
    }
  }, [adminAutenticado, tab, importacaoUtils, carregandoImportacaoUtils, falhaCarregamentoImportacaoUtils]);

  useEffect(() => {
    if (!leituraPlanilha) {
      setPreviewImportacao(null);
      return;
    }

    if (!importacaoUtils || typeof importacaoUtils.construirPreviewImportacao !== 'function') {
      setPreviewImportacao(null);
      return;
    }

    const preview = importacaoUtils.construirPreviewImportacao({
      cabecalhos: leituraPlanilha.cabecalhos,
      linhasDados: leituraPlanilha.linhasDados,
      mapeamento: mapeamentoPayload,
      maxLinhas: 16
    });

    setPreviewImportacao(preview);

    if (importandoPlanilha || estadoFluxoImportacao === ESTADOS_FLUXO_IMPORTACAO.IMPORTING) {
      return;
    }

    if (resultadoImportacao) {
      setEstadoFluxoImportacao(ESTADOS_FLUXO_IMPORTACAO.FINISHED);
      return;
    }

    if (validacaoMapeamento.ok) {
      setEstadoFluxoImportacao(ESTADOS_FLUXO_IMPORTACAO.PREVIEW_READY);
      return;
    }

    setEstadoFluxoImportacao(ESTADOS_FLUXO_IMPORTACAO.MAPPING_READY);
  }, [
    leituraPlanilha,
    importacaoUtils,
    mapeamentoPayload,
    importandoPlanilha,
    estadoFluxoImportacao,
    resultadoImportacao,
    validacaoMapeamento.ok
  ]);

  useEffect(() => {
    if (passoImportacaoAtivo <= passoImportacaoMaximoLiberado) {
      return;
    }

    setPassoImportacaoAtivo(passoImportacaoMaximoLiberado);
  }, [passoImportacaoAtivo, passoImportacaoMaximoLiberado]);

  async function handleLogin(event) {
    event.preventDefault();
    setCarregandoSessao(true);
    setErro('');

    try {
      await adminLogin(adminUsuario.trim(), adminSenha);
      setAdminAutenticado(true);
      setAdminSenha('');
      setMensagem('Acesso administrativo concedido.');
    } catch (error) {
      setAdminAutenticado(false);
      setErro(extrairMensagemErro(error));
    } finally {
      setCarregandoSessao(false);
    }
  }

  async function handleLogout() {
    setErro('');
    setMensagem('');

    try {
      await adminLogout();
    } catch {
      // segue fluxo de encerramento local mesmo se API falhar
    }

    setAdminAutenticado(false);
    setDashboard(null);
    setProdutos([]);
    setImportLogs([]);
    setEnrichmentLogs([]);
    setResultadoImportacao(null);
    setResultadoReprocessamento(null);
    setResultadoLoteSemImagem(null);
    setResultadoLoteImportacaoRecente(null);
    setEdicaoProduto(estadoInicialEdicao);
  }

  function abrirEdicaoProduto(produto) {
    setEdicaoProduto({
      id: produto.id,
      codigo_barras: produto.codigo_barras || '',
      nome: produto.nome || '',
      descricao: produto.descricao || '',
      preco_tabela: Number(produto.preco_tabela || 0),
      imagem_url: produto.imagem_url || ''
    });
  }

  async function salvarEdicaoProduto() {
    if (!edicaoProduto.id) return;

    setSalvandoProduto(true);
    setErro('');

    try {
      await adminAtualizarProdutoCatalogo(edicaoProduto.id, {
        codigo_barras: edicaoProduto.codigo_barras,
        nome: edicaoProduto.nome,
        descricao: edicaoProduto.descricao,
        preco_tabela: edicaoProduto.preco_tabela,
        imagem_url: edicaoProduto.imagem_url
      });

      setMensagem('Produto atualizado com sucesso.');
      setEdicaoProduto(estadoInicialEdicao);
      await Promise.all([
        carregarProdutos(paginacaoProdutos.pagina || 1),
        carregarDashboard()
      ]);
    } catch (error) {
      tratarErroApi(error);
    } finally {
      setSalvandoProduto(false);
    }
  }

  async function handleEnriquecerProduto(produtoId) {
    setEnriquecendoProdutoId(produtoId);
    setErro('');

    try {
      const data = await adminEnriquecerProdutoCatalogo(produtoId, {
        force: true,
        preferSpreadsheet: true,
        overwriteImageMode
      });

      setMensagem(data?.mensagem || 'Enriquecimento executado.');
      await Promise.all([
        carregarProdutos(paginacaoProdutos.pagina || 1),
        carregarDashboard()
      ]);

      if (tab === 'logs') {
        await carregarLogs();
      }
    } catch (error) {
      tratarErroApi(error);
    } finally {
      setEnriquecendoProdutoId(null);
    }
  }

  async function handleBuscarBarcodeManual() {
    setErro('');
    setResultadoLookupManual(null);

    const codigo = String(barcodeManual || '').replace(/\D/g, '');
    if (codigo.length < 8) {
      setErro('Informe um codigo de barras valido (minimo 8 digitos).');
      return;
    }

    setBuscandoBarcode(true);
    try {
      const data = await adminBuscarProdutoPorCodigoBarras(codigo);
      setResultadoLookupManual(data);
    } catch (error) {
      tratarErroApi(error);
    } finally {
      setBuscandoBarcode(false);
    }
  }

  async function handleReprocessarFalhas() {
    setReprocessandoFalhas(true);
    setErro('');

    const limit = clampInt(loteLimite, 80, { min: 1, max: 500 });
    const concurrency = clampInt(loteConcorrencia, 3, { min: 1, max: 10 });

    try {
      const data = await adminReprocessarFalhasEnriquecimento({
        limit,
        concurrency,
        overwriteImageMode
      });
      setResultadoReprocessamento(data);
      setMensagem('Reprocessamento finalizado.');
      await Promise.all([
        carregarProdutos(1),
        carregarDashboard(),
        carregarLogs()
      ]);
    } catch (error) {
      tratarErroApi(error);
    } finally {
      setReprocessandoFalhas(false);
    }
  }

  async function handleEnriquecerSemImagem() {
    setExecutandoLoteSemImagem(true);
    setErro('');

    const limit = clampInt(loteLimite, 80, { min: 1, max: 500 });
    const concurrency = clampInt(loteConcorrencia, 3, { min: 1, max: 10 });

    try {
      const data = await adminEnriquecerProdutosSemImagem({
        limit,
        concurrency,
        force: forcarLookupLote,
        overwriteImageMode
      });

      setResultadoLoteSemImagem(data);
      setMensagem('Lote de produtos sem imagem processado.');
      await Promise.all([
        carregarProdutos(1),
        carregarDashboard(),
        carregarLogs()
      ]);
    } catch (error) {
      tratarErroApi(error);
    } finally {
      setExecutandoLoteSemImagem(false);
    }
  }

  async function handleEnriquecerImportacaoRecente() {
    setExecutandoLoteImportacaoRecente(true);
    setErro('');

    const limit = clampInt(loteLimite, 120, { min: 1, max: 800 });
    const concurrency = clampInt(loteConcorrencia, 3, { min: 1, max: 10 });
    const windowMinutes = clampInt(janelaImportacaoMinutos, 180, { min: 5, max: 43200 });

    try {
      const data = await adminEnriquecerImportacaoRecente({
        windowMinutes,
        limit,
        concurrency,
        somenteSemImagem: somenteSemImagemImportacaoRecente,
        force: forcarLookupLote,
        overwriteImageMode
      });

      setResultadoLoteImportacaoRecente(data);
      setMensagem('Lote de importacao recente processado.');
      await Promise.all([
        carregarProdutos(1),
        carregarDashboard(),
        carregarLogs()
      ]);
    } catch (error) {
      tratarErroApi(error);
    } finally {
      setExecutandoLoteImportacaoRecente(false);
    }
  }

  async function handleBaixarModeloImportacao() {
    setErro('');
    setMensagem('');
    setBaixandoModelo(true);

    try {
      const arquivo = await adminBaixarCatalogModeloImportacao();
      dispararDownloadBrowser(arquivo?.blob, arquivo?.fileName || 'modelo-importacao-produtos.csv');
      setMensagem('Modelo de importacao baixado com sucesso.');
    } catch (error) {
      tratarErroApi(error);
    } finally {
      setBaixandoModelo(false);
    }
  }

  async function handleExportarCatalogo() {
    setErro('');
    setMensagem('');
    setBaixandoExportacao(true);

    try {
      const arquivo = await adminBaixarCatalogoExportacao({
        search: buscaDebounced,
        com_imagem: filtros.com_imagem,
        enrichment_status: filtros.enrichment_status,
        com_erro: filtros.com_erro,
        com_preco: filtros.com_preco,
        orderBy: filtros.orderBy,
        orderDir: filtros.orderDir
      });

      dispararDownloadBrowser(arquivo?.blob, arquivo?.fileName || 'produtos_admin.xlsx');
      setMensagem('Exportacao concluida com sucesso.');
    } catch (error) {
      tratarErroApi(error);
    } finally {
      setBaixandoExportacao(false);
    }
  }

  if (adminAutenticado === null && carregandoSessao) {
    return (
      <section className="page admin-gerencia-page">
        <h1>Admin / Gerencia</h1>
        <p>Validando sessao administrativa...</p>
      </section>
    );
  }

  if (adminAutenticado !== true) {
    return (
      <section className="page admin-gerencia-page">
        <h1>Admin / Gerencia</h1>
        <p>Painel interno para operacao da gerencia do supermercado.</p>

        <form className="form-box" onSubmit={handleLogin}>
          <label className="field-label" htmlFor="admin-gerencia-usuario">Usuario</label>
          <input
            id="admin-gerencia-usuario"
            className="field-input"
            value={adminUsuario}
            onChange={(event) => setAdminUsuario(event.target.value)}
            required
          />

          <label className="field-label" htmlFor="admin-gerencia-senha">Senha</label>
          <input
            id="admin-gerencia-senha"
            className="field-input"
            type="password"
            value={adminSenha}
            onChange={(event) => setAdminSenha(event.target.value)}
            required
          />

          {erro ? <p className="error-text">{erro}</p> : null}

          <button className="btn-primary" type="submit" disabled={carregandoSessao}>
            {carregandoSessao ? 'Validando acesso...' : 'Entrar na gerencia'}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="page admin-gerencia-page">
      <div className="admin-gerencia-hero">
        <div className="admin-gerencia-hero-copy">
          <p className="admin-gerencia-kicker">OPERACAO DE CATALOGO</p>
          <h1>Admin / Gerencia</h1>
          <p>Painel de qualidade de base para importacao, mapeamento e enriquecimento do catalogo.</p>
          <div className="admin-gerencia-hero-pills">
            <span className="admin-gerencia-pill">Formatos aceitos: {textoExtensoesImportacao}</span>
            <span className="admin-gerencia-pill">Fluxo guiado com preview e simulacao</span>
            <span className="admin-gerencia-pill">Sessao administrativa ativa</span>
          </div>
        </div>
        <div className="admin-gerencia-header-actions">
          <button className="btn-secondary" type="button" onClick={() => { void validarSessaoAdmin(); }}>
            Validar sessao
          </button>
          <button className="btn-secondary" type="button" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </div>

      <div className="admin-gerencia-top-metrics" aria-label="Resumo operacional do catalogo">
        <article className="admin-gerencia-top-card">
          <span>Total de produtos</span>
          <strong>{Number(dashboard?.total_produtos || 0)}</strong>
        </article>
        <article className="admin-gerencia-top-card is-warning">
          <span>Sem preco</span>
          <strong>{Number(dashboard?.produtos_sem_preco || 0)}</strong>
        </article>
        <article className="admin-gerencia-top-card is-warning">
          <span>Sem imagem</span>
          <strong>{Number(dashboard?.produtos_sem_imagem || 0)}</strong>
        </article>
        <article className="admin-gerencia-top-card is-neutral">
          <span>Pendentes de enriquecimento</span>
          <strong>{Number(dashboard?.produtos_pendentes || 0)}</strong>
        </article>
      </div>

      {mensagem ? <p className="success-text">{mensagem}</p> : null}
      {erro ? <p className="error-text">{erro}</p> : null}

      <div className="admin-gerencia-tabs" role="tablist" aria-label="Secoes administrativas">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`admin-gerencia-tab ${tab === item.id ? 'active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>


      {tab === 'dashboard' ? (
        <GerenciaDashboardTab
          dashboard={dashboard}
          carregandoDashboard={carregandoDashboard}
          onAtualizar={() => { void carregarDashboard(); }}
        />
      ) : null}

      {tab === 'produtos' ? (
        <GerenciaProdutosTab
          produtos={produtos}
          carregandoProdutos={carregandoProdutos}
          paginacaoProdutos={paginacaoProdutos}
          filtros={filtros}
          setFiltros={setFiltros}
          edicaoProduto={edicaoProduto}
          setEdicaoProduto={setEdicaoProduto}
          salvandoProduto={salvandoProduto}
          enriquecendoProdutoId={enriquecendoProdutoId}
          onCarregarProdutos={carregarProdutos}
          onAbrirEdicao={abrirEdicaoProduto}
          onSalvarEdicao={() => { void salvarEdicaoProduto(); }}
          onEnriquecerProduto={handleEnriquecerProduto}
        />
      ) : null}

      {tab === 'importar' ? (
        <GerenciaImportarTab
          passoImportacaoAtivo={passoImportacaoAtivo}
          passoImportacaoMaximoLiberado={passoImportacaoMaximoLiberado}
          podeAvancarPassoImportacao={podeAvancarPassoImportacao}
          onIrParaPasso={irParaPassoImportacao}
          onAvancarPasso={avancarPassoImportacao}
          onVoltarPasso={voltarPassoImportacao}
          arquivoPlanilha={arquivoPlanilha}
          dragUploadAtivo={dragUploadAtivo}
          onDragOver={handleDragOverImportacao}
          onDragLeave={handleDragLeaveImportacao}
          onDrop={handleDropImportacao}
          onArquivoSelecionadoInput={handleArquivoSelecionadoInput}
          processandoLeituraPlanilha={processandoLeituraPlanilha}
          carregandoImportacaoUtils={carregandoImportacaoUtils}
          falhaCarregamentoImportacaoUtils={falhaCarregamentoImportacaoUtils}
          extensoesImportacaoAceitas={extensoesImportacaoAceitas}
          textoExtensoesImportacao={textoExtensoesImportacao}
          nomeArquivoExibicao={nomeArquivoExibicao}
          formatarTamanhoArquivoImportacao={formatarTamanhoArquivoImportacao}
          leituraPlanilha={leituraPlanilha}
          estadoFluxoImportacao={estadoFluxoImportacao}
          erroLeituraPlanilha={erroLeituraPlanilha}
          mapeamentoColunas={mapeamentoColunas}
          camposImportacaoLabel={camposImportacaoLabel}
          validacaoMapeamento={validacaoMapeamento}
          onAtualizarMapeamento={handleAtualizarMapeamento}
          previewImportacao={previewImportacao}
          importacaoCriarNovos={importacaoCriarNovos}
          setImportacaoCriarNovos={setImportacaoCriarNovos}
          importacaoAtualizarEstoque={importacaoAtualizarEstoque}
          setImportacaoAtualizarEstoque={setImportacaoAtualizarEstoque}
          overwriteImageMode={overwriteImageMode}
          setOverwriteImageMode={setOverwriteImageMode}
          enriquecerPosImportacao={enriquecerPosImportacao}
          setEnriquecerPosImportacao={setEnriquecerPosImportacao}
          enriquecerPosImportacaoSomenteSemImagem={enriquecerPosImportacaoSomenteSemImagem}
          setEnriquecerPosImportacaoSomenteSemImagem={setEnriquecerPosImportacaoSomenteSemImagem}
          loteLimite={loteLimite}
          setLoteLimite={setLoteLimite}
          loteConcorrencia={loteConcorrencia}
          setLoteConcorrencia={setLoteConcorrencia}
          janelaImportacaoMinutos={janelaImportacaoMinutos}
          setJanelaImportacaoMinutos={setJanelaImportacaoMinutos}
          importandoPlanilha={importandoPlanilha}
          modoImportacaoAtual={modoImportacaoAtual}
          simulacaoOficialConcluida={simulacaoOficialConcluida}
          progressoImportacaoFormatado={progressoImportacaoFormatado}
          baixandoModelo={baixandoModelo}
          setAssinaturaSimulacaoValida={setAssinaturaSimulacaoValida}
          setResultadoImportacao={setResultadoImportacao}
          onExecutarImportacao={executarImportacao}
          onBaixarModelo={() => { void handleBaixarModeloImportacao(); }}
          resultadoImportacao={resultadoImportacao}
          onBaixarRelatorio={handleBaixarRelatorioImportacao}
          onLimparWizard={limparEstadoWizardImportacao}
          historicoImportacoesRecentes={historicoImportacoesRecentes}
          carregandoHistoricoImportacao={carregandoHistoricoImportacao}
        />
      ) : null}

      {tab === 'exportar' ? (
        <GerenciaExportarTab
          baixandoExportacao={baixandoExportacao}
          onExportarCatalogo={() => { void handleExportarCatalogo(); }}
        />
      ) : null}

      {tab === 'enriquecimento' ? (
        <GerenciaEnriquecimentoTab
          loteLimite={loteLimite}
          setLoteLimite={setLoteLimite}
          loteConcorrencia={loteConcorrencia}
          setLoteConcorrencia={setLoteConcorrencia}
          janelaImportacaoMinutos={janelaImportacaoMinutos}
          setJanelaImportacaoMinutos={setJanelaImportacaoMinutos}
          overwriteImageMode={overwriteImageMode}
          setOverwriteImageMode={setOverwriteImageMode}
          forcarLookupLote={forcarLookupLote}
          setForcarLookupLote={setForcarLookupLote}
          somenteSemImagemImportacaoRecente={somenteSemImagemImportacaoRecente}
          setSomenteSemImagemImportacaoRecente={setSomenteSemImagemImportacaoRecente}
          barcodeManual={barcodeManual}
          setBarcodeManual={setBarcodeManual}
          buscandoBarcode={buscandoBarcode}
          resultadoLookupManual={resultadoLookupManual}
          onBuscarBarcodeManual={() => { void handleBuscarBarcodeManual(); }}
          executandoLoteSemImagem={executandoLoteSemImagem}
          resultadoLoteSemImagem={resultadoLoteSemImagem}
          onEnriquecerSemImagem={() => { void handleEnriquecerSemImagem(); }}
          executandoLoteImportacaoRecente={executandoLoteImportacaoRecente}
          resultadoLoteImportacaoRecente={resultadoLoteImportacaoRecente}
          onEnriquecerImportacaoRecente={() => { void handleEnriquecerImportacaoRecente(); }}
          reprocessandoFalhas={reprocessandoFalhas}
          resultadoReprocessamento={resultadoReprocessamento}
          onReprocessarFalhas={() => { void handleReprocessarFalhas(); }}
        />
      ) : null}

      {tab === 'logs' ? (
        <GerenciaLogsTab
          importLogs={importLogs}
          enrichmentLogs={enrichmentLogs}
          carregandoLogs={carregandoLogs}
          onCarregarLogs={() => { void carregarLogs(); }}
        />
      ) : null}
    </section>
  );
}
