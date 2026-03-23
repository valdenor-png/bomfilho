'use strict';

const mysql = require('mysql2/promise');
const logger = require('./logger');
const { DATABASE_URL, DATABASE_URL_SOURCE } = require('./config');

const dbUrl = new URL(DATABASE_URL);

function parsePositiveIntEnv(name, fallback, { min = 1, max = 600000 } = {}) {
  const raw = Number.parseInt(String(process.env[name] || '').trim(), 10);
  if (!Number.isFinite(raw)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, raw));
}

const DB_CONNECTION_LIMIT = parsePositiveIntEnv('DB_CONNECTION_LIMIT', 10, { min: 1, max: 100 });
const DB_QUEUE_LIMIT = parsePositiveIntEnv('DB_QUEUE_LIMIT', 200, { min: 0, max: 5000 });
const DB_CONNECT_TIMEOUT_MS = parsePositiveIntEnv('DB_CONNECT_TIMEOUT_MS', 10000, { min: 1000, max: 120000 });
const DB_KEEPALIVE_INITIAL_DELAY_MS = parsePositiveIntEnv('DB_KEEPALIVE_INITIAL_DELAY_MS', 30000, { min: 1000, max: 120000 });

const pool = mysql.createPool({
  host: dbUrl.hostname,
  port: dbUrl.port,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.replace('/', ''),
  waitForConnections: true,
  connectionLimit: DB_CONNECTION_LIMIT,
  queueLimit: DB_QUEUE_LIMIT,
  connectTimeout: DB_CONNECT_TIMEOUT_MS,
  enableKeepAlive: true,
  keepAliveInitialDelay: DB_KEEPALIVE_INITIAL_DELAY_MS,
});

logger.info('MySQL config', {
  host: dbUrl.hostname ? `${dbUrl.hostname.slice(0, 4)}***` : '(vazio)',
  port: dbUrl.port || '(padrão)',
  user: dbUrl.username ? `${dbUrl.username.slice(0, 2)}***` : '(vazio)',
  database: dbUrl.pathname ? dbUrl.pathname.replace('/', '').slice(0, 3) + '***' : '(vazio)',
  source: DATABASE_URL_SOURCE,
  connectionLimit: DB_CONNECTION_LIMIT,
  queueLimit: DB_QUEUE_LIMIT,
  connectTimeoutMs: DB_CONNECT_TIMEOUT_MS,
  keepAliveInitialDelayMs: DB_KEEPALIVE_INITIAL_DELAY_MS
});

// ============================================
// RETRY LOGIC
// ============================================
const QUERY_RETRY_ATTEMPTS = 3;
const QUERY_RETRY_DELAY_MS = 1000;
const MYSQL_RETRYABLE_CODES = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ER_CON_COUNT_ERROR',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'PROTOCOL_ENQUEUE_AFTER_QUIT'
]);

const aguardar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isErroConexaoMySql(error) {
  if (!error) return false;
  if (MYSQL_RETRYABLE_CODES.has(error.code)) return true;
  const msg = String(error.message || '').toLowerCase();
  return msg.includes('connection') || msg.includes('socket') || msg.includes('timeout');
}

function classificarErroMySql(error) {
  const code = String(error?.code || '').trim().toUpperCase();

  if (code === 'ETIMEDOUT') {
    return {
      status: 503,
      code: 'DB_CONNECT_TIMEOUT',
      message: 'Banco de dados indisponível no momento (timeout de conexão).',
      tipo: 'rede_timeout'
    };
  }

  if (code === 'ECONNREFUSED') {
    return {
      status: 503,
      code: 'DB_CONNECTION_REFUSED',
      message: 'Banco de dados recusou a conexão (host/porta indisponíveis).',
      tipo: 'rede_recusada'
    };
  }

  if (code === 'ER_ACCESS_DENIED_ERROR') {
    return {
      status: 500,
      code: 'DB_ACCESS_DENIED',
      message: 'Falha de autenticação no banco de dados (credenciais inválidas).',
      tipo: 'credencial_invalida'
    };
  }

  if (code === 'ER_BAD_DB_ERROR') {
    return {
      status: 500,
      code: 'DB_DATABASE_NOT_FOUND',
      message: 'Banco de dados configurado não foi encontrado.',
      tipo: 'banco_inexistente'
    };
  }

  if (code === 'ER_CON_COUNT_ERROR' || code === 'ER_USER_LIMIT_REACHED') {
    return {
      status: 503,
      code: 'DB_CONNECTION_LIMIT',
      message: 'Banco de dados indisponível por limite de conexões.',
      tipo: 'limite_conexao'
    };
  }

  if (isErroConexaoMySql(error)) {
    return {
      status: 503,
      code: 'DB_CONNECTION_ERROR',
      message: 'Banco de dados indisponível no momento (falha de conexão).',
      tipo: 'conexao'
    };
  }

  return {
    status: 500,
    code: 'DB_QUERY_ERROR',
    message: 'Falha ao consultar banco de dados.',
    tipo: 'consulta'
  };
}

function montarRespostaErroBanco(error, { fallbackMessage } = {}) {
  const classificacao = classificarErroMySql(error);
  const mensagem = String(fallbackMessage || '').trim() || classificacao.message;

  return {
    status: classificacao.status,
    payload: {
      erro: mensagem,
      codigo: classificacao.code
    },
    logMeta: {
      db_error_code: String(error?.code || '').trim() || 'UNKNOWN',
      db_error_type: classificacao.tipo,
      db_error_message: String(error?.message || '').slice(0, 240)
    }
  };
}

async function queryWithRetry(sql, params = [], options = {}) {
  const attempts = Number.isFinite(Number(options?.attempts))
    ? Math.max(1, Number(options.attempts))
    : QUERY_RETRY_ATTEMPTS;
  const retryDelayMs = Number.isFinite(Number(options?.retryDelayMs))
    ? Math.max(0, Number(options.retryDelayMs))
    : QUERY_RETRY_DELAY_MS;

  let lastError = null;
  for (let tentativa = 1; tentativa <= attempts; tentativa++) {
    try {
      return await pool.query(sql, params);
    } catch (error) {
      lastError = error;
      if (tentativa < attempts && isErroConexaoMySql(error)) {
        logger.warn(`Falha de conexão MySQL (tentativa ${tentativa}/${attempts}). Repetindo em ${retryDelayMs}ms...`);
        await aguardar(retryDelayMs);
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error('Falha ao executar consulta MySQL com retry.');
}

// ============================================
// CONNECTION TEST
// ============================================
async function testConnection() {
  const conn = await pool.getConnection();
  logger.info('MySQL conectado');
  conn.release();
}

module.exports = {
  pool,
  queryWithRetry,
  isErroConexaoMySql,
  classificarErroMySql,
  montarRespostaErroBanco,
  aguardar,
  testConnection,
};
