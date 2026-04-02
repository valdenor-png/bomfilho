'use strict';

function criarWhatsappService({ logger, config, fetchWithTimeout }) {
  const { EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE } = config;
  const WHATSAPP_HTTP_TIMEOUT_MS = Number.parseInt(String(process.env.WHATSAPP_HTTP_TIMEOUT_MS || '8000'), 10) || 8000;

  function formatarTelefoneWhatsapp(telefone) {
    const digits = (telefone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('55')) return digits;
    return '55' + digits;
  }

  async function enviarWhatsappTexto({ telefone, mensagem }) {
    if (!EVOLUTION_API_KEY) {
      logger.warn('⚠️ Evolution API não configurada. WhatsApp desabilitado.');
      return false;
    }
    const numero = formatarTelefoneWhatsapp(telefone);
    if (!numero || !mensagem) return false;
    if (typeof fetch !== 'function') {
      logger.warn('Fetch indisponível; mensagem de WhatsApp não enviada.');
      return false;
    }
    const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
    const payload = { number: numero, text: mensagem };
    try {
      const resp = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeoutMs: WHATSAPP_HTTP_TIMEOUT_MS
      });
      if (!resp.ok) {
        const erroTexto = await resp.text();
        logger.error('❌ Erro ao enviar WhatsApp:', erroTexto);
        return false;
      } else {
        const resultado = await resp.json();
        logger.info('✅ WhatsApp enviado:', resultado);
        return true;
      }
    } catch (erro) {
      logger.error('❌ Erro ao enviar WhatsApp:', erro?.name === 'AbortError' ? 'timeout ao chamar Evolution API' : erro.message);
      return false;
    }
  }

  async function enviarWhatsappPedido({ telefone, nome, pedidoId, total, pixCodigo, mensagemExtra }) {
    const mensagemBase = mensagemExtra || `Recebemos o seu pedido #${pedidoId}! Total: R$ ${Number(total || 0).toFixed(2)}.`;
    const detalhePix = pixCodigo ? ` Codigo PIX: ${pixCodigo}` : '';
    const mensagem = `Ola ${nome || 'cliente'}! ${mensagemBase}${detalhePix}`;
    await enviarWhatsappTexto({ telefone, mensagem });
  }

  return { formatarTelefoneWhatsapp, enviarWhatsappTexto, enviarWhatsappPedido };
}

module.exports = { criarWhatsappService };
