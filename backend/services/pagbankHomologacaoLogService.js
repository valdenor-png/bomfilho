'use strict';

const fs = require('fs');
const path = require('path');
const { sanitizarPayloadPagBankParaLog } = require('./pagbankLogService');

// ---------------------------------------------------------------------------
// Mascaramento centralizado para logs de homologação
// ---------------------------------------------------------------------------

function mascararValorSensivel(valor, { prefixo = 6, sufixo = 4 } = {}) {
  const texto = String(valor || '').trim();
  if (!texto) return '';
  if (texto.length <= prefixo + sufixo) return `${texto.slice(0, 2)}***`;
  return `${texto.slice(0, prefixo)}***${texto.slice(-sufixo)}`;
}

function mascararCpfCnpj(valor) {
  const digits = String(valor || '').replace(/\D/g, '');
  if (!digits) return '';
  return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
}

function mascararEmail(valor) {
  const email = String(valor || '').trim();
  const idx = email.indexOf('@');
  if (idx < 0) return mascararValorSensivel(email, { prefixo: 2, sufixo: 2 });
  const usuario = email.slice(0, idx);
  const dominio = email.slice(idx + 1);
  return `${usuario.slice(0, 2)}***@${dominio.slice(0, 1)}***`;
}

/**
 * Mascara um payload de request/response para homologação.
 * Remove campos que NUNCA devem aparecer em log:
 *  - CVV / security_code
 *  - Bearer token (authorization header)
 *  - Número de cartão puro (só encrypted é permitido)
 *
 * Mascara parcialmente:
 *  - tax_id / cpf / cnpj
 *  - email
 *  - card.encrypted (mostra início+fim)
 *  - holder.name mantém (não é sensível para fins de homologação)
 */
function mascararPayloadHomologacao(obj) {
  if (obj == null) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(mascararPayloadHomologacao);

  const saida = {};
  for (const [chave, valor] of Object.entries(obj)) {
    const key = chave.toLowerCase();

    // Campos que NUNCA devem aparecer
    if (['cvv', 'security_code', 'securitycode'].includes(key)) continue;
    if (key === 'authorization') {
      saida[chave] = '***REDACTED***';
      continue;
    }

    // Mascarar tax_id / cpf / cnpj
    if (['tax_id', 'cpf', 'cnpj'].includes(key) && typeof valor === 'string') {
      saida[chave] = mascararCpfCnpj(valor);
      continue;
    }

    // Mascarar email
    if (['email', 'email_address'].includes(key) && typeof valor === 'string') {
      saida[chave] = mascararEmail(valor);
      continue;
    }

    // Mascarar card.encrypted (manter parte, pois faz parte do payload de homologação)
    if (key === 'encrypted' && typeof valor === 'string') {
      saida[chave] = mascararValorSensivel(valor, { prefixo: 8, sufixo: 4 });
      continue;
    }

    // Mascarar tokens genéricos
    if ((key === 'token' || key.endsWith('_token')) && typeof valor === 'string') {
      saida[chave] = '***REDACTED***';
      continue;
    }

    // Mascarar número de cartão puro (nunca deveria chegar, mas segurança extra)
    if (key === 'number' && typeof valor === 'string' && /^\d{13,19}$/.test(valor.replace(/\s/g, ''))) {
      const digits = valor.replace(/\s/g, '');
      saida[chave] = `${digits.slice(0, 6)}******${digits.slice(-4)}`;
      continue;
    }

    // Recursão para objetos e arrays
    if (typeof valor === 'object' && valor !== null) {
      saida[chave] = mascararPayloadHomologacao(valor);
      continue;
    }

    saida[chave] = valor;
  }
  return saida;
}

// ---------------------------------------------------------------------------
// Formato PagBank de homologação: Request + Response (texto puro)
// ---------------------------------------------------------------------------

/**
 * Gera o texto de homologação no formato EXATO exigido pelo PagBank:
 *
 *   Request
 *
 *   { JSON do payload enviado }
 *
 *
 *   RESPONSE
 *
 *   { JSON do response recebido }
 *
 * @param {object} params
 * @param {object} params.requestPayload - Body enviado ao POST /orders
 * @param {object} params.responsePayload - Body retornado pelo PagBank
 * @param {boolean} [params.mascararDados=true] - Se true, aplica mascaramento
 * @returns {{ texto: string, request: object, response: object }}
 */
function gerarLogHomologacaoPagBank({
  requestPayload,
  responsePayload,
  mascararDados = true
} = {}) {
  const reqFinal = mascararDados
    ? mascararPayloadHomologacao(requestPayload)
    : requestPayload;
  const resFinal = mascararDados
    ? mascararPayloadHomologacao(responsePayload)
    : responsePayload;

  const reqJson = JSON.stringify(reqFinal, null, 4);
  const resJson = JSON.stringify(resFinal, null, 4);

  const texto = `\nRequest\n\n${reqJson}\n\n\n\n\nRESPONSE \n\n${resJson}\n`;

  return {
    texto,
    request: reqFinal,
    response: resFinal
  };
}

