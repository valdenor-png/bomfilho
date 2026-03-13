import API_BASE_URL, { API_TIMEOUT_MS, IS_DEVELOPMENT, IS_NGROK_API } from '../config/api';

function logApi(evento, dados) {
  if (!IS_DEVELOPMENT) {
    return;
  }

  try {
    console.log(`[${evento}]`, dados);
  } catch {
    // Ignora erro de log para nao afetar fluxo da requisicao.
  }
}

function buildUrl(path) {
  const rawPath = String(path || '').trim();
  if (!rawPath) {
    return API_BASE_URL;
  }

  if (/^https?:\/\//i.test(rawPath)) {
    return rawPath;
  }

  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function buildLowerHeaderMap(headers = {}) {
  const map = {};
  Object.keys(headers || {}).forEach((key) => {
    map[String(key || '').toLowerCase()] = true;
  });
  return map;
}

function mapMensagemHttp(status) {
  const statusCode = Number(status || 0);

  if (statusCode === 400) return 'Nao foi possivel concluir a solicitacao. Revise os dados e tente novamente.';
  if (statusCode === 401) return 'Sua sessao expirou. Faca login novamente.';
  if (statusCode === 403) return 'Voce nao tem permissao para realizar esta acao.';
  if (statusCode === 404) return 'Nao encontramos as informacoes solicitadas.';
  if (statusCode === 408) return 'Servidor demorou para responder.';
  if (statusCode >= 500) return 'O servidor esta indisponivel no momento. Tente novamente em instantes.';

  return 'Nao foi possivel concluir sua solicitacao.';
}

async function parseResponse(response) {
  const contentType = String(response?.headers?.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}));
  }

  const text = await response.text().catch(() => '');
  if (!text) {
    return {};
  }

  return {
    mensagem: text,
    raw_text: text
  };
}

function criarErroTimeout(timeoutMs) {
  const erro = new Error('Servidor demorou para responder.');
  erro.code = 'API_TIMEOUT';
  erro.status = 408;
  erro.timeoutMs = timeoutMs;
  return erro;
}

export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    credentials = 'include',
    timeoutMs = API_TIMEOUT_MS,
    signal
  } = options;

  const methodUpper = String(method || 'GET').toUpperCase();
  const url = buildUrl(path);
  const hasBody = body !== undefined;
  const isFormData = hasBody && typeof FormData !== 'undefined' && body instanceof FormData;
  const preparedHeaders = { ...headers };
  const lowerHeaderMap = buildLowerHeaderMap(preparedHeaders);

  if (hasBody && !isFormData && !lowerHeaderMap['content-type']) {
    preparedHeaders['Content-Type'] = 'application/json';
  }

  if (IS_NGROK_API && !lowerHeaderMap['ngrok-skip-browser-warning']) {
    preparedHeaders['ngrok-skip-browser-warning'] = 'true';
  }

  const requestBody = hasBody
    ? (isFormData || typeof body === 'string' ? body : JSON.stringify(body))
    : undefined;

  let controller = null;
  let timeoutId = null;
  let timeoutHit = false;

  if (typeof AbortController !== 'undefined') {
    controller = new AbortController();
    if (Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0) {
      timeoutId = setTimeout(() => {
        timeoutHit = true;
        controller.abort();
      }, Number(timeoutMs));
    }
  }

  const signalToUse = signal || controller?.signal;

  logApi('API REQUEST', {
    method: methodUpper,
    path,
    url,
    hasBody,
    timeoutMs: Number(timeoutMs)
  });

  try {
    const response = await fetch(url, {
      method: methodUpper,
      headers: preparedHeaders,
      body: requestBody,
      credentials,
      signal: signalToUse
    });

    const data = await parseResponse(response);

    if (!response.ok) {
      const serverMessage = data?.erro || data?.mensagem || data?.message || mapMensagemHttp(response.status);
      const erroHttp = new Error(String(serverMessage || mapMensagemHttp(response.status)));
      erroHttp.status = response.status;
      erroHttp.serverMessage = String(serverMessage || '');
      erroHttp.payload = data;

      logApi('API ERROR', {
        method: methodUpper,
        path,
        url,
        status: response.status,
        message: erroHttp.message
      });

      throw erroHttp;
    }

    logApi('API RESPONSE', {
      method: methodUpper,
      path,
      url,
      status: response.status
    });

    return data;
  } catch (erro) {
    const isAbortError = erro?.name === 'AbortError';
    if (isAbortError && timeoutHit) {
      throw criarErroTimeout(timeoutMs);
    }

    if (erro?.status) {
      throw erro;
    }

    const erroRede = new Error('Nao foi possivel conectar ao servidor. Verifique sua internet e tente novamente.');
    erroRede.status = 0;
    erroRede.serverMessage = erro?.message || '';

    logApi('API ERROR', {
      method: methodUpper,
      path,
      url,
      status: 0,
      message: erroRede.message
    });

    throw erroRede;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function apiGet(path, options = {}) {
  return apiRequest(path, {
    ...options,
    method: 'GET'
  });
}

export function apiPost(path, body, options = {}) {
  return apiRequest(path, {
    ...options,
    method: 'POST',
    body
  });
}

export function apiPut(path, body, options = {}) {
  return apiRequest(path, {
    ...options,
    method: 'PUT',
    body
  });
}

export function apiDelete(path, options = {}) {
  return apiRequest(path, {
    ...options,
    method: 'DELETE'
  });
}
