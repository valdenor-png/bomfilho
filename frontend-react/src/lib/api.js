import API_BASE_URL from '../config/api';
import { apiGet, apiRequest } from '../services/api';

const CSRF_COOKIE_KEY = 'bf_csrf_token';
const USER_ACCESS_TOKEN_KEY = 'bf_user_access_token';
const ADMIN_ACCESS_TOKEN_KEY = 'bf_admin_access_token';
const GENERIC_USER_ERROR_MESSAGE = 'Não foi possível concluir sua solicitação agora. Tente novamente em instantes.';
let csrfTokenCache = '';

function readStorage(key) {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return String(window.localStorage.getItem(key) || '').trim();
  } catch {
    return '';
  }
}

function writeStorage(key, value) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const normalized = String(value || '').trim();
    if (!normalized) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, normalized);
  } catch {
    // Ignora falhas de storage para nao bloquear a navegacao.
  }
}

function clearUserAccessToken() {
  writeStorage(USER_ACCESS_TOKEN_KEY, '');
}

function clearAdminAccessToken() {
  writeStorage(ADMIN_ACCESS_TOKEN_KEY, '');
}

function getUserAccessToken() {
  return readStorage(USER_ACCESS_TOKEN_KEY);
}

function getAdminAccessToken() {
  return readStorage(ADMIN_ACCESS_TOKEN_KEY);
}

function salvarTokenPorRota(path, token) {
  const normalizedPath = String(path || '');
  const normalizedToken = String(token || '').trim();

  if (!normalizedToken) {
    return;
  }

  if (normalizedPath.startsWith('/api/admin/')) {
    writeStorage(ADMIN_ACCESS_TOKEN_KEY, normalizedToken);
    return;
  }

  writeStorage(USER_ACCESS_TOKEN_KEY, normalizedToken);
}

function isMutatingMethod(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || '').toUpperCase());
}

function readCookie(name) {
  if (typeof document === 'undefined') {
    return '';
  }

  const cookieName = `${name}=`;
  const cookies = String(document.cookie || '').split(';');
  for (const entry of cookies) {
    const trimmed = entry.trim();
    if (trimmed.startsWith(cookieName)) {
      return decodeURIComponent(trimmed.substring(cookieName.length));
    }
  }
  return '';
}

function atualizarCsrfToken(token) {
  const normalizado = String(token || '').trim();
  if (normalizado) {
    csrfTokenCache = normalizado;
  }
}

function obterCsrfToken() {
  return csrfTokenCache || readCookie(CSRF_COOKIE_KEY);
}

function mapHttpStatusMessage(status) {
  const statusCode = Number(status || 0);

  if (statusCode === 400) {
    return 'Não foi possível concluir a solicitação. Revise os dados e tente novamente.';
  }

  if (statusCode === 401) {
    return 'Sua sessão expirou. Faça login novamente.';
  }

  if (statusCode === 403) {
    return 'Você não tem permissão para realizar esta ação.';
  }

  if (statusCode === 404) {
    return 'Não encontramos as informações solicitadas.';
  }

  if (statusCode >= 500) {
    return GENERIC_USER_ERROR_MESSAGE;
  }

  return GENERIC_USER_ERROR_MESSAGE;
}

