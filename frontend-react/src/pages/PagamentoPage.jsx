import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { criarPedido, gerarPix, getStoredToken } from '../lib/api';
import { useCart } from '../context/CartContext';

export default function PagamentoPage() {
  const { itens, resumo, updateItemQuantity, removeItem, clearCart } = useCart();
  const [resultadoPedido, setResultadoPedido] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultadoPix, setResultadoPix] = useState(null);
  const token = getStoredToken();

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
    if (!token) {
      return;
    }
  }, [token]);

  async function handleCriarPedido() {
    setResultadoPix(null);
    setResultadoPedido(null);
    setErro('');

    if (itensPedido.length === 0) {
      setErro('Adicione produtos ao carrinho para criar o pedido.');
      return;
    }

    setCarregando(true);
    try {
      const data = await criarPedido(token, {
        itens: itensPedido,
        formaPagamento: 'pix'
      });

      setResultadoPedido(data);
      clearCart();

      if (data?.pix_codigo) {
        setResultadoPix({
          status: data.pix_erro ? 'fallback' : 'waiting',
          qr_data: data.pix_codigo,
          qr_code_base64: null
        });
      }
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  async function handleGerarPix(pedidoId) {
    setResultadoPix(null);
    setErro('');
    setCarregando(true);
    try {
      const data = await gerarPix(token, pedidoId);
      setResultadoPix(data);
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  if (!token) {
    return (
      <section className="page">
        <h1>Pagamento</h1>
        <p>Você precisa fazer login para concluir pedido e gerar PIX.</p>

        <div className="card-box">
          <p><strong>Como finalizar seu pedido</strong></p>
          <p>1. Entre na sua conta.</p>
          <p>2. Revise o carrinho e confirme o total.</p>
          <p>3. Gere o PIX e pague pelo app do banco.</p>
          <Link to="/conta" className="btn-primary" style={{ display: 'inline-block', marginTop: '0.4rem' }}>
            Ir para Conta
          </Link>
        </div>

        <div className="card-box">
          <p><strong>Atendimento</strong></p>
          <p>Dúvidas no pagamento? Fale com a loja:</p>
          <p>WhatsApp: (91) 99965-2790</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>Pagamento</h1>
      <p>Revise o carrinho, crie o pedido e finalize no PIX.</p>

      {erro ? <p className="error-text">{erro}</p> : null}

      <div className="card-box">
        <p><strong>Carrinho atual</strong></p>
        {itens.length === 0 ? (
          <>
            <p className="muted-text">Carrinho vazio. Adicione produtos na página inicial.</p>
            <Link to="/" className="btn-secondary" style={{ display: 'inline-block' }}>
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

        <button className="btn-primary" type="button" onClick={handleCriarPedido} disabled={carregando || itens.length === 0}>
          Criar pedido com PIX
        </button>
      </div>

      <div className="card-box">
        <p><strong>Status do pedido</strong></p>
        {resultadoPedido ? (
          <p>Pedido #{resultadoPedido.pedido_id} criado. Gere novamente o PIX se precisar atualizar o código.</p>
        ) : (
          <p className="muted-text">Nenhum pedido criado ainda nesta sessão.</p>
        )}
      </div>

      {resultadoPedido ? (
        <div className="card-box">
          <p><strong>Pedido criado</strong></p>
          <p>Número: #{resultadoPedido.pedido_id}</p>
          <p>Total: R$ {Number(resultadoPedido.total || 0).toFixed(2)}</p>
          <p>Forma de pagamento: {resultadoPedido.forma_pagamento}</p>
          <button
            className="btn-secondary"
            type="button"
            disabled={carregando}
            onClick={() => handleGerarPix(resultadoPedido.pedido_id)}
          >
            Gerar PIX novamente
          </button>
        </div>
      ) : null}

      {resultadoPix ? (
        <div className="card-box">
          <p><strong>PIX gerado</strong></p>
          <p>Status: {resultadoPix.status || '-'}</p>
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
        </div>
      ) : null}

      <div className="card-box">
        <p><strong>Ajuda rápida</strong></p>
        <p>Se o QR não abrir no banco, copie o código PIX e cole no app manualmente.</p>
        <p>Após o pagamento, a loja confirma e inicia a preparação do pedido.</p>
      </div>
    </section>
  );
}

