'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('../lib/logger');
const { pool } = require('../lib/db');
const crypto = require('crypto');
const {
  JWT_SECRET,
  USER_AUTH_COOKIE_NAME, ADMIN_AUTH_COOKIE_NAME, CSRF_COOKIE_NAME,
  USER_AUTH_COOKIE_MAX_AGE, ADMIN_AUTH_COOKIE_MAX_AGE,
  ADMIN_USER, ADMIN_PASSWORD_HASH, ADMIN_PASSWORD,
  IS_PRODUCTION,
} = require('../lib/config');

// ── Admin 2FA state (in-memory, short-lived) ──
const ADMIN_2FA_WHATSAPP = String(process.env.ADMIN_2FA_WHATSAPP || '').trim();
const ADMIN_2FA_ENABLED = Boolean(ADMIN_2FA_WHATSAPP);
const ADMIN_2FA_TTL_MS = 5 * 60 * 1000; // 5 min
const ADMIN_2FA_MAX_ATTEMPTS = 5;
let admin2faPending = null; // { code, expiresAt, attempts, ip }
const { validatePassword } = require('../lib/passwordValidator');

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
    enviarWhatsappTexto,
  } = deps;

  /**
   * @swagger
   * /api/auth/cadastro:
   *   post:
   *     summary: Registrar novo usuário
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [nome, email, senha, telefone]
   *             properties:
   *               nome:
   *                 type: string
   *               email:
   *                 type: string
   *                 format: email
   *               senha:
   *                 type: string
   *                 format: password
   *               telefone:
   *                 type: string
   *               whatsapp_opt_in:
   *                 type: boolean
   *     responses:
   *       201:
   *         description: Usuário criado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 mensagem:
   *                   type: string
   *       400:
   *         description: Campos obrigatórios faltando ou email já cadastrado
   */
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

      const senhaCheck = validatePassword(senha);
      if (!senhaCheck.valid) {
        return res.status(400).json({ erro: senhaCheck.errors.join(' ') });
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

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Login de usuário
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, senha]
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               senha:
   *                 type: string
   *                 format: password
   *     responses:
   *       200:
   *         description: Login bem-sucedido, cookie JWT definido
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 mensagem:
   *                   type: string
   *                 usuario:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: integer
   *                     nome:
   *                       type: string
   *                     email:
   *                       type: string
   *       400:
   *         description: Credenciais inválidas
   *       401:
   *         description: Email ou senha incorretos
   */
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

  // Login administrativo (com 2FA opcional via WhatsApp)
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

      // ── 2FA: se habilitado, gera código e exige verificação ──
      if (ADMIN_2FA_ENABLED) {
        const code = String(crypto.randomInt(100000, 999999));
        admin2faPending = {
          code,
          expiresAt: Date.now() + ADMIN_2FA_TTL_MS,
          attempts: 0,
          ip: extrairIpRequisicao(req),
        };

        // Tenta enviar por WhatsApp via Evolution API
        let enviado = false;
        if (typeof enviarWhatsappTexto === 'function') {
          try {
            enviado = await enviarWhatsappTexto({
              telefone: ADMIN_2FA_WHATSAPP,
              mensagem: `BomFilho Admin\n\nSeu codigo de acesso: *${code}*\n\nExpira em 5 minutos. Nao compartilhe.`,
            });
          } catch {
            // Evolution API não disponível
          }
        }

        if (!enviado) {
          if (IS_PRODUCTION) {
            // SECURITY: nunca logar código 2FA em produção — logs podem ser acessados por terceiros
            logger.error('🔐 [ADMIN 2FA] Falha ao enviar código por WhatsApp. Canal de entrega indisponível.');
            admin2faPending = null;
            return res.status(503).json({
              erro: 'Não foi possível enviar o código de verificação. Verifique a configuração do WhatsApp e tente novamente.'
            });
          }
          // Fallback: código no log apenas em desenvolvimento
          logger.warn(`🔐 [ADMIN 2FA] Código: ${code} (Evolution API indisponível — código exibido no log, APENAS DEV)`);
        } else {
          logger.info(`🔐 [ADMIN 2FA] Código enviado por WhatsApp para ...${ADMIN_2FA_WHATSAPP.slice(-4)}`);
        }

        registrarAuditoria(pool, {
          acao: 'admin_2fa_enviado',
          entidade: 'admin',
          detalhes: { canal: enviado ? 'whatsapp' : 'log', telefone_final: ADMIN_2FA_WHATSAPP.slice(-4) },
          admin_usuario: ADMIN_USER,
          ip: extrairIpRequisicao(req),
        }).catch(() => {});

        return res.json({
          requires2FA: true,
          mensagem: enviado
            ? 'Código de verificação enviado para seu WhatsApp.'
            : 'Código de verificação gerado. Verifique o terminal do servidor.',
          canal: enviado ? 'whatsapp' : 'log',
        });
      }

      // ── Sem 2FA: login direto ──
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
        detalhes: { metodo: ADMIN_PASSWORD_HASH ? 'bcrypt' : 'legacy_plaintext', twoFA: false },
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

  // Verificação 2FA admin
  router.post('/api/admin/login/verify', adminAuthLimiter, exigirAcessoLocalAdmin, async (req, res) => {
    try {
      const { codigo } = req.body || {};
      const codigoLimpo = String(codigo || '').trim();

      if (!admin2faPending) {
        return res.status(400).json({ erro: 'Nenhuma verificação pendente. Faça login novamente.' });
      }

      if (Date.now() > admin2faPending.expiresAt) {
        admin2faPending = null;
        return res.status(410).json({ erro: 'Código expirado. Faça login novamente.' });
      }

      if (admin2faPending.attempts >= ADMIN_2FA_MAX_ATTEMPTS) {
        admin2faPending = null;
        return res.status(429).json({ erro: 'Muitas tentativas incorretas. Faça login novamente.' });
      }

      if (!codigoLimpo || codigoLimpo.length !== 6) {
        return res.status(400).json({ erro: 'Informe o código de 6 dígitos.' });
      }

      if (codigoLimpo !== admin2faPending.code) {
        admin2faPending.attempts += 1;
        const restantes = ADMIN_2FA_MAX_ATTEMPTS - admin2faPending.attempts;
        return res.status(401).json({
          erro: `Código incorreto. ${restantes} tentativa${restantes !== 1 ? 's' : ''} restante${restantes !== 1 ? 's' : ''}.`,
        });
      }

      // Código correto — limpa e emite JWT
      admin2faPending = null;

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
        detalhes: { metodo: 'bcrypt', twoFA: true },
        admin_usuario: ADMIN_USER,
        ip: extrairIpRequisicao(req),
      }).catch(() => {});

      return res.json({
        mensagem: 'Acesso administrativo liberado com sucesso.',
        usuario: ADMIN_USER,
        csrfToken,
      });
    } catch (erro) {
      logger.error('Erro na verificação 2FA admin:', erro);
      return res.status(500).json({ erro: 'Falha na verificação do código.' });
    }
  });

  router.get('/api/auth/csrf', (req, res) => {
    const csrfToken = emitirCsrfToken(res);
    return res.json({ csrfToken });
  });

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     summary: Logout do usuário (limpa cookie de autenticação)
   *     tags: [Auth]
   *     responses:
   *       200:
   *         description: Logout realizado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 mensagem:
   *                   type: string
   */
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

  /**
   * @swagger
   * /api/auth/me:
   *   get:
   *     summary: Obter dados do usuário autenticado
   *     tags: [Auth]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Dados do usuário
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: integer
   *                 nome:
   *                   type: string
   *                 email:
   *                   type: string
   *                 telefone:
   *                   type: string
   *       401:
   *         description: Não autenticado
   */
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

  // Atualizar perfil do usuário
  router.put('/api/auth/profile', autenticarToken, async (req, res) => {
    try {
      const { nome, telefone } = req.body;
      const updates = [];
      const values = [];

      if (nome !== undefined) { updates.push('nome = ?'); values.push(String(nome).trim()); }
      if (telefone !== undefined) { updates.push('telefone = ?'); values.push(String(telefone).trim()); }

      if (updates.length === 0) {
        return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });
      }

      values.push(req.usuario.id);
      await pool.query(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`, values);

      const [rows] = await pool.query('SELECT id, nome, email, telefone FROM usuarios WHERE id = ?', [req.usuario.id]);
      res.json(rows[0] || {});
    } catch (erro) {
      logger.error('Erro ao atualizar perfil:', erro);
      res.status(500).json({ erro: 'Não foi possível atualizar o perfil.' });
    }
  });

  // Alterar senha
  router.put('/api/auth/password', autenticarToken, async (req, res) => {
    try {
      const { senhaAtual, novaSenha } = req.body;

      if (!senhaAtual || !novaSenha) {
        return res.status(400).json({ erro: 'Informe a senha atual e a nova senha.' });
      }

      const senhaCheck = validatePassword(novaSenha);
      if (!senhaCheck.valid) {
        return res.status(400).json({ erro: senhaCheck.errors.join(' ') });
      }

      const [rows] = await pool.query('SELECT senha FROM usuarios WHERE id = ?', [req.usuario.id]);
      if (!rows.length) {
        return res.status(404).json({ erro: 'Usuário não encontrado.' });
      }

      const senhaCorreta = await bcrypt.compare(senhaAtual, rows[0].senha);
      if (!senhaCorreta) {
        return res.status(401).json({ erro: 'Senha atual incorreta.' });
      }

      const hash = await bcrypt.hash(novaSenha, 12);
      await pool.query('UPDATE usuarios SET senha = ? WHERE id = ?', [hash, req.usuario.id]);

      res.json({ ok: true, mensagem: 'Senha alterada com sucesso.' });
    } catch (erro) {
      logger.error('Erro ao alterar senha:', erro);
      res.status(500).json({ erro: 'Não foi possível alterar a senha.' });
    }
  });

  return router;
};
