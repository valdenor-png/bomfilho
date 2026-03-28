'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('../lib/logger');
const { pool } = require('../lib/db');
const {
  JWT_SECRET,
  USER_AUTH_COOKIE_NAME, ADMIN_AUTH_COOKIE_NAME, CSRF_COOKIE_NAME,
  USER_AUTH_COOKIE_MAX_AGE, ADMIN_AUTH_COOKIE_MAX_AGE,
  ADMIN_USER, ADMIN_PASSWORD_HASH, ADMIN_PASSWORD,
} = require('../lib/config');

/**
 * @param {object} deps
 * @param {Function} deps.authLimiter
 * @param {Function} deps.loginLimiter
 * @param {Function} deps.adminAuthLimiter
 * @param {Function} deps.autenticarToken
 * @param {Function} deps.autenticarAdminToken
 * @param {Function} deps.exigirAcessoLocalAdmin
 * @param {Function} deps.validarRecaptcha
 * @param {Function} deps.emitirCsrfToken
 * @param {Function} deps.definirCookieAuth
 * @param {Function} deps.limparCookie
 * @param {Function} deps.compararTextoSegura
 * @param {Function} deps.registrarAuditoria
 * @param {Function} deps.extrairIpRequisicao
 */
module.exports = function createAuthRoutes(deps) {
  const router = express.Router();
  const {
    authLimiter, loginLimiter, adminAuthLimiter,
    autenticarToken, autenticarAdminToken, exigirAcessoLocalAdmin,
    validarRecaptcha, emitirCsrfToken, definirCookieAuth, limparCookie,
    compararTextoSegura, registrarAuditoria, extrairIpRequisicao,
  } = deps;

  // Cadastro de usuário
  router.post('/api/auth/cadastro', authLimiter, async (req, res) => {
    try {
      const { nome, email, senha, telefone, whatsapp_opt_in } = req.body || {};
      const optIn = !!whatsapp_opt_in;

      if (!nome || !email || !senha || !telefone) {
        return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
      }

      if (!/^\S+@\S+\.\S+$/.test(String(email))) {
        return res.status(400).json({ erro: 'Informe um e-mail válido.' });
      }

      if (String(senha).length < 8) {
        return res.status(400).json({ erro: 'A senha deve ter no mínimo 8 caracteres.' });
      }

      const [usuariosExistentes] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
      if (usuariosExistentes.length > 0) {
        return res.status(409).json({ erro: 'Não foi possível criar a conta. Verifique os dados ou tente fazer login.' });
      }

      const senhaHash = await bcrypt.hash(senha, 10);

      const [resultado] = await pool.query(
        'INSERT INTO usuarios (nome, email, senha, telefone, whatsapp_opt_in) VALUES (?, ?, ?, ?, ?)',
        [nome, email, senhaHash, telefone, optIn]
      );

      const token = jwt.sign(
        { id: resultado.insertId, email: email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      const csrfToken = emitirCsrfToken(res);
      definirCookieAuth(res, USER_AUTH_COOKIE_NAME, token, USER_AUTH_COOKIE_MAX_AGE);

      res.status(201).json({
        mensagem: 'Cadastro realizado com sucesso.',
        csrfToken,
        usuario: {
          id: resultado.insertId,
          nome: nome,
          email: email,
          telefone: telefone,
          whatsapp_opt_in: optIn
        }
      });
    } catch (erro) {
      if (erro?.httpStatus) {
        return res.status(erro.httpStatus).json({ erro: erro.message });
      }

      logger.error('Erro ao cadastrar usuário:', erro);
      return res.status(500).json({ erro: 'Não foi possível concluir o cadastro. Tente novamente.' });
    }
  });

  // Login
  router.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
      const { email, senha, recaptcha_token } = req.body || {};

      await validarRecaptcha({
        token: recaptcha_token,
        req,
        action: 'auth_login'
      });

      if (!email || !senha) {
        return res.status(400).json({ erro: 'Informe e-mail e senha.' });
      }

      const [usuarios] = await pool.query('SELECT id, nome, email, telefone, senha, whatsapp_opt_in FROM usuarios WHERE email = ?', [email]);
      if (usuarios.length === 0) {
        return res.status(401).json({ erro: 'E-mail ou senha não conferem.' });
      }

      const usuario = usuarios[0];

      const senhaValida = await bcrypt.compare(senha, usuario.senha);
      if (!senhaValida) {
        return res.status(401).json({ erro: 'E-mail ou senha não conferem.' });
      }

      const token = jwt.sign(
        { id: usuario.id, email: usuario.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      const csrfToken = emitirCsrfToken(res);
      definirCookieAuth(res, USER_AUTH_COOKIE_NAME, token, USER_AUTH_COOKIE_MAX_AGE);

      res.json({
        mensagem: 'Login realizado com sucesso.',
        csrfToken,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          telefone: usuario.telefone,
          whatsapp_opt_in: usuario.whatsapp_opt_in === 1 || usuario.whatsapp_opt_in === true
        }
      });
    } catch (erro) {
      if (erro?.httpStatus) {
        return res.status(erro.httpStatus).json({ erro: erro.message });
      }

      logger.error('Erro ao fazer login:', erro);
      return res.status(500).json({ erro: 'Não foi possível concluir o login. Tente novamente.' });
    }
  });

  // Login administrativo
  router.post('/api/admin/login', adminAuthLimiter, exigirAcessoLocalAdmin, async (req, res) => {
    try {
      const { usuario, senha } = req.body || {};

      if (!ADMIN_PASSWORD_HASH && !ADMIN_PASSWORD) {
        return res.status(503).json({ erro: 'A autenticação administrativa está indisponível no momento.' });
      }

      if (!usuario || !senha) {
        return res.status(400).json({ erro: 'Informe usuário e senha de administrador.' });
      }

      if (!compararTextoSegura(String(usuario).trim(), ADMIN_USER)) {
        return res.status(401).json({ erro: 'Usuário ou senha de administrador inválidos.' });
      }

      let senhaValida = false;
      if (ADMIN_PASSWORD_HASH) {
        senhaValida = await bcrypt.compare(String(senha), ADMIN_PASSWORD_HASH);
      } else if (ADMIN_PASSWORD) {
        senhaValida = compararTextoSegura(String(senha), ADMIN_PASSWORD);
        if (senhaValida) {
          logger.warn('⚠️ [DEPRECIADO] Login admin via ADMIN_PASSWORD (texto plano). Migre para ADMIN_PASSWORD_HASH.');
        }
      }

      if (!senhaValida) {
        return res.status(401).json({ erro: 'Usuário ou senha de administrador inválidos.' });
      }

      const token = jwt.sign(
        { role: 'admin', usuario: ADMIN_USER },
        JWT_SECRET,
        { expiresIn: '12h' }
      );

      const csrfToken = emitirCsrfToken(res);
      definirCookieAuth(res, ADMIN_AUTH_COOKIE_NAME, token, ADMIN_AUTH_COOKIE_MAX_AGE);

      registrarAuditoria(pool, {
        acao: 'admin_login',
        entidade: 'admin',
        detalhes: { metodo: ADMIN_PASSWORD_HASH ? 'bcrypt' : 'legacy_plaintext' },
        admin_usuario: ADMIN_USER,
        ip: extrairIpRequisicao(req)
      }).catch(() => {});

      return res.json({
        mensagem: 'Acesso administrativo liberado com sucesso.',
        usuario: ADMIN_USER,
        csrfToken
      });
    } catch (erro) {
      logger.error('Erro no login admin:', erro);
      return res.status(500).json({ erro: 'Não foi possível concluir o login administrativo.' });
    }
  });

  router.get('/api/auth/csrf', (req, res) => {
    const csrfToken = emitirCsrfToken(res);
    return res.json({ csrfToken });
  });

  router.post('/api/auth/logout', (req, res) => {
    limparCookie(res, USER_AUTH_COOKIE_NAME, { httpOnly: true });
    limparCookie(res, CSRF_COOKIE_NAME, { httpOnly: false });
    return res.json({ mensagem: 'Sessão encerrada com sucesso.' });
  });

  router.get('/api/admin/me', exigirAcessoLocalAdmin, autenticarAdminToken, (req, res) => {
    return res.json({ admin: { usuario: req.admin?.usuario || ADMIN_USER } });
  });

  router.post('/api/admin/logout', exigirAcessoLocalAdmin, (req, res) => {
    limparCookie(res, ADMIN_AUTH_COOKIE_NAME, { httpOnly: true });
    limparCookie(res, CSRF_COOKIE_NAME, { httpOnly: false });
    return res.json({ mensagem: 'Sessão administrativa encerrada com sucesso.' });
  });

  // Obter dados do usuário logado
  router.get('/api/auth/me', autenticarToken, async (req, res) => {
    try {
      const tokenUserId = Number(req.usuario?.id || req.usuario?.userId || 0);
      const tokenEmail = String(req.usuario?.email || '').trim();
      const buscarPorId = Number.isInteger(tokenUserId) && tokenUserId > 0;

      const [usuarios] = buscarPorId
        ? await pool.query(
          'SELECT id, nome, email, telefone, whatsapp_opt_in FROM usuarios WHERE id = ?',
          [tokenUserId]
        )
        : await pool.query(
          'SELECT id, nome, email, telefone, whatsapp_opt_in FROM usuarios WHERE email = ? LIMIT 1',
          [tokenEmail]
        );

      if (usuarios.length === 0) {
        limparCookie(res, USER_AUTH_COOKIE_NAME, { httpOnly: true });
        limparCookie(res, CSRF_COOKIE_NAME, { httpOnly: false });
        return res.status(401).json({ erro: 'Sessão inválida. Faça login novamente.' });
      }

      const usuarioAtual = usuarios[0];

      // Compatibilidade: tokens legados podiam vir sem id; rotaciona cookie com payload completo.
      if (!buscarPorId) {
        const tokenAtualizado = jwt.sign(
          { id: usuarioAtual.id, email: usuarioAtual.email },
          JWT_SECRET,
          { expiresIn: '7d' }
        );
        definirCookieAuth(res, USER_AUTH_COOKIE_NAME, tokenAtualizado, USER_AUTH_COOKIE_MAX_AGE);
      }

      res.json({ usuario: usuarioAtual });
    } catch (erro) {
      logger.error('Erro ao buscar usuário:', erro);
      res.status(500).json({ erro: 'Não foi possível carregar os dados da sua conta.' });
    }
  });

  // Atualizar telefone e consentimento de WhatsApp
  router.post('/api/usuario/whatsapp', autenticarToken, async (req, res) => {
    try {
      const { telefone, whatsapp_opt_in } = req.body;

      if (!telefone) {
        return res.status(400).json({ erro: 'Informe um telefone para continuar.' });
      }

      const numeroLimpo = telefone.trim();
      const optIn = !!whatsapp_opt_in;

      await pool.query(
        'UPDATE usuarios SET telefone = ?, whatsapp_opt_in = ? WHERE id = ?',
        [numeroLimpo, optIn, req.usuario.id]
      );

      res.json({ mensagem: 'Preferências de WhatsApp atualizadas com sucesso.', whatsapp_opt_in: optIn, telefone: numeroLimpo });
    } catch (erro) {
      logger.error('Erro ao atualizar WhatsApp:', erro);
      res.status(500).json({ erro: 'Não foi possível atualizar suas preferências de WhatsApp.' });
    }
  });

  return router;
};
