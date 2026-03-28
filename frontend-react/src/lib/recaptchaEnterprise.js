/**
 * reCAPTCHA Enterprise Score — carregamento invisível e execução por ação.
 *
 * Nenhum checkbox é exibido ao usuário.
 * O token é gerado silenciosamente no momento do submit,
 * com base em sinais comportamentais do browser.
 *
 * Uso:
 *   import { tryGetRecaptchaToken } from '../lib/recaptchaEnterprise';
 *
 *   const token = await tryGetRecaptchaToken('auth_login', SITE_KEY, enabled);
 *   // Retorna '' se disabled/sem chave OU se todos os retries falharem (backend ignora)
 */

const ENTERPRISE_SCRIPT_BASE = 'https://www.google.com/recaptcha/enterprise.js';
const EXECUTE_TIMEOUT_MS = 12000;
const SCRIPT_READY_TIMEOUT_MS = 5000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

let _scriptPromise = null;

function _buildScriptSrc(siteKey) {
  return `${ENTERPRISE_SCRIPT_BASE}?render=${encodeURIComponent(siteKey)}`;
}

function _delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Carrega o script enterprise.js uma única vez por sessão (singleton).
 */
function _loadScript(siteKey) {
  if (_scriptPromise) {
    return _scriptPromise;
  }

  _scriptPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('reCAPTCHA não disponível fora do browser.'));
    }

    if (window.grecaptcha?.enterprise?.ready) {
      return resolve();
    }

    const existing = document.querySelector('script[src*="recaptcha/enterprise.js"]');
    if (existing) {
      const checkReady = setInterval(() => {
        if (window.grecaptcha?.enterprise) {
          clearInterval(checkReady);
          resolve();
        }
      }, 50);

      setTimeout(() => {
        clearInterval(checkReady);
        _scriptPromise = null;
        reject(new Error('Tempo limite ao aguardar script de segurança.'));
      }, SCRIPT_READY_TIMEOUT_MS);

      return;
    }

    const script = document.createElement('script');
    script.src = _buildScriptSrc(siteKey);
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      _scriptPromise = null;
      reject(new Error('Falha ao carregar proteção de segurança. Verifique sua conexão.'));
    };

    document.head.appendChild(script);
  });

  return _scriptPromise;
}

/**
 * Tentativa única de gerar token.
 */
async function _executeOnce(action, siteKey) {
  await _loadScript(siteKey);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Tempo limite ao gerar proteção de segurança.'));
    }, EXECUTE_TIMEOUT_MS);

    try {
      window.grecaptcha.enterprise.ready(async () => {
        try {
          const token = await window.grecaptcha.enterprise.execute(siteKey, { action });
          clearTimeout(timeout);
          resolve(token);
        } catch {
          clearTimeout(timeout);
          reject(new Error('Não foi possível gerar proteção de segurança.'));
        }
      });
    } catch {
      clearTimeout(timeout);
      reject(new Error('Proteção de segurança indisponível. Recarregue a página.'));
    }
  });
}

/**
 * Gera token com até MAX_RETRIES tentativas automáticas e delay entre elas.
 *
 * @param {string} action  Ex: 'auth_login', 'checkout_pix'
 * @param {string} siteKey Chave pública VITE_RECAPTCHA_SITE_KEY
 * @returns {Promise<string>} Token para enviar ao backend
 */
export async function getRecaptchaToken(action, siteKey) {
  if (!siteKey) {
    throw new Error('RECAPTCHA_SITE_KEY não configurada.');
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await _executeOnce(action, siteKey);
    } catch (err) {
      lastError = err;
      if (attempt <= MAX_RETRIES) {
        await _delay(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}

/**
 * Versão "safe" — nunca lança.
 * Retorna '' se desabilitado, sem chave, ou após todos os retries falharem.
 * Neste último caso emite console.warn — o backend aceita token vazio como bypass.
 *
 * @param {string}  action   Identificador da ação
 * @param {string}  siteKey  Chave pública reCAPTCHA
 * @param {boolean} enabled  Flag de habilitação (env var)
 * @returns {Promise<string>}
 */
export async function tryGetRecaptchaToken(action, siteKey, enabled = true) {
  if (!enabled || !siteKey) {
    return '';
  }

  try {
    return await getRecaptchaToken(action, siteKey);
  } catch (err) {
    console.warn(
      `[reCAPTCHA] Bypass após ${MAX_RETRIES + 1} tentativas para ação "${action}". Prosseguindo sem token.`,
      err?.message || err
    );
    return '';
  }
}
