'use strict';
function criarRateLimiters({ rateLimit, ipKeyGenerator, IS_PRODUCTION, rateLimitValidateOptions }) {

  const globalLimiter = rateLimit({
    windowMs: 60 * 1000, max: 400, validate: rateLimitValidateOptions,
    standardHeaders: true, legacyHeaders: false,
    skip: (req) => {
      const pathAtual = req.path || '';
      if (!pathAtual.startsWith('/api/')) return true;
      if (pathAtual.startsWith('/api/produtos')) return true;
      if (pathAtual.startsWith('/api/webhook/')) return true;
      if (pathAtual.startsWith('/api/webhooks/')) return true;
      if (pathAtual.startsWith('/api/admin/')) return true;
      return false;
    },
    message: { erro: 'Muitas requisições em sequência. Tente novamente em instantes.' }
  });

  const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 200, validate: rateLimitValidateOptions,
    standardHeaders: true, legacyHeaders: false,
    message: { erro: 'Muitas requisições. Tente novamente em alguns minutos.' }
  });

  const produtosPublicLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, max: IS_PRODUCTION ? 1200 : 5000,
    validate: rateLimitValidateOptions, standardHeaders: true, legacyHeaders: false,
    message: { erro: 'Catálogo temporariamente sobrecarregado. Tente novamente em instantes.' }
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 20, validate: rateLimitValidateOptions,
    standardHeaders: true, legacyHeaders: false,
    message: { erro: 'Muitas tentativas de autenticação. Aguarde 15 minutos.' }
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 5, validate: rateLimitValidateOptions,
    standardHeaders: true, legacyHeaders: false, skipSuccessfulRequests: true,
    message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos.' }
  });

  const adminAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 5, validate: rateLimitValidateOptions,
    standardHeaders: true, legacyHeaders: false,
    message: { erro: 'Muitas tentativas de login admin. Aguarde 15 minutos.' }
  });

  const paymentLimiter = rateLimit({
    windowMs: 60 * 1000, max: 5, validate: rateLimitValidateOptions,
    standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req) => req.usuario?.id ? 'user_' + req.usuario.id : ipKeyGenerator(req.ip),
    message: { erro: 'Muitas tentativas de pagamento. Aguarde 1 minuto.' }
  });

  const orderCreateLimiter = rateLimit({
    windowMs: 60 * 1000, max: 3, validate: rateLimitValidateOptions,
    standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req) => req.usuario?.id ? 'user_' + req.usuario.id : ipKeyGenerator(req.ip),
    message: { erro: 'Muitas tentativas de criação de pedido. Aguarde 1 minuto.' }
  });

  return {
    globalLimiter, publicLimiter, produtosPublicLimiter,
    authLimiter, loginLimiter, adminAuthLimiter,
    paymentLimiter, orderCreateLimiter
  };
}
module.exports = { criarRateLimiters };
