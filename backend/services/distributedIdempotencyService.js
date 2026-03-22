'use strict';

const crypto = require('crypto');
const logger = require('../lib/logger');

const STATUS_PROCESSING = 'processing';
const STATUS_COMPLETED = 'completed';
const STATUS_FAILED = 'failed';

function normalizarIdempotencyKey(raw) {
  const chave = String(raw || '').trim();
  if (!chave) return '';
  if (chave.length < 8 || chave.length > 128) return '';
  if (!/^[a-zA-Z0-9:_-]+$/.test(chave)) return '';
  return chave;
}

function sortObjectDeep(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectDeep(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value)
    .sort((a, b) => a.localeCompare(b))
    .reduce((acc, key) => {
      acc[key] = sortObjectDeep(value[key]);
      return acc;
    }, {});
}

function hashFingerprint(value) {
  const canonical = JSON.stringify(sortObjectDeep(value ?? null));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function parseJsonSafe(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

function isTabelaIdempotenciaAusente(error) {
  const code = String(error?.code || '').toUpperCase();
  const msg = String(error?.message || '').toLowerCase();
  return code === 'ER_NO_SUCH_TABLE' || msg.includes('idempotency_operations');
}

function toDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function serializarPayloadResposta(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const raw = JSON.stringify(payload);
  if (raw.length <= 32_000) {
    return raw;
  }
  return JSON.stringify({ truncated: true });
}

async function withDedicatedConnection(pool, fn) {
  const connection = await pool.getConnection();
  try {
    return await fn(connection);
  } finally {
    connection.release();
  }
}

async function iniciarOperacaoDistribuida({
  pool,
  scope,
  idempotencyKey,
  userId,
  pedidoId = null,
  requestFingerprint,
  strictFingerprint = true,
  lockTtlSeconds = 35,
  operationTtlSeconds = 180
} = {}) {
  if (!pool || typeof pool.getConnection !== 'function') {
    throw new Error('Pool MySQL inválido para iniciar idempotência distribuída.');
  }

  const scopeNormalizado = String(scope || '').trim().toLowerCase();
  const keyNormalizada = normalizarIdempotencyKey(idempotencyKey);
  const userIdNumerico = Number(userId || 0);
  const fingerprint = String(requestFingerprint || '').trim();

  if (!scopeNormalizado || !keyNormalizada || !Number.isInteger(userIdNumerico) || userIdNumerico <= 0) {
    return { state: 'bypass' };
  }

  try {
    return await withDedicatedConnection(pool, async (connection) => {
      await connection.beginTransaction();
      try {
        const [rows] = await connection.query(
          `SELECT id, request_fingerprint, status, http_status, response_payload_json, lock_until, expires_at
           FROM idempotency_operations
           WHERE scope = ? AND idempotency_key = ? AND user_id = ?
           LIMIT 1
           FOR UPDATE`,
          [scopeNormalizado, keyNormalizada, userIdNumerico]
        );

        const now = Date.now();
        const pedidoIdNumerico = Number.isInteger(Number(pedidoId)) ? Number(pedidoId) : null;

        if (!rows.length) {
          await connection.query(
            `INSERT INTO idempotency_operations
              (scope, idempotency_key, user_id, pedido_id, request_fingerprint, status, lock_until, expires_at)
             VALUES
              (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), DATE_ADD(NOW(), INTERVAL ? SECOND))`,
            [
              scopeNormalizado,
              keyNormalizada,
              userIdNumerico,
              pedidoIdNumerico,
              fingerprint,
              STATUS_PROCESSING,
              Number(lockTtlSeconds),
              Number(operationTtlSeconds)
            ]
          );
          await connection.commit();
          return { state: 'acquired' };
        }

        const atual = rows[0];
        const lockUntil = toDate(atual.lock_until);
        const expiresAt = toDate(atual.expires_at);
        const lockAtivo = lockUntil && lockUntil.getTime() > now;
        const expirado = !expiresAt || expiresAt.getTime() <= now;

        if (strictFingerprint && atual.request_fingerprint && fingerprint && atual.request_fingerprint !== fingerprint) {
          await connection.commit();
          return {
            state: 'fingerprint_mismatch',
            httpStatus: 409,
            message: 'A mesma chave de idempotência foi reutilizada com payload diferente.'
          };
        }

        if (atual.status === STATUS_COMPLETED && !expirado) {
          await connection.commit();
          return {
            state: 'replay',
            httpStatus: Number(atual.http_status || 200),
            responsePayload: parseJsonSafe(atual.response_payload_json)
          };
        }

        if (atual.status === STATUS_PROCESSING && lockAtivo) {
          await connection.commit();
          return {
            state: 'in_progress',
            httpStatus: 409,
            message: 'Já existe uma operação em processamento para esta chave.'
          };
        }

        await connection.query(
          `UPDATE idempotency_operations
           SET status = ?,
               pedido_id = COALESCE(?, pedido_id),
               request_fingerprint = ?,
               http_status = NULL,
               response_payload_json = NULL,
               last_error = NULL,
               lock_until = DATE_ADD(NOW(), INTERVAL ? SECOND),
               expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
               updated_at = NOW()
           WHERE id = ?`,
          [
            STATUS_PROCESSING,
            pedidoIdNumerico,
            fingerprint,
            Number(lockTtlSeconds),
            Number(operationTtlSeconds),
            atual.id
          ]
        );

        await connection.commit();
        return { state: 'acquired' };
      } catch (err) {
        await connection.rollback();
        throw err;
      }
    });
  } catch (err) {
    if (isTabelaIdempotenciaAusente(err)) {
      logger.warn('Idempotência distribuída desativada temporariamente: tabela idempotency_operations ausente.');
      return { state: 'bypass' };
    }
    throw err;
  }
}

async function concluirOperacaoDistribuida({
  pool,
  scope,
  idempotencyKey,
  userId,
  pedidoId = null,
  httpStatus,
  responsePayload,
  successTtlSeconds = 300
} = {}) {
  const scopeNormalizado = String(scope || '').trim().toLowerCase();
  const keyNormalizada = normalizarIdempotencyKey(idempotencyKey);
  const userIdNumerico = Number(userId || 0);
  if (!scopeNormalizado || !keyNormalizada || !Number.isInteger(userIdNumerico) || userIdNumerico <= 0) {
    return;
  }

  try {
    await withDedicatedConnection(pool, async (connection) => {
      await connection.query(
        `UPDATE idempotency_operations
         SET status = ?,
             pedido_id = COALESCE(?, pedido_id),
             http_status = ?,
             response_payload_json = ?,
             lock_until = NOW(),
             expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
             updated_at = NOW()
         WHERE scope = ? AND idempotency_key = ? AND user_id = ?`,
        [
          STATUS_COMPLETED,
          Number.isInteger(Number(pedidoId)) ? Number(pedidoId) : null,
          Number(httpStatus || 200),
          serializarPayloadResposta(responsePayload),
          Number(successTtlSeconds),
          scopeNormalizado,
          keyNormalizada,
          userIdNumerico
        ]
      );
    });
  } catch (err) {
    if (!isTabelaIdempotenciaAusente(err)) {
      throw err;
    }
  }
}

async function falharOperacaoDistribuida({
  pool,
  scope,
  idempotencyKey,
  userId,
  httpStatus,
  errorMessage,
  failureTtlSeconds = 90
} = {}) {
  const scopeNormalizado = String(scope || '').trim().toLowerCase();
  const keyNormalizada = normalizarIdempotencyKey(idempotencyKey);
  const userIdNumerico = Number(userId || 0);
  if (!scopeNormalizado || !keyNormalizada || !Number.isInteger(userIdNumerico) || userIdNumerico <= 0) {
    return;
  }

  const mensagem = String(errorMessage || 'falha').slice(0, 255);

  try {
    await withDedicatedConnection(pool, async (connection) => {
      await connection.query(
        `UPDATE idempotency_operations
         SET status = ?,
             http_status = ?,
             last_error = ?,
             lock_until = NOW(),
             expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
             updated_at = NOW()
         WHERE scope = ? AND idempotency_key = ? AND user_id = ?`,
        [
          STATUS_FAILED,
          Number(httpStatus || 500),
          mensagem,
          Number(failureTtlSeconds),
          scopeNormalizado,
          keyNormalizada,
          userIdNumerico
        ]
      );
    });
  } catch (err) {
    if (!isTabelaIdempotenciaAusente(err)) {
      throw err;
    }
  }
}

module.exports = {
  normalizarIdempotencyKey,
  hashFingerprint,
  iniciarOperacaoDistribuida,
  concluirOperacaoDistribuida,
  falharOperacaoDistribuida
};
