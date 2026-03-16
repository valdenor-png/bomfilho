'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_OUTPUT_DIR = path.join(__dirname, '..', 'logs', 'enrichment-final-stage');
const DOMINANT_MESSAGE = 'Codigo de barras invalido. Tamanho nao suportado para EAN/GTIN.';

function parseCliArgs(argv) {
  const args = { _: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '').trim();

    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    const eqIndex = token.indexOf('=');
    if (eqIndex > -1) {
      const key = token.slice(2, eqIndex).trim().replace(/-/g, '_');
      const value = token.slice(eqIndex + 1);
      args[key] = value === '' ? true : value;
      continue;
    }

    const key = token.slice(2).trim().replace(/-/g, '_');
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

function toTimestamp(value) {
  const source = String(value || '').trim();
  if (source && /^\d{8}_\d{6}$/.test(source)) {
    return source;
  }

  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, String(text || ''), 'utf8');
}

function copyAsLatest(sourceFile, latestFile) {
  ensureDir(path.dirname(latestFile));
  fs.copyFileSync(sourceFile, latestFile);
}

function pctDrop(before, after) {
  if (!Number.isFinite(before) || before <= 0) {
    return 0;
  }

  return Number((((before - after) / before) * 100).toFixed(2));
}

function buildSummary({ runId, generatedAt }) {
  const baseline = {
    total_ativos: 21291,
    enriquecido: 2137,
    erro: 2505,
    nao_encontrado: 16649
  };

  const residualAntes = {
    barcode_invalido: 2502,
    sem_barcode: 2,
    timeout: 1,
    mensagem_dominante: {
      texto: DOMINANT_MESSAGE,
      total: 2502
    }
  };

  const faseDv = {
    descricao: 'Autoaprovacao segura para digito verificador inconsistente',
    total_autoaprovado_reprocessado: 1901,
    resultado: 'concluida_sem_falhas_relevantes'
  };

  const faseAnalise2502 = {
    descricao: 'Analise somente leitura dos casos de tamanho invalido',
    total_analisado: 2502,
    distribuicao: {
      menor_que_esperado_ate_6_digitos: 1471,
      menor_que_esperado_7_digitos: 945,
      menor_que_esperado_11_digitos: 80,
      menor_que_esperado_9_10_digitos: 5,
      maior_que_esperado_15_19_digitos: 1
    },
    causa_raiz: [
      'forte presenca de codigo interno, sku e codigo fornecedor no campo barcode',
      'forte indicio de perda de zero a esquerda nos grupos de 7 e 11 digitos',
      'casos residuais de truncamento e inconsistencias de origem'
    ]
  };

  const faseTriagem = {
    descricao: 'Triagem restritiva pad-left-zero para grupos 7 e 11 digitos',
    total_elegivel_analisado: 1025,
    bucket: {
      candidate: 1001,
      safe: 1001,
      assisted: 0,
      rejected: 24
    },
    quebra_grupo: {
      grupo_7: {
        total: 945,
        safe: 924,
        rejected: 21
      },
      grupo_11: {
        total: 80,
        safe: 77,
        rejected: 3
      }
    },
    validacoes: [
      'checksum valido para os itens classificados como safe',
      'sem colisao com outro produto ativo',
      'sem conflito evidente de consistencia minima',
      'sem ambiguidade operacional para autoaplicacao'
    ]
  };

  const faseAplicacao = {
    descricao: 'Execucao controlada somente no bucket safe',
    piloto: {
      alterados: 50,
      reprocessados: 50,
      falhas: 0
    },
    lote_completo: {
      total_ids_carregados: 1001,
      total_alterados: 951,
      total_pulados: 50,
      total_reprocessados: 951,
      total_reprocess_failed: 0,
      total_revalidation_failed: 0
    },
    leitura_operacional: [
      'os 50 pulados no full run correspondem ao piloto previamente aplicado',
      'total efetivamente corrigido na fase pad-left-zero: 1001',
      'total efetivamente reprocessado na fase pad-left-zero: 1001'
    ]
  };

  const ajusteFinal = {
    classificacao_servico: 'catalogoAdminService.js com classificacao acento-insensivel',
    parser_summary_drain: 'enrichment-backlog-drain.js com parser resiliente a variacoes de payload/chave',
    objetivo: 'consistencia da leitura operacional e portabilidade entre maquinas'
  };

  const residualFinal = {
    barcode_invalido: 1501,
    sem_barcode: 2,
    timeout: 1,
    mensagem_dominante: {
      texto: DOMINANT_MESSAGE,
      total: 1501
    }
  };

  const variacaoMensagemDominante = {
    antes: residualAntes.mensagem_dominante.total,
    depois: residualFinal.mensagem_dominante.total,
    queda_absoluta: residualAntes.mensagem_dominante.total - residualFinal.mensagem_dominante.total,
    queda_percentual: pctDrop(residualAntes.mensagem_dominante.total, residualFinal.mensagem_dominante.total)
  };

  const riscosEvitados = [
    'falso positivo de barcode por preenchimento indevido',
    'enriquecimento incorreto por associacao de codigo a produto errado',
    'colisoes de barcode entre produtos ativos',
    'automacao insegura em casos ambiguos ou irrecuperaveis',
    'divergencia entre computadores por parser de summary nao versionado'
  ];

  const naoFeitoDeProposito = [
    'nao inventar barcode quando nao ha base confiavel',
    'nao completar zeros de forma arbitraria fora do criterio safe',
    'nao truncar codigos para forcar formato GTIN',
    'nao automatizar casos ambiguos ou com risco operacional',
    'nao tocar casos fora do escopo seguro definido'
  ];

  const proximosPassos = [
    'tratar o residual de 1501 casos de tamanho invalido em etapa distinta (manual e/ou irrecuperavel)',
    'atuar na origem de cadastro e importacao para reduzir erro estrutural',
    'reforcar prevencao de perda de zero a esquerda em planilhas e integracoes',
    'reforcar validacao para bloquear codigo interno no campo barcode'
  ];

  return {
    run_id: runId,
    generated_at: generatedAt,
    stage: {
      nome: 'saneamento e recuperacao segura de barcode',
      status: 'concluida_com_sucesso',
      closeout_tipo: 'documentacao_final_auditavel',
      sem_mutacao_dados_neste_closeout: true,
      sem_reprocessamento_neste_closeout: true,
      sem_alteracao_logica_neste_closeout: true
    },
    baseline,
    residual_antes: residualAntes,
    fase_dv: faseDv,
    fase_analise_2502: faseAnalise2502,
    fase_triagem_pad_left_zero: faseTriagem,
    fase_aplicacao_controlada_safe: faseAplicacao,
    ajuste_final_classificacao_e_summary: ajusteFinal,
    residual_final: residualFinal,
    variacao_mensagem_dominante: variacaoMensagemDominante,
    resolvido: [
      'incompatibilidade entre script de drain e backend',
      'rotas de enrichment faltantes',
      'backlog elegivel drenado',
      'fluxo de revisao manual de barcode',
      'fluxo de autoaprovacao segura para digito verificador inconsistente',
      'execucao controlada pad-left-zero safe com revalidacao, idempotencia e auditoria',
      'classificacao e summary operacional robustecidos e versionados'
    ],
    residual_remanescente: {
      escopo_atual_encerrado: true,
      pertence_a_nova_etapa: true,
      itens: residualFinal
    },
    riscos_evitados: riscosEvitados,
    nao_feito_de_proposito: naoFeitoDeProposito,
    proximos_passos_recomendados: proximosPassos,
    status_final: {
      etapa_encerrada: true,
      automacao_segura_executada_com_sucesso: true,
      residual_separado_corretamente: true,
      proxima_fase_distinta_do_escopo_atual: true
    },
    referencias_operacionais: [
      'backend/logs/enrichment-barcode-invalid-length/latest.summary.json',
      'backend/logs/enrichment-barcode-pad-left-zero/latest.summary.json',
      'backend/logs/enrichment-barcode-pad-left-zero-apply/latest.summary.json',
      'backend/services/admin/catalogoAdminService.js',
      'backend/scripts/enrichment-backlog-drain.js'
    ]
  };
}

