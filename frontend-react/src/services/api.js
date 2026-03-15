import API_BASE_URL, {
  API_CONFIG_ERROR_MESSAGE,
  API_TIMEOUT_MS,
  IS_DEVELOPMENT,
  IS_NGROK_API
} from '../config/api';

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
  if (!API_BASE_URL) {
    throw new Error(API_CONFIG_ERROR_MESSAGE);
  }

  if (!rawPath) {
    return API_BASE_URL;
  }

  if (/^https?:\/\//i.test(rawPath)) {
    return rawPath;
  }

  const normalizedPath = rawPath.startsWith('/') ? rawPath : '/' + rawPath;
  return API_BASE_URL + normalizedPath;
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

function aguardar(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(ms) || 0));
  });
}

async function parseJsonOuTexto(response) {
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

async function parseResponse(response, responseType = 'json') {
  const tipo = String(responseType || 'json').toLowerCase();

  if (tipo === 'raw') {
    return response;
  }

  if (tipo === 'blob') {
    return response.blob();
  }

  if (tipo === 'arraybuffer') {
    return response.arrayBuffer();
  }

  return parseJsonOuTexto(response);
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
    signal,
    responseType = 'json',
    retryCount,
    retryDelayMs = 1200
  } = options;

  const methodUpper = String(method || 'GET').toUpperCase();
  let url = '';

  try {
    url = buildUrl(path);
  } catch (erroConfiguracao) {
    const mensagem = String(erroConfiguracao?.message || '').trim() || API_CONFIG_ERROR_MESSAGE;
    const erro = new Error(mensagem);
    erro.code = 'API_CONFIG';
    erro.status = 500;
    throw erro;
  }

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

  const maxRetries = Number.isFinite(Number(retryCount))
    ? Math.max(0, Number(retryCount))
    : (methodUpper === 'GET' ? 1 : 0);
  const retryDelay = Math.max(0, Number(retryDelayMs) || 0);

  for (let tentativa = 0; tentativa <= maxRetries; tentativa += 1) {
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
      timeoutMs: Number(timeoutMs),
      tentativa: tentativa + 1,
      totalTentativas: maxRetries + 1
    });

    try {
      const response = await fetch(url, {
        method: methodUpper,
        headers: preparedHeaders,
        body: requestBody,
        credentials,
        signal: signalToUse
      });

      if (!response.ok) {
        const dataErro = await parseJsonOuTexto(response);
        const statusCode = Number(response.status || 0);
        const podeRetentar = tentativa < maxRetries && [502, 503, 504].includes(statusCode) && methodUpper === 'GET';

        if (podeRetentar) {
          logApi('API RETRY', {
            method: methodUpper,
            path,
            url,
            status: statusCode,
            tentativaAtual: tentativa + 1,
            proximaTentativa: tentativa + 2
          });
          await aguardar(retryDelay);
          continue;
        }

        const serverMessage = dataErro?.erro || dataErro?.mensagem || dataErro?.message || mapMensagemHttp(response.status);
        const erroHttp = new Error(String(serverMessage || mapMensagemHttp(response.status)));
        erroHttp.status = response.status;
        erroHttp.serverMessage = String(serverMessage || '');
        erroHttp.payload = dataErro;

        logApi('API ERROR', {
          method: methodUpper,
          path,
          url,
          status: response.status,
          message: erroHttp.message,
          tentativa: tentativa + 1
        });

        throw erroHttp;
      }

      const data = await parseResponse(response, responseType);

      logApi('API RESPONSE', {
        method: methodUpper,
        path,
        url,
        status: response.status,
        tentativa: tentativa + 1
      });

      return data;
    } catch (erro) {
      const isAbortError = erro?.name === 'AbortError';
      const timeoutError = isAbortError && timeoutHit;
      const erroComStatus = Boolean(erro?.status);
      const podeRetentar = tentativa < maxRetries && methodUpper === 'GET' && (timeoutError || !erroComStatus);

      if (podeRetentar) {
        logApi('API RETRY', {
          method: methodUpper,
          path,
          url,
          reason: timeoutError ? 'timeout' : 'network',
          tentativaAtual: tentativa + 1,
          proximaTentativa: tentativa + 2
        });
        await aguardar(retryDelay);
        continue;
      }

      if (timeoutError) {
        throw criarErroTimeout(timeoutMs);
      }

      if (erroComStatus) {
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
        message: erroRede.message,
        tentativa: tentativa + 1
      });

      throw erroRede;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  throw new Error('Falha ao concluir a requisicao da API.');
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
