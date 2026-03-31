/**
 * Admin API layer — auth, CSRF, tokens, and all admin endpoint functions.
 * Uses services/api.js as transport.
 */
import API_BASE_URL from '../config/api';
import { apiGet, apiRequest } from '../services/api';

const CSRF_COOKIE_KEY = 'bf_csrf_token';
const ADMIN_ACCESS_TOKEN_KEY = 'bf_admin_access_token';
const ENABLE_TOKEN_STORAGE = String(import.meta.env.VITE_ENABLE_TOKEN_STORAGE || 'false').trim().toLowerCase() === 'true';
let csrfTokenCache = '';

function readStorage(key) {
  if (typeof window === 'undefined' || !ENABLE_TOKEN_STORAGE) return '';
  try { return String(window.localStorage.getItem(key) || '').trim(); } catch { return ''; }
}

function writeStorage(key, value) {
  if (typeof window === 'undefined') return;
  try {
    const normalized = String(value || '').trim();
    if (!normalized) { window.localStorage.removeItem(key); return; }
    if (!ENABLE_TOKEN_STORAGE) return;
    window.localStorage.setItem(key, normalized);
  } catch {}
}

function clearAdminAccessToken() { writeStorage(ADMIN_ACCESS_TOKEN_KEY, ''); }
function getAdminAccessToken() { return readStorage(ADMIN_ACCESS_TOKEN_KEY); }

function salvarTokenPorRota(path, token) {
  const t = String(token || '').trim();
  if (!t) return;
  if (String(path || '').startsWith('/api/admin/')) writeStorage(ADMIN_ACCESS_TOKEN_KEY, t);
}

function isMutatingMethod(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || '').toUpperCase());
}

function readCookie(name) {
  if (typeof document === 'undefined') return '';
  const cookieName = `${name}=`;
  for (const entry of String(document.cookie || '').split(';')) {
    const trimmed = entry.trim();
    if (trimmed.startsWith(cookieName)) return decodeURIComponent(trimmed.substring(cookieName.length));
  }
  return '';
}

function atualizarCsrfToken(token) { const n = String(token || '').trim(); if (n) csrfTokenCache = n; }
function obterCsrfToken() { return csrfTokenCache || readCookie(CSRF_COOKIE_KEY); }

function mapHttpStatusMessage(status) {
  const s = Number(status || 0);
  if (s === 400) return 'Não foi possível concluir a solicitação. Revise os dados e tente novamente.';
  if (s === 401) return 'Sua sessão administrativa expirou. Faça login novamente.';
  if (s === 403) return 'Você não tem permissão para realizar esta ação.';
  if (s === 404) return 'Não encontramos as informações solicitadas.';
  if (s >= 500) return 'Não foi possível concluir sua solicitação agora. Tente novamente em instantes.';
  return 'Não foi possível concluir sua solicitação agora. Tente novamente em instantes.';
}

function mapUserMessage({ message, status } = {}) {
  const raw = String(message || '').trim();
  if (!raw) return mapHttpStatusMessage(status);
  const lower = raw.toLowerCase();
  if (lower.includes('csrf')) return 'Sua sessão expirou por segurança. Atualize a página e tente novamente.';
  if (/token não fornecido|token inválido|não autenticado|credenciais|acesso negado/.test(lower))
    return 'Sua sessão administrativa expirou. Faça login novamente.';
  if (/^erro http\s+\d+$/i.test(raw)) return mapHttpStatusMessage(status);
  if (Number(status || 0) >= 500) return mapHttpStatusMessage(status);
  return raw;
}

export function isAuthErrorMessage(message) {
  return /nao autenticado|não autenticado|token nao fornecido|token não fornecido|token invalido|token inválido|credenciais|acesso negado|sess[aã]o|401|403|permiss[aã]o/i.test(String(message || ''));
}

function buildHeaders({ token, hasJsonBody, csrfToken } = {}) {
  const headers = {};
  if (hasJsonBody) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (csrfToken) headers['x-csrf-token'] = csrfToken;
  return headers;
}

function buildQueryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    query.set(k, String(v));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

