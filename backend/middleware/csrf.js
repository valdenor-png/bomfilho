'use strict';
function criarCsrfMiddleware({ compararTextoSegura, extrairBearerToken, config }) {
  const { CSRF_COOKIE_NAME } = config;

  const csrfIgnoredPaths = new Set([
    '/api/auth/login',
    '/api/auth/cadastro',
    '/api/admin/login'
  ]);
  const metodosMutaveis = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  return function csrfProtection(req, res, next) {
    const pathAtual = req.path || '';
    if (!pathAtual.startsWith('/api/')) return next();
    if (!metodosMutaveis.has(req.method)) return next();
    if (pathAtual.startsWith('/api/webhooks/')) return next();
    if (csrfIgnoredPaths.has(pathAtual)) return next();
    if (extrairBearerToken(req)) return next();

    const csrfCookie = String(req.cookies?.[CSRF_COOKIE_NAME] || '').trim();
    const csrfHeader = String(req.headers['x-csrf-token'] || '').trim();

    if (!csrfCookie || !csrfHeader || !compararTextoSegura(csrfCookie, csrfHeader)) {
      return res.status(403).json({ erro: 'Sua sessão expirou por segurança. Atualize a página e tente novamente.' });
    }
    return next();
  };
}
module.exports = { criarCsrfMiddleware };
