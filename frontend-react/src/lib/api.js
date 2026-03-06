const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const CSRF_COOKIE_KEY = 'bf_csrf_token';
const USER_ACCESS_TOKEN_KEY = 'bf_user_access_token';
const ADMIN_ACCESS_TOKEN_KEY = 'bf_admin_access_token';
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

function buildHeaders({ token, hasBody, csrfToken }) {
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

  return headers;
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
    credentials: 'include'
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.erro || data?.mensagem || `Erro HTTP ${response.status}`;
    throw new Error(message);
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
    const message = data?.erro || data?.mensagem || `Erro HTTP ${response.status}`;

    if (response.status === 403 && /csrf/i.test(message) && precisaCsrf && tentativa === 0) {
      await garantirCsrfToken(true);
      return request(path, options, 1);
    }

    if (response.status === 401 || response.status === 403) {
      if (isAdminPath) {
        clearAdminAccessToken();
      } else if (String(path || '').startsWith('/api/auth/')) {
        clearUserAccessToken();
      }
    }

    throw new Error(message);
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

export function login(email, senha) {
  return request('/api/auth/login', {
    method: 'POST',
    body: { email, senha }
  });
}

export function cadastrar({ nome, email, senha, telefone, whatsappOptIn }) {
  return request('/api/auth/cadastro', {
    method: 'POST',
    body: {
      nome,
      email,
      senha,
      telefone,
      whatsapp_opt_in: whatsappOptIn
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

export function getPedidos() {
  return request('/api/pedidos');
}

export function getPedidoById(pedidoId) {
  return request(`/api/pedidos/${pedidoId}`);
}

export function getProdutos() {
  return request('/api/produtos');
}

export function criarPedido({ itens, formaPagamento = 'pix' }) {
  return request('/api/pedidos', {
    method: 'POST',
    body: {
      itens,
      forma_pagamento: formaPagamento
    }
  });
}

export function gerarPix(pedidoId) {
  return request('/api/pagamentos/pix', {
    method: 'POST',
    body: { pedido_id: pedidoId }
  });
}

export function adminGetPedidos() {
  return request('/api/admin/pedidos');
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
