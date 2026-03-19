'use strict';

const mysql = require('mysql2/promise');
const logger = require('./logger');
const { DATABASE_URL } = require('./config');

const dbUrl = new URL(DATABASE_URL);

const pool = mysql.createPool({
  host: dbUrl.hostname,
  port: dbUrl.port,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.replace('/', ''),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000,
});

logger.info('MySQL config', {
  host: dbUrl.hostname ? `${dbUrl.hostname.slice(0, 4)}***` : '(vazio)',
  port: dbUrl.port || '(padrão)',
  user: dbUrl.username ? `${dbUrl.username.slice(0, 2)}***` : '(vazio)',
  database: dbUrl.pathname ? dbUrl.pathname.replace('/', '').slice(0, 3) + '***' : '(vazio)',
  source: 'DATABASE_URL'
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

async function queryWithRetry(sql, params = []) {
  let lastError = null;
  for (let tentativa = 1; tentativa <= QUERY_RETRY_ATTEMPTS; tentativa++) {
    try {
      return await pool.query(sql, params);
    } catch (error) {
      lastError = error;
      if (tentativa < QUERY_RETRY_ATTEMPTS && isErroConexaoMySql(error)) {
        logger.warn(`Falha de conexão MySQL (tentativa ${tentativa}/${QUERY_RETRY_ATTEMPTS}). Repetindo em ${QUERY_RETRY_DELAY_MS}ms...`);
        await aguardar(QUERY_RETRY_DELAY_MS);
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
  aguardar,
  testConnection,
};
