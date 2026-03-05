import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { criarPedido, gerarPix, getMe, getPedidos, isAuthErrorMessage } from '../lib/api';
import { useCart } from '../context/CartContext';

const ETAPAS = {
  CARRINHO: 'carrinho',
  PAGAMENTO: 'pagamento',
  PIX: 'pix',
  STATUS: 'status'
};

export default function PagamentoPage() {
  const { itens, resumo, updateItemQuantity, removeItem, clearCart } = useCart();
  const [resultadoPedido, setResultadoPedido] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultadoPix, setResultadoPix] = useState(null);
  const [etapaAtual, setEtapaAtual] = useState(ETAPAS.CARRINHO);
  const [statusPedidoAtual, setStatusPedidoAtual] = useState('');
  const [pagamentoConfirmado, setPagamentoConfirmado] = useState(false);
  const [autenticado, setAutenticado] = useState(null);
  const [verificandoSessao, setVerificandoSessao] = useState(true);

  const itensPedido = useMemo(
    () =>
      itens.map((item) => ({
        produto_id: item.id,
        nome: item.nome,
        preco: Number(item.preco || 0),
        quantidade: Number(item.quantidade || 1)
      })),
    [itens]
  );

  useEffect(() => {
    let ativo = true;
    setVerificandoSessao(true);

    getMe()
      .then(() => {
        if (ativo) {
          setAutenticado(true);
        }
      })
      .catch((error) => {
        if (!ativo) {
          return;
        }

        if (isAuthErrorMessage(error.message)) {
          setAutenticado(false);
        } else {
          setAutenticado(false);
          setErro(error.message || 'Não foi possível validar sua sessão.');
        }
      })
      .finally(() => {
        if (ativo) {
          setVerificandoSessao(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!resultadoPedido?.pedido_id || autenticado !== true) {
      return;
    }

    let ativo = true;

    async function atualizarStatus() {
      try {
        const data = await getPedidos();
        const pedido = (data.pedidos || []).find((item) => Number(item.id) === Number(resultadoPedido.pedido_id));
        if (ativo && pedido?.status) {
          const novoStatus = String(pedido.status);
          setStatusPedidoAtual(novoStatus);
          if (novoStatus === 'pago' || novoStatus === 'entregue') {
            setPagamentoConfirmado(true);
          }
        }
      } catch (error) {
        if (isAuthErrorMessage(error.message)) {
          setAutenticado(false);
        }
      }
    }

    atualizarStatus();
    const interval = setInterval(atualizarStatus, 15000);

    return () => {
      ativo = false;
      clearInterval(interval);
    };
  }, [resultadoPedido?.pedido_id, autenticado]);

  async function handleCriarPedido() {
    setResultadoPix(null);
    setResultadoPedido(null);
    setErro('');

    if (autenticado !== true) {
      setAutenticado(false);
      setErro('Faça login na conta para concluir pedido e gerar PIX.');
      return;
    }

    if (itensPedido.length === 0) {
      setErro('Adicione produtos ao carrinho para criar o pedido.');
      return;
    }

    setCarregando(true);
    try {
      const data = await criarPedido({
        itens: itensPedido,
        formaPagamento: 'pix'
      });

      setResultadoPedido(data);
      setStatusPedidoAtual('pendente');
      clearCart();
      setEtapaAtual(ETAPAS.PIX);

      if (data?.pix_codigo) {
        setResultadoPix({
          status: data.pix_erro ? 'fallback' : 'waiting',
          qr_data: data.pix_codigo,
          qr_code_base64: null
        });
      }
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  async function handleIrParaPix() {
    if (resultadoPedido?.pedido_id) {
      setEtapaAtual(ETAPAS.PIX);
      return;
    }
    await handleCriarPedido();
  }

  async function handleGerarPix(pedidoId) {
    setResultadoPix(null);
    setErro('');
    setCarregando(true);
    try {
      const data = await gerarPix(pedidoId);
      setResultadoPix(data);
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  function getIndiceEtapa(etapa) {
    if (etapa === ETAPAS.CARRINHO) return 0;
    if (etapa === ETAPAS.PAGAMENTO) return 1;
    if (etapa === ETAPAS.PIX) return 2;
    return 3;
  }

  const etapaIndex = getIndiceEtapa(etapaAtual);
  const labelStatus = statusPedidoAtual || resultadoPedido?.status || 'pendente';

  if (verificandoSessao) {
    return (
      <section className="page">
        <h1>Pagamento</h1>
        <p>Verificando sua sessão...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>Pagamento</h1>
      <p>Fluxo em etapas: carrinho, forma de pagamento, pagamento PIX e confirmação.</p>

      {autenticado === false ? (
        <div className="card-box">
          <p><strong>Faça login para concluir o pedido e gerar PIX.</strong></p>
          <p>Você pode revisar e editar o carrinho normalmente antes do login.</p>
          <Link to="/conta" className="btn-primary" style={{ display: 'inline-block', marginTop: '0.4rem' }}>
            Ir para Conta
          </Link>
        </div>
      ) : null}

      <div className="checkout-steps" aria-label="Etapas do checkout">
        {['Carrinho', 'Pagamento', 'PIX', 'Confirmação'].map((titulo, index) => (
          <div key={titulo} className={`checkout-step ${etapaIndex >= index ? 'active' : ''}`}>
            <span className="checkout-step-index">{index + 1}</span>
            <span className="checkout-step-label">{titulo}</span>
          </div>
        ))}
      </div>

      {erro ? <p className="error-text">{erro}</p> : null}

      {etapaAtual === ETAPAS.CARRINHO ? (
        <div className="card-box">
          <p><strong>Etapa 1: Carrinho</strong></p>
          {itens.length === 0 ? (
            <>
              <p className="muted-text">Carrinho vazio. Adicione produtos na página de produtos.</p>
              <Link to="/produtos" className="btn-secondary" style={{ display: 'inline-block' }}>
                Voltar para produtos
              </Link>
            </>
          ) : (
            <div className="produto-lista">
              {itens.map((item) => (
                <div className="produto-item" key={item.id}>
                  <div>
                    <p><strong>{item.emoji || '📦'} {item.nome}</strong></p>
                    <p>R$ {Number(item.preco || 0).toFixed(2)}</p>
                  </div>
                  <div className="cart-item-actions">
                    <input
                      className="qtd-input"
                      type="number"
                      min="1"
                      value={item.quantidade}
                      onChange={(event) => updateItemQuantity(item.id, event.target.value)}
                    />
                    <button className="btn-secondary" type="button" onClick={() => removeItem(item.id)}>
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pedido-resumo">
            <p><strong>Resumo:</strong> {resumo.itens} item(ns)</p>
            <p><strong>Total previsto:</strong> R$ {resumo.total.toFixed(2)}</p>
          </div>

          <button className="btn-primary" type="button" onClick={() => setEtapaAtual(ETAPAS.PAGAMENTO)} disabled={itens.length === 0}>
            Ir para pagamento
          </button>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.PAGAMENTO ? (
        <div className="card-box">
          <p><strong>Etapa 2: Escolha a forma de pagamento</strong></p>
          {autenticado === true ? (
            <>
              <div className="card-box" style={{ marginTop: '0.3rem' }}>
                <p><strong>✅ PIX</strong> (única opção disponível)</p>
                <p className="muted-text" style={{ marginTop: '0.2rem' }}>Pagamento instantâneo via QR Code ou copia e cola.</p>
              </div>

              <button className="btn-primary" type="button" onClick={handleIrParaPix} disabled={carregando || itens.length === 0 && !resultadoPedido?.pedido_id}>
                {carregando ? 'Preparando pagamento...' : 'Continuar com PIX'}
              </button>
            </>
          ) : (
            <>
              <p className="muted-text">Entre na sua conta para continuar para o PIX.</p>
              <Link to="/conta" className="btn-primary" style={{ display: 'inline-block' }}>
                Ir para Conta
              </Link>
            </>
          )}
          <button className="btn-secondary" type="button" onClick={() => setEtapaAtual(ETAPAS.CARRINHO)}>
            Voltar para carrinho
          </button>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.PIX ? (
        <div className="card-box">
          <p><strong>Etapa 3: Fazer pagamento PIX</strong></p>
          {resultadoPedido ? (
            <>
              <p>Pedido #{resultadoPedido.pedido_id} criado.</p>
              <p>Total: R$ {Number(resultadoPedido.total || 0).toFixed(2)}</p>
            </>
          ) : null}

          <button
            className="btn-secondary"
            type="button"
            disabled={carregando || !resultadoPedido?.pedido_id}
            onClick={() => handleGerarPix(resultadoPedido.pedido_id)}
          >
            {carregando ? 'Gerando PIX...' : 'Gerar/Atualizar QR Code PIX'}
          </button>

          {resultadoPix ? (
            <>
              <p>Status do PIX: {resultadoPix.status || '-'}</p>
              {resultadoPix.qr_data ? (
                <textarea
                  className="field-input"
                  rows={4}
                  readOnly
                  value={resultadoPix.qr_data}
                />
              ) : null}
              {resultadoPix.qr_code_base64 ? (
                <img
                  className="pix-image"
                  src={`data:image/png;base64,${resultadoPix.qr_code_base64}`}
                  alt="QR Code PIX"
                />
              ) : null}
            </>
          ) : (
            <p className="muted-text">Clique em gerar PIX para exibir QR Code e código copia e cola.</p>
          )}

          <button className="btn-primary" type="button" onClick={() => {
            setPagamentoConfirmado(true);
            setEtapaAtual(ETAPAS.STATUS);
          }}>
            Confirmar pagamento
          </button>
          <button className="btn-secondary" type="button" onClick={() => setEtapaAtual(ETAPAS.PAGAMENTO)}>
            Voltar
          </button>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.STATUS ? (
        <div className="card-box">
          <p><strong>Etapa 4: Status do pedido</strong></p>
          {resultadoPedido ? (
            <>
              <p>Pedido: #{resultadoPedido.pedido_id}</p>
              <p>
                Situação atual: <span className="pedido-status-badge">{labelStatus}</span>
              </p>
              {pagamentoConfirmado ? (
                <div className="pagamento-ok" aria-label="Pagamento confirmado com sucesso">
                  <span className="pagamento-ok-icon">✅</span>
                  <span>Pagamento efetuado com sucesso</span>
                </div>
              ) : null}
              <p className="muted-text">Atualização automática a cada 15 segundos.</p>
            </>
          ) : (
            <p className="muted-text">Crie um pedido antes de acompanhar status.</p>
          )}

          <div className="card-box" style={{ marginTop: '0.4rem' }}>
            <p><strong>Ajuda rápida</strong></p>
            <p>Se o QR não abrir no banco, copie o código PIX e cole no app manualmente.</p>
            <p>Após o pagamento, a loja confirma e inicia a preparação/envio do pedido.</p>
          </div>

          <button className="btn-secondary" type="button" onClick={() => setEtapaAtual(ETAPAS.PIX)}>
            Voltar para pagamento
          </button>
        </div>
      ) : null}
    </section>
  );
}