function renderMarkdown(summary) {
  const lines = [];

  lines.push('# Encerramento Formal - Saneamento e Recuperacao Segura de Barcode');
  lines.push('');
  lines.push(`Run ID: ${summary.run_id}`);
  lines.push(`Gerado em: ${summary.generated_at}`);
  lines.push(`Status da etapa: ${summary.stage.status}`);
  lines.push('');

  lines.push('## 1) Resumo Executivo');
  lines.push('- Objetivo da etapa: recuperar com seguranca casos de barcode invalido com potencial tecnico real de correcao, sem automacao arriscada.');
  lines.push('- Problema atacado: alta concentracao de erros em barcode_invalido, com dominancia da mensagem de tamanho nao suportado para EAN/GTIN.');
  lines.push('- Resultado final: queda da mensagem dominante de 2502 para 1501 apos execucao controlada dos casos safe.');
  lines.push('- Status: etapa concluida com sucesso e residual separado para nova fase.');
  lines.push('');

  lines.push('## 2) Linha do Tempo da Etapa');
  lines.push('- Diagnostico inicial do estado operacional e do residual de erro.');
  lines.push('- Frente DV inconsistente com autoaprovacao segura e reprocessamento controlado (1901 casos).');
  lines.push('- Fase 1: analise somente leitura dos 2502 casos de tamanho invalido.');
  lines.push('- Fase 2: triagem restritiva pad-left-zero para grupos de 7 e 11 digitos.');
  lines.push('- Fase 3: aplicacao controlada no bucket safe com revalidacao e idempotencia.');
  lines.push('- Ajuste final de classificacao e parser de summary para robustez e portabilidade.');
  lines.push('- Validacao final dos indicadores e consolidacao do residual remanescente.');
  lines.push('');

  lines.push('## 3) O que Foi Implementado');
  lines.push('- Script de analise auditavel para tamanho invalido (somente leitura).');
  lines.push('- Script de triagem pad-left-zero com buckets candidate/safe/assisted/rejected.');
  lines.push('- Script de aplicacao controlada para SAFE com guard rails de seguranca.');
  lines.push('- Guard rails: revalidacao por item, idempotencia, bloqueio de ambiguidade e controle de colisao.');
  lines.push('- Auditoria: artefatos summary/details/markdown e listas de IDs por resultado.');
  lines.push('- Reprocessamento controlado: somente para itens realmente alterados.');
  lines.push('- Correcao de classificacao acento-insensivel e parser de summary resiliente.');
  lines.push('');

  lines.push('## 4) Resultados Quantitativos');
  lines.push(`- Estado inicial relevante: total_ativos=${summary.baseline.total_ativos}, enriquecido=${summary.baseline.enriquecido}, erro=${summary.baseline.erro}, nao_encontrado=${summary.baseline.nao_encontrado}.`);
  lines.push(`- Residual inicial da mensagem dominante: ${summary.residual_antes.mensagem_dominante.total}.`);
  lines.push(`- DV inconsistente tratado: ${summary.fase_dv.total_autoaprovado_reprocessado}.`);
  lines.push(`- Analise dos 2502: ate6=${summary.fase_analise_2502.distribuicao.menor_que_esperado_ate_6_digitos}, g7=${summary.fase_analise_2502.distribuicao.menor_que_esperado_7_digitos}, g11=${summary.fase_analise_2502.distribuicao.menor_que_esperado_11_digitos}, g9_10=${summary.fase_analise_2502.distribuicao.menor_que_esperado_9_10_digitos}, g15_19=${summary.fase_analise_2502.distribuicao.maior_que_esperado_15_19_digitos}.`);
  lines.push(`- Triagem 7/11: elegivel=${summary.fase_triagem_pad_left_zero.total_elegivel_analisado}, candidate=${summary.fase_triagem_pad_left_zero.bucket.candidate}, safe=${summary.fase_triagem_pad_left_zero.bucket.safe}, assisted=${summary.fase_triagem_pad_left_zero.bucket.assisted}, rejected=${summary.fase_triagem_pad_left_zero.bucket.rejected}.`);
  lines.push(`- Aplicacao SAFE (piloto + full): corrigidos efetivos=1001, reprocessados efetivos=1001, falhas de reprocess=0, falhas de revalidacao=0.`);
  lines.push(`- Residual final: barcode_invalido=${summary.residual_final.barcode_invalido}, sem_barcode=${summary.residual_final.sem_barcode}, timeout=${summary.residual_final.timeout}.`);
  lines.push(`- Queda da mensagem dominante: ${summary.variacao_mensagem_dominante.antes} -> ${summary.variacao_mensagem_dominante.depois} (queda absoluta=${summary.variacao_mensagem_dominante.queda_absoluta}, queda percentual=${summary.variacao_mensagem_dominante.queda_percentual}%).`);
  lines.push('');

  lines.push('## 5) O que Foi Resolvido');
  for (const item of summary.resolvido) {
    lines.push(`- ${item}.`);
  }
  lines.push('');

  lines.push('## 6) O que Sobrou');
  lines.push(`- Residual remanescente: barcode_invalido=${summary.residual_final.barcode_invalido}, sem_barcode=${summary.residual_final.sem_barcode}, timeout=${summary.residual_final.timeout}.`);
  lines.push(`- Mensagem dominante residual: "${summary.residual_final.mensagem_dominante.texto}" = ${summary.residual_final.mensagem_dominante.total}.`);
  lines.push('- Este residual pertence a uma nova etapa, fora do escopo desta frente segura encerrada.');
  lines.push('');

  lines.push('## 7) O que Nao Foi Feito de Proposito');
  for (const item of summary.nao_feito_de_proposito) {
    lines.push(`- ${item}.`);
  }
  lines.push('');

  lines.push('## 8) Riscos Evitados');
  for (const item of summary.riscos_evitados) {
    lines.push(`- ${item}.`);
  }
  lines.push('');

  lines.push('## 9) Proximos Passos Recomendados');
  for (const item of summary.proximos_passos_recomendados) {
    lines.push(`- ${item}.`);
  }
  lines.push('');

  lines.push('## 10) Status Final da Etapa');
  lines.push('- Etapa concluida.');
  lines.push('- Automacao segura executada com sucesso.');
  lines.push('- Residual remanescente separado corretamente para tratamento dedicado.');
  lines.push('- Proxima fase definida como escopo distinto da etapa atual.');
  lines.push('');

  lines.push('## Evidencias de Referencia');
  for (const ref of summary.referencias_operacionais) {
    lines.push(`- ${ref}`);
  }

  return `${lines.join('\n')}\n`;
}

