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
 *   // token === '' se disabled/sem chave → backend ignora
 */

const ENTERPRISE_SCRIPT_BASE = 'https://www.google.com/recaptcha/enterprise.js';
const EXECUTE_TIMEOUT_MS = 8000;
const SCRIPT_READY_TIMEOUT_MS = 5000;

let _scriptPromise = null;

function _buildScriptSrc(siteKey) {
  return `${ENTERPRISE_SCRIPT_BASE}?render=${encodeURIComponent(siteKey)}`;
}

/**
 * Carrega o script enterprise.js uma única vez por sessão (singleton).
 * Re-usa se já estiver no DOM ou em carregamento.
 */
function _loadScript(siteKey) {
  if (_scriptPromise) {
    return _scriptPromise;
  }

  _scriptPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('reCAPTCHA não disponível fora do browser.'));
    }

    // Já carregado e pronto
    if (window.grecaptcha?.enterprise?.ready) {
      return resolve();
    }

    // Script já está no DOM (outro componente o adicionou)
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
 * Gera um token Enterprise Score para a ação informada.
 * Invisível — sem interação do usuário.
 *
 * @param {string} action  Ex: 'auth_login', 'auth_cadastro', 'checkout_pix'
 * @param {string} siteKey Chave pública VITE_RECAPTCHA_SITE_KEY
 * @returns {Promise<string>} Token para enviar ao backend
 */
export async function getRecaptchaToken(action, siteKey) {
  if (!siteKey) {
    throw new Error('RECAPTCHA_SITE_KEY não configurada.');
  }

  await _loadScript(siteKey);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Tempo limite ao gerar proteção de segurança. Tente novamente.'));
    }, EXECUTE_TIMEOUT_MS);

    try {
      window.grecaptcha.enterprise.ready(async () => {
        try {
          const token = await window.grecaptcha.enterprise.execute(siteKey, { action });
          clearTimeout(timeout);
          resolve(token);
        } catch {
          clearTimeout(timeout);
          reject(new Error('Não foi possível gerar proteção de segurança. Tente novamente.'));
        }
      });
    } catch {
      clearTimeout(timeout);
      reject(new Error('Proteção de segurança indisponível. Recarregue a página e tente novamente.'));
    }
  });
}

/**
 * Versão "safe" — retorna '' se reCAPTCHA estiver desabilitado ou sem chave.
 * Lança erro apenas se estiver habilitado e a geração falhar.
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

  return getRecaptchaToken(action, siteKey);
}
