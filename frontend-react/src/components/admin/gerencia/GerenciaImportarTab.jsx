import React from 'react';
import {
  PASSOS_IMPORTACAO,
  CAMPOS_MAPEAMENTO_ORDEM,
  ESTADOS_FLUXO_IMPORTACAO,
  POLITICAS_IMAGEM,
  formatarMoeda,
  clampInt
} from '../../../lib/adminGerenciaUtils';

export default function GerenciaImportarTab({
  // wizard step state
  passoImportacaoAtivo,
  passoImportacaoMaximoLiberado,
  podeAvancarPassoImportacao,
  onIrParaPasso,
  onAvancarPasso,
  onVoltarPasso,
  // step 1 - upload
  arquivoPlanilha,
  dragUploadAtivo,
  onDragOver,
  onDragLeave,
  onDrop,
  onArquivoSelecionadoInput,
  processandoLeituraPlanilha,
  carregandoImportacaoUtils,
  falhaCarregamentoImportacaoUtils,
  extensoesImportacaoAceitas,
  textoExtensoesImportacao,
  nomeArquivoExibicao,
  formatarTamanhoArquivoImportacao,
  // step 2 - leitura
  leituraPlanilha,
  estadoFluxoImportacao,
  erroLeituraPlanilha,
  // step 3 - mapeamento
  mapeamentoColunas,
  camposImportacaoLabel,
  validacaoMapeamento,
  onAtualizarMapeamento,
  // step 4 - preview
  previewImportacao,
  // step 5 - simulacao/importacao
  importacaoCriarNovos,
  setImportacaoCriarNovos,
  importacaoAtualizarEstoque,
  setImportacaoAtualizarEstoque,
  overwriteImageMode,
  setOverwriteImageMode,
  enriquecerPosImportacao,
  setEnriquecerPosImportacao,
  enriquecerPosImportacaoSomenteSemImagem,
  setEnriquecerPosImportacaoSomenteSemImagem,
  loteLimite,
  setLoteLimite,
  loteConcorrencia,
  setLoteConcorrencia,
  janelaImportacaoMinutos,
  setJanelaImportacaoMinutos,
  importandoPlanilha,
  modoImportacaoAtual,
  simulacaoOficialConcluida,
  progressoImportacaoFormatado,
  baixandoModelo,
  setAssinaturaSimulacaoValida,
  setResultadoImportacao,
  onExecutarImportacao,
  onBaixarModelo,
  // step 6 - resultado
  resultadoImportacao,
  onBaixarRelatorio,
  onLimparWizard,
  // historico
  historicoImportacoesRecentes,
  carregandoHistoricoImportacao
}) {
  const formatarData = (v) => v ? new Date(v).toLocaleString('pt-BR') : '-';
  const normalizarStatus = (s) => (s || 'pendente').toLowerCase().replace(/\s+/g, '_');

  return (
    <div className="admin-gerencia-panel admin-import-panel">
      <div className="admin-import-header">
        <h2>Importacao de planilha com fluxo guiado</h2>
        <p>
          Upload seguro, leitura automatica, mapeamento assistido, preview e importacao final com controle operacional.
        </p>
      </div>

      <ol className="admin-import-stepper" aria-label="Etapas da importacao">
        {PASSOS_IMPORTACAO.map((passo) => {
          const ativo = passoImportacaoAtivo === passo.id;
          const concluido = passo.id < passoImportacaoAtivo || passo.id < passoImportacaoMaximoLiberado;
          const bloqueado = passo.id > passoImportacaoMaximoLiberado;

          return (
            <li key={passo.id}>
              <button
                type="button"
                className={`admin-import-step-btn ${ativo ? 'is-active' : ''} ${concluido ? 'is-done' : ''}`}
                onClick={() => onIrParaPasso(passo.id)}
                disabled={bloqueado}
                aria-current={ativo ? 'step' : undefined}
              >
                <span className="admin-import-step-index">{passo.id}</span>
                <span>{passo.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="admin-import-cards-grid">
        {/* Etapa 1 - Upload */}
        <article className={`admin-import-card ${passoImportacaoAtivo === 1 ? 'is-active' : ''}`}>
          <h3>Etapa 1 - Upload do arquivo</h3>
          <p>Envie uma planilha de catalogo em formato Excel ou CSV.</p>

          <div
            className={`importacao-dropzone admin-import-dropzone ${dragUploadAtivo ? 'dragover' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                const input = document.getElementById('admin-import-file-input');
                if (input) input.click();
              }
            }}
          >
            <strong>Arraste e solte aqui</strong>
            <span>Formatos aceitos: {textoExtensoesImportacao}</span>
            <input
              id="admin-import-file-input"
              className="importacao-file-input"
              type="file"
              accept={extensoesImportacaoAceitas.join(',')}
              onChange={onArquivoSelecionadoInput}
            />
            <button
              className="btn-secondary importacao-select-btn"
              type="button"
              disabled={carregandoImportacaoUtils}
              onClick={() => {
                const input = document.getElementById('admin-import-file-input');
                if (input) input.click();
              }}
            >
              Selecionar arquivo
            </button>
          </div>

          {processandoLeituraPlanilha ? (
            <p className="muted-text">Lendo arquivo e validando estrutura da planilha...</p>
          ) : carregandoImportacaoUtils ? (
            <p className="muted-text">Preparando leitor de planilha...</p>
          ) : null}

          {falhaCarregamentoImportacaoUtils ? (
            <p className="error-text">Nao foi possivel preparar o leitor de planilha. Tente selecionar o arquivo novamente.</p>
          ) : null}

          {arquivoPlanilha ? (
            <p className="admin-import-file-meta">
              Arquivo carregado: <strong>{nomeArquivoExibicao || arquivoPlanilha.name}</strong> ({formatarTamanhoArquivoImportacao(arquivoPlanilha.size)})
            </p>
          ) : (
            <p className="muted-text">Nenhum arquivo selecionado no momento.</p>
          )}
        </article>

        {/* Etapa 2 - Leitura */}
        <article className={`admin-import-card ${passoImportacaoAtivo === 2 ? 'is-active' : ''}`}>
          <h3>Etapa 2 - Leitura da planilha</h3>
          <p>Conferencia tecnica da estrutura do arquivo antes de mapear colunas.</p>

          {leituraPlanilha ? (
            <div className="admin-import-read-summary">
              <div><span>Arquivo</span><strong>{nomeArquivoExibicao || leituraPlanilha.nomeArquivo}</strong></div>
              <div><span>Formato</span><strong>{leituraPlanilha.extensao}</strong></div>
              <div><span>Aba utilizada</span><strong>{leituraPlanilha.nomeAba}</strong></div>
              <div><span>Linhas estimadas</span><strong>{Number(leituraPlanilha.totalLinhas || 0)}</strong></div>
              <div><span>Colunas detectadas</span><strong>{Number(leituraPlanilha.colunasDetectadas || 0)}</strong></div>
              <div><span>Status da leitura</span><strong>Arquivo valido</strong></div>
            </div>
          ) : processandoLeituraPlanilha ? (
            <p className="muted-text">Lendo planilha e montando diagnostico...</p>
          ) : estadoFluxoImportacao === ESTADOS_FLUXO_IMPORTACAO.READ_ERROR ? (
            <p className="error-text">Falha na leitura: {erroLeituraPlanilha || 'Nao foi possivel processar o arquivo selecionado.'}</p>
          ) : arquivoPlanilha ? (
            <p className="muted-text">Arquivo selecionado, aguardando conclusao da leitura.</p>
          ) : (
            <p className="muted-text">Carregue um arquivo para visualizar diagnostico de leitura.</p>
          )}
        </article>

        {/* Etapa 3 - Mapeamento */}
        <article className={`admin-import-card ${passoImportacaoAtivo === 3 ? 'is-active' : ''}`}>
          <h3>Etapa 3 - Mapeamento de colunas</h3>
          <p>Selecione quais colunas da planilha alimentam cada campo do sistema.</p>
          <p className="muted-text" style={{ marginTop: '-0.2rem' }}>
            Requisitos do backend: (Codigo interno ou Codigo de barras) + (Nome ou Descricao) + Preco.
          </p>

          {leituraPlanilha ? (
            <>
              <div className="admin-import-map-grid">
                {CAMPOS_MAPEAMENTO_ORDEM.map((campo) => (
                  <label key={campo} className="admin-import-map-field">
                    <span>{camposImportacaoLabel[campo] || campo}</span>
                    <select
                      className="field-input"
                      value={mapeamentoColunas[campo] || ''}
                      onChange={(event) => onAtualizarMapeamento(campo, event.target.value)}
                    >
                      <option value="">Nao mapear</option>
                      {leituraPlanilha.cabecalhos.map((cabecalho, indice) => (
                        <option key={`${campo}-col-${indice}`} value={cabecalho}>
                          {cabecalho}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              {!validacaoMapeamento.ok ? (
                <ul className="admin-import-validation-list" aria-label="Pendencias de campos obrigatorios do payload">
                  {validacaoMapeamento.pendencias.map((pendencia, indice) => (
                    <li key={`pendencia-${indice}`}>{pendencia}</li>
                  ))}
                </ul>
              ) : (
                <p className="success-text" style={{ marginTop: '0.4rem' }}>Mapeamento minimo obrigatorio atendido.</p>
              )}
            </>
          ) : (
            <p className="muted-text">
              {estadoFluxoImportacao === ESTADOS_FLUXO_IMPORTACAO.READ_ERROR
                ? 'Corrija o arquivo e tente novamente para habilitar o mapeamento.'
                : 'Conclua a leitura da planilha para habilitar o mapeamento.'}
            </p>
          )}
        </article>

        {/* Etapa 4 - Preview */}
        <article className={`admin-import-card ${passoImportacaoAtivo === 4 ? 'is-active' : ''}`}>
          <h3>Etapa 4 - Pre-visualizacao</h3>
          <p>Valide qualidade das linhas antes da simulacao/importacao final.</p>
          <p className="muted-text" style={{ marginTop: '-0.18rem' }}>
            Esta etapa mostra pre-analise local. A simulacao oficial do backend (etapa 5) e a validacao definitiva antes da importacao real.
          </p>

          {previewImportacao ? (
            <>
              <div className="admin-kpis admin-import-preview-kpis">
                <div className="kpi-card"><strong>Total lidas:</strong> {Number(previewImportacao?.contadores?.total_lidas || 0)}</div>
                <div className="kpi-card"><strong>Validas:</strong> {Number(previewImportacao?.contadores?.validas || 0)}</div>
                <div className="kpi-card"><strong>Com erro:</strong> {Number(previewImportacao?.contadores?.com_erro || 0)}</div>
                <div className="kpi-card"><strong>Duplicadas:</strong> {Number(previewImportacao?.contadores?.duplicadas || 0)}</div>
                <div className="kpi-card"><strong>Prontas:</strong> {Number(previewImportacao?.contadores?.prontas_importar || 0)}</div>
              </div>

              <div className="table-wrap admin-import-preview-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>Status previsto</th>
                      <th>Produto</th>
                      <th>Codigo barras</th>
                      <th>Preco</th>
                      <th>Observacoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewImportacao.rows.map((item) => (
                      <tr key={`preview-row-${item.numeroLinha}`}>
                        <td>{item.numeroLinha}</td>
                        <td>
                          <span className={`admin-import-row-status is-${item.status}`}>
                            {item.statusLabel}
                          </span>
                        </td>
                        <td>{item?.produto?.nome || '-'}</td>
                        <td>{item?.produto?.codigo_barras || '-'}</td>
                        <td>{item?.produto?.preco ? formatarMoeda(item.produto.preco) : '-'}</td>
                        <td>{item.motivos?.length ? item.motivos[0] : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="muted-text">Configure o mapeamento para gerar o preview.</p>
          )}
        </article>

        {/* Etapa 5 - Simulacao e importacao */}
        <article className={`admin-import-card ${passoImportacaoAtivo === 5 ? 'is-active' : ''}`}>
          <h3>Etapa 5 - Simulacao e importacao final</h3>
          <p>Simule para reduzir risco operacional e depois execute a importacao real.</p>

          <label className="importacao-checkbox">
            <input
              type="checkbox"
              checked={importacaoCriarNovos}
              onChange={(event) => {
                setImportacaoCriarNovos(event.target.checked);
                setAssinaturaSimulacaoValida('');
                setResultadoImportacao(null);
              }}
            />
            Criar novos produtos quando nao houver correspondencia.
          </label>

          <label className="importacao-checkbox">
            <input
              type="checkbox"
              checked={importacaoAtualizarEstoque}
              onChange={(event) => {
                setImportacaoAtualizarEstoque(event.target.checked);
                setAssinaturaSimulacaoValida('');
                setResultadoImportacao(null);
              }}
            />
            Atualizar estoque usando coluna mapeada da planilha.
          </label>

          <label className="field-label" style={{ marginTop: '0.65rem' }}>
            Politica de imagem durante enriquecimento
          </label>
          <select
            className="field-input"
            value={overwriteImageMode}
            onChange={(event) => {
              setOverwriteImageMode(event.target.value);
              setAssinaturaSimulacaoValida('');
              setResultadoImportacao(null);
            }}
          >
            {POLITICAS_IMAGEM.map((politica) => (
              <option key={politica.value} value={politica.value}>{politica.label}</option>
            ))}
          </select>

          <label className="importacao-checkbox" style={{ marginTop: '0.6rem' }}>
            <input
              type="checkbox"
              checked={enriquecerPosImportacao}
              onChange={(event) => {
                setEnriquecerPosImportacao(event.target.checked);
                setAssinaturaSimulacaoValida('');
                setResultadoImportacao(null);
              }}
            />
            Rodar enriquecimento automatico ao final da importacao real.
          </label>

          {enriquecerPosImportacao ? (
            <>
              <label className="importacao-checkbox" style={{ marginTop: '0.3rem' }}>
                <input
                  type="checkbox"
                  checked={enriquecerPosImportacaoSomenteSemImagem}
                  onChange={(event) => {
                    setEnriquecerPosImportacaoSomenteSemImagem(event.target.checked);
                    setAssinaturaSimulacaoValida('');
                    setResultadoImportacao(null);
                  }}
                />
                Pos-importacao: processar somente itens sem imagem.
              </label>

              <div className="admin-gerencia-edit-grid" style={{ marginTop: '0.5rem' }}>
                <label className="field-label" style={{ margin: 0 }}>
                  Limite
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
                  Janela recente (min)
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
            </>
          ) : null}

          <div className="admin-import-actions">
            <button
              className="btn-secondary"
              type="button"
              disabled={importandoPlanilha || !leituraPlanilha || !validacaoMapeamento.ok}
              onClick={() => { void onExecutarImportacao({ simular: true }); }}
            >
              {importandoPlanilha && modoImportacaoAtual === 'simulacao' ? 'Simulando...' : 'Simular importacao'}
            </button>

            <button
              className="btn-primary"
              type="button"
              disabled={importandoPlanilha || !leituraPlanilha || !validacaoMapeamento.ok || !simulacaoOficialConcluida}
              onClick={() => { void onExecutarImportacao({ simular: false }); }}
            >
              {importandoPlanilha && modoImportacaoAtual === 'importacao' ? 'Importando...' : 'Importar agora'}
            </button>

            <button
              className="btn-secondary"
              type="button"
              disabled={baixandoModelo}
              onClick={onBaixarModelo}
            >
              {baixandoModelo ? 'Baixando modelo...' : 'Baixar modelo CSV'}
            </button>
          </div>

          {simulacaoOficialConcluida ? (
            <p className="success-text" style={{ marginTop: '0.45rem' }}>
              Simulacao oficial concluida para o contexto atual. Importacao final liberada.
            </p>
          ) : (
            <p className="muted-text" style={{ marginTop: '0.45rem' }}>
              Execute a simulacao oficial antes de importar para garantir alinhamento completo entre preview e payload final.
            </p>
          )}

          {importandoPlanilha || progressoImportacaoFormatado > 0 ? (
            <div className="admin-import-progress" aria-live="polite">
              <div className="admin-import-progress-track">
                <span style={{ width: `${progressoImportacaoFormatado}%` }} />
              </div>
              <p>{progressoImportacaoFormatado}% concluido</p>
            </div>
          ) : null}

          {resultadoImportacao ? (
            <p className="admin-import-alert">
              {resultadoImportacao?.mensagem || 'Operacao de importacao processada.'}
            </p>
          ) : null}
        </article>

        {/* Etapa 6 - Resultado */}
        <article className={`admin-import-card ${passoImportacaoAtivo === 6 ? 'is-active' : ''}`}>
          <h3>Etapa 6 - Resultado e relatorio</h3>
          <p>Resumo final da ultima execucao com possibilidade de baixar relatorio de inconsistencias.</p>

          {resultadoImportacao ? (
            <>
              <div className="admin-kpis">
                <div className="kpi-card"><strong>Total linhas:</strong> {Number(resultadoImportacao.total_linhas || 0)}</div>
                <div className="kpi-card"><strong>Validas:</strong> {Number(resultadoImportacao.total_validos || 0)}</div>
                <div className="kpi-card"><strong>Atualizadas:</strong> {Number(resultadoImportacao.total_atualizados || 0)}</div>
                <div className="kpi-card"><strong>Criadas:</strong> {Number(resultadoImportacao.total_criados || 0)}</div>
                <div className="kpi-card"><strong>Ignoradas:</strong> {Number(resultadoImportacao.total_ignorados || 0)}</div>
                <div className="kpi-card"><strong>Com erro:</strong> {Number(resultadoImportacao.total_erros || 0)}</div>
              </div>

              {resultadoImportacao?.enriquecimento_pos_importacao?.resumo ? (
                <div className="admin-kpis" style={{ marginTop: '0.6rem' }}>
                  <div className="kpi-card"><strong>Pos-importacao:</strong> {Number(resultadoImportacao.enriquecimento_pos_importacao.resumo.total_processados || 0)} processados</div>
                  <div className="kpi-card"><strong>Imagens atualizadas:</strong> {Number(resultadoImportacao.enriquecimento_pos_importacao.resumo.total_imagem_atualizada || 0)}</div>
                  <div className="kpi-card"><strong>Atualizados:</strong> {Number(resultadoImportacao.enriquecimento_pos_importacao.resumo.total_atualizados || 0)}</div>
                  <div className="kpi-card"><strong>Erros:</strong> {Number(resultadoImportacao.enriquecimento_pos_importacao.resumo.total_erros || 0)}</div>
                </div>
              ) : null}

              <div className="admin-import-actions" style={{ marginTop: '0.75rem' }}>
                <button className="btn-secondary" type="button" onClick={onBaixarRelatorio}>
                  Baixar relatorio de erros
                </button>
                <button className="btn-secondary" type="button" onClick={onLimparWizard}>
                  Importar nova planilha
                </button>
              </div>

              {Array.isArray(resultadoImportacao?.logs?.erros) && resultadoImportacao.logs.erros.length > 0 ? (
                <div className="importacao-log-box">
                  <p><strong>Principais erros por linha</strong></p>
                  <ul className="importacao-log-list">
                    {resultadoImportacao.logs.erros.slice(0, 12).map((item, index) => (
                      <li key={`erro-linha-${index}`}>Linha {item?.linha || '-'}: {item?.motivo || 'Erro sem detalhe.'}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted-text">Execute uma simulacao ou importacao para visualizar o resultado final.</p>
          )}
        </article>
      </div>

      <div className="admin-import-step-actions">
        <button
          className="btn-secondary"
          type="button"
          onClick={onVoltarPasso}
          disabled={passoImportacaoAtivo <= 1}
        >
          Etapa anterior
        </button>
        <button
          className="btn-secondary"
          type="button"
          onClick={onAvancarPasso}
          disabled={!podeAvancarPassoImportacao}
        >
          Proxima etapa
        </button>
      </div>

      <div className="admin-import-history card-box" style={{ marginTop: '0.9rem' }}>
        <p><strong>Historico recente de importacoes</strong></p>

        {carregandoHistoricoImportacao ? (
          <p className="muted-text">Carregando historico...</p>
        ) : historicoImportacoesRecentes.length === 0 ? (
          <p className="muted-text">Nenhuma importacao recente encontrada.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: '0.5rem' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Arquivo</th>
                  <th>Formato</th>
                  <th>Status</th>
                  <th>Processadas</th>
                  <th>Com erro</th>
                  <th>Duracao</th>
                </tr>
              </thead>
              <tbody>
                {historicoImportacoesRecentes.map((item) => (
                  <tr key={`hist-import-${item.id}`}>
                    <td>{formatarData(item.created_at)}</td>
                    <td>{item.arquivo_nome || '-'}</td>
                    <td>{item?.resumo?.formato || '-'}</td>
                    <td>
                      <span className={`importacao-status-badge status-${normalizarStatus(item.status)}`}>
                        {item.status || '-'}
                      </span>
                    </td>
                    <td>{Number(item.linhas_validas || 0)}</td>
                    <td>{Number(item.linhas_com_erro || 0)}</td>
                    <td>{Number(item?.resumo?.performance?.duracao_total_ms || 0) > 0 ? `${Number(item.resumo.performance.duracao_total_ms)} ms` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
