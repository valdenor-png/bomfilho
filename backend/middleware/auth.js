'use strict';

const jwt = require('jsonwebtoken');
const logger = require('../lib/logger');
const {
  JWT_SECRET,
  USER_AUTH_COOKIE_NAME,
  ADMIN_AUTH_COOKIE_NAME,
  ADMIN_LOCAL_ONLY
} = require('../lib/config');

/**
 * @param {object} deps
 * @param {Function} deps.normalizarIp
 * @param {Function} deps.extrairTokenUsuarioRequest
 * @param {Function} deps.extrairTokenAdminRequest
 * @param {Function} deps.limparCookie
 */
module.exports = function createAuthMiddleware({
  normalizarIp,
  extrairTokenUsuarioRequest,
  extrairTokenAdminRequest,
  limparCookie
}) {
  function extrairIpRequisicao(req) {
    return normalizarIp(req.ip || req.socket?.remoteAddress || '');
  }

  function isIpLocal(ip) {
    const ipNormalizado = normalizarIp(ip);

    if (!ipNormalizado) {
      return false;
    }

    if (ipNormalizado === '127.0.0.1' || ipNormalizado === '::1' || ipNormalizado === 'localhost') {
      return true;
    }

    // Ambientes locais com Docker, VM ou proxy costumam chegar como IP privado.
    if (ipNormalizado.startsWith('10.') || ipNormalizado.startsWith('192.168.')) {
      return true;
    }

    const match172 = ipNormalizado.match(/^172\.(\d{1,3})\./);
    if (match172) {
      const segundoOcteto = Number(match172[1]);
      if (Number.isInteger(segundoOcteto) && segundoOcteto >= 16 && segundoOcteto <= 31) {
        return true;
      }
    }

    return false;
  }

  const autenticarToken = (req, res, next) => {
    const token = extrairTokenUsuarioRequest(req);

    if (!token) {
      return res.status(401).json({ erro: 'Sessão não encontrada. Faça login para continuar.' });
    }

    jwt.verify(token, JWT_SECRET, (err, usuario) => {
      if (err) {
        limparCookie(res, USER_AUTH_COOKIE_NAME, { httpOnly: true });
        return res.status(403).json({ erro: 'Sua sessão expirou. Faça login novamente.' });
      }
      req.usuario = usuario;
      next();
    });
  };

  const exigirAcessoLocalAdmin = (req, res, next) => {
    if (!ADMIN_LOCAL_ONLY) {
      return next();
    }

    const ip = extrairIpRequisicao(req);
    if (!isIpLocal(ip)) {
      return res.status(403).json({ erro: 'O acesso administrativo é permitido apenas no computador da loja.' });
    }

    next();
  };

  const autenticarAdminToken = (req, res, next) => {
    const token = extrairTokenAdminRequest(req);

    if (!token) {
      return res.status(401).json({ erro: 'Sessão administrativa não encontrada. Faça login para continuar.' });
    }

    jwt.verify(token, JWT_SECRET, (err, payload) => {
      if (err || !payload || payload.role !== 'admin') {
        limparCookie(res, ADMIN_AUTH_COOKIE_NAME, { httpOnly: true });
        return res.status(403).json({ erro: 'Sua sessão administrativa expirou. Faça login novamente.' });
      }

      req.admin = payload;
      next();
    });
  };

  return {
    autenticarToken,
    autenticarAdminToken,
    exigirAcessoLocalAdmin,
    extrairIpRequisicao,
    isIpLocal
  };
};
