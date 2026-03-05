const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const CSRF_COOKIE_KEY = 'bf_csrf_token';
let csrfTokenCache = '';

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
  const hasBody = body !== undefined;
  const precisaCsrf = isMutatingMethod(methodUpper);

  let csrfToken = '';
  if (precisaCsrf) {
    csrfToken = await garantirCsrfToken();
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: methodUpper,
    credentials: 'include',
    headers: buildHeaders({ token, hasBody, csrfToken }),
    body: hasBody ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  atualizarCsrfToken(data?.csrfToken);

  if (!response.ok) {
    const message = data?.erro || data?.mensagem || `Erro HTTP ${response.status}`;

    if (response.status === 403 && /csrf/i.test(message) && precisaCsrf && tentativa === 0) {
      await garantirCsrfToken(true);
      return request(path, options, 1);
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

export function adminLogout() {
  return request('/api/admin/logout', {
    method: 'POST'
  });
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

export function logout() {
  return request('/api/auth/logout', {
    method: 'POST'
  });
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