function renderReleaseNote(summary) {
  const lines = [];

  lines.push('# Release Note Tecnica - Encerramento da Etapa de Saneamento de Barcode');
  lines.push('');
  lines.push(`- Run ID: ${summary.run_id}`);
  lines.push(`- Status: ${summary.stage.status}`);
  lines.push(`- Fechamento da mensagem dominante: ${summary.variacao_mensagem_dominante.antes} -> ${summary.variacao_mensagem_dominante.depois} (${summary.variacao_mensagem_dominante.queda_percentual}% de reducao).`);
  lines.push(`- DV inconsistente tratado anteriormente: ${summary.fase_dv.total_autoaprovado_reprocessado} casos.`);
  lines.push('- Pad-left-zero safe aplicado com controle estrito: 1001 corrigidos e 1001 reprocessados efetivos, sem falhas operacionais relevantes.');
  lines.push(`- Residual final desta frente: barcode_invalido=${summary.residual_final.barcode_invalido}, sem_barcode=${summary.residual_final.sem_barcode}, timeout=${summary.residual_final.timeout}.`);
  lines.push('- Ajustes de robustez consolidados: classificacao acento-insensivel e parser de summary resiliente/portavel.');
  lines.push('- Encerramento: etapa atual concluida; residual segue para fase distinta de tratamento.');

  return `${lines.join('\n')}\n`;
}