async function garantirCsrfToken(forceRefresh = false) {
  if (!forceRefresh) {
    const existente = obterCsrfToken();
    if (existente) return existente;
  }
  if (forceRefresh) csrfTokenCache = '';
  let data;
  try {
    data = await apiGet('/api/auth/csrf', { headers: buildHeaders() });
  } catch (error) {
    const s = Number(error?.status || 0);
    const serverMsg = error?.serverMessage || error?.message || `Erro HTTP ${s || 500}`;
    const e = new Error(mapUserMessage({ message: serverMsg, status: s }));
    e.status = s;
    e.serverMessage = serverMsg;
    throw e;
  }
  atualizarCsrfToken(data?.csrfToken);
  return obterCsrfToken();
}

function isAuthLikeResponse(path, status) {
  const s = Number(status || 0);
  return s === 401 || s === 403;
}

function extrairNomeArquivoCabecalho(contentDisposition) {
  const header = String(contentDisposition || '').trim();
  if (!header) return '';
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) { try { return decodeURIComponent(utf8Match[1]); } catch { return String(utf8Match[1]); } }
  const quotedMatch = header.match(/filename="?([^";]+)"?/i);
  return quotedMatch?.[1] ? String(quotedMatch[1]).trim() : '';
}

function sanitizarNomeArquivoDownload(nomeArquivo, fallback = 'download.bin') {
  const n = String(nomeArquivo || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
  return n || fallback;
}

async function request(path, options = {}, tentativa = 0) {
  const { method = 'GET', token, body, signal } = options;
  const methodUpper = String(method || 'GET').toUpperCase();
  const persistedToken = getAdminAccessToken();
  const tokenToUse = String(token || persistedToken || '').trim();
  const hasBody = body !== undefined;
  const isFormDataBody = hasBody && typeof FormData !== 'undefined' && body instanceof FormData;
  const hasJsonBody = hasBody && !isFormDataBody;
  const precisaCsrf = isMutatingMethod(methodUpper) && !tokenToUse;

  let csrfToken = '';
  if (precisaCsrf) csrfToken = await garantirCsrfToken();

  let data;
  try {
    data = await apiRequest(path, {
      method: methodUpper,
      headers: buildHeaders({ token: tokenToUse, hasJsonBody, csrfToken }),
      body: hasBody ? body : undefined,
      signal
    });
  } catch (error) {
    const responseStatus = Number(error?.status || 0);
    const serverMessage = error?.serverMessage || error?.message || `Erro HTTP ${responseStatus || 500}`;
    if (responseStatus === 403 && /csrf/i.test(serverMessage) && precisaCsrf && tentativa === 0) {
      await garantirCsrfToken(true);
      return request(path, options, 1);
    }
    if (isAuthLikeResponse(path, responseStatus)) clearAdminAccessToken();
    const userMessage = mapUserMessage({ message: serverMessage, status: responseStatus });
    const mappedError = new Error(userMessage);
    mappedError.status = responseStatus;
    mappedError.serverMessage = serverMessage;
    throw mappedError;
  }

  atualizarCsrfToken(data?.csrfToken);
  salvarTokenPorRota(path, data?.accessToken);
  return data;
}

async function requestArquivo(path, options = {}, tentativa = 0) {
  const { method = 'GET', token, body, signal, fallbackFileName = 'download.bin' } = options;
  const methodUpper = String(method || 'GET').toUpperCase();
  const persistedToken = getAdminAccessToken();
  const tokenToUse = String(token || persistedToken || '').trim();
  const hasBody = body !== undefined;
  const isFormDataBody = hasBody && typeof FormData !== 'undefined' && body instanceof FormData;
  const hasJsonBody = hasBody && !isFormDataBody;
  const precisaCsrf = isMutatingMethod(methodUpper) && !tokenToUse;

  let csrfToken = '';
  if (precisaCsrf) csrfToken = await garantirCsrfToken();

  let response;
  try {
    response = await apiRequest(path, {
      method: methodUpper,
      headers: buildHeaders({ token: tokenToUse, hasJsonBody, csrfToken }),
      body: hasBody ? body : undefined,
      signal,
      responseType: 'raw'
    });
  } catch (error) {
    const responseStatus = Number(error?.status || 0);
    const serverMessage = error?.serverMessage || error?.message || `Erro HTTP ${responseStatus || 500}`;
    if (responseStatus === 403 && /csrf/i.test(serverMessage) && precisaCsrf && tentativa === 0) {
      await garantirCsrfToken(true);
      return requestArquivo(path, options, 1);
    }
    if (isAuthLikeResponse(path, responseStatus)) clearAdminAccessToken();
    const userMessage = mapUserMessage({ message: serverMessage, status: responseStatus });
    const mappedError = new Error(userMessage);
    mappedError.status = responseStatus;
    mappedError.serverMessage = serverMessage;
    throw mappedError;
  }

  const contentDisposition = response?.headers?.get?.('content-disposition');
  const fileNameHeader = extrairNomeArquivoCabecalho(contentDisposition);
  const fileName = sanitizarNomeArquivoDownload(fileNameHeader, fallbackFileName);
  const contentType = String(response?.headers?.get?.('content-type') || '').trim();
  const blob = await response.blob();
  return { blob, fileName, contentType };
}

// ── Admin Auth ──────────────────────────────────────────────
export function adminLogin(usuario, senha) {
  return request('/api/admin/login', { method: 'POST', body: { usuario, senha } });
}

export function adminVerify2FA(codigo) {
  return request('/api/admin/login/verify', { method: 'POST', body: { codigo } });
}

export async function adminLogout() {
  try { return await request('/api/admin/logout', { method: 'POST' }); }
  finally { clearAdminAccessToken(); }
}

export function adminGetMe() {
  return request('/api/admin/me');
}

// ── Pedidos ──────────────────────────────────────────────
export function adminGetPedidos(params = {}) {
  return request(`/api/admin/pedidos${buildQueryString(params)}`);
}

export function adminGetDashboardResumo(params = {}) {
  return request(`/api/admin/dashboard/resumo${buildQueryString(params)}`);
}

export function adminAtualizarStatusPedido(pedidoId, status) {
  return request(`/api/admin/pedidos/${pedidoId}/status`, { method: 'PUT', body: { status } });
}

export function adminListarEntregasUber() {
  return request('/api/admin/delivery/pedidos');
}

export function adminCriarEntregaUber({ pedidoId, estimateId }) {
  return request('/api/delivery/create', {
    method: 'POST',
    body: { pedido_id: Number(pedidoId || 0), estimate_id: String(estimateId || '').trim() || undefined }
  });
}

export function adminCancelarEntregaUber({ pedidoId, motivo = 'cancelamento_operacional' }) {
  return request('/api/delivery/cancel', {
    method: 'POST',
    body: { pedido_id: Number(pedidoId || 0), motivo: String(motivo || 'cancelamento_operacional').trim() }
  });
}

// ── Revisao ──────────────────────────────────────────────
export function adminAprovarRevisao(pedidoId, observacao = '') {
  return request(`/api/admin/pedidos/${pedidoId}/aprovar-revisao`, { method: 'PUT', body: { observacao } });
}

export function adminRejeitarRevisao(pedidoId, motivo = '') {
  return request(`/api/admin/pedidos/${pedidoId}/rejeitar-revisao`, { method: 'PUT', body: { motivo } });
}

// ── Produtos ──────────────────────────────────────────────
export function adminCadastrarProduto(dadosProduto) {
  return request('/api/admin/produtos', { method: 'POST', body: dadosProduto });
}

export function adminBuscarProdutoPorCodigoBarras(codigoBarras) {
  const codigo = String(codigoBarras || '').replace(/\D/g, '');
  return request(`/api/admin/produtos/barcode/${codigo}`);
}

export function adminExcluirProduto(produtoId) {
  return request(`/api/admin/produtos/${produtoId}`, { method: 'DELETE' });
}

export function adminImportarProdutosPlanilha({ arquivo, criarNovos = false, simular = false } = {}) {
  const isFile = typeof File !== 'undefined' && arquivo instanceof File;
  const isBlob = typeof Blob !== 'undefined' && arquivo instanceof Blob;
  if (!isFile && !isBlob) throw new Error('Selecione um arquivo .xls, .xlsx ou .csv para importar.');
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  formData.append('criar_novos', criarNovos ? 'true' : 'false');
  formData.append('atualizar_estoque', 'false');
  formData.append('simular', simular ? 'true' : 'false');
  return request('/api/admin/produtos/importar', { method: 'POST', body: formData });
}

export function adminGetImportacoesProdutos(params = {}) {
  return request(`/api/admin/produtos/importacoes${buildQueryString(params)}`);
}

export function getAdminModeloImportacaoUrl() {
  return `${API_BASE_URL}/api/admin/produtos/importacao/modelo`;
}

export function getProdutos(params = {}, options = {}) {
  return request('/api/produtos' + buildQueryString(params), options);
}

// ── Catalogo ──────────────────────────────────────────────
export function adminGetCatalogDashboard() {
  return request('/api/admin/catalogo/dashboard');
}

export function adminListarCatalogoProdutos(params = {}) {
  return request(`/api/admin/catalogo/produtos${buildQueryString(params)}`);
}

export function adminAtualizarProdutoCatalogo(produtoId, payload = {}) {
  return request(`/api/admin/catalogo/produtos/${produtoId}`, { method: 'PATCH', body: payload });
}

export function adminEnriquecerProdutoCatalogo(produtoId, {
  force = false, preferSpreadsheet = true, overwriteImageMode = 'if_empty'
} = {}) {
  return request(`/api/admin/catalogo/produtos/${produtoId}/enriquecer`, {
    method: 'POST',
    body: {
      force: Boolean(force),
      prefer_spreadsheet: Boolean(preferSpreadsheet),
      overwrite_image_mode: String(overwriteImageMode || 'if_empty').trim() || 'if_empty'
    }
  });
}

export function adminReprocessarFalhasEnriquecimento({
  limit = 30, concurrency = 3, overwriteImageMode = 'if_empty'
} = {}) {
  return request('/api/admin/catalogo/enriquecimento/reprocessar-falhas', {
    method: 'POST',
    body: { limit, concurrency, overwrite_image_mode: String(overwriteImageMode || 'if_empty').trim() || 'if_empty' }
  });
}

export function adminEnriquecerProdutosSemImagem({
  limit = 80, concurrency = 3, force = false, overwriteImageMode = 'if_empty'
} = {}) {
  return request('/api/admin/catalogo/enriquecimento/sem-imagem', {
    method: 'POST',
    body: { limit, concurrency, force: Boolean(force), overwrite_image_mode: String(overwriteImageMode || 'if_empty').trim() || 'if_empty' }
  });
}

export function adminEnriquecerImportacaoRecente({
  windowMinutes = 180, limit = 120, concurrency = 3, somenteSemImagem = true, force = false, overwriteImageMode = 'if_empty'
} = {}) {
  return request('/api/admin/catalogo/enriquecimento/importacao-recente', {
    method: 'POST',
    body: {
      window_minutes: windowMinutes, limit, concurrency,
      somente_sem_imagem: Boolean(somenteSemImagem),
      force: Boolean(force),
      overwrite_image_mode: String(overwriteImageMode || 'if_empty').trim() || 'if_empty'
    }
  });
}

export function adminGetEnriquecimentoLogs(params = {}) {
  return request(`/api/admin/catalogo/enriquecimento/logs${buildQueryString(params)}`);
}

export function adminGetCatalogImportLogs(params = {}) {
  return request(`/api/admin/catalogo/importacoes${buildQueryString(params)}`);
}

export function adminImportarCatalogoPlanilha({
  arquivo, criarNovos = false, simular = false, atualizarEstoque = false,
  mapeamentoColunas = null, enriquecerPosImportacao = false, enriquecerApenasSemImagem = true,
  enriquecerLimite = 80, enriquecerConcorrencia = 3, enriquecerForceLookup = false,
  enriquecerJanelaMinutos = 180, overwriteImageMode = 'if_empty'
} = {}) {
  const isFile = typeof File !== 'undefined' && arquivo instanceof File;
  const isBlob = typeof Blob !== 'undefined' && arquivo instanceof Blob;
  if (!isFile && !isBlob) throw new Error('Selecione um arquivo .xls, .xlsx ou .csv para importar.');
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  formData.append('criar_novos', criarNovos ? 'true' : 'false');
  formData.append('simular', simular ? 'true' : 'false');
  formData.append('atualizar_estoque', atualizarEstoque ? 'true' : 'false');
  formData.append('overwrite_image_mode', String(overwriteImageMode || 'if_empty').trim() || 'if_empty');
  if (!simular) {
    formData.append('enriquecer_imagens_pos_importacao', enriquecerPosImportacao ? 'true' : 'false');
    formData.append('enriquecer_apenas_sem_imagem', enriquecerApenasSemImagem ? 'true' : 'false');
    formData.append('enriquecer_limite', String(enriquecerLimite));
    formData.append('enriquecer_concorrencia', String(enriquecerConcorrencia));
    formData.append('enriquecer_force_lookup', enriquecerForceLookup ? 'true' : 'false');
    formData.append('enriquecer_janela_minutos', String(enriquecerJanelaMinutos));
  }
  if (mapeamentoColunas && typeof mapeamentoColunas === 'object') {
    formData.append('mapeamento_colunas', JSON.stringify(mapeamentoColunas));
  }
  return request('/api/admin/catalogo/produtos/importar', { method: 'POST', body: formData });
}

export function getAdminCatalogModeloImportacaoUrl() {
  return `${API_BASE_URL}/api/admin/catalogo/produtos/importacao/modelo`;
}

export function getAdminCatalogExportUrl(params = {}) {
  return `${API_BASE_URL}/api/admin/catalogo/produtos/exportar.xlsx${buildQueryString(params)}`;
}

export function adminBaixarCatalogModeloImportacao() {
  return requestArquivo('/api/admin/catalogo/produtos/importacao/modelo', { fallbackFileName: 'modelo-importacao-produtos.csv' });
}

export function adminBaixarCatalogoExportacao(params = {}) {
  return requestArquivo(`/api/admin/catalogo/produtos/exportar.xlsx${buildQueryString(params)}`, { fallbackFileName: 'produtos_admin.xlsx' });
}

// ── Fila, Clientes, Financeiro, Auditoria, Relatorios ──────
export function adminGetFilaOperacional() {
  return request('/api/admin/fila-operacional');
}

export function adminGetPedidoItensRevisao(pedidoId) {
  return request(`/api/admin/pedidos/${pedidoId}/itens`);
}

export function adminGetPedidoDetalhes(pedidoId) {
  return request(`/api/admin/pedidos/${pedidoId}/detalhes`);
}

export function adminGetClientes(params = {}) {
  return request(`/api/admin/clientes${buildQueryString(params)}`);
}

export function adminGetClienteDetalhe(clienteId) {
  return request(`/api/admin/clientes/${clienteId}`);
}

export function adminGetConciliacao(params = {}) {
  return request(`/api/admin/financeiro/conciliacao${buildQueryString(params)}`);
}

export function adminGetFechamentoDiario(params = {}) {
  return request(`/api/admin/financeiro/fechamento${buildQueryString(params)}`);
}

export function adminGetAuditoria(params = {}) {
  return request(`/api/admin/auditoria${buildQueryString(params)}`);
}

export function adminGetRelatorioVendas(params = {}) {
  return request(`/api/admin/relatorios/vendas${buildQueryString(params)}`);
}

export function adminExportarRelatorioVendasCSV(params = {}) {
  return requestArquivo(`/api/admin/relatorios/vendas${buildQueryString({ ...params, formato: 'csv' })}`, {
    fallbackFileName: `vendas_${Date.now()}.csv`
  });
}

// ── Central de Comando ──────
export function adminGetCentralVivo() {
  return request('/api/admin/central/vivo');
}

export function adminGetFeed(params = {}) {
  return request(`/api/admin/feed${buildQueryString(params)}`);
}

export function adminGetAlertas() {
  return request('/api/admin/alertas');
}

export function adminGetCatalogoSaude() {
  return request('/api/admin/catalogo/saude');
}

export function adminGetCatalogoSaudeProdutos(params = {}) {
  return request(`/api/admin/catalogo/saude/produtos${buildQueryString(params)}`);
}
