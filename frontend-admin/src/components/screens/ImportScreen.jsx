import React from 'react';
import { colors, fonts, radius } from '../../styles/tokens';
import { KPICard, Btn, Badge } from '../ui';

export default function ImportScreen({
  modeloImportacaoUrl,
  arquivoImportacao,
  arrastandoImportacao,
  importarCriarNovos, setImportarCriarNovos,
  importandoPlanilha,
  resultadoImportacao,
  historicoImportacoes,
  carregandoImportacoes,
  handleArquivoImportacaoChange,
  handleDragOverImportacao,
  handleDragLeaveImportacao,
  handleDropImportacao,
  handleImportarPlanilha,
  handleSimularPlanilha,
  carregarHistoricoImportacoes,
  formatarStatusImportacao,
  formatarTamanhoArquivo,
}) {
  const BRL = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, fontFamily: fonts.text }}>Importacao de Produtos</h2>
          <p style={{ fontSize: 11, color: colors.dim, margin: '2px 0 0' }}>Importe planilhas do ERP (.xlsx / .csv) para atualizar preco, nome, descricao e foto.</p>
        </div>
        <Btn href={modeloImportacaoUrl} icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        }>
          Baixar modelo CSV
        </Btn>
      </div>

      {/* Upload form */}
      <form onSubmit={handleImportarPlanilha} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Dropzone */}
        <div
          onDragEnter={handleDragOverImportacao}
          onDragOver={handleDragOverImportacao}
          onDragLeave={handleDragLeaveImportacao}
          onDrop={handleDropImportacao}
          style={{
            padding: '32px 20px', borderRadius: radius.lg, textAlign: 'center',
            border: `2px dashed ${arrastandoImportacao ? colors.goldBorder : colors.border}`,
            background: arrastandoImportacao ? colors.goldDim : 'rgba(31,92,80,0.05)',
            transition: 'all 0.2s',
          }}
        >
          <input
            id="admin-importacao-arquivo"
            type="file" accept=".xlsx,.csv"
            onChange={handleArquivoImportacaoChange}
            style={{ display: 'none' }}
          />

          {/* Upload icon */}
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
            background: colors.goldDim, border: `1px solid ${colors.goldBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>

          <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>Arraste e solte sua planilha aqui</p>
          <p style={{ fontSize: 11, color: colors.dim, margin: '0 0 12px' }}>ou clique para selecionar . Aceita .xlsx e .csv</p>

          <label htmlFor="admin-importacao-arquivo">
            <Btn primary style={{ cursor: 'pointer' }}>Selecionar arquivo</Btn>
          </label>

          {arquivoImportacao && (
            <p style={{ fontSize: 12, color: colors.green, marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <strong>{arquivoImportacao.name}</strong> ({formatarTamanhoArquivo(arquivoImportacao.size)})
            </p>
          )}
        </div>

        {/* Options */}
        <div style={{
          padding: '12px 14px', borderRadius: radius.lg,
          background: colors.bgCard, border: `1px solid ${colors.border}`,
        }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, cursor: 'pointer', lineHeight: 1.5 }}>
            <input
              type="checkbox"
              checked={importarCriarNovos}
              onChange={(e) => setImportarCriarNovos(e.target.checked)}
              style={{ accentColor: colors.gold, width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
            />
            Criar produtos novos automaticamente quando nao existir correspondencia por codigo.
          </label>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={handleSimularPlanilha} disabled={importandoPlanilha}>
            {importandoPlanilha ? 'Processando...' : 'Simular planilha'}
          </Btn>
          <Btn gold type="submit" disabled={importandoPlanilha}>
            {importandoPlanilha ? 'Importando...' : 'Importar de verdade'}
          </Btn>
        </div>
      </form>

      {/* Results */}
      {resultadoImportacao && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>
            {resultadoImportacao.simulacao ? 'Resultado da simulacao' : 'Resultado da importacao'}
          </h3>

          {resultadoImportacao.simulacao && (
            <p style={{ fontSize: 11, color: colors.dim }}>Simulacao — nenhum dado foi alterado. Use "Importar de verdade" para aplicar.</p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
            <KPICard label="Total linhas" value={resultadoImportacao.total_linhas || 0} />
            <KPICard label="Atualizados" value={resultadoImportacao.total_atualizados || 0} tone="green" />
            <KPICard label="Criados" value={resultadoImportacao.total_criados || 0} tone="gold" />
            <KPICard label="Ignorados" value={resultadoImportacao.total_ignorados || 0} tone="orange" />
            <KPICard label="Erros" value={resultadoImportacao.total_erros || 0} tone="red" />
          </div>

          <p style={{ fontSize: 10, color: colors.dim }}>Arquivo: {resultadoImportacao.arquivo || '-'}</p>

          {/* Error logs */}
          {Array.isArray(resultadoImportacao?.logs?.erros) && resultadoImportacao.logs.erros.length > 0 && (
            <div style={{ padding: 12, borderRadius: radius.lg, background: colors.redBg, border: `1px solid ${colors.redBorder}` }}>
              <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px', color: colors.red }}>Erros identificados</p>
              {resultadoImportacao.logs.erros.slice(0, 8).map((item, i) => (
                <p key={i} style={{ fontSize: 11, color: colors.muted, margin: '2px 0' }}>
                  Linha {item?.linha || '-'}: {item?.motivo || 'Erro sem detalhe.'}
                </p>
              ))}
            </div>
          )}

          {Array.isArray(resultadoImportacao?.logs?.ignorados) && resultadoImportacao.logs.ignorados.length > 0 && (
            <div style={{ padding: 12, borderRadius: radius.lg, background: colors.orangeBg, border: `1px solid ${colors.orangeBorder}` }}>
              <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px', color: colors.orange }}>Itens ignorados</p>
              {resultadoImportacao.logs.ignorados.slice(0, 8).map((item, i) => (
                <p key={i} style={{ fontSize: 11, color: colors.muted, margin: '2px 0' }}>
                  Linha {item?.linha || '-'}: {item?.motivo || 'Sem detalhe.'}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Import history */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>Historico de Importacoes</h3>
          <Btn onClick={() => { void carregarHistoricoImportacoes(); }} disabled={carregandoImportacoes}>
            {carregandoImportacoes ? 'Atualizando...' : 'Atualizar'}
          </Btn>
        </div>

        <div style={{ borderRadius: radius.lg, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(31,92,80,0.1)' }}>
                {['Data', 'Arquivo', 'Status', 'Atual.', 'Criados', 'Ignor.', 'Erros'].map((h, i) => (
                  <th key={h} style={{
                    textAlign: i >= 3 ? 'right' : 'left',
                    padding: '10px 12px', fontSize: 10, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.8px',
                    color: colors.dim, borderBottom: `1px solid ${colors.borderLight}`,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historicoImportacoes.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: colors.dim }}>
                    Nenhuma importacao registrada.
                  </td>
                </tr>
              ) : (
                historicoImportacoes.map(imp => (
                  <tr key={imp.id} style={{ borderBottom: `1px solid ${colors.borderDim}` }}>
                    <td style={{ padding: '10px 12px', color: colors.dim, fontSize: 11 }}>
                      {imp.criado_em ? new Date(imp.criado_em).toLocaleString('pt-BR') : '-'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{imp.nome_arquivo || '-'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge tone={imp.status === 'concluido' ? 'green' : imp.status === 'erro' ? 'red' : 'orange'} label={formatarStatusImportacao(imp.status)} />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: fonts.numbers, fontWeight: 600 }}>{Number(imp.total_atualizados || 0)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: fonts.numbers, fontWeight: 600 }}>{Number(imp.total_criados || 0)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: fonts.numbers, fontWeight: 600 }}>{Number(imp.total_ignorados || 0)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: fonts.numbers, fontWeight: 600, color: Number(imp.total_erros || 0) > 0 ? colors.red : colors.muted }}>{Number(imp.total_erros || 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
