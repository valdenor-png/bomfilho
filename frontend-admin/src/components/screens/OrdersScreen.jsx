import React from 'react';
import { colors, fonts, radius, getStatusStyle } from '../../styles/tokens';
import { Badge, KPICard, FilterChip, InputField, SelectField, Btn } from '../ui';

export default function OrdersScreen(props) {
  const {
    pedidosFiltradosOperacionais, pedidoExpandidoId, setPedidoExpandidoId,
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
    handleAcaoRapidaPedido, handleCopiarResumoPedido,
    handleCopiarListaSeparacaoPedido, handleCopiarConferenciaExpedicaoPedido,
    handleCopiarMensagemContatoPedido, handleCopiarCampoPedido,
    abrirPrimeiroPedidoPrioritario,
    limparFiltrosPedidosOperacionais,
    formatarStatusPedido, formatarMoeda,
    PEDIDOS_TAB_SOMENTE_HISTORICO, STATUS_OPTIONS,
  } = props;

  const card = (bg) => ({ padding: 14, borderRadius: radius.lg, background: bg || colors.bgCard, border: `1px solid ${colors.border}` });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Header ── */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Historico de pedidos</h2>
        <p style={{ fontSize: 11, color: colors.dim, margin: '2px 0 0' }}>
          Consulta historica de pedidos. Operacao em tempo real fica na aba Operacao ao Vivo.
        </p>
        <p style={{ fontSize: 10, color: colors.dim, marginTop: 4, fontFamily: fonts.numbers }}>
          Pagina {paginacaoPedidos.pagina} de {paginacaoPedidos.total_paginas} . {paginacaoPedidos.total} pedido(s)
        </p>
      </div>

      {/* ── KPIs ── */}
      {!PEDIDOS_TAB_SOMENTE_HISTORICO && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
          <KPICard label="Total" value={resumoPedidosOperacionais.total} sub={contadorPedidosOperacionaisTexto} />
          <KPICard label="Criticos" value={resumoPedidosOperacionais.criticos} tone="red" />
          <KPICard label="Aguardando" value={resumoPedidosOperacionais.aguardandoAcao} tone="orange" />
          <KPICard label="Em andamento" value={resumoPedidosOperacionais.emAndamento} tone="blue" />
        </div>
      )}

      {/* ── Controls strip ── */}
      <div style={{ ...card(), display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: colors.muted, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoRefreshPedidosAtivo} onChange={(e) => setAutoRefreshPedidosAtivo(e.target.checked)} style={{ accentColor: colors.gold, width: 14, height: 14 }} />
            Auto-refresh
          </label>
          {avisoNovosPedidos > 0 && (
            <Badge tone="orange" label={`${avisoNovosPedidos} novo(s)`} style={{ cursor: 'pointer' }} onClick={limparAvisoNovosPedidos} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn onClick={abrirPrimeiroPedidoPrioritario}>Ir ao prioritario</Btn>
          <Btn onClick={() => carregarPedidosPagina(paginacaoPedidos.pagina)}>Atualizar</Btn>
        </div>
      </div>

      {/* ── Feedback ── */}
      {feedbackPedidos.mensagem && (
        <div style={{
          padding: '10px 14px', borderRadius: radius.md, fontSize: 12, fontWeight: 600,
          background: feedbackPedidos.tipo === 'success' ? colors.greenBg : feedbackPedidos.tipo === 'error' ? colors.redBg : colors.orangeBg,
          color: feedbackPedidos.tipo === 'success' ? colors.green : feedbackPedidos.tipo === 'error' ? colors.red : colors.orange,
          border: `1px solid ${feedbackPedidos.tipo === 'success' ? colors.greenBorder : feedbackPedidos.tipo === 'error' ? colors.redBorder : colors.orangeBorder}`,
        }}>
          {feedbackPedidos.mensagem}
        </div>
      )}

      {/* ── Status filter chips ── */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {statusChipsOperacionais.map((chip) => (
          <FilterChip
            key={chip.id}
            label={chip.label}
            count={chip.count}
            active={filtroPedidoStatus === chip.id}
            gold={filtroPedidoStatus === chip.id}
            onClick={() => setFiltroPedidoStatus(chip.id)}
          />
        ))}
      </div>

      {/* ── Secondary filters ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        <SelectField
          label="Pagamento"
          value={filtroPedidoPagamento}
          onChange={setFiltroPedidoPagamento}
          options={[{ value: 'todos', label: 'Todos' }, { value: 'pix', label: 'PIX' }, { value: 'credito', label: 'Credito' }, { value: 'debito', label: 'Debito' }]}
        />
        <SelectField
          label="Atendimento"
          value={filtroPedidoTipoEntrega}
          onChange={setFiltroPedidoTipoEntrega}
          options={[{ value: 'todos', label: 'Todos' }, { value: 'entrega', label: 'Entrega' }, { value: 'retirada', label: 'Retirada' }]}
        />
        <SelectField
          label="Ordenacao"
          value={ordenacaoPedidos}
          onChange={setOrdenacaoPedidos}
          options={[{ value: 'prioridade', label: 'Prioridade operacional' }, { value: 'data_desc', label: 'Mais recente' }, { value: 'data_asc', label: 'Mais antigo' }, { value: 'valor_desc', label: 'Maior valor' }]}
        />
      </div>

      {/* ── Active filters ── */}
      {filtrosPedidosAplicados.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {filtrosPedidosAplicados.map((f, i) => (
            <Badge key={i} tone="gold" label={f} />
          ))}
          <Btn onClick={limparFiltrosPedidosOperacionais} style={{ fontSize: 10, padding: '3px 8px' }}>Limpar filtros</Btn>
        </div>
      )}

      {/* ── Loading / empty ── */}
      {carregandoPedidos && (
        <p style={{ textAlign: 'center', padding: 20, color: colors.dim, fontSize: 12 }}>Atualizando pedidos...</p>
      )}

      {!carregandoPedidos && pedidosFiltradosOperacionais.length === 0 && (
        <div style={{ ...card(), textAlign: 'center', padding: 32 }}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>Nenhum pedido encontrado</p>
          <p style={{ fontSize: 11, color: colors.dim, margin: 0 }}>Ajuste os filtros ou aguarde novos pedidos.</p>
        </div>
      )}

      {/* ── Order cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pedidosFiltradosOperacionais.map((pedido) => {
          const pedidoId = Number(pedido.id);
          const isExpanded = pedidoExpandidoId === pedidoId;
          const statusInfo = getStatusStyle(pedido.status);
          const isCancelled = String(pedido.status || '').toLowerCase() === 'cancelado';
          const isRetirada = String(pedido.tipo_entrega || '').toLowerCase() === 'retirada';
          const initials = (pedido.cliente_nome || '?').split(' ').map(n => n?.[0] || '').join('').toUpperCase().slice(0, 2);
          const valor = formatarMoeda(pedido._total || pedido.total || 0);

          // Progress steps
          const steps = isRetirada
            ? ['preparo', 'retirada', 'concluido']
            : ['preparo', 'entrega', 'concluido'];
          const stepLabels = { preparo: 'PREPARO', retirada: 'RETIRADA', entrega: 'ENTREGA', concluido: 'CONCLUIDO' };
          const statusToStep = { pago: 'preparo', preparando: 'preparo', pronto_para_retirada: 'retirada', enviado: 'entrega', entregue: 'concluido', retirado: 'concluido' };
          const currentStep = statusToStep[pedido.status] || 'preparo';
          const currentIdx = steps.indexOf(currentStep);

          return (
            <article
              key={pedidoId}
              style={{
                background: colors.bgCard,
                border: `1px solid ${colors.border}`,
                borderLeft: `4px solid ${isCancelled ? colors.red : statusInfo.color}`,
                borderRadius: radius.lg,
                padding: 14,
                opacity: isCancelled ? 0.7 : 1,
                transition: 'transform 0.15s',
              }}
            >
              {/* Header: ID + badges + date */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 18, fontWeight: 800, fontFamily: fonts.numbers, color: colors.gold }}>#{pedidoId}</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    <Badge status={pedido.status} />
                    {pedido.badges?.map((b, i) => <Badge key={i} tone={b.tone} label={b.label} />)}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: colors.dim, fontFamily: fonts.numbers }}>{pedido.dataLabel}</span>
              </div>

              {/* Client + Value */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: radius.md, flexShrink: 0,
                  background: `linear-gradient(135deg, ${colors.teal}, ${colors.tealLight})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 13, fontFamily: fonts.text, color: colors.white,
                }}>
                  {initials}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{pedido.cliente_nome || '—'}</p>
                  <p style={{ fontSize: 10, color: colors.dim, margin: 0 }}>{pedido.cliente_telefone || ''}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontSize: 20, fontWeight: 800, fontFamily: fonts.numbers, color: colors.gold,
                    textDecoration: isCancelled ? 'line-through' : 'none',
                  }}>
                    {valor}
                  </span>
                  <p style={{ fontSize: 10, color: colors.dim, margin: 0 }}>
                    {pedido.resumoItensTexto} . {pedido.formaPagamentoLabel || 'PIX'} . {isRetirada ? 'Retirada' : 'Entrega'}
                  </p>
                </div>
              </div>

              {/* Items summary */}
              {pedido.resumoItensTexto && (
                <div style={{
                  padding: '8px 10px', borderRadius: radius.md, marginBottom: 10,
                  background: 'rgba(10,31,26,0.5)', border: `1px solid ${colors.borderDim}`,
                  fontSize: 11, color: colors.muted,
                }}>
                  {pedido.itensTextoCompleto || pedido.resumoItensTexto}
                </div>
              )}

              {/* Progress bar */}
              {!isCancelled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '8px 0', marginBottom: 8 }}>
                  {steps.map((step, i) => {
                    const done = i < currentIdx;
                    const active = i === currentIdx;
                    return (
                      <div key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative' }}>
                        {i > 0 && (
                          <div style={{
                            position: 'absolute', top: 5, right: '50%', left: '-50%', height: 3,
                            background: done ? colors.green : colors.borderDim, borderRadius: 2, zIndex: 0,
                          }} />
                        )}
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%', position: 'relative', zIndex: 1,
                          background: done ? colors.green : active ? colors.gold : colors.borderDim,
                          boxShadow: active ? `0 0 8px rgba(226,184,74,0.4)` : 'none',
                        }} />
                        <span style={{ fontSize: 8, fontWeight: 600, color: done ? colors.green : active ? colors.gold : colors.dim }}>
                          {stepLabels[step]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {pedido.whatsappLink && (
                  <Btn primary href={pedido.whatsappLink} icon={
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                  } style={{ background: '#25D366', boxShadow: 'none' }}>WhatsApp</Btn>
                )}
                <Btn onClick={() => handleCopiarResumoPedido(pedido)}>Resumo</Btn>
                <Btn onClick={() => window.open(`/admin/pedido/${pedidoId}/separacao`, '_blank')}>Nota</Btn>
                {pedido.cliente_telefone && (
                  <Btn onClick={() => handleCopiarCampoPedido(pedido.cliente_telefone, 'Telefone')}>Tel</Btn>
                )}
              </div>

              {/* Next step action */}
              {pedido.statusFluxoPedido?.proximoStatus && !isCancelled && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                  <Btn
                    gold
                    disabled={atualizandoStatusPedidoId === pedidoId}
                    onClick={() => handleAcaoRapidaPedido(pedidoId, pedido.statusFluxoPedido.proximoStatus)}
                  >
                    {atualizandoStatusPedidoId === pedidoId ? 'Atualizando...' : pedido.statusFluxoPedido.label}
                  </Btn>
                  <Btn danger onClick={() => handleAcaoRapidaPedido(pedidoId, 'cancelado')}>Cancelar</Btn>
                </div>
              )}

              {/* Expand/collapse details */}
              <div style={{ marginTop: 8, borderTop: `1px solid ${colors.borderDim}`, paddingTop: 8 }}>
                <Btn onClick={() => setPedidoExpandidoId(isExpanded ? null : pedidoId)} style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}>
                  {isExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                </Btn>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div style={{ marginTop: 12, padding: 14, borderRadius: radius.lg, background: 'rgba(10,31,26,0.5)', border: `1px solid ${colors.borderDim}` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {/* Client details */}
                    <div style={{ ...card('rgba(10,31,26,0.3)'), padding: 12, borderRadius: 12 }}>
                      <h5 style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: colors.gold, margin: '0 0 6px' }}>Cliente</h5>
                      <p style={{ fontSize: 11, color: colors.muted, lineHeight: 1.6, margin: '2px 0' }}><strong style={{ color: colors.white }}>Nome:</strong> {pedido.cliente_nome || '—'}</p>
                      <p style={{ fontSize: 11, color: colors.muted, lineHeight: 1.6, margin: '2px 0' }}><strong style={{ color: colors.white }}>Tel:</strong> {pedido.cliente_telefone || '—'}</p>
                      <p style={{ fontSize: 11, color: colors.muted, lineHeight: 1.6, margin: '2px 0' }}><strong style={{ color: colors.white }}>Email:</strong> {pedido.cliente_email || '—'}</p>
                    </div>
                    {/* Order details */}
                    <div style={{ ...card('rgba(10,31,26,0.3)'), padding: 12, borderRadius: 12 }}>
                      <h5 style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: colors.gold, margin: '0 0 6px' }}>Pedido</h5>
                      <p style={{ fontSize: 11, color: colors.muted, lineHeight: 1.6, margin: '2px 0' }}><strong style={{ color: colors.white }}>Status:</strong> {formatarStatusPedido(pedido.status)}</p>
                      <p style={{ fontSize: 11, color: colors.muted, lineHeight: 1.6, margin: '2px 0' }}><strong style={{ color: colors.white }}>Pagamento:</strong> {pedido.formaPagamentoLabel || '—'}</p>
                      <p style={{ fontSize: 11, color: colors.muted, lineHeight: 1.6, margin: '2px 0' }}><strong style={{ color: colors.white }}>Entrega:</strong> {isRetirada ? 'Retirada na loja' : 'Entrega'}</p>
                      <p style={{ fontSize: 11, color: colors.muted, lineHeight: 1.6, margin: '2px 0' }}><strong style={{ color: colors.white }}>Criado:</strong> {pedido.dataLabel}</p>
                    </div>
                  </div>

                  {/* Items */}
                  {Array.isArray(pedido.itens) && pedido.itens.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <h5 style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: colors.gold, margin: '0 0 6px' }}>Itens</h5>
                      {pedido.itens.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: `1px solid ${colors.borderDim}`, fontSize: 11 }}>
                          <span style={{ fontFamily: fonts.numbers, fontWeight: 700, color: colors.gold, minWidth: 28 }}>{item.quantidade}x</span>
                          <span style={{ flex: 1 }}>{item.nome_produto || item.nome || 'Item'}</span>
                          <span style={{ fontFamily: fonts.numbers, fontWeight: 600, color: colors.muted }}>{formatarMoeda(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Copy actions */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    <Btn onClick={() => handleCopiarResumoPedido(pedido)}>Copiar resumo</Btn>
                    <Btn onClick={() => handleCopiarListaSeparacaoPedido(pedido)}>Lista separacao</Btn>
                    <Btn onClick={() => window.open(`/admin/pedido/${pedidoId}/separacao`, '_blank')}>Imprimir nota</Btn>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* ── Pagination ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: `1px solid ${colors.borderDim}` }}>
        <span style={{ fontSize: 11, color: colors.dim }}>{contadorPedidosOperacionaisTexto}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn onClick={() => carregarPedidosPagina(paginacaoPedidos.pagina - 1)} disabled={carregandoPedidos || paginacaoPedidos.pagina <= 1}>← Anterior</Btn>
          <Btn onClick={() => carregarPedidosPagina(paginacaoPedidos.pagina + 1)} disabled={carregandoPedidos || !paginacaoPedidos.tem_mais}>Proxima →</Btn>
        </div>
      </div>
    </div>
  );
}
