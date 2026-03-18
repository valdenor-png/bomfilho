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
  adminAtualizarProdutoCatalogo,
  isAuthErrorMessage
} from '../lib/api';
import useDebouncedValue from '../hooks/useDebouncedValue';
import SmartImage from '../components/ui/SmartImage';

const PRODUTOS_POR_PAGINA = 60;

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'importar', label: 'Importar planilha' },
  { id: 'exportar', label: 'Exportar planilha' },
  { id: 'enriquecimento', label: 'Enriquecimento' },
  { id: 'logs', label: 'Logs' }
];

const PASSOS_IMPORTACAO = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Leitura' },
  { id: 3, label: 'Mapeamento' },
  { id: 4, label: 'Preview' },
  { id: 5, label: 'Importacao' },
  { id: 6, label: 'Resultado' }
];

const CAMPOS_MAPEAMENTO_ORDEM = [
  'codigo_interno',
  'codigo_barras',
  'nome',
  'descricao',
  'imagem',
  'preco',
  'preco_promocional',
  'estoque',
  'categoria',
  'unidade',
  'ativo'
];

const EXTENSOES_IMPORTACAO_ACEITAS_PADRAO = Object.freeze(['.xls', '.xlsx', '.csv']);
let importacaoPlanilhaModulePromise = null;

async function carregarModuloImportacaoPlanilha() {
  if (!importacaoPlanilhaModulePromise) {
    importacaoPlanilhaModulePromise = import('../lib/importacaoPlanilha');
  }

  const modulo = await importacaoPlanilhaModulePromise;
  return modulo?.default || modulo;
}

const ESTADOS_FLUXO_IMPORTACAO = Object.freeze({
  IDLE: 'idle',
  FILE_SELECTED: 'file_selected',
  READING: 'reading',
  READ_SUCCESS: 'read_success',
  READ_ERROR: 'read_error',
  MAPPING_READY: 'mapping_ready',
  PREVIEW_READY: 'preview_ready',
  IMPORTING: 'importing',
  FINISHED: 'finished'
});

const POLITICAS_IMAGEM = [
  { value: 'if_empty', label: 'Somente quando imagem estiver vazia (recomendado)' },
  { value: 'always', label: 'Sempre sobrescrever com imagem externa' },
  { value: 'never', label: 'Nunca sobrescrever imagem existente' }
];

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatarData(data) {
  if (!data) return '-';
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}

function normalizarStatusEnriquecimento(status) {
  const value = String(status || '').trim().toLowerCase();
  if (!value) return 'pendente';
  return value;
}

function extrairMensagemErro(error) {
  const mensagem = String(error?.message || '').trim();
  return mensagem || 'Nao foi possivel concluir esta operacao agora.';
}

function isAuthApiError(error) {
  const status = Number(error?.status || 0);
  if (status === 401) {
    return true;
  }

  if (status === 403) {
    const mensagem = String(error?.message || '').toLowerCase();
    return /sess[aã]o|token|credenciais|login|expirou|nao encontrada|não encontrada/.test(mensagem)
      || isAuthErrorMessage(error?.message);
  }

  return isAuthErrorMessage(error?.message);
}

function dispararDownloadBrowser(blob, nomeArquivo) {
  if (!(blob instanceof Blob)) {
    throw new Error('Nao foi possivel preparar o download do arquivo.');
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Download indisponivel neste ambiente.');
  }

  const nomeFinal = String(nomeArquivo || 'download.bin').trim() || 'download.bin';
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeFinal;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 300);
}

function formatarPercentual(valor) {
  const numero = Number(valor || 0);
  if (!Number.isFinite(numero)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numero)));
}

