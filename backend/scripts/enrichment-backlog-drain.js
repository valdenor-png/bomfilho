'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const fetch = global.fetch || require('node-fetch');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config();

const TERMINAL_JOB_STATUS = new Set(['completed', 'failed', 'cancelled']);
const DEFAULT_PHASE_PLAN = '100x2@1,1000x3@2,5000x4';
const PHASE_PRESETS = {
  1: { nome: 'fase-1', limit: 100, concurrency: 2, maxJobs: Number.POSITIVE_INFINITY },
  2: { nome: 'fase-2', limit: 1000, concurrency: 3, maxJobs: Number.POSITIVE_INFINITY },
  3: { nome: 'fase-3', limit: 5000, concurrency: 4, maxJobs: Number.POSITIVE_INFINITY }
};

function toArgKey(rawKey) {
  return String(rawKey || '')
    .trim()
    .replace(/^--?/, '')
    .replace(/-/g, '_');
}

function parseCliArgs(argv) {
  const args = { _: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '').trim();

    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    if (token.startsWith('--no-')) {
      args[toArgKey(token.slice(5))] = false;
      continue;
    }

    const eqIndex = token.indexOf('=');
    if (eqIndex > -1) {
      const key = toArgKey(token.slice(0, eqIndex));
      const value = token.slice(eqIndex + 1);
      args[key] = value === '' ? true : value;
      continue;
    }

    const key = toArgKey(token);
    const next = argv[i + 1];
    if (next === undefined || String(next).startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return args;
}

function printUsage() {
  const lines = [
    'Uso: node scripts/enrichment-backlog-drain.js [opcoes]',
    '',
    'Principais opcoes:',
    '  --phase 1|2|3',
    '  --phase-plan "100x2@1,1000x3@2,5000x4"',
    '  --limit <n> --concurrency <n>',
    '  --target-pending <n>',
    '  --target-pending-elegiveis <n>',
    '  --max-jobs <n>',
    '  --max-hours <n>',
    '  --poll-interval <ms>',
    '  --max-error-rate <0..1>',
    '  --max-rate-limit-rate <0..1>',
    '  --max-consecutive-failures <n>',
    '  --max-jobs-without-progress <n>',
    '  --max-minutes-without-progress <n>',
    '  --min-throughput-ips <n>',
    '  --dry-run',
    '  --allow-duplicate true|false (padrao: false)',
    '  --dedupe-window-minutes <n>',
    '  --admin-user <usuario>',
    '  --admin-password <senha>',
    '  --access-token <token>',
    '  --report-dir <pasta>',
    '  --write-report-files true|false',
    '  --help',
    '',
    'Exemplo:',
    '  node scripts/enrichment-backlog-drain.js --phase 2 --target-pending 10000 --admin-user admin --admin-password "SUA_SENHA"'
  ];

  for (const line of lines) {
    process.stdout.write(`${line}\n`);
  }
}

function parseBooleanInput(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (['1', 'true', 'sim', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'nao', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parsePositiveInt(value, fallback, { min = 1, max = 1000000 } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function parseFloatValue(value, fallback, { min = 0, max = 1000000 } = {}) {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function parseIntegerOrNull(value, { min = 0, max = 1000000 } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(min, Math.min(max, parsed));
}

function normalizeBaseUrl(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return 'http://127.0.0.1:3000';
  }

  return normalized.replace(/\/+$/, '');
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value) {
  return toNumber(value, 0).toLocaleString('pt-BR');
}

function formatPercent(value) {
  return `${(toNumber(value, 0) * 100).toFixed(2)}%`;
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.floor(toNumber(seconds, 0)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatEta(isoDate) {
  const date = isoDate ? new Date(isoDate) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString('pt-BR', { hour12: false });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeErrorMessage(error, fallbackMessage = 'erro desconhecido') {
  if (!error) {
    return fallbackMessage;
  }

  if (typeof error === 'string') {
    return error;
  }

  const message = String(error?.message || '').trim();
  if (message) {
    return message;
  }

  return fallbackMessage;
}

function extractServerMessage(data, fallbackText, statusCode) {
  if (data && typeof data === 'object') {
    const known = [data.erro, data.error, data.message, data.mensagem]
      .map((item) => String(item || '').trim())
      .find(Boolean);

    if (known) {
      return known;
    }
  }

  const fallback = String(fallbackText || '').trim();
  if (fallback) {
    return fallback;
  }

  return `erro HTTP ${statusCode}`;
}

function createLogger({ enabled = true, reportDir = '', runId = '' } = {}) {
  const lines = [];
  let stream = null;
  let logPath = '';

  if (enabled) {
    fs.mkdirSync(reportDir, { recursive: true });
    logPath = path.join(reportDir, `${runId}.log`);
    stream = fs.createWriteStream(logPath, { flags: 'a', encoding: 'utf8' });
  }

  function log(message) {
    const now = new Date().toISOString();
    const line = `[${now}] ${String(message || '')}`;
    lines.push(line);
    process.stdout.write(`${line}\n`);
    if (stream) {
      stream.write(`${line}\n`);
    }
  }

  function close() {
    if (stream) {
      stream.end();
    }
  }

  return {
    log,
    close,
    lines,
    logPath
  };
}

function writeJsonFile(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function parsePhasePlan(rawPlan) {
  const text = String(rawPlan || '').trim();
  if (!text) {
    return [];
  }

  const chunks = text
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const phases = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const match = chunk.match(/^(\d+)\s*x\s*(\d+)(?:\s*@\s*(\d+|all|inf|infinity))?(?:\s*#\s*([a-zA-Z0-9_-]+))?$/i);
    if (!match) {
      throw new Error(`Formato invalido de fase em "${chunk}". Use limitxconcurrency ou limitxconcurrency@maxJobs.`);
    }

    const limit = parsePositiveInt(match[1], 5000, { min: 1, max: 50000 });
    const concurrency = parsePositiveInt(match[2], 3, { min: 1, max: 12 });
    const rawMaxJobs = String(match[3] || '').trim().toLowerCase();

    let maxJobs = Number.POSITIVE_INFINITY;
    if (rawMaxJobs && !['all', 'inf', 'infinity'].includes(rawMaxJobs)) {
      maxJobs = parsePositiveInt(rawMaxJobs, 1, { min: 1, max: 1000000 });
    }

    phases.push({
      nome: String(match[4] || `fase-${index + 1}`).trim() || `fase-${index + 1}`,
      limit,
      concurrency,
      maxJobs
    });
  }

  return phases;
}

function clonePhases(phases) {
  return phases.map((phase) => ({
    nome: String(phase.nome || '').trim() || 'fase',
    limit: parsePositiveInt(phase.limit, 100, { min: 1, max: 50000 }),
    concurrency: parsePositiveInt(phase.concurrency, 2, { min: 1, max: 12 }),
    maxJobs: Number.isFinite(phase.maxJobs)
      ? parsePositiveInt(phase.maxJobs, 1, { min: 1, max: 1000000 })
      : Number.POSITIVE_INFINITY
  }));
}

function createPhaseCursor(phases) {
  return {
    phaseIndex: 0,
    jobsInCurrentPhase: 0,
    phases: clonePhases(phases)
  };
}

function getCurrentPhase(cursor) {
  const phases = Array.isArray(cursor?.phases) ? cursor.phases : [];
  if (!phases.length) {
    return {
      nome: 'fase-unica',
      limit: 100,
      concurrency: 2,
      maxJobs: Number.POSITIVE_INFINITY
    };
  }

  const index = Math.min(Math.max(0, cursor.phaseIndex || 0), phases.length - 1);
  return phases[index];
}

function consumePhaseJob(cursor) {
  const current = getCurrentPhase(cursor);
  cursor.jobsInCurrentPhase = toNumber(cursor.jobsInCurrentPhase, 0) + 1;

  if (Number.isFinite(current.maxJobs)
    && current.maxJobs > 0
    && cursor.jobsInCurrentPhase >= current.maxJobs
    && cursor.phaseIndex < cursor.phases.length - 1) {
    cursor.phaseIndex += 1;
    cursor.jobsInCurrentPhase = 0;
  }
}

function firstObject(...values) {
  for (const value of values) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }
  }

  return {};
}

function normalizeCounterList(rawValue, primaryKey, aliasKeys = []) {
  const allKeys = [primaryKey, ...aliasKeys].map((key) => String(key || '').trim()).filter(Boolean);

  const toRow = (item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return null;
    }

    let keyValue = '';
    for (const key of allKeys) {
      const candidate = String(item?.[key] || '').trim();
      if (candidate) {
        keyValue = candidate;
        break;
      }
    }

    if (!keyValue) {
      return null;
    }

    return {
      [primaryKey]: keyValue,
      total: toNumber(item?.total ?? item?.count ?? item?.quantidade ?? item?.value ?? item?.valor, 0)
    };
  };

  let rows = [];

  if (Array.isArray(rawValue)) {
    rows = rawValue.map((item) => toRow(item)).filter(Boolean);
  } else if (rawValue && typeof rawValue === 'object') {
    rows = Object.entries(rawValue)
      .map(([key, value]) => ({
        [primaryKey]: String(key || '').trim(),
        total: toNumber(value, 0)
      }))
      .filter((row) => row[primaryKey]);
  }

  return rows.sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total;
    }

    return String(a[primaryKey]).localeCompare(String(b[primaryKey]), 'pt-BR', { sensitivity: 'base' });
  });
}

function classTotalsFromSummary(summary) {
  const map = {};
  const classes = normalizeCounterList(
    summary?.por_classe ?? summary?.porClasse ?? summary?.classes,
    'classe',
    ['chave', 'key', 'class']
  );

  for (const row of classes) {
    const key = String(row?.classe || '').trim().toLowerCase() || 'outros';
    map[key] = toNumber(row?.total ?? row?.count ?? row?.quantidade, 0);
  }

  return map;
}

function diffClassTotals(before, after) {
  const output = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  for (const key of keys) {
    output[key] = toNumber(after?.[key], 0) - toNumber(before?.[key], 0);
  }

  return output;
}

function normalizeOperationalMetrics(payload = {}) {
  const root = firstObject(payload?.dados, payload?.data, payload?.resultado, payload);

  const produtos = firstObject(root?.produtos, root?.products);
  const status = firstObject(produtos?.status, produtos?.statuses, root?.status);
  const imagem = firstObject(produtos?.imagem, produtos?.images, root?.imagem);
  const pendentes = firstObject(root?.pendentes, root?.pending);
  const jobs = firstObject(root?.jobs, root?.enrichment_jobs, root?.enrichmentJobs);
  const errosResumoRaw = firstObject(
    root?.erros_resumo,
    root?.errosResumo,
    root?.error_summary,
    root?.resumo_erros
  );
  const errosTotaisRaw = firstObject(errosResumoRaw?.totais, errosResumoRaw?.totals);
  const errosFiltrosRaw = firstObject(errosResumoRaw?.filtros, errosResumoRaw?.filters);

  const porClasse = normalizeCounterList(
    errosResumoRaw?.por_classe ?? errosResumoRaw?.porClasse ?? errosResumoRaw?.classes,
    'classe',
    ['chave', 'key', 'class']
  );

  const porMensagem = normalizeCounterList(
    errosResumoRaw?.por_mensagem ?? errosResumoRaw?.porMensagem ?? errosResumoRaw?.messages,
    'mensagem',
    ['chave', 'key', 'message', 'erro', 'error']
  );

  const normalized = {
    coletado_em: String(root?.coletado_em || root?.coletadoEm || new Date().toISOString()),
    produtos: {
      total_ativos: toNumber(produtos?.total_ativos ?? produtos?.totalAtivos ?? root?.total_ativos, 0),
      status: {
        pendente: toNumber(status?.pendente ?? status?.pending, 0),
        running: toNumber(status?.running ?? status?.processando, 0),
        enriquecido: toNumber(status?.enriquecido ?? status?.enriched, 0),
        erro: toNumber(status?.erro ?? status?.error, 0),
        nao_encontrado: toNumber(status?.nao_encontrado ?? status?.naoEncontrado ?? status?.not_found, 0)
      },
      imagem: {
        com_imagem: toNumber(imagem?.com_imagem ?? imagem?.comImagem, 0),
        sem_imagem: toNumber(imagem?.sem_imagem ?? imagem?.semImagem, 0)
      }
    },
    pendentes: {
      total_sem_imagem: toNumber(pendentes?.total_sem_imagem ?? pendentes?.totalSemImagem, 0),
      elegiveis: toNumber(pendentes?.elegiveis ?? pendentes?.eligible, 0),
      sem_barcode: toNumber(pendentes?.sem_barcode ?? pendentes?.semBarcode, 0),
      barcode_formato_valido: toNumber(pendentes?.barcode_formato_valido ?? pendentes?.barcodeFormatoValido, 0),
      percentual_elegiveis: toNumber(pendentes?.percentual_elegiveis ?? pendentes?.percentualElegiveis, 0),
      percentual_barcode_formato_valido_entre_elegiveis: toNumber(
        pendentes?.percentual_barcode_formato_valido_entre_elegiveis
          ?? pendentes?.percentualBarcodeFormatoValidoEntreElegiveis,
        0
      )
    },
    jobs: {
      tabela_detectada: Boolean(jobs?.tabela_detectada ?? jobs?.tabelaDetectada),
      total_jobs: toNumber(jobs?.total_jobs ?? jobs?.totalJobs, 0),
      queued: toNumber(jobs?.queued ?? jobs?.em_fila, 0),
      running: toNumber(jobs?.running ?? jobs?.processando, 0),
      completed: toNumber(jobs?.completed ?? jobs?.concluidos, 0),
      failed: toNumber(jobs?.failed ?? jobs?.falhos, 0),
      cancelled: toNumber(jobs?.cancelled ?? jobs?.cancelados, 0),
      ativos: toNumber(jobs?.ativos ?? jobs?.active, 0)
    },
    erros_resumo: {
      filtros: errosFiltrosRaw,
      totais: {
        total_itens: toNumber(errosTotaisRaw?.total_itens ?? errosTotaisRaw?.totalItens, 0),
        total_erro: toNumber(errosTotaisRaw?.total_erro ?? errosTotaisRaw?.totalErro, 0),
        total_nao_encontrado: toNumber(
          errosTotaisRaw?.total_nao_encontrado ?? errosTotaisRaw?.totalNaoEncontrado,
          0
        )
      },
      por_classe: porClasse,
      por_mensagem: porMensagem
    }
  };

  return normalized;
}

function normalizeJobSnapshot(payload = {}) {
  const job = payload?.job && typeof payload.job === 'object' ? payload.job : payload;

  return {
    job_id: String(job?.job_id || '').trim(),
    status: String(job?.status || '').trim().toLowerCase(),
    escopo: String(job?.escopo || '').trim().toLowerCase(),
    total_previsto: toNumber(job?.total_previsto, 0),
    processados: toNumber(job?.processados, 0),
    encontrados: toNumber(job?.encontrados, 0),
    falhas: toNumber(job?.falhas, 0),
    nao_encontrados: toNumber(job?.nao_encontrados, 0),
    ignorados: toNumber(job?.ignorados, 0),
    cancelados: toNumber(job?.cancelados, 0),
    percentual_concluido: toNumber(job?.percentual_concluido, 0),
    tempo_decorrido_s: toNumber(job?.tempo_decorrido_s, 0),
    itens_por_segundo: toNumber(job?.itens_por_segundo, 0),
    itens_por_minuto: toNumber(job?.itens_por_minuto, 0),
    estimativa_termino_em: String(job?.estimativa_termino_em || '').trim() || null,
    mensagem_atual: String(job?.mensagem_atual || '').trim(),
    erro_geral: String(job?.erro_geral || '').trim(),
    criado_em: String(job?.criado_em || '').trim() || null,
    iniciado_em: String(job?.iniciado_em || '').trim() || null,
    finalizado_em: String(job?.finalizado_em || '').trim() || null
  };
}

function summarizeJobProgress(job) {
  return [
    `status=${job.status || '-'}`,
    `proc=${formatNumber(job.processados)}/${formatNumber(job.total_previsto)}`,
    `ok=${formatNumber(job.encontrados)}`,
    `falhas=${formatNumber(job.falhas)}`,
    `nao_encontrado=${formatNumber(job.nao_encontrados)}`,
    `ignorados=${formatNumber(job.ignorados)}`,
    `duracao=${formatDuration(job.tempo_decorrido_s)}`,
    `ips=${toNumber(job.itens_por_segundo, 0).toFixed(3)}`,
    `eta=${formatEta(job.estimativa_termino_em)}`
  ].join(' | ');
}

function shouldLogProgress(previous, current, nowMs, lastLogMs, intervalMs) {
  if (!previous) {
    return true;
  }

  if (current.status !== previous.status) {
    return true;
  }

  if (current.processados !== previous.processados
    || current.falhas !== previous.falhas
    || current.nao_encontrados !== previous.nao_encontrados
    || current.encontrados !== previous.encontrados) {
    return true;
  }

  const silentWindow = Math.max(intervalMs * 3, 30000);
  return (nowMs - lastLogMs) >= silentWindow;
}

function createRunId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  const random = Math.random().toString(36).slice(2, 8);
  return `enrichment_drain_${year}${month}${day}_${hour}${minute}${second}_${random}`;
}

function buildConfig(args) {
  const env = process.env;

  const baseUrl = normalizeBaseUrl(args.base_url || env.ENRICHMENT_DRAIN_BASE_URL || `http://127.0.0.1:${env.PORT || 3000}`);
  const requestTimeoutMs = parsePositiveInt(args.request_timeout || env.ENRICHMENT_DRAIN_REQUEST_TIMEOUT_MS, 20000, { min: 3000, max: 180000 });
  const pollIntervalMs = parsePositiveInt(args.poll_interval || env.ENRICHMENT_DRAIN_POLL_INTERVAL_MS, 5000, { min: 1000, max: 120000 });
  const maxPollFailures = parsePositiveInt(args.max_poll_failures || env.ENRICHMENT_DRAIN_MAX_POLL_FAILURES, 5, { min: 1, max: 30 });
  const jobTimeoutMinutes = parsePositiveInt(args.job_timeout_minutes || env.ENRICHMENT_DRAIN_JOB_TIMEOUT_MINUTES, 120, { min: 5, max: 1440 });

  const phaseFromArg = parseIntegerOrNull(args.phase, { min: 1, max: 3 });
  const hasManualLimit = args.limit !== undefined || args.concurrency !== undefined;
  const phasePlanRaw = String(args.phase_plan || env.ENRICHMENT_DRAIN_PHASE_PLAN || '').trim();

  let phasePlan = [];

  if (phaseFromArg && PHASE_PRESETS[phaseFromArg]) {
    const preset = PHASE_PRESETS[phaseFromArg];
    const limit = parsePositiveInt(args.limit, preset.limit, { min: 1, max: 50000 });
    const concurrency = parsePositiveInt(args.concurrency, preset.concurrency, { min: 1, max: 12 });

    phasePlan = [{
      nome: preset.nome,
      limit,
      concurrency,
      maxJobs: Number.POSITIVE_INFINITY
    }];
  } else if (hasManualLimit && !phasePlanRaw) {
    phasePlan = [{
      nome: 'fase-manual',
      limit: parsePositiveInt(args.limit, 1000, { min: 1, max: 50000 }),
      concurrency: parsePositiveInt(args.concurrency, 3, { min: 1, max: 12 }),
      maxJobs: Number.POSITIVE_INFINITY
    }];
  } else {
    const raw = phasePlanRaw || DEFAULT_PHASE_PLAN;
    phasePlan = parsePhasePlan(raw);
    if (!phasePlan.length) {
      phasePlan = parsePhasePlan(DEFAULT_PHASE_PLAN);
    }
  }

  const targetPending = parseIntegerOrNull(args.target_pending, { min: 0, max: 100000000 });
  const explicitTargetEligible = parseIntegerOrNull(args.target_pending_elegiveis, { min: 0, max: 100000000 });
  const stopWhenNoEligible = parseBooleanInput(args.stop_when_no_eligible, true);

  const targetPendingEligible = explicitTargetEligible !== null
    ? explicitTargetEligible
    : (stopWhenNoEligible ? 0 : null);

  const maxJobs = parsePositiveInt(args.max_jobs || env.ENRICHMENT_DRAIN_MAX_JOBS, 0, { min: 0, max: 1000000 });
  const maxHours = parseFloatValue(args.max_hours || env.ENRICHMENT_DRAIN_MAX_HOURS, 0, { min: 0, max: 2400 });
  const maxRunMs = maxHours > 0 ? Math.round(maxHours * 60 * 60 * 1000) : 0;

  return {
    baseUrl,
    dryRun: parseBooleanInput(args.dry_run, false),
    accessToken: String(args.access_token || env.ADMIN_ACCESS_TOKEN || '').trim(),
    adminUser: String(args.admin_user || env.ADMIN_USER || 'admin').trim() || 'admin',
    adminPassword: String(args.admin_password || env.ADMIN_PASSWORD || '').trim(),
    requestTimeoutMs,
    pollIntervalMs,
    maxPollFailures,
    jobTimeoutMs: jobTimeoutMinutes * 60 * 1000,
    allowDuplicate: parseBooleanInput(args.allow_duplicate, false),
    dedupeWindowMinutes: parsePositiveInt(args.dedupe_window_minutes, 240, { min: 5, max: 1440 }),
    itemMaxRetries: parsePositiveInt(args.item_max_retries, 1, { min: 0, max: 5 }),
    force: parseBooleanInput(args.force, false),
    targetPending,
    targetPendingEligible,
    stopWhenNoEligible,
    maxJobs,
    maxRunMs,
    maxHours,
    maxErrorRate: parseFloatValue(args.max_error_rate, 0.95, { min: 0, max: 1 }),
    maxRateLimitRate: parseFloatValue(args.max_rate_limit_rate, 0.35, { min: 0, max: 1 }),
    maxProviderConfigErrors: parsePositiveInt(args.max_provider_config_errors, 0, { min: 0, max: 1000000 }),
    maxConsecutiveFailures: parsePositiveInt(args.max_consecutive_failures, 2, { min: 1, max: 1000000 }),
    maxJobsWithoutProgress: parsePositiveInt(args.max_jobs_without_progress, 2, { min: 1, max: 1000000 }),
    maxMinutesWithoutProgress: parsePositiveInt(args.max_minutes_without_progress, 60, { min: 1, max: 1000000 }),
    minThroughputIps: parseFloatValue(args.min_throughput_ips, 0.02, { min: 0, max: 1000 }),
    minProcessedForThroughput: parsePositiveInt(args.min_processed_for_throughput, 30, { min: 1, max: 1000000 }),
    maxLowThroughputJobs: parsePositiveInt(args.max_low_throughput_jobs, 2, { min: 1, max: 1000000 }),
    includeNaoEncontradoErrors: parseBooleanInput(args.include_nao_encontrado_erros, false),
    reportDir: path.resolve(process.cwd(), String(args.report_dir || 'logs/enrichment-drain').trim() || 'logs/enrichment-drain'),
    writeReportFiles: parseBooleanInput(args.write_report_files, true),
    phasePlan: clonePhases(phasePlan)
  };
}

async function requestJson(config, token, pathName, { method = 'GET', body = null } = {}) {
  const url = `${config.baseUrl}${pathName}`;
  const headers = {
    Accept: 'application/json'
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== null) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, config.requestTimeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body !== null ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    const responseText = await response.text();
    let data = null;

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { raw: responseText };
      }
    }

    if (!response.ok) {
      const message = extractServerMessage(data, responseText, response.status);
      const error = new Error(`HTTP ${response.status} ${method} ${pathName}: ${message}`);
      error.status = response.status;
      error.response = data;
      throw error;
    }

    return data || {};
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Timeout HTTP em ${method} ${pathName} apos ${config.requestTimeoutMs}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function buildApiClient(config, token) {
  return {
    get: (pathName) => requestJson(config, token, pathName, { method: 'GET' }),
    post: (pathName, body) => requestJson(config, token, pathName, { method: 'POST', body })
  };
}

async function runWithRetry(fn, {
  attempts = 3,
  delayMs = 1500,
  logger = null,
  label = 'operacao'
} = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        break;
      }

      if (logger) {
        logger.log(`${label}: tentativa ${attempt}/${attempts} falhou (${normalizeErrorMessage(error)}). Tentando novamente em ${delayMs}ms.`);
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}

async function authenticate(config, logger) {
  if (config.accessToken) {
    logger.log('Autenticacao: usando access token informado.');
    return config.accessToken;
  }

  if (!config.adminPassword) {
    throw new Error('Informe --admin-password ou ADMIN_PASSWORD quando --access-token nao for usado.');
  }

  logger.log(`Autenticacao: realizando login admin em ${config.baseUrl}/api/admin/login com usuario ${config.adminUser}.`);

  const response = await runWithRetry(
    () => requestJson(config, '', '/api/admin/login', {
      method: 'POST',
      body: {
        usuario: config.adminUser,
        senha: config.adminPassword
      }
    }),
    {
      attempts: 2,
      delayMs: 1000,
      logger,
      label: 'login-admin'
    }
  );

  const token = String(response?.accessToken || '').trim();
  if (!token) {
    throw new Error('Login admin nao retornou accessToken.');
  }

  logger.log('Autenticacao: login admin concluido com sucesso.');
  return token;
}

async function fetchOperationalMetrics(api, config, logger) {
  const query = config.includeNaoEncontradoErrors ? '?include_nao_encontrado=true' : '';
  const payload = await runWithRetry(
    () => api.get(`/api/admin/catalogo/enriquecimento/metricas${query}`),
    {
      attempts: 3,
      delayMs: 1200,
      logger,
      label: 'coleta-metricas'
    }
  );

  return normalizeOperationalMetrics(payload);
}

async function triggerPendingJob(api, payload, logger) {
  const response = await runWithRetry(
    () => api.post('/api/admin/catalogo/produtos/enriquecer-pendentes', payload),
    {
      attempts: 3,
      delayMs: 1200,
      logger,
      label: 'disparo-job'
    }
  );

  const job = normalizeJobSnapshot(response?.job || {});
  if (!job.job_id) {
    throw new Error('API nao retornou job_id ao disparar lote de pendentes.');
  }

  return {
    reutilizado: Boolean(response?.reutilizado),
    mensagem: String(response?.mensagem || '').trim(),
    job
  };
}

async function monitorJobUntilTerminal(api, config, logger, jobId) {
  const startedMs = Date.now();
  let lastSnapshot = null;
  let lastLogMs = 0;
  let consecutivePollFailures = 0;

  for (;;) {
    let response;

    try {
      response = await api.get(`/api/admin/catalogo/produtos/enriquecimento-jobs/${encodeURIComponent(jobId)}`);
      consecutivePollFailures = 0;
    } catch (error) {
      consecutivePollFailures += 1;
      logger.log(`[job ${jobId}] falha no polling (${consecutivePollFailures}/${config.maxPollFailures}): ${normalizeErrorMessage(error)}`);

      if (consecutivePollFailures >= config.maxPollFailures) {
        throw new Error(`Polling do job ${jobId} excedeu falhas consecutivas (${config.maxPollFailures}).`);
      }

      await sleep(config.pollIntervalMs);
      continue;
    }

    const snapshot = normalizeJobSnapshot(response?.job || {});
    if (!snapshot.job_id) {
      throw new Error(`Resposta invalida ao consultar job ${jobId}.`);
    }

    const nowMs = Date.now();
    if (shouldLogProgress(lastSnapshot, snapshot, nowMs, lastLogMs, config.pollIntervalMs)) {
      logger.log(`[job ${snapshot.job_id}] ${summarizeJobProgress(snapshot)}`);
      lastLogMs = nowMs;
      lastSnapshot = snapshot;
    }

    if (TERMINAL_JOB_STATUS.has(snapshot.status)) {
      return snapshot;
    }

    if ((nowMs - startedMs) >= config.jobTimeoutMs) {
      throw new Error(`Tempo limite de monitoramento excedido para job ${jobId} (${Math.round(config.jobTimeoutMs / 60000)} minutos).`);
    }

    await sleep(config.pollIntervalMs);
  }
}

function evaluateStopByGoal(config, state, metrics, nowMs) {
  if (config.maxJobs > 0 && state.jobsExecutados >= config.maxJobs) {
    return {
      code: 'max_jobs_reached',
      message: `Parada por max_jobs: ${state.jobsExecutados}/${config.maxJobs}.`
    };
  }

  if (config.maxRunMs > 0 && (nowMs - state.startedMs) >= config.maxRunMs) {
    return {
      code: 'max_hours_reached',
      message: `Parada por max_hours: ${config.maxHours}h.`
    };
  }

  if (config.targetPending !== null && metrics.produtos.status.pendente <= config.targetPending) {
    return {
      code: 'target_pending_reached',
      message: `Parada por meta de pendentes: atual=${metrics.produtos.status.pendente}, alvo=${config.targetPending}.`
    };
  }

  if (config.targetPendingEligible !== null && metrics.pendentes.elegiveis <= config.targetPendingEligible) {
    return {
      code: 'target_pending_eligible_reached',
      message: `Parada por meta de pendentes elegiveis: atual=${metrics.pendentes.elegiveis}, alvo=${config.targetPendingEligible}.`
    };
  }

  return null;
}

function evaluateRiskGuards(config, state, cycle) {
  const job = cycle.job_final;
  const processed = toNumber(job.processados, 0);
  const failures = toNumber(job.falhas, 0);
  const throughputIps = toNumber(job.itens_por_segundo, 0);

  const errorRate = processed > 0 ? (failures / processed) : 0;
  const rateLimitDelta = Math.max(0, toNumber(cycle.erro_delta_por_classe.rate_limit, 0));
  const rateLimitRate = processed > 0 ? (rateLimitDelta / processed) : 0;
  const providerConfigDelta = Math.max(0, toNumber(cycle.erro_delta_por_classe.config_provider, 0));

  if (job.status === 'failed' || job.status === 'cancelled') {
    state.consecutiveFailedJobs += 1;
  } else {
    state.consecutiveFailedJobs = 0;
  }

  if (toNumber(cycle.delta.pendentes_elegiveis, 0) > 0) {
    state.jobsWithoutProgress = 0;
    state.lastProgressMs = Date.now();
  } else {
    state.jobsWithoutProgress += 1;
  }

  if (config.minThroughputIps > 0
    && processed >= config.minProcessedForThroughput
    && throughputIps < config.minThroughputIps) {
    state.lowThroughputJobs += 1;
  } else {
    state.lowThroughputJobs = 0;
  }

  if (!TERMINAL_JOB_STATUS.has(job.status)) {
    return {
      code: 'unexpected_job_status',
      message: `Parada por status final inesperado: ${job.status || '(vazio)'}.`
    };
  }

  if (state.consecutiveFailedJobs >= config.maxConsecutiveFailures) {
    return {
      code: 'consecutive_job_failures',
      message: `Parada por falhas consecutivas de job: ${state.consecutiveFailedJobs}/${config.maxConsecutiveFailures}.`
    };
  }

  if (processed > 0 && errorRate > config.maxErrorRate) {
    return {
      code: 'error_rate_threshold',
      message: `Parada por taxa de erro alta no job: ${formatPercent(errorRate)} > ${formatPercent(config.maxErrorRate)}.`
    };
  }

  if (processed > 0 && rateLimitRate > config.maxRateLimitRate) {
    return {
      code: 'rate_limit_threshold',
      message: `Parada por taxa de rate_limit alta no job: ${formatPercent(rateLimitRate)} > ${formatPercent(config.maxRateLimitRate)}.`
    };
  }

  if (providerConfigDelta > config.maxProviderConfigErrors) {
    return {
      code: 'provider_config_error_threshold',
      message: `Parada por aumento de config_provider: delta=${providerConfigDelta}, limite=${config.maxProviderConfigErrors}.`
    };
  }

  if (state.jobsWithoutProgress >= config.maxJobsWithoutProgress) {
    return {
      code: 'no_backlog_reduction_jobs',
      message: `Parada por falta de reducao de backlog em ${state.jobsWithoutProgress} jobs consecutivos.`
    };
  }

  const minutesWithoutProgress = (Date.now() - state.lastProgressMs) / 60000;
  if (minutesWithoutProgress >= config.maxMinutesWithoutProgress) {
    return {
      code: 'no_backlog_reduction_time',
      message: `Parada por tempo sem progresso: ${minutesWithoutProgress.toFixed(1)} min >= ${config.maxMinutesWithoutProgress} min.`
    };
  }

  if (state.lowThroughputJobs >= config.maxLowThroughputJobs) {
    return {
      code: 'low_throughput_threshold',
      message: `Parada por throughput baixo em ${state.lowThroughputJobs} jobs consecutivos.`
    };
  }

  return null;
}

function buildDryRunPlan(metrics, config) {
  const previewLimit = 30;
  const simulated = [];
  const cursor = createPhaseCursor(config.phasePlan);
  const maxSimulatedJobs = config.maxJobs > 0 ? config.maxJobs : 1000;
  let jobsCount = 0;

  let pendentes = toNumber(metrics.pendentes.elegiveis, 0);
  const alvo = config.targetPendingEligible !== null
    ? config.targetPendingEligible
    : 0;

  for (let i = 0; i < maxSimulatedJobs; i += 1) {
    if (pendentes <= alvo) {
      break;
    }

    const phase = getCurrentPhase(cursor);
    const reducao = Math.min(phase.limit, Math.max(0, pendentes - alvo));
    pendentes = Math.max(alvo, pendentes - reducao);
    jobsCount += 1;

    if (simulated.length < previewLimit) {
      simulated.push({
        ciclo: i + 1,
        fase: phase.nome,
        limit: phase.limit,
        concurrency: phase.concurrency,
        reducao_estimada: reducao,
        pendentes_elegiveis_pos_job: pendentes
      });
    }

    consumePhaseJob(cursor);
  }

  const estimatedJobs = jobsCount;

  return {
    pendentes_elegiveis_iniciais: toNumber(metrics.pendentes.elegiveis, 0),
    alvo_pendentes_elegiveis: alvo,
    jobs_estimados: estimatedJobs,
    pendentes_elegiveis_estimado_final: pendentes,
    preview_jobs: simulated
  };
}

function buildExecutionSummary(report) {
  const cycles = Array.isArray(report.ciclos) ? report.ciclos : [];

  let totalProcessados = 0;
  let totalEncontrados = 0;
  let totalFalhas = 0;
  let totalNaoEncontrados = 0;
  let totalIgnorados = 0;
  let totalCancelados = 0;
  let throughputAccumulator = 0;
  let throughputSamples = 0;
  let jobsCompleted = 0;
  let jobsFailed = 0;
  let jobsCancelled = 0;
  let jobsReused = 0;

  for (const cycle of cycles) {
    const job = cycle?.job_final || {};

    totalProcessados += toNumber(job.processados, 0);
    totalEncontrados += toNumber(job.encontrados, 0);
    totalFalhas += toNumber(job.falhas, 0);
    totalNaoEncontrados += toNumber(job.nao_encontrados, 0);
    totalIgnorados += toNumber(job.ignorados, 0);
    totalCancelados += toNumber(job.cancelados, 0);

    if (toNumber(job.itens_por_segundo, 0) > 0) {
      throughputAccumulator += toNumber(job.itens_por_segundo, 0);
      throughputSamples += 1;
    }

    if (job.status === 'completed') jobsCompleted += 1;
    if (job.status === 'failed') jobsFailed += 1;
    if (job.status === 'cancelled') jobsCancelled += 1;
    if (cycle.reutilizado) jobsReused += 1;
  }

  const initialEligible = toNumber(report?.metricas_iniciais?.pendentes?.elegiveis, 0);
  const finalEligible = toNumber(report?.metricas_finais?.pendentes?.elegiveis, initialEligible);

  return {
    jobs_rodados: cycles.length,
    jobs_completed: jobsCompleted,
    jobs_failed: jobsFailed,
    jobs_cancelled: jobsCancelled,
    jobs_reutilizados: jobsReused,
    total_processados: totalProcessados,
    total_encontrados: totalEncontrados,
    total_falhas: totalFalhas,
    total_nao_encontrados: totalNaoEncontrados,
    total_ignorados: totalIgnorados,
    total_cancelados: totalCancelados,
    throughput_medio_ips: throughputSamples > 0
      ? Number((throughputAccumulator / throughputSamples).toFixed(3))
      : 0,
    backlog_elegivel_inicial: initialEligible,
    backlog_elegivel_final: finalEligible,
    backlog_elegivel_reduzido: Math.max(0, initialEligible - finalEligible)
  };
}

function printInitialMetrics(logger, metrics) {
  logger.log('Metricas iniciais:');
  logger.log(`- pendente=${formatNumber(metrics.produtos.status.pendente)} | running=${formatNumber(metrics.produtos.status.running)} | enriquecido=${formatNumber(metrics.produtos.status.enriquecido)} | erro=${formatNumber(metrics.produtos.status.erro)} | nao_encontrado=${formatNumber(metrics.produtos.status.nao_encontrado)}`);
  logger.log(`- pendentes_elegiveis=${formatNumber(metrics.pendentes.elegiveis)} | pendentes_sem_barcode=${formatNumber(metrics.pendentes.sem_barcode)} | elegibilidade=${toNumber(metrics.pendentes.percentual_elegiveis, 0).toFixed(2)}%`);

  const topClasses = Array.isArray(metrics.erros_resumo?.por_classe)
    ? metrics.erros_resumo.por_classe.slice(0, 3)
    : [];

  if (topClasses.length) {
    const formatted = topClasses
      .map((row) => `${row.classe}:${formatNumber(row.total)}`)
      .join(' | ');
    logger.log(`- erros_top_classes=${formatted}`);
  }
}

async function execute() {
  const args = parseCliArgs(process.argv.slice(2));

  if (parseBooleanInput(args.help, false)) {
    printUsage();
    return {
      help: true
    };
  }

  const config = buildConfig(args);

  const runId = createRunId();
  const logger = createLogger({
    enabled: config.writeReportFiles,
    reportDir: config.reportDir,
    runId
  });

  const report = {
    run_id: runId,
    iniciado_em: new Date().toISOString(),
    finalizado_em: null,
    duracao_total_s: 0,
    dry_run: config.dryRun,
    config: {
      base_url: config.baseUrl,
      poll_interval_ms: config.pollIntervalMs,
      request_timeout_ms: config.requestTimeoutMs,
      job_timeout_ms: config.jobTimeoutMs,
      allow_duplicate: config.allowDuplicate,
      dedupe_window_minutes: config.dedupeWindowMinutes,
      item_max_retries: config.itemMaxRetries,
      force: config.force,
      target_pending: config.targetPending,
      target_pending_elegiveis: config.targetPendingEligible,
      max_jobs: config.maxJobs,
      max_hours: config.maxHours,
      max_error_rate: config.maxErrorRate,
      max_rate_limit_rate: config.maxRateLimitRate,
      max_provider_config_errors: config.maxProviderConfigErrors,
      max_consecutive_failures: config.maxConsecutiveFailures,
      max_jobs_without_progress: config.maxJobsWithoutProgress,
      max_minutes_without_progress: config.maxMinutesWithoutProgress,
      min_throughput_ips: config.minThroughputIps,
      min_processed_for_throughput: config.minProcessedForThroughput,
      max_low_throughput_jobs: config.maxLowThroughputJobs,
      phase_plan: config.phasePlan
    },
    metricas_iniciais: null,
    metricas_finais: null,
    planejamento_dry_run: null,
    ciclos: [],
    stop_reason: null,
    resumo: null,
    artefatos: {
      log_path: logger.logPath || null,
      report_json_path: null
    }
  };

  const state = {
    startedMs: Date.now(),
    jobsExecutados: 0,
    consecutiveFailedJobs: 0,
    jobsWithoutProgress: 0,
    lowThroughputJobs: 0,
    lastProgressMs: Date.now()
  };

  let stopReason = null;
  let api = null;
  let interruptionRequested = false;

  const onSignal = () => {
    interruptionRequested = true;
    logger.log('Sinal de interrupcao recebido. O ciclo atual sera finalizado e o loop sera encerrado.');
  };

  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  try {
    logger.log('Iniciando orquestrador de drenagem de backlog de enrichment.');
    logger.log(`Base URL: ${config.baseUrl}`);
    logger.log(`Plano de fases: ${config.phasePlan.map((phase) => `${phase.nome}=${phase.limit}x${phase.concurrency}${Number.isFinite(phase.maxJobs) ? `@${phase.maxJobs}` : ''}`).join(', ')}`);

    const token = await authenticate(config, logger);
    api = buildApiClient(config, token);

    const metricasIniciais = await fetchOperationalMetrics(api, config, logger);
    report.metricas_iniciais = metricasIniciais;
    state.lastProgressMs = Date.now();

    printInitialMetrics(logger, metricasIniciais);

    if (config.dryRun) {
      const planejamento = buildDryRunPlan(metricasIniciais, config);
      report.planejamento_dry_run = planejamento;

      logger.log('Modo dry-run ativo: nenhum job real sera disparado.');
      logger.log(`- pendentes_elegiveis_iniciais=${formatNumber(planejamento.pendentes_elegiveis_iniciais)}`);
      logger.log(`- alvo_pendentes_elegiveis=${formatNumber(planejamento.alvo_pendentes_elegiveis)}`);
      logger.log(`- jobs_estimados=${formatNumber(planejamento.jobs_estimados)}`);
      logger.log(`- pendentes_elegiveis_estimado_final=${formatNumber(planejamento.pendentes_elegiveis_estimado_final)}`);

      for (const preview of planejamento.preview_jobs) {
        logger.log(`  ciclo ${preview.ciclo}: fase=${preview.fase} limit=${preview.limit} concurrency=${preview.concurrency} reducao_estimada=${preview.reducao_estimada} pendentes_apos=${preview.pendentes_elegiveis_pos_job}`);
      }

      stopReason = {
        code: 'dry_run_completed',
        message: 'Dry-run concluido sem disparar jobs.'
      };

      report.metricas_finais = metricasIniciais;
      report.stop_reason = stopReason;
      report.resumo = buildExecutionSummary(report);
      return report;
    }

    const phaseCursor = createPhaseCursor(config.phasePlan);
    let metricasAtuais = metricasIniciais;

    for (;;) {
      if (interruptionRequested) {
        stopReason = {
          code: 'manual_interruption',
          message: 'Execucao interrompida manualmente por sinal do operador.'
        };
        break;
      }

      const stopByGoal = evaluateStopByGoal(config, state, metricasAtuais, Date.now());
      if (stopByGoal) {
        stopReason = stopByGoal;
        break;
      }

      const fase = getCurrentPhase(phaseCursor);
      const cicloNumero = state.jobsExecutados + 1;
      const metricasAntes = metricasAtuais;
      const errosAntes = classTotalsFromSummary(metricasAntes.erros_resumo);

      const payload = {
        limit: fase.limit,
        concurrency: fase.concurrency,
        allow_duplicate: config.allowDuplicate,
        dedupe_window_minutes: config.dedupeWindowMinutes,
        item_max_retries: config.itemMaxRetries,
        force: config.force
      };

      logger.log(`Ciclo ${cicloNumero}: disparando job com fase=${fase.nome}, limit=${fase.limit}, concurrency=${fase.concurrency}, allow_duplicate=${config.allowDuplicate}.`);
      logger.log(`Ciclo ${cicloNumero}: backlog antes => pendente=${formatNumber(metricasAntes.produtos.status.pendente)} | elegiveis=${formatNumber(metricasAntes.pendentes.elegiveis)}.`);

      const cicloInicioIso = new Date().toISOString();
      const trigger = await triggerPendingJob(api, payload, logger);

      if (trigger.reutilizado) {
        logger.log(`Ciclo ${cicloNumero}: API reutilizou job ativo ${trigger.job.job_id}.`);
      } else {
        logger.log(`Ciclo ${cicloNumero}: novo job criado ${trigger.job.job_id}.`);
      }

      logger.log(`Ciclo ${cicloNumero}: mensagem API => ${trigger.mensagem || '(sem mensagem)'}`);

      let jobFinal = trigger.job;

      if (!TERMINAL_JOB_STATUS.has(jobFinal.status)) {
        jobFinal = await monitorJobUntilTerminal(api, config, logger, jobFinal.job_id);
      } else {
        logger.log(`Ciclo ${cicloNumero}: job ${jobFinal.job_id} ja veio em status terminal ${jobFinal.status}.`);
      }

      const metricasDepois = await fetchOperationalMetrics(api, config, logger);
      const errosDepois = classTotalsFromSummary(metricasDepois.erros_resumo);
      const erroDeltaPorClasse = diffClassTotals(errosAntes, errosDepois);

      const cicloFimIso = new Date().toISOString();
      const deltaPendente = metricasAntes.produtos.status.pendente - metricasDepois.produtos.status.pendente;
      const deltaElegiveis = metricasAntes.pendentes.elegiveis - metricasDepois.pendentes.elegiveis;

      const cycleReport = {
        ciclo: cicloNumero,
        iniciado_em: cicloInicioIso,
        finalizado_em: cicloFimIso,
        fase: {
          nome: fase.nome,
          limit: fase.limit,
          concurrency: fase.concurrency
        },
        payload_disparo: payload,
        reutilizado: trigger.reutilizado,
        mensagem_disparo: trigger.mensagem,
        job_id: jobFinal.job_id,
        job_final: jobFinal,
        metricas_antes: metricasAntes,
        metricas_depois: metricasDepois,
        delta: {
          pendentes: deltaPendente,
          pendentes_elegiveis: deltaElegiveis,
          enriquecido: metricasDepois.produtos.status.enriquecido - metricasAntes.produtos.status.enriquecido,
          erro: metricasDepois.produtos.status.erro - metricasAntes.produtos.status.erro,
          nao_encontrado: metricasDepois.produtos.status.nao_encontrado - metricasAntes.produtos.status.nao_encontrado
        },
        erro_delta_por_classe: erroDeltaPorClasse,
        indicadores: {
          taxa_erro_job: jobFinal.processados > 0 ? Number((jobFinal.falhas / jobFinal.processados).toFixed(4)) : 0,
          throughput_ips: Number(toNumber(jobFinal.itens_por_segundo, 0).toFixed(3)),
          taxa_rate_limit_delta: jobFinal.processados > 0
            ? Number((Math.max(0, toNumber(erroDeltaPorClasse.rate_limit, 0)) / jobFinal.processados).toFixed(4))
            : 0
        }
      };

      report.ciclos.push(cycleReport);
      state.jobsExecutados += 1;
      consumePhaseJob(phaseCursor);

      logger.log(`Ciclo ${cicloNumero}: resultado final => ${summarizeJobProgress(jobFinal)}`);
      logger.log(`Ciclo ${cicloNumero}: backlog depois => pendente=${formatNumber(metricasDepois.produtos.status.pendente)} | elegiveis=${formatNumber(metricasDepois.pendentes.elegiveis)} | delta_elegiveis=${formatNumber(deltaElegiveis)}.`);

      const riskStop = evaluateRiskGuards(config, state, cycleReport);
      metricasAtuais = metricasDepois;

      if (riskStop) {
        stopReason = riskStop;
        break;
      }
    }

    report.metricas_finais = metricasAtuais || report.metricas_iniciais;
    report.stop_reason = stopReason || {
      code: 'loop_finished',
      message: 'Loop finalizado sem motivo explicito de parada.'
    };
    report.resumo = buildExecutionSummary(report);

    logger.log(`Parada: ${report.stop_reason.message}`);
  } catch (error) {
    const failure = {
      code: 'execution_error',
      message: normalizeErrorMessage(error, 'Falha inesperada durante a execucao.')
    };

    report.stop_reason = failure;

    if (!report.metricas_finais && api) {
      try {
        report.metricas_finais = await fetchOperationalMetrics(api, config, logger);
      } catch {
        // Ignora erro secundario de coleta final.
      }
    }

    if (!report.metricas_finais) {
      report.metricas_finais = report.metricas_iniciais;
    }

    report.resumo = buildExecutionSummary(report);
    logger.log(`ERRO: ${failure.message}`);
    process.exitCode = 1;
  } finally {
    report.finalizado_em = new Date().toISOString();
    report.duracao_total_s = Number(((Date.now() - state.startedMs) / 1000).toFixed(3));

    if (!report.resumo) {
      report.resumo = buildExecutionSummary(report);
    }

    if (config.writeReportFiles) {
      const jsonPath = path.join(config.reportDir, `${runId}.summary.json`);
      writeJsonFile(jsonPath, report);
      report.artefatos.report_json_path = jsonPath;
      logger.log(`Relatorio JSON salvo em: ${jsonPath}`);
      if (logger.logPath) {
        logger.log(`Log textual salvo em: ${logger.logPath}`);
      }
    }

    const resumo = report.resumo || {};
    logger.log('Resumo final:');
    logger.log(`- jobs_rodados=${formatNumber(resumo.jobs_rodados)} | completed=${formatNumber(resumo.jobs_completed)} | failed=${formatNumber(resumo.jobs_failed)} | cancelled=${formatNumber(resumo.jobs_cancelled)} | reutilizados=${formatNumber(resumo.jobs_reutilizados)}`);
    logger.log(`- processados=${formatNumber(resumo.total_processados)} | encontrados=${formatNumber(resumo.total_encontrados)} | falhas=${formatNumber(resumo.total_falhas)} | nao_encontrados=${formatNumber(resumo.total_nao_encontrados)}`);
    logger.log(`- backlog_elegivel_inicial=${formatNumber(resumo.backlog_elegivel_inicial)} | backlog_elegivel_final=${formatNumber(resumo.backlog_elegivel_final)} | reduzido=${formatNumber(resumo.backlog_elegivel_reduzido)}`);
    logger.log(`- throughput_medio_ips=${toNumber(resumo.throughput_medio_ips, 0).toFixed(3)} | duracao_total=${formatDuration(report.duracao_total_s)}`);
    logger.log(`- motivo_parada=${report.stop_reason?.code || '-'} :: ${report.stop_reason?.message || '-'}`);

    logger.close();
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }

  return report;
}

if (require.main === module) {
  execute().catch((error) => {
    process.stderr.write(`${normalizeErrorMessage(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  execute,
  parseCliArgs,
  buildConfig,
  normalizeOperationalMetrics,
  normalizeJobSnapshot
};
