'use strict';

const NODE_ENV = String(process.env.NODE_ENV || 'development').trim().toLowerCase();
const IS_PRODUCTION = NODE_ENV === 'production';
const LOG_LEVEL = String(process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug')).trim().toLowerCase();

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = LEVELS[LOG_LEVEL] ?? LEVELS.info;

function formatTimestamp() {
  return new Date().toISOString();
}

function serializeExtra(extra) {
  if (!extra || typeof extra !== 'object') return undefined;
  try {
    return JSON.stringify(extra, (_key, value) => {
      if (value instanceof Error) {
        return { message: value.message, stack: value.stack, code: value.code };
      }
      return value;
    });
  } catch {
    return '[unserializable]';
  }
}

function emitLog(level, message, extra) {
  if (LEVELS[level] > CURRENT_LEVEL) return;

  if (IS_PRODUCTION) {
    const entry = { ts: formatTimestamp(), level, msg: message };
    if (extra !== undefined) {
      if (extra instanceof Error) {
        entry.error = { message: extra.message, stack: extra.stack, code: extra.code };
      } else if (typeof extra === 'object' && extra !== null) {
        Object.assign(entry, extra);
      } else {
        entry.data = extra;
      }
    }
    const out = level === 'error' ? process.stderr : process.stdout;
    out.write(JSON.stringify(entry) + '\n');
  } else {
    const prefix = `[${formatTimestamp()}] [${level.toUpperCase()}]`;
    const args = [prefix, message];
    if (extra !== undefined) args.push(extra);
    if (level === 'error') {
      console.error(...args);
    } else if (level === 'warn') {
      console.warn(...args);
    } else {
      console.log(...args);
    }
  }
}

const logger = {
  error(msg, extra) { emitLog('error', msg, extra); },
  warn(msg, extra) { emitLog('warn', msg, extra); },
  info(msg, extra) { emitLog('info', msg, extra); },
  debug(msg, extra) { emitLog('debug', msg, extra); },

  child(context) {
    const ctx = typeof context === 'object' && context ? { ...context } : {};
    return {
      error(msg, extra) { emitLog('error', msg, { ...ctx, ...(typeof extra === 'object' ? extra : { data: extra }) }); },
      warn(msg, extra) { emitLog('warn', msg, { ...ctx, ...(typeof extra === 'object' ? extra : { data: extra }) }); },
      info(msg, extra) { emitLog('info', msg, { ...ctx, ...(typeof extra === 'object' ? extra : { data: extra }) }); },
      debug(msg, extra) { emitLog('debug', msg, { ...ctx, ...(typeof extra === 'object' ? extra : { data: extra }) }); },
    };
  }
};

module.exports = logger;
