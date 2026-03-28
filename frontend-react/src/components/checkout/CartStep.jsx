import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from '../../icons';
import { useCart } from '../../context/CartContext';
import { useCheckout, CHECKOUT_ACTIONS } from '../../context/CheckoutContext';
import { ETAPAS, formatarQuantidadeItens, normalizarTextoSugestao } from '../../lib/checkoutUtils';
import { getProdutos } from '../../lib/api';
import { isProdutoAlcoolico, isProdutoTabaco, isProdutoVisivelNoCatalogo } from '../../lib/produtoCatalogoRules';
import { CartItemRow, CheckoutSummaryCard, CheckoutCrossSellRail } from '../checkout';

// Constantes locais (copiadas de PagamentoPage — podem ir para checkoutUtils futuramente)
const LIMITE_SUGESTOES_CHECKOUT = 8;
const MINIMO_PRIORIDADE_IMPULSO = 6;
const TERMOS_PRIORIDADE_IMPULSO = [
  'biscoito', 'biscoitos', 'bolacha', 'bolachas',
  'chocolate', 'chocolates', 'bombom', 'bombons',
  'bala', 'balas', 'salgadinho', 'salgadinhos',
  'refrigerante', 'refri', 'suco', 'sucos',
  'sobremesa', 'conveniencia'
];
const TERMOS_FALLBACK_GERAL = [
  'conveniencia', 'snack', 'sobremesa', 'suco', 'refrigerante'
];
const TOKENS_MEDICAMENTOS_BLOQUEADOS = [
  'medicamento', 'medicamentos', 'remedio', 'remedios',
  'farmacia', 'tarja', 'analgesico', 'antibiotico'
];
const TOKENS_ALCOOL_BLOQUEADOS = [
  'bebida alcoolica', 'bebidas alcoolicas', 'cerveja', 'vinho',
  'whisky', 'vodka', 'gin', 'rum', 'tequila', 'licor', 'aperitivo', 'cachaca'
];
const TOKENS_TABACO_BLOQUEADOS = [
  'tabaco', 'cigarro', 'cigarros', 'fumo', 'narguile', 'vape'
];