function formatarTamanhoArquivoFallback(bytesRaw) {
  const bytes = Number(bytesRaw || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 KB';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function gerarNomeRelatorioImportacao() {
  const data = new Date();
  const stamp = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}_${String(data.getHours()).padStart(2, '0')}${String(data.getMinutes()).padStart(2, '0')}`;
  return `relatorio-importacao-${stamp}.csv`;
}

function normalizarNomeArquivoExibicao(nomeArquivo) {
  const nome = String(nomeArquivo || '').trim().replace(/\s+/g, ' ');
  if (!nome) {
    return '';
  }

  return nome.replace(/(\.xlsx|\.xls|\.csv)(?:\s*\1)+$/i, '$1');
}

function temValorMapeamento(valor) {
  return String(valor ?? '').trim() !== '';
}

function validarMapeamentoObrigatorioFallback(mapeamento = {}) {
  const temIdentificador = temValorMapeamento(mapeamento.codigo_interno) || temValorMapeamento(mapeamento.codigo_barras);
  const temNomeOuDescricao = temValorMapeamento(mapeamento.nome) || temValorMapeamento(mapeamento.descricao);
  const temPreco = temValorMapeamento(mapeamento.preco);

  const pendencias = [];

  if (!temIdentificador) {
    pendencias.push('Selecione ao menos Codigo interno ou Codigo de barras.');
  }

  if (!temNomeOuDescricao) {
    pendencias.push('Selecione Nome do produto ou Descricao.');
  }

  if (!temPreco) {
    pendencias.push('Selecione a coluna de Preco.');
  }

  return {
    ok: pendencias.length === 0,
    pendencias
  };
}

function construirMapeamentoPayload(mapeamento = {}, extrairMapeamentoNormalizadoFn) {
  const extrator = typeof extrairMapeamentoNormalizadoFn === 'function'
    ? extrairMapeamentoNormalizadoFn
    : (dados) => ({ ...(dados || {}) });

  const normalizadoRaw = extrator(mapeamento);
  const normalizado = normalizadoRaw && typeof normalizadoRaw === 'object'
    ? { ...normalizadoRaw }
    : {};

  if (!normalizado.nome && normalizado.descricao) {
    normalizado.nome = normalizado.descricao;
  }

  if (!normalizado.descricao && normalizado.nome) {
    normalizado.descricao = normalizado.nome;
  }

  return normalizado;
}

function extrairMensagemErroImportacaoReal(error) {
  const fromServer = String(error?.serverMessage || '').trim();
  if (fromServer) {
    return fromServer;
  }

  const fromPayload = String(error?.payload?.erro || '').trim();
  if (fromPayload) {
    return fromPayload;
  }

  const fromMessage = String(error?.message || '').trim();
  if (fromMessage) {
    return fromMessage;
  }

  return 'Nao foi possivel concluir a importacao da planilha.';
}

function gerarAssinaturaContextoImportacao({
  arquivo,
  mapeamento,
  criarNovos,
  atualizarEstoque
} = {}) {
  const arquivoInfo = arquivo
    ? {
      nome: String(arquivo.name || '').trim(),
      tamanho: Number(arquivo.size || 0),
      modificadoEm: Number(arquivo.lastModified || 0)
    }
    : null;

  const mapeamentoNormalizado = Object.entries(mapeamento || {})
    .map(([campo, coluna]) => [String(campo || '').trim(), String(coluna || '').trim()])
    .filter(([, coluna]) => Boolean(coluna))
    .sort(([campoA], [campoB]) => campoA.localeCompare(campoB));

  return JSON.stringify({
    arquivo: arquivoInfo,
    mapeamento: mapeamentoNormalizado,
    criar_novos: Boolean(criarNovos),
    atualizar_estoque: Boolean(atualizarEstoque)
  });
}

function montarResumoDetalhesFalhaImportacao(detalhes = {}) {
  if (!detalhes || typeof detalhes !== 'object') {
    return '';
  }

  const partes = [];

  if (detalhes.etapa_falha) {
    partes.push(`etapa=${detalhes.etapa_falha}`);
  }

  const lotesProcessados = Number(detalhes.lotes_processados);
  if (Number.isFinite(lotesProcessados)) {
    partes.push(`lotes=${lotesProcessados}`);
  }

  if (typeof detalhes.rollback_aplicado === 'boolean') {
    partes.push(`rollback=${detalhes.rollback_aplicado ? 'total' : 'nao_aplicado'}`);
  }

  const duracaoMs = Number(detalhes.duracao_ms || detalhes.duracao_total_ms);
  if (Number.isFinite(duracaoMs) && duracaoMs > 0) {
    partes.push(`duracao=${duracaoMs}ms`);
  }

  return partes.join(' | ');
}

function clampInt(value, fallback, { min = 1, max = 1000 } = {}) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

const estadoInicialFiltro = {
  search: '',
  com_imagem: '',
  enrichment_status: '',
  com_erro: '',
  com_preco: '',
  orderBy: 'updated_at',
  orderDir: 'desc'
};

const estadoInicialEdicao = {
  id: null,
  codigo_barras: '',
  nome: '',
  descricao: '',
  preco_tabela: '',
  imagem_url: ''
};

const estadoInicialMapeamento = {
  codigo_interno: '',
  codigo_barras: '',
  nome: '',
  descricao: '',
  imagem: '',
  preco: '',
  preco_promocional: '',
  estoque: '',
  categoria: '',
  unidade: '',
  ativo: ''
};

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
        <div className="admin-gerencia-panel">
          <div className="toolbar-box">
            <button className="btn-secondary" type="button" onClick={() => { void carregarDashboard(); }} disabled={carregandoDashboard}>
              {carregandoDashboard ? 'Atualizando...' : 'Atualizar indicadores'}
            </button>
          </div>

          <div className="admin-kpis" style={{ marginTop: '0.8rem' }}>
            {carregandoDashboard ? (
              <p className="muted-text">Carregando indicadores...</p>
            ) : (
              <>
                <div className="kpi-card"><strong>Total produtos:</strong> {Number(dashboard?.total_produtos || 0)}</div>
                <div className="kpi-card"><strong>Com preco:</strong> {Number(dashboard?.produtos_com_preco || 0)}</div>
                <div className="kpi-card"><strong>Sem preco:</strong> {Number(dashboard?.produtos_sem_preco || 0)}</div>
                <div className="kpi-card"><strong>Com imagem:</strong> {Number(dashboard?.produtos_com_imagem || 0)}</div>
                <div className="kpi-card"><strong>Sem imagem:</strong> {Number(dashboard?.produtos_sem_imagem || 0)}</div>
                <div className="kpi-card"><strong>Enriquecidos:</strong> {Number(dashboard?.produtos_enriquecidos || 0)}</div>
                <div className="kpi-card"><strong>Nao encontrados:</strong> {Number(dashboard?.produtos_nao_encontrados || 0)}</div>
                <div className="kpi-card"><strong>Com erro:</strong> {Number(dashboard?.produtos_com_erro || 0)}</div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'produtos' ? (
        <div className="admin-gerencia-panel">
          <div className="admin-gerencia-filtros">
            <input
              className="field-input"
              placeholder="Buscar por nome ou codigo de barras"
              value={filtros.search}
              onChange={(event) => setFiltros((atual) => ({ ...atual, search: event.target.value }))}
            />

            <select className="field-input" value={filtros.com_imagem} onChange={(event) => setFiltros((atual) => ({ ...atual, com_imagem: event.target.value }))}>
              <option value="">Imagem: todos</option>
              <option value="true">Com imagem</option>
              <option value="false">Sem imagem</option>
            </select>

            <select className="field-input" value={filtros.enrichment_status} onChange={(event) => setFiltros((atual) => ({ ...atual, enrichment_status: event.target.value }))}>
              <option value="">Enriquecimento: todos</option>
              <option value="enriquecido">Enriquecidos</option>
              <option value="nao_encontrado">Nao encontrados</option>
              <option value="erro">Com erro</option>
              <option value="pendente">Pendentes</option>
            </select>

            <select className="field-input" value={filtros.com_erro} onChange={(event) => setFiltros((atual) => ({ ...atual, com_erro: event.target.value }))}>
              <option value="">Erro: todos</option>
              <option value="true">Com erro</option>
              <option value="false">Sem erro</option>
            </select>

            <select className="field-input" value={filtros.com_preco} onChange={(event) => setFiltros((atual) => ({ ...atual, com_preco: event.target.value }))}>
              <option value="">Preco: todos</option>
              <option value="true">Com preco</option>
              <option value="false">Sem preco</option>
            </select>

            <select className="field-input" value={`${filtros.orderBy}:${filtros.orderDir}`} onChange={(event) => {
              const [orderBy, orderDir] = String(event.target.value).split(':');
              setFiltros((atual) => ({ ...atual, orderBy, orderDir }));
            }}>
              <option value="updated_at:desc">Atualizacao (mais recente)</option>
              <option value="updated_at:asc">Atualizacao (mais antiga)</option>
              <option value="nome:asc">Nome A-Z</option>
              <option value="nome:desc">Nome Z-A</option>
              <option value="preco_tabela:desc">Preco maior</option>
              <option value="preco_tabela:asc">Preco menor</option>
            </select>
          </div>

          <div className="table-wrap" style={{ marginTop: '0.8rem' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Produto</th>
                  <th>Codigo</th>
                  <th>Preco tabela</th>
                  <th>Status</th>
                  <th>Atualizado</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {carregandoProdutos ? (
                  <tr>
                    <td colSpan={7}>Carregando produtos...</td>
                  </tr>
                ) : produtos.length === 0 ? (
                  <tr>
                    <td colSpan={7}>Nenhum produto encontrado para os filtros selecionados.</td>
                  </tr>
                ) : (
                  produtos.map((produto) => (
                    <tr key={produto.id}>
                      <td>
                        {produto.imagem_url ? (
                          <SmartImage className="admin-produto-thumb" src={produto.imagem_url} alt={produto.nome} loading="lazy" />
                        ) : (
                          <span className="muted-text">Sem foto</span>
                        )}
                      </td>
                      <td>{produto.nome || '-'}</td>
                      <td>{produto.codigo_barras || '-'}</td>
                      <td>{formatarMoeda(produto.preco_tabela)}</td>
                      <td>
                        <span className={`importacao-status-badge status-${normalizarStatusEnriquecimento(produto.enrichment_status)}`}>
                          {normalizarStatusEnriquecimento(produto.enrichment_status)}
                        </span>
                      </td>
                      <td>{formatarData(produto.updated_at)}</td>
                      <td>
                        <div className="admin-row-actions">
                          <button className="btn-secondary" type="button" onClick={() => abrirEdicaoProduto(produto)}>
                            Editar
                          </button>
                          <button
                            className="btn-secondary"
                            type="button"
                            disabled={enriquecendoProdutoId === produto.id}
                            onClick={() => {
                              void handleEnriquecerProduto(produto.id);
                            }}
                          >
                            {enriquecendoProdutoId === produto.id ? 'Processando...' : 'Reprocessar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="toolbar-box" style={{ marginTop: '0.8rem', alignItems: 'center' }}>
            <p className="muted-text" style={{ margin: 0 }}>
              Pagina {paginacaoProdutos.pagina} de {paginacaoProdutos.total_paginas} • {paginacaoProdutos.total} registro(s)
            </p>
            <button
              className="btn-secondary"
              type="button"
              disabled={carregandoProdutos || paginacaoProdutos.pagina <= 1}
              onClick={() => {
                void carregarProdutos(paginacaoProdutos.pagina - 1);
              }}
            >
              Pagina anterior
            </button>
            <button
              className="btn-secondary"
              type="button"
              disabled={carregandoProdutos || !paginacaoProdutos.tem_mais}
              onClick={() => {
                void carregarProdutos(paginacaoProdutos.pagina + 1);
              }}
            >
              Proxima pagina
            </button>
          </div>

          {edicaoProduto.id ? (
            <div className="card-box" style={{ marginTop: '1rem' }}>
              <p><strong>Editar produto #{edicaoProduto.id}</strong></p>
              <div className="admin-gerencia-edit-grid">
                <input className="field-input" placeholder="Codigo de barras" value={edicaoProduto.codigo_barras} onChange={(event) => setEdicaoProduto((atual) => ({ ...atual, codigo_barras: event.target.value }))} />
                <input className="field-input" placeholder="Nome" value={edicaoProduto.nome} onChange={(event) => setEdicaoProduto((atual) => ({ ...atual, nome: event.target.value }))} />
                <input className="field-input" placeholder="Preco tabela" type="number" step="0.01" min="0" value={edicaoProduto.preco_tabela} onChange={(event) => setEdicaoProduto((atual) => ({ ...atual, preco_tabela: event.target.value }))} />
                <input className="field-input" placeholder="URL da imagem" value={edicaoProduto.imagem_url} onChange={(event) => setEdicaoProduto((atual) => ({ ...atual, imagem_url: event.target.value }))} />
              </div>
              <textarea className="field-input" rows={3} placeholder="Descricao" value={edicaoProduto.descricao} onChange={(event) => setEdicaoProduto((atual) => ({ ...atual, descricao: event.target.value }))} />

              <div className="toolbar-box" style={{ marginTop: '0.6rem' }}>
                <button className="btn-primary" type="button" disabled={salvandoProduto} onClick={() => { void salvarEdicaoProduto(); }}>
                  {salvandoProduto ? 'Salvando...' : 'Salvar alteracoes'}
                </button>
                <button className="btn-secondary" type="button" onClick={() => setEdicaoProduto(estadoInicialEdicao)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'importar' ? (
        <div className="admin-gerencia-panel admin-import-panel">
          <div className="admin-import-header">
            <h2>Importacao de planilha com fluxo guiado</h2>
            <p>
              Upload seguro, leitura automatica, mapeamento assistido, preview e importacao final com controle operacional.
            </p>
          </div>

          <ol className="admin-import-stepper" aria-label="Etapas da importacao">
            {PASSOS_IMPORTACAO.map((passo) => {
              const ativo = passoImportacaoAtivo === passo.id;
              const concluido = passo.id < passoImportacaoAtivo || passo.id < passoImportacaoMaximoLiberado;
              const bloqueado = passo.id > passoImportacaoMaximoLiberado;

              return (
                <li key={passo.id}>
                  <button
                    type="button"
                    className={`admin-import-step-btn ${ativo ? 'is-active' : ''} ${concluido ? 'is-done' : ''}`}
                    onClick={() => irParaPassoImportacao(passo.id)}
                    disabled={bloqueado}
                    aria-current={ativo ? 'step' : undefined}
                  >
                    <span className="admin-import-step-index">{passo.id}</span>
                    <span>{passo.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="admin-import-cards-grid">
            <article className={`admin-import-card ${passoImportacaoAtivo === 1 ? 'is-active' : ''}`}>
              <h3>Etapa 1 - Upload do arquivo</h3>
              <p>Envie uma planilha de catalogo em formato Excel ou CSV.</p>

              <div
                className={`importacao-dropzone admin-import-dropzone ${dragUploadAtivo ? 'dragover' : ''}`}
                onDragOver={handleDragOverImportacao}
                onDragLeave={handleDragLeaveImportacao}
                onDrop={handleDropImportacao}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    const input = document.getElementById('admin-import-file-input');
                    if (input) {
                      input.click();
                    }
                  }
                }}
              >
                <strong>Arraste e solte aqui</strong>
                <span>Formatos aceitos: {textoExtensoesImportacao}</span>
                <input
                  id="admin-import-file-input"
                  className="importacao-file-input"
                  type="file"
                  accept={extensoesImportacaoAceitas.join(',')}
                  onChange={handleArquivoSelecionadoInput}
                />
                <button
                  className="btn-secondary importacao-select-btn"
                  type="button"
                  disabled={carregandoImportacaoUtils}
                  onClick={() => {
                    const input = document.getElementById('admin-import-file-input');
                    if (input) {
                      input.click();
                    }
                  }}
                >
                  Selecionar arquivo
                </button>
              </div>

              {processandoLeituraPlanilha ? (
                <p className="muted-text">Lendo arquivo e validando estrutura da planilha...</p>
              ) : carregandoImportacaoUtils ? (
                <p className="muted-text">Preparando leitor de planilha...</p>
              ) : null}

              {falhaCarregamentoImportacaoUtils ? (
                <p className="error-text">Nao foi possivel preparar o leitor de planilha. Tente selecionar o arquivo novamente.</p>
              ) : null}

              {arquivoPlanilha ? (
                <p className="admin-import-file-meta">
                  Arquivo carregado: <strong>{nomeArquivoExibicao || arquivoPlanilha.name}</strong> ({formatarTamanhoArquivoImportacao(arquivoPlanilha.size)})
                </p>
              ) : (
                <p className="muted-text">Nenhum arquivo selecionado no momento.</p>
              )}
            </article>

            <article className={`admin-import-card ${passoImportacaoAtivo === 2 ? 'is-active' : ''}`}>
              <h3>Etapa 2 - Leitura da planilha</h3>
              <p>Conferencia tecnica da estrutura do arquivo antes de mapear colunas.</p>

              {leituraPlanilha ? (
                <div className="admin-import-read-summary">
                  <div><span>Arquivo</span><strong>{nomeArquivoExibicao || leituraPlanilha.nomeArquivo}</strong></div>
                  <div><span>Formato</span><strong>{leituraPlanilha.extensao}</strong></div>
                  <div><span>Aba utilizada</span><strong>{leituraPlanilha.nomeAba}</strong></div>
                  <div><span>Linhas estimadas</span><strong>{Number(leituraPlanilha.totalLinhas || 0)}</strong></div>
                  <div><span>Colunas detectadas</span><strong>{Number(leituraPlanilha.colunasDetectadas || 0)}</strong></div>
                  <div><span>Status da leitura</span><strong>Arquivo valido</strong></div>
                </div>
              ) : processandoLeituraPlanilha ? (
                <p className="muted-text">Lendo planilha e montando diagnostico...</p>
              ) : estadoFluxoImportacao === ESTADOS_FLUXO_IMPORTACAO.READ_ERROR ? (
                <p className="error-text">Falha na leitura: {erroLeituraPlanilha || 'Nao foi possivel processar o arquivo selecionado.'}</p>
              ) : arquivoPlanilha ? (
                <p className="muted-text">Arquivo selecionado, aguardando conclusao da leitura.</p>
              ) : (
                <p className="muted-text">Carregue um arquivo para visualizar diagnostico de leitura.</p>
              )}
            </article>

            <article className={`admin-import-card ${passoImportacaoAtivo === 3 ? 'is-active' : ''}`}>
              <h3>Etapa 3 - Mapeamento de colunas</h3>
              <p>Selecione quais colunas da planilha alimentam cada campo do sistema.</p>
              <p className="muted-text" style={{ marginTop: '-0.2rem' }}>
                Requisitos do backend: (Codigo interno ou Codigo de barras) + (Nome ou Descricao) + Preco.
              </p>

              {leituraPlanilha ? (
                <>
                  <div className="admin-import-map-grid">
                    {CAMPOS_MAPEAMENTO_ORDEM.map((campo) => (
                      <label key={campo} className="admin-import-map-field">
                        <span>{camposImportacaoLabel[campo] || campo}</span>
                        <select
                          className="field-input"
                          value={mapeamentoColunas[campo] || ''}
                          onChange={(event) => handleAtualizarMapeamento(campo, event.target.value)}
                        >
                          <option value="">Nao mapear</option>
                          {leituraPlanilha.cabecalhos.map((cabecalho, indice) => (
                            <option key={`${campo}-col-${indice}`} value={cabecalho}>
                              {cabecalho}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>

                  {!validacaoMapeamento.ok ? (
                    <ul className="admin-import-validation-list" aria-label="Pendencias de campos obrigatorios do payload">
                      {validacaoMapeamento.pendencias.map((pendencia, indice) => (
                        <li key={`pendencia-${indice}`}>{pendencia}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="success-text" style={{ marginTop: '0.4rem' }}>Mapeamento minimo obrigatorio atendido.</p>
                  )}
                </>
              ) : (
                <p className="muted-text">
                  {estadoFluxoImportacao === ESTADOS_FLUXO_IMPORTACAO.READ_ERROR
                    ? 'Corrija o arquivo e tente novamente para habilitar o mapeamento.'
                    : 'Conclua a leitura da planilha para habilitar o mapeamento.'}
                </p>
              )}
            </article>

            <article className={`admin-import-card ${passoImportacaoAtivo === 4 ? 'is-active' : ''}`}>
              <h3>Etapa 4 - Pre-visualizacao</h3>
              <p>Valide qualidade das linhas antes da simulacao/importacao final.</p>
              <p className="muted-text" style={{ marginTop: '-0.18rem' }}>
                Esta etapa mostra pre-analise local. A simulacao oficial do backend (etapa 5) e a validacao definitiva antes da importacao real.
              </p>

              {previewImportacao ? (
                <>
                  <div className="admin-kpis admin-import-preview-kpis">
                    <div className="kpi-card"><strong>Total lidas:</strong> {Number(previewImportacao?.contadores?.total_lidas || 0)}</div>
                    <div className="kpi-card"><strong>Validas:</strong> {Number(previewImportacao?.contadores?.validas || 0)}</div>
                    <div className="kpi-card"><strong>Com erro:</strong> {Number(previewImportacao?.contadores?.com_erro || 0)}</div>
                    <div className="kpi-card"><strong>Duplicadas:</strong> {Number(previewImportacao?.contadores?.duplicadas || 0)}</div>
                    <div className="kpi-card"><strong>Prontas:</strong> {Number(previewImportacao?.contadores?.prontas_importar || 0)}</div>
                  </div>

                  <div className="table-wrap admin-import-preview-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Linha</th>
                          <th>Status previsto</th>
                          <th>Produto</th>
                          <th>Codigo barras</th>
                          <th>Preco</th>
                          <th>Observacoes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewImportacao.rows.map((item) => (
                          <tr key={`preview-row-${item.numeroLinha}`}>
                            <td>{item.numeroLinha}</td>
                            <td>
                              <span className={`admin-import-row-status is-${item.status}`}>
                                {item.statusLabel}
                              </span>
                            </td>
                            <td>{item?.produto?.nome || '-'}</td>
                            <td>{item?.produto?.codigo_barras || '-'}</td>
                            <td>{item?.produto?.preco ? formatarMoeda(item.produto.preco) : '-'}</td>
                            <td>{item.motivos?.length ? item.motivos[0] : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="muted-text">Configure o mapeamento para gerar o preview.</p>
              )}
            </article>

            <article className={`admin-import-card ${passoImportacaoAtivo === 5 ? 'is-active' : ''}`}>
              <h3>Etapa 5 - Simulacao e importacao final</h3>
              <p>Simule para reduzir risco operacional e depois execute a importacao real.</p>

              <label className="importacao-checkbox">
                <input
                  type="checkbox"
                  checked={importacaoCriarNovos}
                  onChange={(event) => {
                    setImportacaoCriarNovos(event.target.checked);
                    setAssinaturaSimulacaoValida('');
                    setResultadoImportacao(null);
                  }}
                />
                Criar novos produtos quando nao houver correspondencia.
              </label>

              <label className="importacao-checkbox">
                <input
                  type="checkbox"
                  checked={importacaoAtualizarEstoque}
                  onChange={(event) => {
                    setImportacaoAtualizarEstoque(event.target.checked);
                    setAssinaturaSimulacaoValida('');
                    setResultadoImportacao(null);
                  }}
                />
                Atualizar estoque usando coluna mapeada da planilha.
              </label>

              <label className="field-label" style={{ marginTop: '0.65rem' }}>
                Politica de imagem durante enriquecimento
              </label>
              <select
                className="field-input"
                value={overwriteImageMode}
                onChange={(event) => {
                  setOverwriteImageMode(event.target.value);
                  setAssinaturaSimulacaoValida('');
                  setResultadoImportacao(null);
                }}
              >
                {POLITICAS_IMAGEM.map((politica) => (
                  <option key={politica.value} value={politica.value}>{politica.label}</option>
                ))}
              </select>

              <label className="importacao-checkbox" style={{ marginTop: '0.6rem' }}>
                <input
                  type="checkbox"
                  checked={enriquecerPosImportacao}
                  onChange={(event) => {
                    setEnriquecerPosImportacao(event.target.checked);
                    setAssinaturaSimulacaoValida('');
                    setResultadoImportacao(null);
                  }}
                />
                Rodar enriquecimento automatico ao final da importacao real.
              </label>

              {enriquecerPosImportacao ? (
                <>
                  <label className="importacao-checkbox" style={{ marginTop: '0.3rem' }}>
                    <input
                      type="checkbox"
                      checked={enriquecerPosImportacaoSomenteSemImagem}
                      onChange={(event) => {
                        setEnriquecerPosImportacaoSomenteSemImagem(event.target.checked);
                        setAssinaturaSimulacaoValida('');
                        setResultadoImportacao(null);
                      }}
                    />
                    Pos-importacao: processar somente itens sem imagem.
                  </label>

                  <div className="admin-gerencia-edit-grid" style={{ marginTop: '0.5rem' }}>
                    <label className="field-label" style={{ margin: 0 }}>
                      Limite
                      <input
                        className="field-input"
                        type="number"
                        min="1"
                        max="800"
                        value={loteLimite}
                        onChange={(event) => setLoteLimite(clampInt(event.target.value, 80, { min: 1, max: 800 }))}
                      />
                    </label>

                    <label className="field-label" style={{ margin: 0 }}>
                      Concorrencia
                      <input
                        className="field-input"
                        type="number"
                        min="1"
                        max="10"
                        value={loteConcorrencia}
                        onChange={(event) => setLoteConcorrencia(clampInt(event.target.value, 3, { min: 1, max: 10 }))}
                      />
                    </label>

                    <label className="field-label" style={{ margin: 0 }}>
                      Janela recente (min)
                      <input
                        className="field-input"
                        type="number"
                        min="5"
                        max="43200"
                        value={janelaImportacaoMinutos}
                        onChange={(event) => setJanelaImportacaoMinutos(clampInt(event.target.value, 180, { min: 5, max: 43200 }))}
                      />
                    </label>
                  </div>
                </>
              ) : null}

              <div className="admin-import-actions">
                <button
                  className="btn-secondary"
                  type="button"
                  disabled={importandoPlanilha || !leituraPlanilha || !validacaoMapeamento.ok}
                  onClick={() => {
                    void executarImportacao({ simular: true });
                  }}
                >
                  {importandoPlanilha && modoImportacaoAtual === 'simulacao' ? 'Simulando...' : 'Simular importacao'}
                </button>

                <button
                  className="btn-primary"
                  type="button"
                  disabled={importandoPlanilha || !leituraPlanilha || !validacaoMapeamento.ok || !simulacaoOficialConcluida}
                  onClick={() => {
                    void executarImportacao({ simular: false });
                  }}
                >
                  {importandoPlanilha && modoImportacaoAtual === 'importacao' ? 'Importando...' : 'Importar agora'}
                </button>

                <button
                  className="btn-secondary"
                  type="button"
                  disabled={baixandoModelo}
                  onClick={() => {
                    void handleBaixarModeloImportacao();
                  }}
                >
                  {baixandoModelo ? 'Baixando modelo...' : 'Baixar modelo CSV'}
                </button>
              </div>

              {simulacaoOficialConcluida ? (
                <p className="success-text" style={{ marginTop: '0.45rem' }}>
                  Simulacao oficial concluida para o contexto atual. Importacao final liberada.
                </p>
              ) : (
                <p className="muted-text" style={{ marginTop: '0.45rem' }}>
                  Execute a simulacao oficial antes de importar para garantir alinhamento completo entre preview e payload final.
                </p>
              )}

              {importandoPlanilha || progressoImportacaoFormatado > 0 ? (
                <div className="admin-import-progress" aria-live="polite">
                  <div className="admin-import-progress-track">
                    <span style={{ width: `${progressoImportacaoFormatado}%` }} />
                  </div>
                  <p>{progressoImportacaoFormatado}% concluido</p>
                </div>
              ) : null}

              {resultadoImportacao ? (
                <p className="admin-import-alert">
                  {resultadoImportacao?.mensagem || 'Operacao de importacao processada.'}
                </p>
              ) : null}
            </article>

            <article className={`admin-import-card ${passoImportacaoAtivo === 6 ? 'is-active' : ''}`}>
              <h3>Etapa 6 - Resultado e relatorio</h3>
              <p>Resumo final da ultima execucao com possibilidade de baixar relatorio de inconsistencias.</p>

              {resultadoImportacao ? (
                <>
                  <div className="admin-kpis">
                    <div className="kpi-card"><strong>Total linhas:</strong> {Number(resultadoImportacao.total_linhas || 0)}</div>
                    <div className="kpi-card"><strong>Validas:</strong> {Number(resultadoImportacao.total_validos || 0)}</div>
                    <div className="kpi-card"><strong>Atualizadas:</strong> {Number(resultadoImportacao.total_atualizados || 0)}</div>
                    <div className="kpi-card"><strong>Criadas:</strong> {Number(resultadoImportacao.total_criados || 0)}</div>
                    <div className="kpi-card"><strong>Ignoradas:</strong> {Number(resultadoImportacao.total_ignorados || 0)}</div>
                    <div className="kpi-card"><strong>Com erro:</strong> {Number(resultadoImportacao.total_erros || 0)}</div>
                  </div>

                  {resultadoImportacao?.enriquecimento_pos_importacao?.resumo ? (
                    <div className="admin-kpis" style={{ marginTop: '0.6rem' }}>
                      <div className="kpi-card"><strong>Pos-importacao:</strong> {Number(resultadoImportacao.enriquecimento_pos_importacao.resumo.total_processados || 0)} processados</div>
                      <div className="kpi-card"><strong>Imagens atualizadas:</strong> {Number(resultadoImportacao.enriquecimento_pos_importacao.resumo.total_imagem_atualizada || 0)}</div>
                      <div className="kpi-card"><strong>Atualizados:</strong> {Number(resultadoImportacao.enriquecimento_pos_importacao.resumo.total_atualizados || 0)}</div>
                      <div className="kpi-card"><strong>Erros:</strong> {Number(resultadoImportacao.enriquecimento_pos_importacao.resumo.total_erros || 0)}</div>
                    </div>
                  ) : null}

                  <div className="admin-import-actions" style={{ marginTop: '0.75rem' }}>
                    <button className="btn-secondary" type="button" onClick={handleBaixarRelatorioImportacao}>
                      Baixar relatorio de erros
                    </button>
                    <button className="btn-secondary" type="button" onClick={limparEstadoWizardImportacao}>
                      Importar nova planilha
                    </button>
                  </div>

                  {Array.isArray(resultadoImportacao?.logs?.erros) && resultadoImportacao.logs.erros.length > 0 ? (
                    <div className="importacao-log-box">
                      <p><strong>Principais erros por linha</strong></p>
                      <ul className="importacao-log-list">
                        {resultadoImportacao.logs.erros.slice(0, 12).map((item, index) => (
                          <li key={`erro-linha-${index}`}>Linha {item?.linha || '-'}: {item?.motivo || 'Erro sem detalhe.'}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="muted-text">Execute uma simulacao ou importacao para visualizar o resultado final.</p>
              )}
            </article>
          </div>

          <div className="admin-import-step-actions">
            <button
              className="btn-secondary"
              type="button"
              onClick={voltarPassoImportacao}
              disabled={passoImportacaoAtivo <= 1}
            >
              Etapa anterior
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={avancarPassoImportacao}
              disabled={!podeAvancarPassoImportacao}
            >
              Proxima etapa
            </button>
          </div>

          <div className="admin-import-history card-box" style={{ marginTop: '0.9rem' }}>
            <p><strong>Historico recente de importacoes</strong></p>

            {carregandoHistoricoImportacao ? (
              <p className="muted-text">Carregando historico...</p>
            ) : historicoImportacoesRecentes.length === 0 ? (
              <p className="muted-text">Nenhuma importacao recente encontrada.</p>
            ) : (
              <div className="table-wrap" style={{ marginTop: '0.5rem' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Arquivo</th>
                      <th>Formato</th>
                      <th>Status</th>
                      <th>Processadas</th>
                      <th>Com erro</th>
                      <th>Duracao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoImportacoesRecentes.map((item) => (
                      <tr key={`hist-import-${item.id}`}>
                        <td>{formatarData(item.created_at)}</td>
                        <td>{item.arquivo_nome || '-'}</td>
                        <td>{item?.resumo?.formato || '-'}</td>
                        <td>
                          <span className={`importacao-status-badge status-${normalizarStatusEnriquecimento(item.status)}`}>
                            {item.status || '-'}
                          </span>
                        </td>
                        <td>{Number(item.linhas_validas || 0)}</td>
                        <td>{Number(item.linhas_com_erro || 0)}</td>
                        <td>{Number(item?.resumo?.performance?.duracao_total_ms || 0) > 0 ? `${Number(item.resumo.performance.duracao_total_ms)} ms` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'exportar' ? (
        <div className="admin-gerencia-panel">
          <div className="card-box" style={{ marginTop: '0.8rem' }}>
            <p><strong>Exportacao de catalogo (Excel)</strong></p>
            <p className="muted-text">
              O arquivo sera gerado com codigo de barras, nome, descricao, preco de tabela, imagem, status de enriquecimento e ultima atualizacao.
            </p>
            <button
              className="btn-primary"
              type="button"
              disabled={baixandoExportacao}
              onClick={() => {
                void handleExportarCatalogo();
              }}
            >
              {baixandoExportacao ? 'Gerando exportacao...' : 'Exportar produtos em Excel'}
            </button>
            <p className="muted-text" style={{ marginTop: '0.6rem' }}>
              A exportacao respeita os filtros atuais da aba Produtos.
            </p>
          </div>
        </div>
      ) : null}

      {tab === 'enriquecimento' ? (
        <div className="admin-gerencia-panel">
          <div className="card-box" style={{ marginTop: '0.8rem' }}>
            <p><strong>Configuracoes de lote</strong></p>
            <div className="admin-gerencia-edit-grid" style={{ marginTop: '0.4rem' }}>
              <label className="field-label" style={{ margin: 0 }}>
                Limite por execucao
                <input
                  className="field-input"
                  type="number"
                  min="1"
                  max="800"
                  value={loteLimite}
                  onChange={(event) => setLoteLimite(clampInt(event.target.value, 80, { min: 1, max: 800 }))}
                />
              </label>

              <label className="field-label" style={{ margin: 0 }}>
                Concorrencia
                <input
                  className="field-input"
                  type="number"
                  min="1"
                  max="10"
                  value={loteConcorrencia}
                  onChange={(event) => setLoteConcorrencia(clampInt(event.target.value, 3, { min: 1, max: 10 }))}
                />
              </label>

              <label className="field-label" style={{ margin: 0 }}>
                Janela de importacao recente (min)
                <input
                  className="field-input"
                  type="number"
                  min="5"
                  max="43200"
                  value={janelaImportacaoMinutos}
                  onChange={(event) => setJanelaImportacaoMinutos(clampInt(event.target.value, 180, { min: 5, max: 43200 }))}
                />
              </label>
            </div>

            <label className="field-label" style={{ marginTop: '0.5rem' }}>
              Politica de sobrescrita de imagem
            </label>
            <select
              className="field-input"
              value={overwriteImageMode}
              onChange={(event) => setOverwriteImageMode(event.target.value)}
            >
              {POLITICAS_IMAGEM.map((politica) => (
                <option key={politica.value} value={politica.value}>{politica.label}</option>
              ))}
            </select>

            <label className="importacao-checkbox" style={{ marginTop: '0.5rem' }}>
              <input
                type="checkbox"
                checked={forcarLookupLote}
                onChange={(event) => setForcarLookupLote(event.target.checked)}
              />
              Forcar consulta externa (ignorar cache persistente no lote).
            </label>

            <label className="importacao-checkbox" style={{ marginTop: '0.4rem' }}>
              <input
                type="checkbox"
                checked={somenteSemImagemImportacaoRecente}
                onChange={(event) => setSomenteSemImagemImportacaoRecente(event.target.checked)}
              />
              Importacao recente: processar somente produtos sem imagem.
            </label>
          </div>

          <div className="form-box" style={{ marginTop: '0.8rem' }}>
            <p><strong>Consulta manual por codigo de barras</strong></p>
            <div className="barcode-row">
              <input className="field-input" placeholder="Digite EAN/GTIN" value={barcodeManual} onChange={(event) => setBarcodeManual(event.target.value)} />
              <button className="btn-secondary" type="button" disabled={buscandoBarcode} onClick={() => { void handleBuscarBarcodeManual(); }}>
                {buscandoBarcode ? 'Consultando...' : 'Consultar'}
              </button>
            </div>

            {resultadoLookupManual?.produto ? (
              <div className="card-box" style={{ marginTop: '0.6rem' }}>
                <p><strong>Resultado da consulta</strong></p>
                <p><strong>Fonte:</strong> {resultadoLookupManual?.provider || resultadoLookupManual?.fonte || '-'}</p>
                <p><strong>Nome:</strong> {resultadoLookupManual.produto.nome || '-'}</p>
                <p><strong>Marca:</strong> {resultadoLookupManual.produto.marca || '-'}</p>
                <p><strong>Descricao:</strong> {resultadoLookupManual.produto.descricao || '-'}</p>
                <p><strong>Imagem:</strong> {resultadoLookupManual.produto.imagem || '-'}</p>
              </div>
            ) : null}
          </div>

          <div className="card-box" style={{ marginTop: '1rem' }}>
            <p><strong>Enriquecer produtos sem imagem</strong></p>
            <p className="muted-text">
              Processa itens ativos com codigo de barras e imagem vazia usando fallback entre providers.
            </p>
            <button className="btn-primary" type="button" disabled={executandoLoteSemImagem} onClick={() => { void handleEnriquecerSemImagem(); }}>
              {executandoLoteSemImagem ? 'Processando lote...' : 'Enriquecer sem imagem'}
            </button>

            {resultadoLoteSemImagem?.resumo ? (
              <div className="admin-kpis" style={{ marginTop: '0.7rem' }}>
                <div className="kpi-card"><strong>Selecionados:</strong> {Number(resultadoLoteSemImagem.resumo.total_selecionados || 0)}</div>
                <div className="kpi-card"><strong>Processados:</strong> {Number(resultadoLoteSemImagem.resumo.total_processados || 0)}</div>
                <div className="kpi-card"><strong>Atualizados:</strong> {Number(resultadoLoteSemImagem.resumo.total_atualizados || 0)}</div>
                <div className="kpi-card"><strong>Imagem atualizada:</strong> {Number(resultadoLoteSemImagem.resumo.total_imagem_atualizada || 0)}</div>
                <div className="kpi-card"><strong>Imagem preservada:</strong> {Number(resultadoLoteSemImagem.resumo.total_imagem_preservada || 0)}</div>
                <div className="kpi-card"><strong>Erros:</strong> {Number(resultadoLoteSemImagem.resumo.total_erros || 0)}</div>
              </div>
            ) : null}
          </div>

          <div className="card-box" style={{ marginTop: '1rem' }}>
            <p><strong>Enriquecer importacao recente</strong></p>
            <p className="muted-text">
              Reprocessa produtos importados recentemente para complementar imagens com controle de janela e concorrencia.
            </p>
            <button className="btn-primary" type="button" disabled={executandoLoteImportacaoRecente} onClick={() => { void handleEnriquecerImportacaoRecente(); }}>
              {executandoLoteImportacaoRecente ? 'Processando importacao recente...' : 'Enriquecer importacao recente'}
            </button>

            {resultadoLoteImportacaoRecente?.resumo ? (
              <div className="admin-kpis" style={{ marginTop: '0.7rem' }}>
                <div className="kpi-card"><strong>Selecionados:</strong> {Number(resultadoLoteImportacaoRecente.resumo.total_selecionados || 0)}</div>
                <div className="kpi-card"><strong>Processados:</strong> {Number(resultadoLoteImportacaoRecente.resumo.total_processados || 0)}</div>
                <div className="kpi-card"><strong>Atualizados:</strong> {Number(resultadoLoteImportacaoRecente.resumo.total_atualizados || 0)}</div>
                <div className="kpi-card"><strong>Imagem atualizada:</strong> {Number(resultadoLoteImportacaoRecente.resumo.total_imagem_atualizada || 0)}</div>
                <div className="kpi-card"><strong>Nao encontrados:</strong> {Number(resultadoLoteImportacaoRecente.resumo.total_nao_encontrados || 0)}</div>
                <div className="kpi-card"><strong>Erros:</strong> {Number(resultadoLoteImportacaoRecente.resumo.total_erros || 0)}</div>
              </div>
            ) : null}
          </div>

          <div className="card-box" style={{ marginTop: '1rem' }}>
            <p><strong>Reprocessamento em lote (falhas)</strong></p>
            <p className="muted-text">Reprocessa itens com status de erro ou nao encontrado, com controle de concorrencia.</p>
            <button className="btn-primary" type="button" disabled={reprocessandoFalhas} onClick={() => { void handleReprocessarFalhas(); }}>
              {reprocessandoFalhas ? 'Reprocessando...' : 'Reprocessar falhas agora'}
            </button>

            {resultadoReprocessamento?.resumo ? (
              <div className="admin-kpis" style={{ marginTop: '0.7rem' }}>
                <div className="kpi-card"><strong>Processados:</strong> {Number(resultadoReprocessamento.resumo.total_processados || 0)}</div>
                <div className="kpi-card"><strong>Enriquecidos:</strong> {Number(resultadoReprocessamento.resumo.total_enriquecidos || 0)}</div>
                <div className="kpi-card"><strong>Atualizados:</strong> {Number(resultadoReprocessamento.resumo.total_atualizados || 0)}</div>
                <div className="kpi-card"><strong>Nao encontrados:</strong> {Number(resultadoReprocessamento.resumo.total_nao_encontrados || 0)}</div>
                <div className="kpi-card"><strong>Erros:</strong> {Number(resultadoReprocessamento.resumo.total_erros || 0)}</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'logs' ? (
        <div className="admin-gerencia-panel">
          <div className="toolbar-box" style={{ marginTop: '0.8rem' }}>
            <button className="btn-secondary" type="button" disabled={carregandoLogs} onClick={() => { void carregarLogs(); }}>
              {carregandoLogs ? 'Atualizando...' : 'Atualizar logs'}
            </button>
          </div>

          <div className="card-box" style={{ marginTop: '0.8rem' }}>
            <p><strong>Logs de importacao</strong></p>
            <div className="table-wrap" style={{ marginTop: '0.5rem' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Arquivo</th>
                    <th>Formato</th>
                    <th>Status</th>
                    <th>Validas</th>
                    <th>Com erro</th>
                    <th>Duracao</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {carregandoLogs ? (
                    <tr><td colSpan={8}>Carregando logs de importacao...</td></tr>
                  ) : importLogs.length === 0 ? (
                    <tr><td colSpan={8}>Nenhum log de importacao registrado.</td></tr>
                  ) : (
                    importLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatarData(log.created_at)}</td>
                        <td>{log.arquivo_nome}</td>
                        <td>{log?.resumo?.formato || '-'}</td>
                        <td>{log.status}</td>
                        <td>{Number(log.linhas_validas || 0)}</td>
                        <td>{Number(log.linhas_com_erro || 0)}</td>
                        <td>{Number(log?.resumo?.performance?.duracao_total_ms || log?.resumo?.duracao_ms || 0) > 0 ? `${Number(log.resumo.performance?.duracao_total_ms || log.resumo?.duracao_ms)} ms` : '-'}</td>
                        <td>{log.criado_por || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card-box" style={{ marginTop: '1rem' }}>
            <p><strong>Logs de enriquecimento</strong></p>
            <div className="table-wrap" style={{ marginTop: '0.5rem' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Produto</th>
                    <th>Barcode</th>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {carregandoLogs ? (
                    <tr><td colSpan={6}>Carregando logs de enriquecimento...</td></tr>
                  ) : enrichmentLogs.length === 0 ? (
                    <tr><td colSpan={6}>Nenhum log de enriquecimento registrado.</td></tr>
                  ) : (
                    enrichmentLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatarData(log.created_at)}</td>
                        <td>{log.produto_id || '-'}</td>
                        <td>{log.barcode || '-'}</td>
                        <td>{log.provider || '-'}</td>
                        <td>{log.status || '-'}</td>
                        <td>{log.mensagem || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
