'use strict';

const crypto = require('crypto');

function criarCookieAuthHelpers({ config }) {
  const { COOKIE_SECURE, COOKIE_DOMAIN, COOKIE_SAME_SITE, CSRF_COOKIE_NAME, CSRF_COOKIE_MAX_AGE, USER_AUTH_COOKIE_NAME, ADMIN_AUTH_COOKIE_NAME, CORS_ORIGINS, CORS_ORIGIN_PATTERNS } = config;

  function normalizarIp(ip) {
    return String(ip || '').replace('::ffff:', '').trim();
  }

  function getCookieOptions({ httpOnly = true, maxAge } = {}) {
    const options = {
      httpOnly,
      secure: COOKIE_SECURE,
      sameSite: COOKIE_SAME_SITE,
      path: '/'
    };

    if (Number.isFinite(maxAge)) {
      options.maxAge = maxAge;
    }

    if (COOKIE_DOMAIN) {
      options.domain = COOKIE_DOMAIN;
    }

    return options;
  }

  function definirCookieAuth(res, nome, token, maxAge) {
    res.cookie(nome, token, getCookieOptions({ httpOnly: true, maxAge }));
  }

  function limparCookie(res, nome, { httpOnly = true } = {}) {
    res.clearCookie(nome, getCookieOptions({ httpOnly }));
  }

  function emitirCsrfToken(res) {
    const csrfToken = crypto.randomBytes(24).toString('hex');
    res.cookie(CSRF_COOKIE_NAME, csrfToken, getCookieOptions({ httpOnly: false, maxAge: CSRF_COOKIE_MAX_AGE }));
    return csrfToken;
  }

  function isOriginPermitida(origin) {
    if (!origin) {
      return true;
    }

    const originNormalizada = String(origin).trim().replace(/\/+$/, '').toLowerCase();
    if (CORS_ORIGINS.includes(originNormalizada)) {
      return true;
    }

    return CORS_ORIGIN_PATTERNS.some((pattern) => pattern.test(originNormalizada));
  }

  function extrairBearerToken(req) {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return '';
    }
    return String(authHeader.slice(7)).trim();
  }

  function extrairTokenUsuarioRequest(req) {
    // SECURITY: token via query string removido — expõe JWT em logs, Referer e histórico do navegador
    return extrairBearerToken(req)
      || String(req.cookies?.[USER_AUTH_COOKIE_NAME] || '').trim();
  }

  function extrairTokenAdminRequest(req) {
    return extrairBearerToken(req) || String(req.cookies?.[ADMIN_AUTH_COOKIE_NAME] || '').trim();
  }

  return { normalizarIp, getCookieOptions, definirCookieAuth, limparCookie, emitirCsrfToken, isOriginPermitida, extrairBearerToken, extrairTokenUsuarioRequest, extrairTokenAdminRequest };
}

module.exports = { criarCookieAuthHelpers };
