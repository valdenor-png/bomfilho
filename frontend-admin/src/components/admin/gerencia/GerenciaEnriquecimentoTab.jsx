import React from 'react';
import { POLITICAS_IMAGEM, clampInt } from '../../../lib/adminGerenciaUtils';

export default function GerenciaEnriquecimentoTab({
  // batch config
  loteLimite,
  setLoteLimite,
  loteConcorrencia,
  setLoteConcorrencia,
  janelaImportacaoMinutos,
  setJanelaImportacaoMinutos,
  overwriteImageMode,
  setOverwriteImageMode,
  forcarLookupLote,
  setForcarLookupLote,
  somenteSemImagemImportacaoRecente,
  setSomenteSemImagemImportacaoRecente,
  // barcode manual
  barcodeManual,
  setBarcodeManual,
  buscandoBarcode,
  resultadoLookupManual,
  onBuscarBarcodeManual,
  // batch actions
  executandoLoteSemImagem,
  resultadoLoteSemImagem,
  onEnriquecerSemImagem,
  executandoLoteImportacaoRecente,
  resultadoLoteImportacaoRecente,
  onEnriquecerImportacaoRecente,
  reprocessandoFalhas,
  resultadoReprocessamento,
  onReprocessarFalhas
}) {
  return (
    <div className="admin-gerencia-panel">
      <div className="card-box" style={{ marginTop: '0.8rem' }}>
        <p><strong>Configuracoes de lote</strong></p>
        <div className="admin-gerencia-edit-grid" style={{ marginTop: '0.4rem' }}>
          <label className="field-label" style={{ margin: 0 }}>
            Limite por execucao
            <input
              className="field-input"
              type="number"
              min="1"
              max="800"
              value={loteLimite}
              onChange={(event) => setLoteLimite(clampInt(event.target.value, 80, { min: 1, max: 800 }))}
            />
          </label>

          <label className="field-label" style={{ margin: 0 }}>
            Concorrencia
            <input
              className="field-input"
              type="number"
              min="1"
              max="10"
              value={loteConcorrencia}
              onChange={(event) => setLoteConcorrencia(clampInt(event.target.value, 3, { min: 1, max: 10 }))}
            />
          </label>

          <label className="field-label" style={{ margin: 0 }}>
            Janela de importacao recente (min)
            <input
              className="field-input"
              type="number"
              min="5"
              max="43200"
              value={janelaImportacaoMinutos}
              onChange={(event) => setJanelaImportacaoMinutos(clampInt(event.target.value, 180, { min: 5, max: 43200 }))}
            />
          </label>
        </div>

        <label className="field-label" style={{ marginTop: '0.5rem' }}>
          Politica de sobrescrita de imagem
        </label>
        <select
          className="field-input"
          value={overwriteImageMode}
          onChange={(event) => setOverwriteImageMode(event.target.value)}
        >
          {POLITICAS_IMAGEM.map((politica) => (
            <option key={politica.value} value={politica.value}>{politica.label}</option>
          ))}
        </select>

        <label className="importacao-checkbox" style={{ marginTop: '0.5rem' }}>
          <input
            type="checkbox"
            checked={forcarLookupLote}
            onChange={(event) => setForcarLookupLote(event.target.checked)}
          />
          Forcar consulta externa (ignorar cache persistente no lote).
        </label>

        <label className="importacao-checkbox" style={{ marginTop: '0.4rem' }}>
          <input
            type="checkbox"
            checked={somenteSemImagemImportacaoRecente}
            onChange={(event) => setSomenteSemImagemImportacaoRecente(event.target.checked)}
          />
          Importacao recente: processar somente produtos sem imagem.
        </label>
      </div>

      <div className="form-box" style={{ marginTop: '0.8rem' }}>
        <p><strong>Consulta manual por codigo de barras</strong></p>
        <div className="barcode-row">
          <input className="field-input" placeholder="Digite EAN/GTIN" value={barcodeManual} onChange={(event) => setBarcodeManual(event.target.value)} />
          <button className="btn-secondary" type="button" disabled={buscandoBarcode} onClick={onBuscarBarcodeManual}>
            {buscandoBarcode ? 'Consultando...' : 'Consultar'}
          </button>
        </div>

        {resultadoLookupManual?.produto ? (
          <div className="card-box" style={{ marginTop: '0.6rem' }}>
            <p><strong>Resultado da consulta</strong></p>
            <p><strong>Fonte:</strong> {resultadoLookupManual?.provider || resultadoLookupManual?.fonte || '-'}</p>
            <p><strong>Nome:</strong> {resultadoLookupManual.produto.nome || '-'}</p>
            <p><strong>Marca:</strong> {resultadoLookupManual.produto.marca || '-'}</p>
            <p><strong>Descricao:</strong> {resultadoLookupManual.produto.descricao || '-'}</p>
            <p><strong>Imagem:</strong> {resultadoLookupManual.produto.imagem || '-'}</p>
          </div>
        ) : null}
      </div>

      <div className="card-box" style={{ marginTop: '1rem' }}>
        <p><strong>Enriquecer produtos sem imagem</strong></p>
        <p className="muted-text">
          Processa itens ativos com codigo de barras e imagem vazia usando fallback entre providers.
        </p>
        <button className="btn-primary" type="button" disabled={executandoLoteSemImagem} onClick={onEnriquecerSemImagem}>
          {executandoLoteSemImagem ? 'Processando lote...' : 'Enriquecer sem imagem'}
        </button>

        {resultadoLoteSemImagem?.resumo ? (
          <div className="admin-kpis" style={{ marginTop: '0.7rem' }}>
            <div className="kpi-card"><strong>Selecionados:</strong> {Number(resultadoLoteSemImagem.resumo.total_selecionados || 0)}</div>
            <div className="kpi-card"><strong>Processados:</strong> {Number(resultadoLoteSemImagem.resumo.total_processados || 0)}</div>
            <div className="kpi-card"><strong>Atualizados:</strong> {Number(resultadoLoteSemImagem.resumo.total_atualizados || 0)}</div>
            <div className="kpi-card"><strong>Imagem atualizada:</strong> {Number(resultadoLoteSemImagem.resumo.total_imagem_atualizada || 0)}</div>
            <div className="kpi-card"><strong>Imagem preservada:</strong> {Number(resultadoLoteSemImagem.resumo.total_imagem_preservada || 0)}</div>
            <div className="kpi-card"><strong>Erros:</strong> {Number(resultadoLoteSemImagem.resumo.total_erros || 0)}</div>
          </div>
        ) : null}
      </div>

      <div className="card-box" style={{ marginTop: '1rem' }}>
        <p><strong>Enriquecer importacao recente</strong></p>
        <p className="muted-text">
          Reprocessa produtos importados recentemente para complementar imagens com controle de janela e concorrencia.
        </p>
        <button className="btn-primary" type="button" disabled={executandoLoteImportacaoRecente} onClick={onEnriquecerImportacaoRecente}>
          {executandoLoteImportacaoRecente ? 'Processando importacao recente...' : 'Enriquecer importacao recente'}
        </button>

        {resultadoLoteImportacaoRecente?.resumo ? (
          <div className="admin-kpis" style={{ marginTop: '0.7rem' }}>
            <div className="kpi-card"><strong>Selecionados:</strong> {Number(resultadoLoteImportacaoRecente.resumo.total_selecionados || 0)}</div>
            <div className="kpi-card"><strong>Processados:</strong> {Number(resultadoLoteImportacaoRecente.resumo.total_processados || 0)}</div>
            <div className="kpi-card"><strong>Atualizados:</strong> {Number(resultadoLoteImportacaoRecente.resumo.total_atualizados || 0)}</div>
            <div className="kpi-card"><strong>Imagem atualizada:</strong> {Number(resultadoLoteImportacaoRecente.resumo.total_imagem_atualizada || 0)}</div>
            <div className="kpi-card"><strong>Nao encontrados:</strong> {Number(resultadoLoteImportacaoRecente.resumo.total_nao_encontrados || 0)}</div>
            <div className="kpi-card"><strong>Erros:</strong> {Number(resultadoLoteImportacaoRecente.resumo.total_erros || 0)}</div>
          </div>
        ) : null}
      </div>

      <div className="card-box" style={{ marginTop: '1rem' }}>
        <p><strong>Reprocessamento em lote (falhas)</strong></p>
        <p className="muted-text">Reprocessa itens com status de erro ou nao encontrado, com controle de concorrencia.</p>
        <button className="btn-primary" type="button" disabled={reprocessandoFalhas} onClick={onReprocessarFalhas}>
          {reprocessandoFalhas ? 'Reprocessando...' : 'Reprocessar falhas agora'}
        </button>

        {resultadoReprocessamento?.resumo ? (
          <div className="admin-kpis" style={{ marginTop: '0.7rem' }}>
            <div className="kpi-card"><strong>Processados:</strong> {Number(resultadoReprocessamento.resumo.total_processados || 0)}</div>
            <div className="kpi-card"><strong>Enriquecidos:</strong> {Number(resultadoReprocessamento.resumo.total_enriquecidos || 0)}</div>
            <div className="kpi-card"><strong>Atualizados:</strong> {Number(resultadoReprocessamento.resumo.total_atualizados || 0)}</div>
            <div className="kpi-card"><strong>Nao encontrados:</strong> {Number(resultadoReprocessamento.resumo.total_nao_encontrados || 0)}</div>
            <div className="kpi-card"><strong>Erros:</strong> {Number(resultadoReprocessamento.resumo.total_erros || 0)}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
