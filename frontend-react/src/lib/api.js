const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'bomfilho_token';

function buildHeaders(token, hasBody) {
  const headers = {};
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function request(path, options = {}) {
  const { method = 'GET', token, body } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders(token, body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.erro || data?.mensagem || `Erro HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setStoredToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
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

export function getMe(token) {
  return request('/api/auth/me', { token });
}

export function getPedidos(token) {
  return request('/api/pedidos', { token });
}

export function getProdutos() {
  return request('/api/produtos');
}

export function criarPedido(token, { itens, formaPagamento = 'pix' }) {
  return request('/api/pedidos', {
    method: 'POST',
    token,
    body: {
      itens,
      forma_pagamento: formaPagamento
    }
  });
}

export function gerarPix(token, pedidoId) {
  return request('/api/pagamentos/pix', {
    method: 'POST',
    token,
    body: { pedido_id: pedidoId }
  });
}