function mapUserMessage({ message, status, path, isAdminPath = false } = {}) {
  const rawMessage = String(message || '').trim();
  const normalizedMessage = rawMessage.toLowerCase();
  const normalizedPath = String(path || '').trim().toLowerCase();

  if (!rawMessage) {
    return mapHttpStatusMessage(status);
  }

  if (normalizedMessage.includes('csrf')) {
    return 'Sua sessão expirou por segurança. Atualize a página e tente novamente.';
  }

  if (/token não fornecido|token inválido|não autenticado|credenciais|acesso negado/.test(normalizedMessage)) {
    if (isAdminPath) {
      return 'Sua sessão administrativa expirou. Faça login novamente.';
    }
    return 'Sua sessão expirou. Faça login novamente.';
  }

  const isPagamentoPath = normalizedPath.startsWith('/api/pagamentos/') || normalizedPath.startsWith('/api/pagbank/');
  if (isPagamentoPath) {
    if (normalizedMessage.includes('pagbank não configurado')) {
      return 'Esta forma de pagamento está temporariamente indisponível. Tente novamente em instantes.';
    }

    if (normalizedMessage.includes('pedido_id')) {
      return 'Não foi possível identificar o pedido para pagamento. Atualize a página e tente novamente.';
    }

    if (normalizedMessage.includes('tax_id') || normalizedMessage.includes('cpf') || normalizedMessage.includes('cnpj')) {
      return 'Informe um CPF ou CNPJ válido para continuar o pagamento.';
    }

    if (normalizedMessage.includes('token_cartao')) {
      return 'Não foi possível validar os dados do cartão. Revise as informações e tente novamente.';
    }
  }

  if (/^erro http\s+\d+$/i.test(rawMessage)) {
    return mapHttpStatusMessage(status);
  }

  if (Number(status || 0) >= 500) {
    return GENERIC_USER_ERROR_MESSAGE;
  }

  return rawMessage;
}

function buildHeaders({ token, hasJsonBody, csrfToken } = {}) {
  const headers = {};
  if (hasJsonBody) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  return headers;
}