export default function CartStep({ taxaServicoAtual, avisosRestricaoEntregaPorItem }) {
  const { itens, resumo, addItem, updateItemQuantity, removeItem, clearCart } = useCart();
  const { dispatch, tipoEntrega } = useCheckout();

  // Estados locais deste step
  const [feedbackCarrinho, setFeedbackCarrinho] = useState('');
  const [sugestoesCheckout, setSugestoesCheckout] = useState([]);
  const [modoSugestoesCheckout, setModoSugestoesCheckout] = useState('impulso');
  const [carregandoSugestoesCheckout, setCarregandoSugestoesCheckout] = useState(false);
  const cacheSugestoesRef = useRef(new Map());
  const ultimaSugestaoCheckoutValidaRef = useRef([]);

  const carrinhoVazio = itens.length === 0;
  const itensDistintosCarrinho = itens.length;
  const resumoItensCarrinho = formatarQuantidadeItens(
    itens.reduce((acc, item) => acc + Number(item.quantidade || 1), 0)
  );

  const handleAtualizarQuantidadeCarrinho = useCallback((id, quantidade) => {
    updateItemQuantity(id, quantidade);
    setFeedbackCarrinho('Carrinho atualizado.');
  }, [updateItemQuantity]);

  const handleRemoverItemCarrinho = useCallback((id) => {
    removeItem(id);
    setFeedbackCarrinho('Item removido do carrinho.');
  }, [removeItem]);

  const handleLimparCarrinho = useCallback(() => {
    clearCart();
    setFeedbackCarrinho('Carrinho limpo.');
    setSugestoesCheckout([]);
  }, [clearCart]);

  const termosSugestaoImpulso = TERMOS_PRIORIDADE_IMPULSO.map(
    (termo) => normalizarTextoSugestao(termo)
  ).filter(Boolean);

  // Limpar feedbackCarrinho após 2.2s
  useEffect(() => {
    if (!feedbackCarrinho) return undefined;
    const timeout = setTimeout(() => setFeedbackCarrinho(''), 2200);
    return () => clearTimeout(timeout);
  }, [feedbackCarrinho]);

  // Sugestões cross-sell
  useEffect(() => {
    let ativo = true;

    if (!itens.length) {
      setSugestoesCheckout([]);
      setModoSugestoesCheckout('impulso');
      setCarregandoSugestoesCheckout(false);
      return () => { ativo = false; };
    }

    const idsNoCarrinho = new Set(itens.map((item) => Number(item.id)));

    const categoriaTermos = [];
    const vistos = new Set(termosSugestaoImpulso);
    itens.forEach((item) => {
      const textoFonte = [item?.categoria, item?.nome]
        .map(normalizarTextoSugestao)
        .filter(Boolean)
        .join(' ');
      textoFonte.split(/\s+/).filter((t) => t.length >= 4).slice(0, 6).forEach((termo) => {
        if (!vistos.has(termo)) { vistos.add(termo); categoriaTermos.push(termo); }
      });
    });

    const chaveCache = [...termosSugestaoImpulso, ...categoriaTermos].sort().join('|');
    const cached = cacheSugestoesRef.current.get(chaveCache);
    if (cached) {
      const filtrados = cached.filter((p) => !idsNoCarrinho.has(Number(p.id)));
      if (filtrados.length >= 2) {
        setSugestoesCheckout(filtrados.slice(0, LIMITE_SUGESTOES_CHECKOUT));
        setCarregandoSugestoesCheckout(false);
        return () => { ativo = false; };
      }
    }

    setCarregandoSugestoesCheckout(true);

    async function buscarSugestoes() {
      try {
        const termoBusca = termosSugestaoImpulso.slice(0, 3).join(' ') || TERMOS_FALLBACK_GERAL[0];
        const data = await getProdutos({ busca: termoBusca, limite: 20 });
        if (!ativo) return;

        const todos = Array.isArray(data?.produtos) ? data.produtos : [];
        const filtrados = todos.filter((p) => {
          if (!isProdutoVisivelNoCatalogo(p)) return false;
          if (isProdutoAlcoolico(p)) return false;
          if (isProdutoTabaco(p)) return false;
          const nome = normalizarTextoSugestao(p?.nome || '');
          if (TOKENS_MEDICAMENTOS_BLOQUEADOS.some((t) => nome.includes(t))) return false;
          if (TOKENS_ALCOOL_BLOQUEADOS.some((t) => nome.includes(t))) return false;
          if (TOKENS_TABACO_BLOQUEADOS.some((t) => nome.includes(t))) return false;
          return !idsNoCarrinho.has(Number(p.id));
        });

        const impulso = filtrados.filter((p) => {
          const nome = normalizarTextoSugestao(p?.nome || '');
          return termosSugestaoImpulso.filter((t) => nome.includes(t)).length >= MINIMO_PRIORIDADE_IMPULSO;
        });

        const resultado = (impulso.length >= 2 ? impulso : filtrados)
          .slice(0, LIMITE_SUGESTOES_CHECKOUT);

        cacheSugestoesRef.current.set(chaveCache, resultado);
        ultimaSugestaoCheckoutValidaRef.current = resultado;
        setSugestoesCheckout(resultado);
        setModoSugestoesCheckout(impulso.length >= 2 ? 'impulso' : 'geral');
      } catch {
        if (ativo && ultimaSugestaoCheckoutValidaRef.current.length) {
          setSugestoesCheckout(
            ultimaSugestaoCheckoutValidaRef.current.filter(
              (p) => !idsNoCarrinho.has(Number(p.id))
            )
          );
        }
      } finally {
        if (ativo) setCarregandoSugestoesCheckout(false);
      }
    }

    void buscarSugestoes();
    return () => { ativo = false; };
  }, [itens]);

  const tituloSugestoesCheckout = modoSugestoesCheckout === 'impulso'
    ? 'Aproveite e adicione mais'
    : 'Você pode gostar';

  const subtituloSugestoesCheckout = modoSugestoesCheckout === 'impulso'
    ? 'Itens populares para complementar seu pedido'
    : 'Produtos relacionados ao seu carrinho';

  return (
    <div className="checkout-cart-layout">
      <div className="card-box checkout-cart-main">
        <div className="checkout-cart-header">
          <p className="checkout-cart-live-feedback" role="status" aria-live="polite">
            {feedbackCarrinho || (carrinhoVazio
              ? 'Nenhum item no carrinho por enquanto.'
              : `${itensDistintosCarrinho} produtos diferentes · ${resumoItensCarrinho}.`)}
          </p>
        </div>

        {carrinhoVazio ? (
          <div className="checkout-cart-empty-state" role="status">
            <span className="checkout-cart-empty-icon" aria-hidden="true">
              <ShoppingCart size={22} strokeWidth={2} />
            </span>
            <div>
              <strong>Seu carrinho está vazio.</strong>
              <p>Adicione produtos para continuar com a finalização do pedido.</p>
              <Link className="btn-primary checkout-cart-empty-cta" to="/produtos">
                Ir para produtos
              </Link>
            </div>
          </div>
        ) : (
          <div className="checkout-cart-items-list">
            {itens.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                warningMessage={avisosRestricaoEntregaPorItem.get(Number(item.id)) || ''}
                onUpdateQuantity={handleAtualizarQuantidadeCarrinho}
                onRemove={handleRemoverItemCarrinho}
              />
            ))}
          </div>
        )}

        <CheckoutCrossSellRail
          title={tituloSugestoesCheckout}
          subtitle={subtituloSugestoesCheckout}
          produtos={sugestoesCheckout}
          carregando={carregandoSugestoesCheckout}
          alwaysVisible={Boolean(itens.length)}
          onAdd={(produto) => addItem(produto, 1, { source: 'checkout_cross_sell' })}
        />
      </div>

      <aside className="checkout-cart-side">
        <CheckoutSummaryCard
          subtotal={resumo.total}
          taxaServico={taxaServicoAtual}
          tipoEntrega={tipoEntrega}
          economiaFrete={0}
          onContinue={() => dispatch({ type: CHECKOUT_ACTIONS.SET_ETAPA, payload: ETAPAS.ENTREGA })}
          disabled={carrinhoVazio}
          showContinueButton={false}
        />
      </aside>
    </div>
  );
}