// ---------------------------------------------------------------------------
// Funções legadas (mantidas para compatibilidade com server.js)
// ---------------------------------------------------------------------------

function gerarLog3DSAuth({
  operacao,
  referenceId,
  status3DS,
  authenticationId,
  traceId,
  resultadoFinal,
  extra
} = {}) {
  const timestamp = new Date().toISOString();
  const bloco = {
    operacao: operacao || '3ds.authenticate',
    reference_id: referenceId || null,
    status_3ds: status3DS || null,
    authentication_id: authenticationId
      ? mascararValorSensivel(authenticationId, { prefixo: 6, sufixo: 4 })
      : null,
    trace_id: traceId || null,
    timestamp,
    resultado_final: resultadoFinal || (status3DS === 'AUTH_FLOW_COMPLETED' ? 'APROVADO' : 'REJEITADO'),
    ...(extra ? mascararPayloadHomologacao(extra) : {})
  };

  return {
    texto: JSON.stringify(bloco, null, 2),
    dados: bloco
  };
}

function gerarLogOrderRequest({ endpoint, method, payload, headers, idempotencyKey } = {}) {
  const requestBloco = mascararPayloadHomologacao(payload);
  return {
    texto: JSON.stringify(requestBloco, null, 4),
    dados: requestBloco
  };
}

function gerarLogOrderResponse({ httpStatus, responsePayload, traceId } = {}) {
  const responseBloco = mascararPayloadHomologacao(responsePayload);
  return {
    texto: JSON.stringify(responseBloco, null, 4),
    dados: responseBloco
  };
}

function gerarLogsHomologacaoPagBank({
  auth3DS,
  orderRequest,
  orderResponse,
  logger = console.log
} = {}) {
  const blocos = [];

  // Log 3DS (se presente)
  if (auth3DS) {
    const log1 = gerarLog3DSAuth(auth3DS);
    blocos.push({ tipo: '3DS_AUTH', ...log1 });
  }

  // Log no formato PagBank: Request + Response (mascarado no console)
  if (orderRequest && orderResponse) {
    const logHml = gerarLogHomologacaoPagBank({
      requestPayload: orderRequest.payload,
      responsePayload: orderResponse.responsePayload
    });
    blocos.push({ tipo: 'HOMOLOGACAO_PAGBANK', ...logHml });
    logger(logHml.texto);

    // Salvar arquivo SEM mascaramento para enviar ao PagBank
    try {
      salvarArquivoHomologacao({
        requestPayload: orderRequest.payload,
        responsePayload: orderResponse.responsePayload
      });
    } catch (err) {
      console.error('[HOMOLOGACAO] Erro ao salvar arquivo:', err.message);
    }
  }

  return blocos;
}

/**
 * Salva o log de homologação em arquivo .txt no formato exato do PagBank,
 * SEM mascaramento (sandbox/teste), pronto para enviar ao time de homologação.
 */
function salvarArquivoHomologacao({ requestPayload, responsePayload }) {
  if (!requestPayload || !responsePayload) return null;

  // Detectar tipo de pagamento e pedido
  const charge = requestPayload?.charges?.[0] || {};
  const tipo = (charge.payment_method?.type || 'DESCONHECIDO').toUpperCase();
  const refId = requestPayload?.reference_id || 'pedido';
  const pedidoNum = refId.replace(/\D/g, '') || Date.now();
  const orderId = responsePayload?.id || '';

  // Verificar se tem 3DS
  const tem3DS = Boolean(charge.payment_method?.authentication_method?.type === 'THREEDS');
  const sufixo3DS = tem3DS ? '_3DS' : '';

  const nomeArquivo = `LOG_HOMOLOGACAO_${tipo}${sufixo3DS}_PEDIDO_${pedidoNum}.txt`;

  // Gerar texto no formato PagBank (sem máscara)
  const reqJson = JSON.stringify(requestPayload, null, 4);
  const resJson = JSON.stringify(responsePayload, null, 4);
  const conteudo = `Request\n\n${reqJson}\n\n\n\n\nRESPONSE \n\n${resJson}\n`;

  // Salvar em docs/pagbank-homologacao/
  const pastaHomologacao = path.resolve(__dirname, '..', '..', 'docs', 'pagbank-homologacao');
  if (!fs.existsSync(pastaHomologacao)) {
    fs.mkdirSync(pastaHomologacao, { recursive: true });
  }

  const caminhoArquivo = path.join(pastaHomologacao, nomeArquivo);
  fs.writeFileSync(caminhoArquivo, conteudo, 'utf8');
  console.log(`[HOMOLOGACAO] Arquivo salvo: ${caminhoArquivo}`);
  return caminhoArquivo;
}

module.exports = {
  mascararPayloadHomologacao,
  mascararCpfCnpj,
  mascararEmail,
  mascararValorSensivel,
  gerarLog3DSAuth,
  gerarLogOrderRequest,
  gerarLogOrderResponse,
  gerarLogsHomologacaoPagBank,
  gerarLogHomologacaoPagBank,
  salvarArquivoHomologacao
};
