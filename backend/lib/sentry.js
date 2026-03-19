'use strict';

/**
 * Integração opcional com Sentry para captura de erros em produção.
 * Se SENTRY_DSN não estiver configurado ou @sentry/node não estiver instalado,
 * exporta stubs que não fazem nada (zero impacto).
 *
 * Instalação: npm install @sentry/node
 * Configuração: SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
 */

const SENTRY_DSN = String(process.env.SENTRY_DSN || '').trim();

let Sentry = null;

if (SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: String(process.env.NODE_ENV || 'development').trim(),
      release: String(process.env.API_VERSION || '1.0.0').trim(),
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
      beforeSend(event) {
        // Remove dados sensíveis dos headers
        if (event.request && event.request.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
        return event;
      }
    });
    console.log('✅ Sentry inicializado com sucesso.');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.warn('⚠️ SENTRY_DSN configurado mas @sentry/node não instalado. Execute: npm install @sentry/node');
    } else {
      console.error('❌ Erro ao inicializar Sentry:', err.message);
    }
    Sentry = null;
  }
}

/** Captura um erro no Sentry (no-op se desabilitado). */
function captureException(error, context) {
  if (!Sentry) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** Captura uma mensagem no Sentry (no-op se desabilitado). */
function captureMessage(message, level = 'info') {
  if (!Sentry) return;
  Sentry.captureMessage(message, level);
}

/** Handler de erros Express para Sentry. Deve ser registrado ANTES do handler de erro final. */
function sentryErrorHandler() {
  if (Sentry && typeof Sentry.setupExpressErrorHandler === 'function') {
    return (err, req, res, next) => {
      Sentry.captureException(err);
      next(err);
    };
  }
  return (_err, _req, _res, next) => next(_err);
}

/** Request handler Express para Sentry (adiciona contexto de request). */
function sentryRequestHandler() {
  // No-op middleware se Sentry não está ativo
  return (_req, _res, next) => next();
}

module.exports = {
  captureException,
  captureMessage,
  sentryErrorHandler,
  sentryRequestHandler,
  isActive: () => Boolean(Sentry)
};
