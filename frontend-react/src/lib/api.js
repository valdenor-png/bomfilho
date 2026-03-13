const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const CSRF_COOKIE_KEY = 'bf_csrf_token';
const USER_ACCESS_TOKEN_KEY = 'bf_user_access_token';
const ADMIN_ACCESS_TOKEN_KEY = 'bf_admin_access_token';
const GENERIC_USER_ERROR_MESSAGE = 'Não foi possível concluir sua solicitação agora. Tente novamente em instantes.';
let csrfTokenCache = '';
const IS_NGROK_API = /ngrok(-free)?\.dev|ngrok\.io/i.test(String(API_BASE_URL || ''));

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

function buildHeaders({ token, hasBody, csrfToken } = {}) {
  const headers = {};
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  // Evita a pagina de alerta do ngrok em requisicoes XHR/fetch no browser.
  if (IS_NGROK_API) {
    headers['ngrok-skip-browser-warning'] = 'true';
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

  const response = await fetch(`${API_BASE_URL}/api/auth/csrf`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders()
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const serverMessage = data?.erro || data?.mensagem || `Erro HTTP ${response.status}`;
    const userMessage = mapUserMessage({
      message: serverMessage,
      status: response.status,
      path: '/api/auth/csrf'
    });
    const mappedError = new Error(userMessage);
    mappedError.status = response.status;
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
  const precisaCsrf = isMutatingMethod(methodUpper) && !tokenToUse;

  let csrfToken = '';
  if (precisaCsrf) {
    csrfToken = await garantirCsrfToken();
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: methodUpper,
    credentials: 'include',
    headers: buildHeaders({ token: tokenToUse, hasBody, csrfToken }),
    body: hasBody ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  atualizarCsrfToken(data?.csrfToken);
  salvarTokenPorRota(path, data?.accessToken);

  if (!response.ok) {
    const serverMessage = data?.erro || data?.mensagem || `Erro HTTP ${response.status}`;

    if (response.status === 403 && /csrf/i.test(serverMessage) && precisaCsrf && tentativa === 0) {
      await garantirCsrfToken(true);
      return request(path, options, 1);
    }

    if (response.status === 401 || response.status === 403) {
      if (isAdminPath) {
        clearAdminAccessToken();
      } else {
        clearUserAccessToken();
      }
    }

    const userMessage = mapUserMessage({
      message: serverMessage,
      status: response.status,
      path,
      isAdminPath
    });

    const mappedError = new Error(userMessage);
    mappedError.status = response.status;
    mappedError.serverMessage = serverMessage;
    throw mappedError;
  }

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
