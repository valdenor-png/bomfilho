import React from "react";
import { Package, AlertTriangle, Clock3, FileText, FolderSearch, Search, Receipt, Store, Wallet } from "../../icons";
import SmartImage from "../ui/SmartImage";

export default function OrdersScreen(props) {
  const {
    pedidos, pedidosFiltradosOperacionais, pedidoExpandidoId, setPedidoExpandidoId,
    paginacaoPedidos, carregandoPedidos, carregarPedidosPagina,
    filtroPedidoStatus, setFiltroPedidoStatus,
    filtroPedidoPagamento, setFiltroPedidoPagamento,
    filtroPedidoTipoEntrega, setFiltroPedidoTipoEntrega,
    ordenacaoPedidos, setOrdenacaoPedidos,
    buscaPedidosOperacional, setBuscaPedidosOperacional,
    autoRefreshPedidosAtivo, setAutoRefreshPedidosAtivo,
    modoFilaAltaAtivo, handleToggleModoFilaAlta,
    statusDraft, setStatusDraft,
    feedbackPedidos,
    resumoPedidosOperacionais, contadorPedidosOperacionaisTexto,
    statusChipsOperacionais, filtrosPedidosAplicados,
    atualizandoStatusPedidoId,
    avisoNovosPedidos, limparAvisoNovosPedidos,
    resumoAuditoriaSessao, historicoAcoesSessao, limparHistoricoAuditoriaSessao,
    handleAcaoRapidaPedido, handleCopiarResumoPedido,
    handleCopiarListaSeparacaoPedido, handleCopiarConferenciaExpedicaoPedido,
    handleCopiarMensagemContatoPedido, handleCopiarCampoPedido,
    abrirPrimeiroPedidoPrioritario,
    limparFiltrosPedidosOperacionais,
    formatarStatusPedido, formatarMoeda, formatarTempoRelativo,
    PEDIDOS_TAB_SOMENTE_HISTORICO, STATUS_OPTIONS,
  } = props;

  return (
        <>
          <section className={`admin-orders-panel ${modoFilaAltaAtivo ? 'is-fila-alta' : ''}`}>
            <div className="admin-orders-head">
              <div>
                <h2>Histórico de pedidos</h2>
                <p>Consulta histórica de pedidos. Operação em tempo real fica na aba Operação ao Vivo.</p>
              </div>

              <p className="admin-orders-head-meta">
                Página {paginacaoPedidos.pagina} de {paginacaoPedidos.total_paginas} · {paginacaoPedidos.total} pedido(s)
              </p>
            </div>

            {!PEDIDOS_TAB_SOMENTE_HISTORICO ? (
              <div className="admin-orders-summary-grid" aria-label="Resumo operacional dos pedidos">
              <article className="admin-orders-summary-card">
                <span>Total na página</span>
                <strong>{resumoPedidosOperacionais.total}</strong>
                <small>{contadorPedidosOperacionaisTexto}</small>
              </article>

              <article className="admin-orders-summary-card is-critical">
                <span>Pendências críticas</span>
                <strong>{resumoPedidosOperacionais.criticos}</strong>
                <small>Pedidos com atenção imediata</small>
              </article>

              <article className="admin-orders-summary-card">
                <span>Aguardando ação</span>
                <strong>{resumoPedidosOperacionais.aguardandoAcao}</strong>
                <small>Status que exigem operação</small>
              </article>

              <article className="admin-orders-summary-card">
                <span>Em andamento</span>
                <strong>{resumoPedidosOperacionais.emAndamento}</strong>
                <small>Pedidos em fluxo de preparação/entrega</small>
              </article>

              <article className="admin-orders-summary-card">
                <span>Concluídos hoje</span>
                <strong>{resumoPedidosOperacionais.concluidosHoje}</strong>
                <small>Entregues no dia atual</small>
              </article>

              <article className="admin-orders-summary-card">
                <span>Pagamento pendente</span>
                <strong>{resumoPedidosOperacionais.pendentesPagamento}</strong>
                <small>Com necessidade de conferência</small>
              </article>
              </div>
            ) : null}

            {!PEDIDOS_TAB_SOMENTE_HISTORICO ? (
              <div className="admin-orders-refresh-strip" aria-label="Estado de atualização operacional">
              <div className="admin-orders-refresh-info">
                <p>
                  <strong>Ãšltima atualização:</strong> {ultimaAtualizacaoPedidosTexto}
                </p>
                {novosPedidosDetectados > 0 ? (
                  <div className="admin-orders-new-warning" role="status" aria-live="polite">
                    <span>{novosPedidosDetectados} novo(s) pedido(s) detectado(s) na atualização.</span>
                    <button className="btn-secondary" type="button" onClick={limparAvisoNovosPedidos}>
                      Dispensar aviso
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="admin-orders-refresh-actions">
                <label className="admin-orders-autorefresh-toggle" htmlFor="admin-orders-auto-refresh">
                  <input
                    id="admin-orders-auto-refresh"
                    type="checkbox"
                    checked={autoRefreshPedidosAtivo}
                    onChange={(event) => setAutoRefreshPedidosAtivo(event.target.checked)}
                  />
                  Autoatualizar a cada {AUTO_REFRESH_PEDIDOS_LABEL}
                </label>

                <label className="admin-orders-autorefresh-toggle" htmlFor="admin-orders-high-queue-mode">
                  <input
                    id="admin-orders-high-queue-mode"
                    type="checkbox"
                    checked={modoFilaAltaAtivo}
                    onChange={(event) => handleToggleModoFilaAlta(event.target.checked)}
                  />
                  Fila alta: mais pedidos por tela
                </label>

                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => {
                    void atualizarPedidosOperacionaisAgora();
                  }}
                  disabled={carregandoPedidos}
                >
                  {carregandoPedidos ? 'Atualizando...' : 'Sincronizar fila agora'}
                </button>
              </div>
              </div>
            ) : null}

            {!PEDIDOS_TAB_SOMENTE_HISTORICO ? (
              <div className="admin-orders-quick-nav" aria-label="Navegação rápida entre pedidos">
              <p>
                {pedidoExpandidoId && navegacaoPedidosDetalhe.indiceAtual >= 0
                  ? `Detalhe aberto ${navegacaoPedidosDetalhe.indiceAtual + 1} de ${navegacaoPedidosDetalhe.total}`
                  : 'Nenhum detalhe aberto na fila'}
              </p>

              <div className="admin-orders-quick-nav-actions">
                <button className="btn-secondary" type="button" onClick={abrirPrimeiroPedidoPrioritario}>
                  Abrir pedido crítico
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => navegarDetalhePedidoOperacional(-1)}
                  disabled={!navegacaoPedidosDetalhe.anteriorId}
                >
                  Pedido anterior
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => navegarDetalhePedidoOperacional(1)}
                  disabled={!navegacaoPedidosDetalhe.proximoId}
                >
                  Próximo pedido
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setPedidoExpandidoId(null)}
                  disabled={!pedidoExpandidoId}
                >
                  Fechar detalhe
                </button>
              </div>
              </div>
            ) : null}

            {!PEDIDOS_TAB_SOMENTE_HISTORICO ? (
              <div className="admin-orders-session-audit" aria-label="Auditoria da sessão operacional">
              <div className="admin-orders-session-audit-head">
                <p>
                  <strong>Histórico da sessão:</strong> {resumoAuditoriaSessao.total} ação(ões)
                </p>
                <small>
                  {resumoAuditoriaSessao.ultimaAcao
                    ? `Ãšltima: ${resumoAuditoriaSessao.ultimaAcao.mensagem} (${formatarTempoRelativo(resumoAuditoriaSessao.ultimaAcao.em)})`
                    : 'Sem ações registradas nesta sessão.'}
                </small>
              </div>

              <div className="admin-orders-session-audit-chips">
                <span className="admin-orders-session-audit-chip tone-success">Sucessos: {resumoAuditoriaSessao.success}</span>
                <span className="admin-orders-session-audit-chip tone-info">Avisos: {resumoAuditoriaSessao.info}</span>
                <span className="admin-orders-session-audit-chip tone-error">Falhas: {resumoAuditoriaSessao.error}</span>
              </div>

              {ultimasAcoesSessaoVisiveis.length > 0 ? (
                <ul className="admin-orders-session-audit-list" aria-label="Ãšltimas ações da sessão">
                  {ultimasAcoesSessaoVisiveis.map((acao, index) => (
                    <li key={`sessao-acao-${acao.em}-${index}`}>
                      <span className={`admin-orders-session-audit-dot tone-${acao.tipo || 'info'}`} aria-hidden="true" />
                      <span>{acao.mensagem}</span>
                      <small>{formatarTempoRelativo(acao.em)}</small>
                    </li>
                  ))}
                </ul>
              ) : null}

              <button
                className="btn-secondary admin-orders-session-audit-clear"
                type="button"
                onClick={limparHistoricoAuditoriaSessao}
                disabled={resumoAuditoriaSessao.total === 0}
              >
                Limpar histórico da sessão
              </button>
              </div>
            ) : null}

            <div className="admin-orders-filter-wrap" aria-label="Filtros de histórico de pedidos">
              {!PEDIDOS_TAB_SOMENTE_HISTORICO ? (
                <div className="admin-orders-status-chips" role="tablist" aria-label="Filtrar pedidos por status">
                  {statusChipsOperacionais.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      className={`admin-orders-status-chip ${filtroPedidoStatus === chip.id ? 'active' : ''}`}
                      onClick={() => setFiltroPedidoStatus(chip.id)}
                      aria-pressed={filtroPedidoStatus === chip.id}
                    >
                      <span>{chip.label}</span>
                      <strong>{chip.count}</strong>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="admin-orders-filters-grid">
                <label className="admin-orders-search-field" htmlFor="admin-orders-search">
                  <span>Buscar no histórico</span>
                  <input
                    id="admin-orders-search"
                    className="field-input"
                    placeholder="Número, cliente ou telefone"
                    value={buscaPedidosOperacional}
                    onChange={(event) => setBuscaPedidosOperacional(event.target.value)}
                  />
                </label>

                <label className="admin-orders-select-field" htmlFor="admin-orders-payment-filter">
                  <span>Pagamento</span>
                  <select
                    id="admin-orders-payment-filter"
                    className="field-input"
                    value={filtroPedidoPagamento}
                    onChange={(event) => setFiltroPedidoPagamento(event.target.value)}
                  >
                    {FILTRO_PAGAMENTO_OPTIONS.map((opcao) => (
                      <option key={opcao.id} value={opcao.id}>{opcao.label}</option>
                    ))}
                  </select>
                </label>

                <label className="admin-orders-select-field" htmlFor="admin-orders-delivery-filter">
                  <span>Atendimento</span>
                  <select
                    id="admin-orders-delivery-filter"
                    className="field-input"
                    value={filtroPedidoTipoEntrega}
                    onChange={(event) => setFiltroPedidoTipoEntrega(event.target.value)}
                  >
                    {FILTRO_TIPO_ENTREGA_OPTIONS.map((opcao) => (
                      <option key={opcao.id} value={opcao.id}>{opcao.label}</option>
                    ))}
                  </select>
                </label>

                <label className="admin-orders-select-field" htmlFor="admin-orders-orderby">
                  <span>Ordenação</span>
                  <select
                    id="admin-orders-orderby"
                    className="field-input"
                    value={ordenacaoPedidos}
                    onChange={(event) => setOrdenacaoPedidos(event.target.value)}
                  >
                    {ORDENACAO_PEDIDOS_OPTIONS.map((opcao) => (
                      <option key={opcao.id} value={opcao.id}>{opcao.label}</option>
                    ))}
                  </select>
                </label>

                <button
                  className="btn-secondary admin-orders-clear-btn"
                  type="button"
                  onClick={limparFiltrosPedidosOperacionais}
                  disabled={filtrosPedidosAplicados.length === 0}
                >
                  Limpar filtros da fila
                </button>
              </div>

              {filtrosPedidosAplicados.length > 0 ? (
                <div className="admin-orders-active-filters" aria-label="Filtros ativos">
                  {filtrosPedidosAplicados.map((item) => (
                    <span key={item} className="admin-orders-active-filter">{item}</span>
                  ))}
                </div>
              ) : null}
            </div>

            {feedbackPedidos.mensagem ? (
              <div className={`admin-orders-feedback is-${feedbackPedidos.tipo || 'info'}`} role="status" aria-live="polite">
                {feedbackPedidos.mensagem}
              </div>
            ) : null}

            {carregandoPedidos && semPedidosOperacionais ? (
              <div className="orders-state-card" role="status" aria-live="polite">
                <div className="orders-empty-icon" aria-hidden="true"><Clock3 size={18} /></div>
                <p><strong>Atualizando pedidos operacionais...</strong></p>
                <p>Estamos carregando os pedidos mais recentes desta página.</p>
              </div>
            ) : erro && semPedidosOperacionais ? (
              <div className="orders-state-card is-filter-empty" role="alert">
                <div className="orders-empty-icon" aria-hidden="true"><AlertTriangle size={18} /></div>
                <p><strong>Não foi possível carregar os pedidos agora.</strong></p>
                <p>Confira sua conexão e tente atualizar novamente.</p>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => {
                    void atualizarPedidosOperacionaisAgora();
                  }}
                >
                  Tentar novamente
                </button>
              </div>
            ) : semPedidosOperacionais ? (
              <div className="orders-state-card is-filter-empty" role="status" aria-live="polite">
                <div className="orders-empty-icon" aria-hidden="true"><FileText size={18} /></div>
                <p><strong>Sem pedidos nesta página no momento.</strong></p>
                <p>Assim que houver novas vendas, elas aparecerão aqui para acompanhamento operacional.</p>
              </div>
            ) : semResultadosPedidosOperacionais ? (
              <div className="orders-state-card is-filter-empty" role="status" aria-live="polite">
                <div className="orders-empty-icon" aria-hidden="true"><FolderSearch size={18} /></div>
                <p><strong>Nenhum pedido encontrado com os filtros aplicados.</strong></p>
                <p>Ajuste os filtros para visualizar pedidos de outros status, clientes ou pagamentos.</p>
              </div>
            ) : (
              <div className={`admin-orders-list ${modoFilaAltaAtivo ? 'is-fila-alta' : ''}`}>
                {pedidosFiltradosOperacionais.map((pedido) => {
                  const pedidoId = Number(pedido?.id || 0);
                  const statusSelecionado = String(statusDraft[pedidoId] || pedido.statusNormalizado || '').trim().toLowerCase() || 'pendente';
                  const statusFluxoPedido = pedido.tipoEntregaNormalizado === 'retirada'
                    ? ['pendente', 'preparando', 'pronto_para_retirada', 'retirado', 'cancelado']
                    : ['pendente', 'preparando', 'enviado', 'entregue', 'cancelado'];
                  const opcoesStatus = statusFluxoPedido.includes(statusSelecionado)
                    ? statusFluxoPedido
                    : [statusSelecionado, ...statusFluxoPedido.filter((status) => status !== statusSelecionado)];
                  const detalheAberto = pedidoExpandidoId === pedidoId;
                  const emAtualizacao = atualizandoStatusPedidoId === pedidoId;
                  const podeSalvarStatus = statusFluxoPedido.includes(statusSelecionado);
                  const resumoOperacionalTexto = montarResumoOperacionalPedido(pedido);
                  const proximoStatusLabel = pedido.proximoStatus ? formatarStatusPedido(pedido.proximoStatus) : '';
                  const classeEnvelhecimento = pedido.envelhecimentoTone !== 'normal'
                    ? `is-aged-${pedido.envelhecimentoTone}`
                    : '';
                  const pedidoTemPendencias = pedido.pendenciasOperacionais.length > 0;
                  const pendenciasVisiveis = modoFilaAltaAtivo
                    ? pedido.pendenciasOperacionais.slice(0, OPERACAO_PEDIDOS_LIMITES.maxPendenciasVisiveisFilaAlta)
                    : pedido.pendenciasOperacionais;
                  const pendenciasOcultas = Math.max(0, pedido.pendenciasOperacionais.length - pendenciasVisiveis.length);
                  const ultimaAcaoPedido = ultimasAcoesPedidos[pedidoId] || null;
                  const observacoesRelevantesPreview = pedido.observacoesRelevantesLista.slice(0, 2);
                  const observacoesRelevantesExtras = Math.max(0, pedido.observacoesRelevantesLista.length - observacoesRelevantesPreview.length);
                  const tipoAtendimentoTone = pedido.tipoEntregaNormalizado === 'retirada' ? 'retirada' : 'entrega';
                  const enderecoConferenciaTone = pedido.tipoEntregaNormalizado === 'retirada'
                    ? 'note'
                    : (pedido.enderecoDisponivel ? 'ok' : 'attention');
                  const enderecoConferenciaLabel = pedido.tipoEntregaNormalizado === 'retirada'
                    ? 'Não se aplica'
                    : (pedido.enderecoDisponivel ? 'Confirmado' : 'Pendente');
                  const enderecoConferenciaDetalhe = pedido.tipoEntregaNormalizado === 'retirada'
                    ? 'Cliente escolheu retirar na loja.'
                    : pedido.enderecoTexto;
                  const StatusIcon = typeof pedido.statusMeta.icon === 'function' ? pedido.statusMeta.icon : Package;

                  return (
                    <article
                      key={pedidoId}
                      className={`admin-order-card ${pedido.critico ? 'is-critical' : ''} ${pedido.urgente ? 'is-urgent' : ''} ${classeEnvelhecimento} ${modoFilaAltaAtivo ? 'is-fila-alta' : ''}`}
                    >
                      <div
                        className="admin-order-card-head"
                        onDoubleClick={() => toggleDetalhePedidoOperacional(pedidoId)}
                        title="Duplo clique para abrir ou recolher detalhe"
                      >
                        <div>
                          <p className="admin-order-id">Pedido #{pedidoId}</p>
                          <p className="admin-order-date">{pedido.dataLabel}</p>
                          <div className="admin-order-time-meta">
                            <span className={`admin-order-time-chip tone-${pedido.envelhecimentoTone}`}>
                              Criado: {pedido.tempoDesdeCriacaoLabel}
                            </span>
                            {!modoFilaAltaAtivo && pedido.tempoNoStatusDisponivel ? (
                              <span className="admin-order-time-chip">No status: {pedido.tempoNoStatusLabel}</span>
                            ) : !modoFilaAltaAtivo ? (
                              <span className="admin-order-time-chip is-muted">No status: sem histórico dedicado</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="admin-order-badges">
                          {pedido.envelhecimentoLabel ? (
                            <span className={`admin-order-urgency tone-${pedido.envelhecimentoTone}`}>{pedido.envelhecimentoLabel}</span>
                          ) : null}

                          <span className={`admin-delivery-badge tone-${tipoAtendimentoTone}`}>
                            {pedido.tipoEntregaNormalizado === 'retirada' ? 'RETIRADA' : 'ENTREGA'}
                          </span>

                          <span className={`admin-payment-badge tone-${pedido.pagamentoMeta.tone}`}>
                            {pedido.pagamentoMeta.label}
                          </span>

                          <span className={`orders-status-badge tone-${pedido.statusMeta.tone}`}>
                            <span className="orders-status-icon" aria-hidden="true"><StatusIcon size={14} /></span>
                            <span>{pedido.statusMeta.label}</span>
                          </span>
                        </div>
                      </div>

                      {pedidoTemPendencias ? (
                        <div className="admin-order-pendencias" aria-label="Pendências operacionais">
                          {pendenciasVisiveis.map((pendencia) => (
                            <span
                              key={`${pedidoId}-${pendencia.id}`}
                              className={`admin-order-pendencia-chip tone-${pendencia.tone}`}
                            >
                              {pendencia.label}
                            </span>
                          ))}
                          {pendenciasOcultas > 0 ? (
                            <span className="admin-order-pendencia-chip tone-muted">+{pendenciasOcultas} pendência(s)</span>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="admin-order-grid">
                        <div>
                          <span>Cliente</span>
                          <strong>{pedido.clienteNome}</strong>
                          <small>{pedido.clienteTelefone || 'Telefone não informado'}</small>
                        </div>

                        <div>
                          <span>Total</span>
                          <strong>{formatarMoeda(pedido.totalNumero)}</strong>
                          <small>{pedido.totalItens} item(ns)</small>
                        </div>

                        <div>
                          <span>Atendimento</span>
                          <strong>{pedido.tipoAtendimento}</strong>
                          <small>{pedido.formaPagamentoLabel}</small>
                        </div>
                      </div>

                      {pedido.metricasTempo ? (
                        <div className="admin-order-metricas-row" aria-label="Tempos operacionais">
                          <span className={`admin-metrica-chip${pedido.metricasTempo.preparo.sla ? ` sla-${pedido.metricasTempo.preparo.sla}` : ''}`}>
                            <small>Preparo</small>
                            <strong>{pedido.metricasTempo.preparo.label}</strong>
                          </span>
                          {pedido.metricasTempo.rota ? (
                            <span className={`admin-metrica-chip${pedido.metricasTempo.rota.sla ? ` sla-${pedido.metricasTempo.rota.sla}` : ''}`}>
                              <small>Rota</small>
                              <strong>{pedido.metricasTempo.rota.label}</strong>
                            </span>
                          ) : pedido.metricasTempo.esperaRetirada ? (
                            <span className={`admin-metrica-chip${pedido.metricasTempo.esperaRetirada.sla ? ` sla-${pedido.metricasTempo.esperaRetirada.sla}` : ''}`}>
                              <small>Retirada</small>
                              <strong>{pedido.metricasTempo.esperaRetirada.label}</strong>
                            </span>
                          ) : null}
                          <span className={`admin-metrica-chip${pedido.metricasTempo.total.sla ? ` sla-${pedido.metricasTempo.total.sla}` : ''}`}>
                            <small>Total</small>
                            <strong>{pedido.metricasTempo.total.label}</strong>
                          </span>
                        </div>
                      ) : null}

                      <div className="admin-order-mid-row">
                        <p className="admin-order-summary">{pedido.resumoItensTexto}</p>

                        <div className="admin-order-tools-row">
                          <button
                            className="btn-secondary admin-order-util-btn"
                            type="button"
                            onClick={() => {
                              void handleCopiarCampoPedido(pedido.clienteTelefone, 'Telefone');
                            }}
                            disabled={!pedido.clienteTelefone}
                          >
                            Copiar telefone
                          </button>

                          {pedido.whatsappLink ? (
                            <a className="btn-secondary admin-order-util-btn" href={pedido.whatsappLink} target="_blank" rel="noopener noreferrer">
                              Abrir WhatsApp
                            </a>
                          ) : null}

                          <button
                            className="btn-secondary admin-order-util-btn"
                            type="button"
                            onClick={() => {
                              void handleCopiarCampoPedido(pedido.enderecoTexto, 'Endereço');
                            }}
                            disabled={!pedido.enderecoDisponivel}
                          >
                            Copiar endereço
                          </button>

                          <button
                            className="btn-secondary admin-order-util-btn"
                            type="button"
                            onClick={() => {
                              void handleCopiarResumoPedido(pedido);
                            }}
                            disabled={!resumoOperacionalTexto}
                          >
                            Copiar resumo
                          </button>

                          <button
                            className="btn-secondary admin-order-util-btn"
                            type="button"
                            onClick={() => {
                              window.open(`/admin/pedido/${pedido.id}/separacao`, '_blank');
                            }}
                          >
                            Imprimir nota
                          </button>
                        </div>
                      </div>

                      {ultimaAcaoPedido ? (
                        <p className={`admin-order-last-action tone-${ultimaAcaoPedido.tipo || 'info'}`}>
                          Ãšltima ação: {ultimaAcaoPedido.mensagem} ({formatarTempoRelativo(ultimaAcaoPedido.em)})
                        </p>
                      ) : null}

                      <div className="admin-order-actions-row">
                        {!PEDIDOS_TAB_SOMENTE_HISTORICO && pedido.proximoStatus ? (
                          <button
                            className="btn-primary admin-order-next-step-btn"
                            type="button"
                            onClick={() => {
                              void handleAcaoRapidaPedido(pedido);
                            }}
                            disabled={emAtualizacao}
                          >
                            Avançar para {proximoStatusLabel}
                          </button>
                        ) : null}

                        <select
                          className="field-input"
                          value={statusSelecionado}
                          onChange={(event) =>
                            setStatusDraft((atual) => ({
                              ...atual,
                              [pedidoId]: event.target.value
                            }))
                          }
                          disabled={emAtualizacao || PEDIDOS_TAB_SOMENTE_HISTORICO}
                          title={PEDIDOS_TAB_SOMENTE_HISTORICO ? 'Aba somente histórico: sem alteração de status.' : ''}
                        >
                          {opcoesStatus.map((status) => (
                            <option key={`${pedidoId}-${status}`} value={status}>
                              {formatarStatusPedido(status)}
                              {!STATUS_OPTIONS.includes(status) ? ' (somente leitura)' : ''}
                            </option>
                          ))}
                        </select>

                        <button
                          className="btn-secondary admin-order-secondary-btn"
                          type="button"
                          onClick={() => {
                            void salvarStatusPedido(pedidoId);
                          }}
                          disabled={PEDIDOS_TAB_SOMENTE_HISTORICO || !podeSalvarStatus || emAtualizacao}
                          title={PEDIDOS_TAB_SOMENTE_HISTORICO ? 'Aba somente histórico: sem alteração de status.' : ''}
                        >
                          {PEDIDOS_TAB_SOMENTE_HISTORICO ? 'Somente histórico' : (emAtualizacao ? 'Salvando...' : 'Confirmar status')}
                        </button>

                        <button
                          className="btn-secondary admin-order-secondary-btn"
                          type="button"
                          onClick={() => toggleDetalhePedidoOperacional(pedidoId)}
                        >
                          {detalheAberto ? 'Fechar detalhe' : 'Abrir detalhe'}
                        </button>
                      </div>

                      {detalheAberto ? (
                        <div className="admin-order-details">
                          <div className="admin-order-operational-signals" aria-label="Sinalização operacional do pedido">
                            {pedido.observacoesRelevantesCount > 0 ? (
                              <span className="admin-order-operational-signal tone-note">
                                Observação do cliente
                              </span>
                            ) : null}

                            {pedido.pagamentoRequerConferencia ? (
                              <span className="admin-order-operational-signal tone-attention">
                                Pagamento pendente/falha
                              </span>
                            ) : null}

                            {pedido.possuiMuitosItens ? (
                              <span className="admin-order-operational-signal tone-attention">
                                Separação volumosa
                              </span>
                            ) : null}

                            {pedido.envelhecimentoLabel ? (
                              <span className="admin-order-operational-signal tone-urgent">
                                {pedido.envelhecimentoLabel}
                              </span>
                            ) : null}

                            {modoFilaAltaAtivo ? (
                              <span className="admin-order-operational-signal tone-muted">Fila alta ativa</span>
                            ) : null}
                          </div>

                          <div className="admin-order-details-layout">
                            <div className="admin-order-details-main">
                              <div className="admin-order-separacao-box">
                                <div className="admin-order-separacao-head">
                                  <strong>Separação do pedido</strong>
                                  <span>Priorize quantidade, item e pontos críticos</span>
                                </div>

                                <div className="admin-order-separacao-metrics" aria-label="Resumo de separação">
                                  <span>
                                    <strong>{pedido.totalItensDistintos}</strong> itens distintos
                                  </span>
                                  <span>
                                    <strong>{pedido.totalUnidadesEstimadas}</strong> unidades estimadas
                                  </span>
                                  <span>
                                    <strong>{pedido.observacoesRelevantesCount}</strong> observação(ões) relevante(s)
                                  </span>
                                </div>

                                {observacoesRelevantesPreview.length > 0 ? (
                                  <p className="admin-order-separacao-observacoes">
                                    Observações: {observacoesRelevantesPreview.join(' | ')}
                                    {observacoesRelevantesExtras > 0 ? ` +${observacoesRelevantesExtras}` : ''}
                                  </p>
                                ) : (
                                  <p className="admin-order-separacao-observacoes is-empty">Sem observações relevantes no pedido.</p>
                                )}

                                <div className="admin-order-separacao-copy-row">
                                  <button
                                    className="btn-secondary"
                                    type="button"
                                    onClick={() => {
                                      void handleCopiarListaSeparacaoPedido(pedido);
                                    }}
                                  >
                                    Copiar lista de separação
                                  </button>

                                  <button
                                    className="btn-secondary"
                                    type="button"
                                    onClick={() => {
                                      void handleCopiarMensagemContatoPedido(pedido);
                                    }}
                                  >
                                    Copiar mensagem de contato
                                  </button>

                                  <button
                                    className="btn-secondary"
                                    type="button"
                                    onClick={() => {
                                      void handleCopiarConferenciaExpedicaoPedido(pedido);
                                    }}
                                  >
                                    Copiar conferência/expedição
                                  </button>
                                </div>

                                {pedido.itensLista.length === 0 ? (
                                  <p className="muted-text">Itens não detalhados neste pedido.</p>
                                ) : (
                                  <ul className="admin-order-items-list is-operacional">
                                    {pedido.itensLista.map((item) => (
                                      <li key={`${pedidoId}-${item.id}`}>
                                        <div className="admin-order-item-qty">{item.quantidade}x</div>
                                        <div className="admin-order-item-main">
                                          <p>{item.nome}</p>
                                          <small>{formatarMoeda(item.preco)} por unidade</small>
                                          {item.variacaoTexto ? (
                                            <small className="admin-order-item-variation">Variação: {item.variacaoTexto}</small>
                                          ) : null}
                                          {item.observacaoItem ? (
                                            <small className="admin-order-item-note">Obs item: {item.observacaoItem}</small>
                                          ) : null}
                                        </div>
                                        <strong>{formatarMoeda(item.subtotal)}</strong>
                                        {pedido.statusNormalizado === 'preparando' && pedido.clienteTelefone && (
                                          <button
                                            className="btn-avisar-cliente"
                                            title="Avisar cliente via WhatsApp"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const tel = normalizarTelefoneWhatsapp(pedido.clienteTelefone);
                                              if (!tel) return;
                                              const msg = encodeURIComponent(
                                                `Ola! Aqui e do BomFilho \u{1F6D2}\n\n` +
                                                `Sobre seu pedido #${pedidoId}:\n` +
                                                `O produto "${item.nome}" esta em falta.\n\n` +
                                                `Posso substituir por outro similar?\n` +
                                                `Responda SIM ou NAO, ou sugira outro produto.\n\n` +
                                                `Se nao responder em 10 min, vamos remover o item e ajustar o valor.`
                                              );
                                              window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
                                            }}
                                            style={{
                                              padding: '4px 8px', borderRadius: 6,
                                              background: 'rgba(37,211,102,0.15)',
                                              border: '1px solid rgba(37,211,102,0.3)',
                                              color: '#25D366', fontSize: 10, fontWeight: 700,
                                              cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap',
                                            }}
                                          >
                                            Avisar
                                          </button>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>

                              <div className={`admin-timeline-box${pedido.statusNormalizado === 'cancelado' ? ' is-canceled' : ''}`}>
                                <div className="admin-timeline-box-head">
                                  <strong>Linha do tempo</strong>
                                  {pedido.metricasTempo?.isCancelado && pedido.metricasTempo.cancelamento ? (
                                    <span className="admin-timeline-cancel-badge">{pedido.metricasTempo.cancelamento.label}</span>
                                  ) : null}
                                </div>
                                <div className="admin-timeline-etapas" aria-label="Linha do tempo operacional">
                                  {pedido.timelineEtapas.map((etapa) => {
                                    const concluida = Boolean(etapa.dt);
                                    const isCancelStep = etapa.id === 'cancelado';
                                    return (
                                      <div
                                        className={`admin-timeline-etapa ${concluida ? 'is-done' : ''} ${isCancelStep ? 'is-cancel' : ''}`}
                                        key={`${pedidoId}-tl-${etapa.id}`}
                                      >
                                        <span className="admin-timeline-dot" aria-hidden="true" />
                                        <div className="admin-timeline-info">
                                          <span className="admin-timeline-label">{etapa.label}</span>
                                          {etapa.hora ? (
                                            <span className="admin-timeline-hora">{etapa.hora}</span>
                                          ) : (
                                            <span className="admin-timeline-hora is-pending">?</span>
                                          )}
                                          {etapa.descricao ? (
                                            <span className="admin-timeline-descricao">{etapa.descricao}</span>
                                          ) : etapa.duracaoDesdeAnteriorLabel ? (
                                            <span className="admin-timeline-duracao">+{etapa.duracaoDesdeAnteriorLabel}</span>
                                          ) : null}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {pedido.metricasTempo?.total?.ms != null && !pedido.metricasTempo?.isCancelado ? (
                                  <div className={`admin-timeline-total sla-${pedido.metricasTempo.total.sla || 'ok'}`}>
                                    Tempo total: {pedido.metricasTempo.total.label}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <div className="admin-order-details-side">
                              <div className="admin-order-conferencia-box" aria-label="Conferência antes de sair">
                                <div className="admin-order-conferencia-head">
                                  <strong>Conferência antes de sair</strong>
                                  <small>Checklist rápido de expedição</small>
                                </div>

                                <ul className="admin-order-conferencia-list">
                                  <li className={`tone-${pedido.pagamentoMeta.tone === 'error' ? 'error' : (pedido.pagamentoRequerConferencia ? 'attention' : 'ok')}`}>
                                    <span>Pagamento</span>
                                    <strong>{pedido.pagamentoMeta.label}</strong>
                                    <small>{pedido.pagamentoMeta.detalhe}</small>
                                  </li>

                                  <li className={`tone-${enderecoConferenciaTone}`}>
                                    <span>Endereço</span>
                                    <strong>{enderecoConferenciaLabel}</strong>
                                    <small>{enderecoConferenciaDetalhe}</small>
                                  </li>

                                  <li className={`tone-${pedido.clienteTelefone ? 'ok' : 'attention'}`}>
                                    <span>Telefone</span>
                                    <strong>{pedido.clienteTelefone ? 'Confirmado' : 'Pendente'}</strong>
                                    <small>{pedido.clienteTelefone || 'Telefone não informado'}</small>
                                  </li>

                                  <li className={`tone-${pedido.observacaoOperacional ? 'note' : 'muted'}`}>
                                    <span>Observação do cliente</span>
                                    <strong>{pedido.observacaoOperacional ? 'Com observação' : 'Sem observação'}</strong>
                                    <small>{pedido.observacaoOperacional || 'Sem instruções adicionais do cliente.'}</small>
                                  </li>

                                  <li className={`tone-${pedido.statusNormalizado === 'cancelado' ? 'error' : (pedido.requerAcao ? 'action' : 'ok')}`}>
                                    <span>Status atual</span>
                                    <strong>{pedido.statusMeta.label}</strong>
                                    <small>{pedido.tempoNoStatusDisponivel ? `No status há ${pedido.tempoNoStatusLabel}` : 'Sem histórico dedicado de status.'}</small>
                                  </li>
                                </ul>
                              </div>

                              <div className="admin-order-details-grid">
                                <article className="admin-order-detail-card">
                                  <h4>Pagamento</h4>
                                  <p>{pedido.pagamentoMeta.label}</p>
                                  <small>{pedido.pagamentoMeta.detalhe}</small>
                                  <small>Criado: {pedido.tempoDesdeCriacaoLabel}</small>
                                  <small>
                                    {pedido.tempoNoStatusDisponivel
                                      ? `No status atual: ${pedido.tempoNoStatusLabel}`
                                      : 'No status atual: sem histórico dedicado.'}
                                  </small>
                                  {pedido.pixStatus ? <small>PIX status: {pedido.pixStatus}</small> : null}
                                </article>

                                <article className="admin-order-detail-card">
                                  <h4>Contato</h4>
                                  <p>{pedido.clienteNome}</p>
                                  <small>{pedido.clienteTelefone || 'Telefone não informado'}</small>
                                  <div className="admin-order-detail-actions">
                                    <button
                                      className="btn-secondary"
                                      type="button"
                                      onClick={() => {
                                        void handleCopiarCampoPedido(pedido.clienteTelefone, 'Telefone');
                                      }}
                                    >
                                      Copiar telefone
                                    </button>
                                    {pedido.whatsappLink ? (
                                      <a className="btn-secondary" href={pedido.whatsappLink} target="_blank" rel="noopener noreferrer">
                                        Abrir WhatsApp
                                      </a>
                                    ) : null}
                                  </div>
                                </article>

                                <article className="admin-order-detail-card">
                                  <h4>Endereço</h4>
                                  <p>{pedido.tipoEntregaNormalizado === 'retirada' ? 'Retirada na loja (sem rota de entrega).' : pedido.enderecoTexto}</p>
                                  <div className="admin-order-detail-actions">
                                    <button
                                      className="btn-secondary"
                                      type="button"
                                      onClick={() => {
                                        void handleCopiarCampoPedido(pedido.enderecoTexto, 'Endereço');
                                      }}
                                      disabled={!pedido.enderecoDisponivel}
                                    >
                                      Copiar endereço
                                    </button>
                                  </div>
                                </article>

                                {pedido.observacaoOperacional ? (
                                  <article className="admin-order-detail-card is-highlight">
                                    <h4>Observação</h4>
                                    <p>{pedido.observacaoOperacional}</p>
                                  </article>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="toolbar-box admin-orders-pagination" style={{ alignItems: 'center' }}>
              <p className="muted-text" style={{ margin: 0 }}>
                {contadorPedidosOperacionaisTexto}
              </p>
              <button
                className="btn-secondary"
                type="button"
                disabled={carregandoPedidos || paginacaoPedidos.pagina <= 1}
                onClick={() => {
                  void carregarPedidosPagina(paginacaoPedidos.pagina - 1);
                }}
              >
                Página anterior
              </button>
              <button
                className="btn-secondary"
                type="button"
                disabled={carregandoPedidos || !paginacaoPedidos.tem_mais}
                onClick={() => {
                  void carregarPedidosPagina(paginacaoPedidos.pagina + 1);
                }}
              >
                Próxima página
              </button>
            </div>

            {carregandoPedidos ? <p className="muted-text" style={{ marginTop: '0.2rem' }}>Atualizando pedidos...</p> : null}
          </section>
        </>
  );
}
