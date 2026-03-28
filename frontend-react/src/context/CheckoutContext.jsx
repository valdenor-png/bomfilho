/**
 * CheckoutContext — estado centralizado do fluxo de checkout.
 *
 * Arquitetura com useReducer para facilitar migração gradual de
 * PagamentoPage. Por ora, PagamentoPage ainda gerencia seu próprio
 * estado e injeta um value no Provider; sub-componentes podem
 * consumir via useCheckout() sem prop drilling.
 *
 * Uso:
 *   // Em PagamentoPage (provider)
 *   <CheckoutContext.Provider value={checkoutContextValue}>
 *     {children}
 *   </CheckoutContext.Provider>
 *
 *   // Em sub-componentes (consumer)
 *   const { etapaAtual, setEtapaAtual, ... } = useCheckout();
 */
import { createContext, useContext, useReducer } from 'react';
import { ETAPAS } from '../lib/checkoutUtils';

// ── Actions ────────────────────────────────────────────────────────────

export const CHECKOUT_ACTIONS = Object.freeze({
  SET_ETAPA:                'SET_ETAPA',
  SET_RESULTADO_PEDIDO:     'SET_RESULTADO_PEDIDO',
  SET_FORMA_PAGAMENTO:      'SET_FORMA_PAGAMENTO',
  SET_STATUS_PEDIDO:        'SET_STATUS_PEDIDO',
  SET_CARREGANDO:           'SET_CARREGANDO',
  SET_ERRO:                 'SET_ERRO',
  SET_AUTH:                 'SET_AUTH',
  SET_PAGAMENTO_CONFIRMADO: 'SET_PAGAMENTO_CONFIRMADO',
  SET_RESULTADO_PIX:        'SET_RESULTADO_PIX',
  SET_SNAPSHOT:             'SET_SNAPSHOT',
  SET_ENTREGA_DATA:         'SET_ENTREGA_DATA',
  SET_ULTIMA_ATUALIZACAO:   'SET_ULTIMA_ATUALIZACAO',
  RESET_CHECKOUT:           'RESET_CHECKOUT',
});

// ── Estado inicial ─────────────────────────────────────────────────────

export const CHECKOUT_INITIAL_STATE = Object.freeze({
  // Navegação
  etapaAtual:               ETAPAS.CARRINHO,
  // Resultado do pedido criado
  resultadoPedido:          null,
  // Pagamento
  formaPagamento:           'pix',
  statusPedidoAtual:        '',
  carregando:               false,
  erro:                     '',
  // Autenticação
  autenticado:              null,
  dadosUsuarioCheckout:     null,
  // Confirmação de pagamento (cartão)
  pagamentoConfirmado:      false,
  // PIX
  resultadoPix:             null,
  // Snapshot do pedido no momento da confirmação
  itensPedidoSnapshot:      [],
  resumoPedidoSnapshot:     null,
  // Entrega
  tipoEntrega:              'entrega',
  veiculoEntrega:           'uber',
  simulacaoFrete:           null,
  cepEntrega:               '',
  numeroEntrega:            '',
  enderecoCepEntrega:       null,
  // Revisão
  ultimaAtualizacaoRevisao: '',
});

// ── Reducer ────────────────────────────────────────────────────────────

export function checkoutReducer(state, action) {
  switch (action.type) {
    case CHECKOUT_ACTIONS.SET_ETAPA:
      return { ...state, etapaAtual: action.payload };

    case CHECKOUT_ACTIONS.SET_RESULTADO_PEDIDO:
      return { ...state, resultadoPedido: action.payload };

    case CHECKOUT_ACTIONS.SET_FORMA_PAGAMENTO:
      return { ...state, formaPagamento: action.payload };

    case CHECKOUT_ACTIONS.SET_STATUS_PEDIDO:
      return { ...state, statusPedidoAtual: action.payload };

    case CHECKOUT_ACTIONS.SET_CARREGANDO:
      return { ...state, carregando: action.payload };

    case CHECKOUT_ACTIONS.SET_ERRO:
      return { ...state, erro: action.payload };

    case CHECKOUT_ACTIONS.SET_AUTH:
      return {
        ...state,
        autenticado:          action.payload.autenticado,
        dadosUsuarioCheckout: action.payload.dadosUsuarioCheckout,
      };

    case CHECKOUT_ACTIONS.SET_PAGAMENTO_CONFIRMADO:
      return { ...state, pagamentoConfirmado: action.payload };

    case CHECKOUT_ACTIONS.SET_RESULTADO_PIX:
      return { ...state, resultadoPix: action.payload };

    case CHECKOUT_ACTIONS.SET_SNAPSHOT:
      return {
        ...state,
        itensPedidoSnapshot:  action.payload.itens,
        resumoPedidoSnapshot: action.payload.resumo,
      };

    case CHECKOUT_ACTIONS.SET_ENTREGA_DATA: {
      const p = action.payload || {};
      const updates = {};
      if ('tipoEntrega' in p) updates.tipoEntrega = p.tipoEntrega;
      if ('veiculoEntrega' in p) updates.veiculoEntrega = p.veiculoEntrega;
      if ('simulacaoFrete' in p) updates.simulacaoFrete = p.simulacaoFrete;
      if ('cepEntrega' in p) updates.cepEntrega = p.cepEntrega;
      if ('numeroEntrega' in p) updates.numeroEntrega = p.numeroEntrega;
      if ('enderecoCepEntrega' in p) updates.enderecoCepEntrega = p.enderecoCepEntrega;
      return { ...state, ...updates };
    }

    case CHECKOUT_ACTIONS.SET_ULTIMA_ATUALIZACAO:
      return { ...state, ultimaAtualizacaoRevisao: action.payload };

    case CHECKOUT_ACTIONS.RESET_CHECKOUT:
      return { ...CHECKOUT_INITIAL_STATE };

    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────────────────────

export const CheckoutContext = createContext(null);

/**
 * Hook de conveniência para consumir o CheckoutContext.
 * Lança erro se usado fora de um CheckoutContext.Provider.
 *
 * @returns {object} Valor atual do contexto
 */
export function useCheckout() {
  const ctx = useContext(CheckoutContext);
  if (!ctx) {
    throw new Error('useCheckout precisa estar dentro de CheckoutContext.Provider (PagamentoPage).');
  }
  return ctx;
}

/**
 * Hook standalone que cria estado próprio via useReducer.
 * Útil em testes ou quando se deseja um checkout isolado.
 *
 * @returns {{ state, dispatch }}
 */
export function useCheckoutReducer(initialEtapa = ETAPAS.CARRINHO) {
  return useReducer(checkoutReducer, {
    ...CHECKOUT_INITIAL_STATE,
    etapaAtual: initialEtapa,
  });
}