function buildOutputPaths(outputDir, runId) {
  return {
    markdown: path.join(outputDir, `${runId}.md`),
    summaryJson: path.join(outputDir, `${runId}.summary.json`),
    releaseNote: path.join(outputDir, `${runId}.release-note.md`),
    latestMarkdown: path.join(outputDir, 'latest.md'),
    latestSummaryJson: path.join(outputDir, 'latest.summary.json'),
    latestReleaseNote: path.join(outputDir, 'latest.release-note.md')
  };
}

function printUsage() {
  const lines = [
    'Uso: node tools/generate-enrichment-stage-closeout.js [opcoes]',
    '',
    'Opcoes:',
    '  --output-dir <path>      Pasta de saida (padrao: backend/logs/enrichment-final-stage)',
    '  --timestamp <YYYYMMDD_HHMMSS>  Timestamp fixo para run_id',
    '  --help                   Exibe esta ajuda'
  ];

  process.stdout.write(`${lines.join('\n')}\n`);
}

function run() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return null;
  }

  const timestamp = toTimestamp(args.timestamp);
  const runId = `enrichment_stage_closeout_${timestamp}`;
  const outputDir = path.resolve(String(args.output_dir || DEFAULT_OUTPUT_DIR));
  const generatedAt = new Date().toISOString();

  const summary = buildSummary({ runId, generatedAt });
  const markdown = renderMarkdown(summary);
  const releaseNote = renderReleaseNote(summary);
  const output = buildOutputPaths(outputDir, runId);

  writeJson(output.summaryJson, summary);
  writeText(output.markdown, markdown);
  writeText(output.releaseNote, releaseNote);

  copyAsLatest(output.summaryJson, output.latestSummaryJson);
  copyAsLatest(output.markdown, output.latestMarkdown);
  copyAsLatest(output.releaseNote, output.latestReleaseNote);

  process.stdout.write(`Closeout gerado com sucesso.\n`);
  process.stdout.write(`- Summary JSON: ${output.summaryJson}\n`);
  process.stdout.write(`- Markdown: ${output.markdown}\n`);
  process.stdout.write(`- Release note: ${output.releaseNote}\n`);
  process.stdout.write(`- Latest JSON: ${output.latestSummaryJson}\n`);
  process.stdout.write(`- Latest MD: ${output.latestMarkdown}\n`);
  process.stdout.write(`- Latest release note: ${output.latestReleaseNote}\n`);

  return {
    runId,
    output,
    summary
  };
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    process.stderr.write(`Falha ao gerar closeout: ${error.message || error}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  run,
  buildSummary,
  renderMarkdown,
  renderReleaseNote
};
