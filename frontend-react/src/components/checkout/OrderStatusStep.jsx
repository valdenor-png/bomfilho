import React from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck } from '../../icons';
import { formatarMoeda } from '../../lib/checkoutUtils';

export default function OrderStatusStep({
  resultadoPedido,
  totalComEntregaPedido,
  labelStatus,
  pagamentoConfirmado,
  formaPagamento,
}) {
  return (
    <div className="card-box">
      <p><strong>Etapa 4: Confirmação e acompanhamento</strong></p>
      {resultadoPedido ? (
        <>
          <p>Pedido: #{resultadoPedido.pedido_id}</p>
          <p>Total com entrega estimado: {formatarMoeda(totalComEntregaPedido)}</p>
          <p>
            Situação atual: <span className="pedido-status-badge">{labelStatus}</span>
          </p>
          {pagamentoConfirmado ? (
            <div className="pagamento-ok" aria-label="Pagamento confirmado com sucesso">
              <span className="pagamento-ok-icon"><CircleCheck size={16} aria-hidden="true" /></span>
              <span>Pagamento confirmado com sucesso.</span>
            </div>
          ) : (
            <p className="checkout-status-pending" role="status">
              Ainda estamos aguardando a confirmação final do pagamento. Mantenha esta tela aberta para acompanhar.
            </p>
          )}
          <p className="muted-text">Atualização automática a cada 15 segundos.</p>
        </>
      ) : (
        <p className="muted-text">Finalize um pedido para acompanhar o status.</p>
      )}

      <div className="card-box" style={{ marginTop: '0.4rem' }}>
        <p><strong>Precisa de ajuda?</strong></p>
        <p>
          {formaPagamento === 'pix'
            ? 'Se o QR Code não abrir no seu banco, copie o código PIX e cole manualmente no aplicativo.'
            : 'Se o pagamento não for aprovado, revise os dados do cartão e tente novamente.'}
        </p>
        <p>Após a confirmação do pagamento, iniciamos a preparação e o envio do pedido.</p>
      </div>

      <Link className="btn-secondary" to="/pedidos" style={{ display: 'inline-flex', width: 'fit-content' }}>
        Ir para meus pedidos
      </Link>
    </div>
  );
}
