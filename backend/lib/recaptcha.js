'use strict';

function criarRecaptchaValidator({ criarErroHttp, logger, config, normalizarIp }) {
  const { RECAPTCHA_SECRET_KEY, RECAPTCHA_MIN_SCORE, RECAPTCHA_AUTH_PROTECTION_ENABLED, RECAPTCHA_PROJECT_ID, RECAPTCHA_CLOUD_API_KEY, RECAPTCHA_ENTERPRISE_MODE } = config;

  function extrairRecaptchaErrorCodes(payload) {
    if (!payload || !Array.isArray(payload['error-codes'])) {
      return [];
    }

    return payload['error-codes']
      .map((codigo) => String(codigo || '').trim())
      .filter(Boolean);
  }

  async function validarRecaptcha({ token, req, action = '' } = {}) {
    const normalizedAction = String(action || '').trim().toLowerCase();
    if (normalizedAction.startsWith('auth_') && !RECAPTCHA_AUTH_PROTECTION_ENABLED) {
      return;
    }

    if (!RECAPTCHA_SECRET_KEY && !RECAPTCHA_ENTERPRISE_MODE) {
      return;
    }

    const recaptchaToken = String(token || '').trim();
    if (!recaptchaToken) {
      throw criarErroHttp(400, 'Proteção de segurança ausente. Tente novamente.');
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

    let response;
    try {
      if (RECAPTCHA_ENTERPRISE_MODE) {
        // Enterprise Score — POST to Enterprise API
        const ipCliente = normalizarIp(req?.ip || req?.socket?.remoteAddress);
        const body = {
          event: {
            token: recaptchaToken,
            siteKey: String(process.env.RECAPTCHA_SITE_KEY || '').trim(),
            ...(action ? { expectedAction: String(action).trim() } : {}),
            ...(ipCliente ? { userIpAddress: ipCliente } : {})
          }
        };
        response = await fetch(
          `https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent(RECAPTCHA_PROJECT_ID)}/assessments?key=${encodeURIComponent(RECAPTCHA_CLOUD_API_KEY)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller?.signal
          }
        );
      } else {
        // Legacy siteverify (v2/v3)
        const formData = new URLSearchParams();
        formData.set('secret', RECAPTCHA_SECRET_KEY);
        formData.set('response', recaptchaToken);
        const ipCliente = normalizarIp(req?.ip || req?.socket?.remoteAddress);
        if (ipCliente) formData.set('remoteip', ipCliente);
        response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
          signal: controller?.signal
        });
      }
    } catch (erroRecaptcha) {
      if (erroRecaptcha?.name === 'AbortError') {
        throw criarErroHttp(503, 'Validação de segurança indisponível no momento. Tente novamente em instantes.');
      }
      throw criarErroHttp(503, 'Não foi possível validar a proteção de segurança. Tente novamente.');
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw criarErroHttp(503, 'Falha ao validar proteção de segurança. Tente novamente.');
    }

    if (RECAPTCHA_ENTERPRISE_MODE) {
      // Enterprise response shape: { tokenProperties: { valid, action }, riskAnalysis: { score } }
      if (!payload?.tokenProperties?.valid) {
        const invalido = String(payload?.tokenProperties?.invalidReason || '').toLowerCase();
        if (invalido.includes('expired') || invalido.includes('timeout')) {
          throw criarErroHttp(400, 'Proteção de segurança expirada. Tente novamente.');
        }
        throw criarErroHttp(400, 'Falha na verificação de segurança. Tente novamente.');
      }

      const score = typeof payload?.riskAnalysis?.score === 'number' ? payload.riskAnalysis.score : 1;
      if (score < RECAPTCHA_MIN_SCORE) {
        throw criarErroHttp(403, 'A verificação de segurança não foi aprovada. Tente novamente.');
      }

      if (action && payload?.tokenProperties?.action &&
          String(payload.tokenProperties.action).trim() !== String(action).trim()) {
        throw criarErroHttp(400, 'Falha na verificação de segurança. Tente novamente.');
      }
    } else {
      // siteverify shape: { success, score, action, error-codes }
      if (!payload?.success) {
        const codigos = extrairRecaptchaErrorCodes(payload);
        if (codigos.includes('timeout-or-duplicate')) {
          throw criarErroHttp(400, 'Proteção de segurança expirada. Tente novamente.');
        }
        throw criarErroHttp(400, 'Falha na verificação de segurança. Tente novamente.');
      }

      if (typeof payload?.score === 'number' && payload.score < RECAPTCHA_MIN_SCORE) {
        throw criarErroHttp(403, 'A verificação de segurança não foi aprovada. Tente novamente.');
      }

      if (action && payload?.action && String(payload.action).trim() !== String(action).trim()) {
        throw criarErroHttp(400, 'Falha na verificação de segurança. Tente novamente.');
      }
    }
  }

  return { validarRecaptcha };
}

module.exports = { criarRecaptchaValidator };
