import { isAuthErrorMessage } from './api';

// ─── Constantes de configuração do Admin Gerência ────────────────────

export const PRODUTOS_POR_PAGINA = 60;

export const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'importar', label: 'Importar planilha' },
  { id: 'exportar', label: 'Exportar planilha' },
  { id: 'enriquecimento', label: 'Enriquecimento' },
  { id: 'logs', label: 'Logs' }
];

export const PASSOS_IMPORTACAO = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Leitura' },
  { id: 3, label: 'Mapeamento' },
  { id: 4, label: 'Preview' },
  { id: 5, label: 'Importacao' },
  { id: 6, label: 'Resultado' }
];

export const CAMPOS_MAPEAMENTO_ORDEM = [
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

export const EXTENSOES_IMPORTACAO_ACEITAS_PADRAO = Object.freeze(['.xls', '.xlsx', '.csv']);

export const ESTADOS_FLUXO_IMPORTACAO = Object.freeze({
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

export const POLITICAS_IMAGEM = [
  { value: 'if_empty', label: 'Somente quando imagem estiver vazia (recomendado)' },
  { value: 'always', label: 'Sempre sobrescrever com imagem externa' },
  { value: 'never', label: 'Nunca sobrescrever imagem existente' }
];

export const estadoInicialFiltro = {
  search: '',
  com_imagem: '',
  enrichment_status: '',
  com_erro: '',
  com_preco: '',
  orderBy: 'updated_at',
  orderDir: 'desc'
};

export const estadoInicialEdicao = {
  id: null,
  codigo_barras: '',
  nome: '',
  descricao: '',
  preco_tabela: '',
  imagem_url: ''
};

export const estadoInicialMapeamento = {
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

// ─── Lazy-load do módulo de importação de planilha ───────────────────

let importacaoPlanilhaModulePromise = null;

export async function carregarModuloImportacaoPlanilha() {
  if (!importacaoPlanilhaModulePromise) {
    importacaoPlanilhaModulePromise = import('../lib/importacaoPlanilha');
  }

  const modulo = await importacaoPlanilhaModulePromise;
  return modulo?.default || modulo;
}

export function resetImportacaoPlanilhaModulePromise() {
  importacaoPlanilhaModulePromise = null;
}

// ─── Funções utilitárias ─────────────────────────────────────────────

export function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

export function formatarData(data) {
  if (!data) return '-';
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}

export function normalizarStatusEnriquecimento(status) {
  const value = String(status || '').trim().toLowerCase();
  if (!value) return 'pendente';
  return value;
}

export function extrairMensagemErro(error) {
  const mensagem = String(error?.message || '').trim();
  return mensagem || 'Nao foi possivel concluir esta operacao agora.';
}

export function isAuthApiError(error) {
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

export function dispararDownloadBrowser(blob, nomeArquivo) {
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

export function formatarPercentual(valor) {
  const numero = Number(valor || 0);
  if (!Number.isFinite(numero)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numero)));
}

export function formatarTamanhoArquivoFallback(bytesRaw) {
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

export function gerarNomeRelatorioImportacao() {
  const data = new Date();
  const stamp = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}_${String(data.getHours()).padStart(2, '0')}${String(data.getMinutes()).padStart(2, '0')}`;
  return `relatorio-importacao-${stamp}.csv`;
}

export function normalizarNomeArquivoExibicao(nomeArquivo) {
  const nome = String(nomeArquivo || '').trim().replace(/\s+/g, ' ');
  if (!nome) {
    return '';
  }

  return nome.replace(/(\.xlsx|\.xls|\.csv)(?:\s*\1)+$/i, '$1');
}

export function temValorMapeamento(valor) {
  return String(valor ?? '').trim() !== '';
}

export function validarMapeamentoObrigatorioFallback(mapeamento = {}) {
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

export function construirMapeamentoPayload(mapeamento = {}, extrairMapeamentoNormalizadoFn) {
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

export function extrairMensagemErroImportacaoReal(error) {
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

export function gerarAssinaturaContextoImportacao({
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

export function montarResumoDetalhesFalhaImportacao(detalhes = {}) {
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

export function clampInt(value, fallback, { min = 1, max = 1000 } = {}) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}
