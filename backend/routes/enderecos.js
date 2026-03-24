'use strict';

const express = require('express');
const { pool } = require('../lib/db');
const logger = require('../lib/logger');
const { DB_DIALECT } = require('../lib/config');

async function getEnderecoColumns() {
  const query = DB_DIALECT === 'postgres'
    ? `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = ANY(current_schemas(true))
          AND table_name = 'enderecos'`
    : `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'enderecos'`;

  const [rows] = await pool.query(query);

  return new Set(
    (rows || [])
      .map((row) => String(row?.COLUMN_NAME || row?.column_name || '').trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * @param {object} deps
 * @param {Function} deps.autenticarToken
 */
module.exports = function createEnderecosRoutes({ autenticarToken }) {
  const router = express.Router();

  // Obter endereço do usuário
  router.get('/api/endereco', autenticarToken, async (req, res) => {
    try {
      const columns = await getEnderecoColumns();
      const colunaRua = columns.has('rua') ? 'rua' : (columns.has('logradouro') ? 'logradouro' : null);

      if (!colunaRua) {
        logger.error('Tabela enderecos sem coluna de rua/logradouro.');
        return res.status(500).json({ erro: 'Estrutura de endereço inválida no banco. Contate o suporte.' });
      }

      const [enderecos] = await pool.query(
        `SELECT id,
                usuario_id,
                cep,
                ${colunaRua} AS rua,
                ${colunaRua} AS logradouro,
                numero,
                ${columns.has('complemento') ? 'complemento' : 'NULL AS complemento'},
                ${columns.has('referencia') ? 'referencia' : 'NULL AS referencia'},
                bairro,
                cidade,
                estado,
                atualizado_em
           FROM enderecos
          WHERE usuario_id = ?`,
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
      const columns = await getEnderecoColumns();
      const colunaRua = columns.has('rua') ? 'rua' : (columns.has('logradouro') ? 'logradouro' : null);

      if (!colunaRua) {
        logger.error('Tabela enderecos sem coluna de rua/logradouro.');
        return res.status(500).json({ erro: 'Estrutura de endereço inválida no banco. Contate o suporte.' });
      }

      const { rua, logradouro, numero, bairro, cidade, estado, cep, complemento, referencia } = req.body || {};
      const ruaNormalizada = String(rua || logradouro || '').trim();
      const numeroNormalizado = String(numero || '').trim();
      const bairroNormalizado = String(bairro || '').trim();
      const cidadeNormalizada = String(cidade || '').trim();
      const estadoNormalizado = String(estado || '').trim().toUpperCase().slice(0, 2);
      const cepNormalizado = String(cep || '').trim();
      const complementoNormalizado = String(complemento || '').trim();
      const referenciaNormalizada = String(referencia || '').trim();

      if (!ruaNormalizada || !numeroNormalizado || !bairroNormalizado || !cidadeNormalizada || !estadoNormalizado || !cepNormalizado) {
        return res.status(400).json({ erro: 'Preencha todos os campos do endereço.' });
      }

      // Verificar se já existe endereço
      const [enderecosExistentes] = await pool.query(
        'SELECT id FROM enderecos WHERE usuario_id = ?',
        [req.usuario.id]
      );

      if (enderecosExistentes.length > 0) {
        // Atualizar
        const updateParts = [
          `${colunaRua} = ?`,
          'numero = ?',
          'bairro = ?',
          'cidade = ?',
          'estado = ?',
          'cep = ?'
        ];
        const updateValues = [
          ruaNormalizada,
          numeroNormalizado,
          bairroNormalizado,
          cidadeNormalizada,
          estadoNormalizado,
          cepNormalizado
        ];

        if (columns.has('complemento')) {
          updateParts.push('complemento = ?');
          updateValues.push(complementoNormalizado);
        }

        if (columns.has('referencia')) {
          updateParts.push('referencia = ?');
          updateValues.push(referenciaNormalizada);
        }

        updateValues.push(req.usuario.id);
        await pool.query(`UPDATE enderecos SET ${updateParts.join(', ')} WHERE usuario_id = ?`, updateValues);
      } else {
        // Inserir
        const insertColumns = ['usuario_id', colunaRua, 'numero', 'bairro', 'cidade', 'estado', 'cep'];
        const insertValues = [
          req.usuario.id,
          ruaNormalizada,
          numeroNormalizado,
          bairroNormalizado,
          cidadeNormalizada,
          estadoNormalizado,
          cepNormalizado
        ];

        if (columns.has('complemento')) {
          insertColumns.push('complemento');
          insertValues.push(complementoNormalizado);
        }

        if (columns.has('referencia')) {
          insertColumns.push('referencia');
          insertValues.push(referenciaNormalizada);
        }

        const placeholders = insertColumns.map(() => '?').join(', ');
        await pool.query(
          `INSERT INTO enderecos (${insertColumns.join(', ')}) VALUES (${placeholders})`,
          insertValues
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