function buildQueryString(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params || {}).forEach(([chave, valor]) => {
    if (valor === undefined || valor === null || valor === '') {
      return;
    }

    query.set(chave, String(valor));
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

async function garantirCsrfToken(forceRefresh = false) {
  if (!forceRefresh) {
    const existente = obterCsrfToken();
    if (existente) {
      return existente;
    }
  }

  if (forceRefresh) {
    csrfTokenCache = '';
  }

  let data;
  try {
    data = await apiGet('/api/auth/csrf', {
      headers: buildHeaders()
    });
  } catch (error) {
    const responseStatus = Number(error?.status || 0);
    const serverMessage = error?.serverMessage || error?.message || `Erro HTTP ${responseStatus || 500}`;
    const userMessage = mapUserMessage({
      message: serverMessage,
      status: responseStatus,
      path: '/api/auth/csrf'
    });
    const mappedError = new Error(userMessage);
    mappedError.status = responseStatus;
    mappedError.serverMessage = serverMessage;
    throw mappedError;
  }

  atualizarCsrfToken(data?.csrfToken);
  return obterCsrfToken();
}

export function isAuthErrorMessage(message) {
  return /não autenticado|token não fornecido|token inválido|credenciais|acesso negado|401|403/i.test(String(message || ''));
}

async function request(path, options = {}, tentativa = 0) {
  const { method = 'GET', token, body } = options;
  const methodUpper = String(method || 'GET').toUpperCase();
  const isAdminPath = String(path || '').startsWith('/api/admin/');
  const persistedToken = isAdminPath ? getAdminAccessToken() : getUserAccessToken();
  const tokenToUse = String(token || persistedToken || '').trim();
  const hasBody = body !== undefined;
  const isFormDataBody = hasBody && typeof FormData !== 'undefined' && body instanceof FormData;
  const hasJsonBody = hasBody && !isFormDataBody;
  const precisaCsrf = isMutatingMethod(methodUpper) && !tokenToUse;

  let csrfToken = '';
  if (precisaCsrf) {
    csrfToken = await garantirCsrfToken();
  }

  let data;
  try {
    data = await apiRequest(path, {
      method: methodUpper,
      headers: buildHeaders({ token: tokenToUse, hasJsonBody, csrfToken }),
      body: hasBody ? body : undefined
    });
  } catch (error) {
    const responseStatus = Number(error?.status || 0);
    const serverMessage = error?.serverMessage || error?.message || `Erro HTTP ${responseStatus || 500}`;

    if (responseStatus === 403 && /csrf/i.test(serverMessage) && precisaCsrf && tentativa === 0) {
      await garantirCsrfToken(true);
      return request(path, options, 1);
    }

    if (responseStatus === 401 || responseStatus === 403) {
      if (isAdminPath) {
        clearAdminAccessToken();
      } else {
        clearUserAccessToken();
      }
    }

    const userMessage = mapUserMessage({
      message: serverMessage,
      status: responseStatus,
      path,
      isAdminPath
    });

    const mappedError = new Error(userMessage);
    mappedError.status = responseStatus;
    mappedError.serverMessage = serverMessage;
    throw mappedError;
  }

  atualizarCsrfToken(data?.csrfToken);
  salvarTokenPorRota(path, data?.accessToken);

  return data;
}

export function adminLogin(usuario, senha) {
  return request('/api/admin/login', {
    method: 'POST',
    body: { usuario, senha }
  });
}

export async function adminLogout() {
  try {
    return await request('/api/admin/logout', {
      method: 'POST'
    });
  } finally {
    clearAdminAccessToken();
  }
}

export function adminGetMe() {
  return request('/api/admin/me');
}

export function login(email, senha, recaptchaToken = '') {
  return request('/api/auth/login', {
    method: 'POST',
    body: {
      email,
      senha,
      recaptcha_token: String(recaptchaToken || '').trim() || undefined
    }
  });
}

export function cadastrar({ nome, email, senha, telefone, whatsappOptIn, recaptchaToken }) {
  return request('/api/auth/cadastro', {
    method: 'POST',
    body: {
      nome,
      email,
      senha,
      telefone,
      whatsapp_opt_in: whatsappOptIn,
      recaptcha_token: String(recaptchaToken || '').trim() || undefined
    }
  });
}

export async function logout() {
  try {
    return await request('/api/auth/logout', {
      method: 'POST'
    });
  } finally {
    clearUserAccessToken();
  }
}

export function getMe() {
  return request('/api/auth/me');
}

export function getEndereco() {
  return request('/api/endereco');
}

function formatarCepVisual(cep) {
  const digits = String(cep || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export async function buscarEnderecoViaCep(cep) {
  const cepLimpo = String(cep || '').replace(/\D/g, '').slice(0, 8);
  if (cepLimpo.length !== 8) {
    throw new Error('CEP inválido');
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);

    if (!response.ok) {
      throw new Error('Não foi possível consultar o CEP no momento.');
    }

    const data = await response.json();
    if (data?.erro) {
      throw new Error('CEP não encontrado');
    }

    return {
      cep: formatarCepVisual(cepLimpo),
      logradouro: String(data?.logradouro || '').trim(),
      bairro: String(data?.bairro || '').trim(),
      cidade: String(data?.localidade || '').trim(),
      estado: String(data?.uf || '').trim(),
      complemento: String(data?.complemento || '').trim()
    };
  } catch (error) {
    const mensagem = String(error?.message || '').trim();

    if (mensagem === 'CEP inválido' || mensagem === 'CEP não encontrado') {
      throw error;
    }

    throw new Error('Não foi possível consultar o CEP. Verifique sua conexão e tente novamente.');
  }
}

export function salvarEndereco({
  rua,
  numero,
  bairro,
  cidade,
  estado,
  cep,
  complemento,
  referencia
} = {}) {
  return request('/api/endereco', {
    method: 'POST',
    body: {
      rua: String(rua || '').trim(),
      numero: String(numero || '').trim(),
      bairro: String(bairro || '').trim(),
      cidade: String(cidade || '').trim(),
      estado: String(estado || '').trim().toUpperCase().slice(0, 2),
      cep: formatarCepVisual(cep),
      complemento: String(complemento || '').trim(),
      referencia: String(referencia || '').trim()
    }
  });
}

export function atualizarPreferenciasWhatsapp({ telefone, whatsappOptIn }) {
  return request('/api/usuario/whatsapp', {
    method: 'POST',
    body: {
      telefone: String(telefone || '').trim(),
      whatsapp_opt_in: Boolean(whatsappOptIn)
    }
  });
}

export function getPedidos(params = {}) {
  return request(`/api/pedidos${buildQueryString(params)}`);
}

export function getPedidoById(pedidoId) {
  return request(`/api/pedidos/${pedidoId}`);
}

export function getProdutos(params = {}) {
  return request(`/api/produtos${buildQueryString(params)}`);
}

export function simularFretePorCep({ cep, veiculo = 'moto' }) {
  const cepNormalizado = String(cep || '').replace(/\D/g, '').slice(0, 8);
  const veiculoNormalizado = String(veiculo || 'moto').trim().toLowerCase();
  return request(`/api/frete/simular?cep=${cepNormalizado}&veiculo=${encodeURIComponent(veiculoNormalizado)}`);
}

export function criarPedido({ itens, formaPagamento = 'pix', entrega, taxId }) {
  const body = {
    itens,
    forma_pagamento: formaPagamento
  };

  if (entrega && typeof entrega === 'object') {
    body.entrega = entrega;
  }

  const taxIdDigits = String(taxId || '').replace(/\D/g, '');
  if (taxIdDigits) {
    body.tax_id = taxIdDigits;
  }

  return request('/api/pedidos', {
    method: 'POST',
    body
  });
}

export function gerarPix(pedidoId, taxId) {
  const taxIdDigits = String(taxId || '').replace(/\D/g, '');
  const body = { pedido_id: pedidoId };

  if (taxIdDigits) {
    body.tax_id = taxIdDigits;
  }

  return request('/api/pagamentos/pix', {
    method: 'POST',
    body
  });
}

export function getPagBankPublicKey() {
  return request('/api/pagbank/public-key');
}

export function pagarCartao(
  pedidoId,
  {
    taxId,
    tokenCartao,
    parcelas = 1,
    tipoCartao = 'credito',
    authenticationMethod
  } = {}
) {
  const taxIdDigits = String(taxId || '').replace(/\D/g, '');
  const tokenNormalizado = String(tokenCartao || '').trim();
  const parcelasNormalizadas = Number.parseInt(parcelas, 10);
  const tipoCartaoNormalizado = String(tipoCartao || '').trim().toLowerCase();
  const body = {
    pedido_id: pedidoId,
    parcelas: Number.isFinite(parcelasNormalizadas) ? parcelasNormalizadas : 1,
    tipo_cartao: ['debito', 'debit', 'debit_card'].includes(tipoCartaoNormalizado) ? 'debito' : 'credito'
  };

  if (taxIdDigits) {
    body.tax_id = taxIdDigits;
  }

  if (tokenNormalizado) {
    body.token_cartao = tokenNormalizado;
  }

  if (authenticationMethod && typeof authenticationMethod === 'object') {
    body.authentication_method = authenticationMethod;
  }

  return request('/api/pagamentos/cartao', {
    method: 'POST',
    body
  });
}

export function adminGetPedidos(params = {}) {
  return request(`/api/admin/pedidos${buildQueryString(params)}`);
}

export function adminAtualizarStatusPedido(pedidoId, status) {
  return request(`/api/admin/pedidos/${pedidoId}/status`, {
    method: 'PUT',
    body: { status }
  });
}

export function adminCadastrarProduto(dadosProduto) {
  return request('/api/admin/produtos', {
    method: 'POST',
    body: dadosProduto
  });
}

export function adminBuscarProdutoPorCodigoBarras(codigoBarras) {
  const codigo = String(codigoBarras || '').replace(/\D/g, '');
  return request(`/api/admin/produtos/barcode/${codigo}`);
}

export function adminExcluirProduto(produtoId) {
  return request(`/api/admin/produtos/${produtoId}`, {
    method: 'DELETE'
  });
}

export function adminImportarProdutosPlanilha({ arquivo, criarNovos = false, simular = false } = {}) {
  const isFile = typeof File !== 'undefined' && arquivo instanceof File;
  const isBlob = typeof Blob !== 'undefined' && arquivo instanceof Blob;
  if (!isFile && !isBlob) {
    throw new Error('Selecione um arquivo .xlsx ou .csv para importar.');
  }

  const formData = new FormData();
  formData.append('arquivo', arquivo);
  formData.append('criar_novos', criarNovos ? 'true' : 'false');
  formData.append('atualizar_estoque', 'false');
  formData.append('simular', simular ? 'true' : 'false');

  return request('/api/admin/produtos/importar', {
    method: 'POST',
    body: formData
  });
}

export function adminGetImportacoesProdutos(params = {}) {
  return request(`/api/admin/produtos/importacoes${buildQueryString(params)}`);
}

export function getAdminModeloImportacaoUrl() {
  return `${API_BASE_URL}/api/admin/produtos/importacao/modelo`;
}
