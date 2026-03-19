'use strict';

const express = require('express');
const { pool } = require('../lib/db');
const logger = require('../lib/logger');

/**
 * @param {object} deps
 * @param {Function} deps.autenticarToken
 */
module.exports = function createEnderecosRoutes({ autenticarToken }) {
  const router = express.Router();

  // Obter endereço do usuário
  router.get('/api/endereco', autenticarToken, async (req, res) => {
    try {
      const [enderecos] = await pool.query(
        'SELECT id, usuario_id, cep, logradouro, numero, complemento, bairro, cidade, estado, atualizado_em FROM enderecos WHERE usuario_id = ?',
        [req.usuario.id]
      );

      if (enderecos.length === 0) {
        return res.json({ endereco: null });
      }

      res.json({ endereco: enderecos[0] });
    } catch (erro) {
      logger.error('Erro ao buscar endereço:', erro);
      res.status(500).json({ erro: 'Não foi possível carregar seu endereço.' });
    }
  });

  // Salvar/atualizar endereço
  router.post('/api/endereco', autenticarToken, async (req, res) => {
    try {
      const { rua, numero, bairro, cidade, estado, cep } = req.body;

      if (!rua || !numero || !bairro || !cidade || !estado || !cep) {
        return res.status(400).json({ erro: 'Preencha todos os campos do endereço.' });
      }

      // Verificar se já existe endereço
      const [enderecosExistentes] = await pool.query(
        'SELECT id FROM enderecos WHERE usuario_id = ?',
        [req.usuario.id]
      );

      if (enderecosExistentes.length > 0) {
        // Atualizar
        await pool.query(
          'UPDATE enderecos SET rua = ?, numero = ?, bairro = ?, cidade = ?, estado = ?, cep = ? WHERE usuario_id = ?',
          [rua, numero, bairro, cidade, estado, cep, req.usuario.id]
        );
      } else {
        // Inserir
        await pool.query(
          'INSERT INTO enderecos (usuario_id, rua, numero, bairro, cidade, estado, cep) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [req.usuario.id, rua, numero, bairro, cidade, estado, cep]
        );
      }

      res.json({ mensagem: 'Endereço salvo com sucesso.' });
    } catch (erro) {
      logger.error('Erro ao salvar endereço:', erro);
      res.status(500).json({ erro: 'Não foi possível salvar seu endereço. Tente novamente.' });
    }
  });

  return router;
};
