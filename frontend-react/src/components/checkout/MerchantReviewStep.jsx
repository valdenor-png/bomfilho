import { Link } from 'react-router-dom';
import { AlertTriangle, BadgeX, CircleCheck, ClipboardList } from '../../icons';
import { formatarMoeda } from '../../lib/checkoutUtils';
import { calcularSubtotalPeso, isItemPeso } from '../../lib/produtoCatalogoRules';

function calcularSubtotalLinhaRevisao(item = {}) {
  const subtotalInformado = Number(item?.subtotal);
  if (Number.isFinite(subtotalInformado) && subtotalInformado >= 0) {
    return Number(subtotalInformado.toFixed(2));
  }
  const preco = Number(item?.preco || 0);
  const quantidade = Math.max(1, Math.floor(Number(item?.quantidade || 1)));
  if (isItemPeso(item)) {
    return calcularSubtotalPeso(preco, item?.peso_gramas, quantidade);
  }
  return Number((preco * quantidade).toFixed(2));
}

export default function MerchantReviewStep({
  resultadoPedido,
  statusRevisaoAtual,
  textoUltimaAtualizacaoRevisao,
  podeCancelarRevisaoPedido,
  cancelandoRevisao,
  onCancelarPedido,
  onIrParaPagamento,
  erro,
  resumoPedidoSnapshot,
  itensPedidoSnapshot,
  totalRevisaoSnapshot,
}) {
  return (
    <div className="checkout-revisao-layout">
      <div className="card-box checkout-revisao-main">
        <div className="checkout-revisao-header">
          <p className="checkout-pix-kicker">Etapa 4</p>
          <h2>Pedido em revisão</h2>
          <p className="muted-text">
            Seu pedido #{resultadoPedido?.pedido_id} foi recebido e está sendo verificado pela nossa equipe.
            Vamos confirmar se todos os itens estão disponíveis.
          </p>
        </div>

        {statusRevisaoAtual === 'aguardando_revisao' ? (
          <div className="checkout-revisao-status">
            <div className="checkout-revisao-icon" aria-hidden="true">
              <ClipboardList size={18} strokeWidth={2} />
            </div>
            <h3>Aguardando revisão da equipe</h3>
            <p className="muted-text">
              A equipe do mercado está verificando a disponibilidade dos seus itens.
              Esta página atualiza automaticamente — você será direcionado para o pagamento assim que o pedido for aprovado.
            </p>
            <div className="checkout-revisao-loading">
              <div className="checkout-revisao-spinner"></div>
              <span>Verificando a cada 10 segundos...</span>
            </div>
            <p className="muted-text" style={{ marginTop: '0.6rem' }}>{textoUltimaAtualizacaoRevisao}</p>
            {podeCancelarRevisaoPedido ? (
              <button
                className="btn-secondary"
                type="button"
                onClick={() => { void onCancelarPedido(); }}
                disabled={cancelandoRevisao}
                style={{ marginTop: '0.8rem' }}
              >
                {cancelandoRevisao ? 'Cancelando pedido...' : 'Cancelar pedido'}
              </button>
            ) : null}
          </div>
        ) : statusRevisaoAtual === 'pendente' || statusRevisaoAtual === 'pagamento_recusado' ? (
          <div className={`checkout-revisao-status ${statusRevisaoAtual === 'pagamento_recusado' ? 'is-rejected' : ''}`.trim()}>
            <div className="checkout-revisao-icon" aria-hidden="true">
              {statusRevisaoAtual === 'pagamento_recusado' ? (
                <AlertTriangle size={18} strokeWidth={2} />
              ) : (
                <CircleCheck size={18} strokeWidth={2} />
              )}
            </div>
            <h3>{statusRevisaoAtual === 'pagamento_recusado' ? 'Pagamento recusado' : 'Pedido aprovado para pagamento'}</h3>
            <p className={statusRevisaoAtual === 'pagamento_recusado' ? 'error-text' : 'muted-text'}>
              {statusRevisaoAtual === 'pagamento_recusado'
                ? 'Seu pedido está aprovado, mas o pagamento foi recusado. Revise os dados e tente novamente.'
                : 'A revisão terminou. Você já pode seguir para o pagamento.'}
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.8rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn-primary" type="button" onClick={onIrParaPagamento}>
                Ir para pagamento
              </button>
              {podeCancelarRevisaoPedido ? (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => { void onCancelarPedido(); }}
                  disabled={cancelandoRevisao}
                >
                  {cancelandoRevisao ? 'Cancelando pedido...' : 'Cancelar pedido'}
                </button>
              ) : null}
              <Link to="/pedidos" className="btn-secondary">
                Ir para meus pedidos
              </Link>
            </div>
          </div>
        ) : statusRevisaoAtual === 'cancelado' || statusRevisaoAtual === 'expirado' ? (
          <div className="checkout-revisao-status is-rejected">
            <div className="checkout-revisao-icon" aria-hidden="true">
              <BadgeX size={18} strokeWidth={2} />
            </div>
            <h3>Pedido encerrado</h3>
            <p className="error-text">
              {erro || 'Esse pedido em revisão foi encerrado. Você pode iniciar um novo carrinho normalmente.'}
            </p>
            <Link to="/produtos" className="btn-primary" style={{ marginTop: '1rem' }}>
              Voltar às compras
            </Link>
          </div>
        ) : null}

        {resumoPedidoSnapshot ? (
          <div className="checkout-revisao-resumo">
            <h4>Resumo do pedido</h4>
            <ul className="checkout-revisao-itens">
              {itensPedidoSnapshot.map((item) => (
                <li key={item.produto_id}>
                  <span>{item.quantidade}x {item.nome}</span>
                  <span>{formatarMoeda(calcularSubtotalLinhaRevisao(item))}</span>
                </li>
              ))}
            </ul>
            <div className="checkout-revisao-total">
              <strong>Total</strong>
              <strong>{formatarMoeda(totalRevisaoSnapshot)}</strong>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
