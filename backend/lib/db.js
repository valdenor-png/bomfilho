'use strict';

const { Pool } = require('pg');
const logger = require('./logger');
const { DATABASE_URL, DB_DIALECT } = require('./config');

const dbUrl = new URL(DATABASE_URL);

function parsePositiveIntEnv(name, fallback, { min = 1, max = 600000 } = {}) {
  const raw = Number.parseInt(String(process.env[name] || '').trim(), 10);
  if (!Number.isFinite(raw)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, raw));
}

const DB_CONNECTION_LIMIT = parsePositiveIntEnv('DB_CONNECTION_LIMIT', 10, { min: 1, max: 100 });
const DB_CONNECT_TIMEOUT_MS = parsePositiveIntEnv('DB_CONNECT_TIMEOUT_MS', 10000, { min: 1000, max: 120000 });
const DB_IDLE_TIMEOUT_MS = parsePositiveIntEnv('DB_IDLE_TIMEOUT_MS', 30000, { min: 1000, max: 600000 });

function normalizeDatabaseUrlForPg(urlString) {
  if (!/^postgres(ql)?:\/\//i.test(urlString)) {
    return urlString;
  }

  // Render internal database URL geralmente nao precisa de SSL.
  // Mantemos SSL opt-in para ambientes externos.
  return urlString;
}

const pool = new Pool({
  connectionString: normalizeDatabaseUrlForPg(DATABASE_URL),
  max: DB_CONNECTION_LIMIT,
  connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS,
  idleTimeoutMillis: DB_IDLE_TIMEOUT_MS,
  ssl: String(process.env.DB_SSL || '').trim().toLowerCase() === 'true'
    ? {
      rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').trim().toLowerCase() !== 'false',
      ...(process.env.DB_CA_CERT ? { ca: process.env.DB_CA_CERT } : {})
    }
    : undefined
});

logger.info('PostgreSQL config', {
  dialect: DB_DIALECT,
  host: dbUrl.hostname ? `${dbUrl.hostname.slice(0, 4)}***` : '(vazio)',
  port: dbUrl.port || '(padrão)',
  user: dbUrl.username ? `${dbUrl.username.slice(0, 2)}***` : '(vazio)',
  database: dbUrl.pathname ? dbUrl.pathname.replace('/', '').slice(0, 3) + '***' : '(vazio)',
  source: 'DATABASE_URL',
  maxConnections: DB_CONNECTION_LIMIT,
  connectTimeoutMs: DB_CONNECT_TIMEOUT_MS,
  idleTimeoutMs: DB_IDLE_TIMEOUT_MS
});

// ============================================
// SQL COMPAT LAYER
// ============================================
function toPgPlaceholders(sql) {
  if (!sql || !sql.includes('?')) return sql;

  let idx = 0;
  return sql.replace(/\?/g, () => {
    idx += 1;
    return `$${idx}`;
  });
}

function splitTopLevelArgs(text) {
  const args = [];
  let current = '';
  let depth = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const prev = i > 0 ? text[i - 1] : '';

    if (ch === "'" && !inDouble && prev !== '\\') {
      inSingle = !inSingle;
      current += ch;
      continue;
    }

    if (ch === '"' && !inSingle && prev !== '\\') {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (!inSingle && !inDouble) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      if (ch === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
        continue;
      }
    }

    current += ch;
  }

  if (current.trim()) args.push(current.trim());
  return args;
}

function rewriteFunctionCalls(sql, functionName, replacer) {
  const input = String(sql || '');
  const upper = input.toUpperCase();
  const fnUpper = functionName.toUpperCase();

  let output = '';
  let i = 0;

  while (i < input.length) {
    const idx = upper.indexOf(fnUpper + '(', i);
    if (idx === -1) {
      output += input.slice(i);
      break;
    }

    output += input.slice(i, idx);
    let j = idx + fnUpper.length + 1;
    let depth = 1;

    while (j < input.length && depth > 0) {
      const ch = input[j];
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      j += 1;
    }

    const argsRaw = input.slice(idx + fnUpper.length + 1, j - 1);
    const replacement = replacer(argsRaw, input.slice(idx, j));
    output += replacement;
    i = j;
  }

  return output;
}

function normalizeSqlForPostgres(sql) {
  if (!sql) return sql;

  let normalized = String(sql);

  normalized = normalized
    .replace(/\bIFNULL\s*\(/gi, 'COALESCE(')
    .replace(/\bativo\s*=\s*1\b/gi, 'ativo = true')
    .replace(/\bativo\s*=\s*0\b/gi, 'ativo = false');

  normalized = rewriteFunctionCalls(normalized, 'DATE_SUB', (argsRaw, originalCall) => {
    const args = splitTopLevelArgs(argsRaw);
    if (args.length < 2) return originalCall;

    const baseExpr = args[0];
    const intervalExpr = args.slice(1).join(', ');
    const match = intervalExpr.match(/INTERVAL\s+(\d+)\s+([a-zA-Z]+)/i);
    if (!match) return originalCall;

    const amount = Number(match[1]);
    const unit = String(match[2] || '').toLowerCase();
    if (!Number.isFinite(amount) || !unit) return originalCall;

    const unitNormalized = unit.endsWith('s') ? unit : `${unit}s`;
    return `(${baseExpr} - INTERVAL '${amount} ${unitNormalized}')`;
  });

  normalized = rewriteFunctionCalls(normalized, 'TIMESTAMPDIFF', (argsRaw, originalCall) => {
    const args = splitTopLevelArgs(argsRaw);
    if (args.length !== 3) return originalCall;

    const unit = String(args[0] || '').trim().toUpperCase();
    const startExpr = args[1];
    const endExpr = args[2];

    if (unit === 'SECOND') {
      return `EXTRACT(EPOCH FROM ((${endExpr}) - (${startExpr})))`;
    }

    if (unit === 'MINUTE') {
      return `(EXTRACT(EPOCH FROM ((${endExpr}) - (${startExpr}))) / 60.0)`;
    }

    return originalCall;
  });

  return normalized;
}

const nativePoolQuery = pool.query.bind(pool);

async function mysqlCompatQuery(executor, sql, params = []) {
  const normalizedSql = normalizeSqlForPostgres(toPgPlaceholders(sql, params));
  const result = await executor(normalizedSql, params);
  return [result.rows || [], []];
}

class PgCompatConnection {
  constructor(client) {
    this.client = client;
    this.inTransaction = false;
  }

  async query(sql, params = []) {
    return mysqlCompatQuery(this.client.query.bind(this.client), sql, params);
  }

  async beginTransaction() {
    await this.client.query('BEGIN');
    this.inTransaction = true;
  }

  async commit() {
    await this.client.query('COMMIT');
    this.inTransaction = false;
  }

  async rollback() {
    await this.client.query('ROLLBACK');
    this.inTransaction = false;
  }

  release() {
    this.client.release();
  }
}

pool.query = async function queryCompat(sql, params = []) {
  return mysqlCompatQuery(nativePoolQuery, sql, params);
};

pool.getConnection = async function getConnectionCompat() {
  const client = await pool.connect();
  return new PgCompatConnection(client);
};

pool.endCompat = async function endCompat() {
  return pool.end();
};

// ============================================
// RETRY LOGIC
// ============================================
const QUERY_RETRY_ATTEMPTS = 3;
const QUERY_RETRY_DELAY_MS = 1000;
const PG_RETRYABLE_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  '53300', // too_many_connections
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03' // cannot_connect_now
]);

const aguardar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isErroConexaoMySql(error) {
  if (!error) return false;
  if (PG_RETRYABLE_CODES.has(String(error.code || '').trim().toUpperCase())) return true;
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

  if (code === '28P01') {
    return {
      status: 500,
      code: 'DB_ACCESS_DENIED',
      message: 'Falha de autenticação no banco de dados (credenciais inválidas).',
      tipo: 'credencial_invalida'
    };
  }

  if (code === '3D000') {
    return {
      status: 500,
      code: 'DB_DATABASE_NOT_FOUND',
      message: 'Banco de dados configurado não foi encontrado.',
      tipo: 'banco_inexistente'
    };
  }

  if (code === '53300') {
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
        logger.warn(`Falha de conexão DB (tentativa ${tentativa}/${attempts}). Repetindo em ${retryDelayMs}ms...`);
        await aguardar(retryDelayMs);
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error('Falha ao executar consulta com retry.');
}

// ============================================
// CONNECTION TEST
// ============================================
async function testConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    logger.info('PostgreSQL conectado');
  } finally {
    client.release();
  }
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
