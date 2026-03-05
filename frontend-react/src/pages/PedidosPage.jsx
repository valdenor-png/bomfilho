import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPedidoById, getPedidos, isAuthErrorMessage } from '../lib/api';

function formatarDataPedido(dataRaw) {
  if (!dataRaw) {
    return '-';
  }

  const data = new Date(dataRaw);
  if (Number.isNaN(data.getTime())) {
    return '-';
  }

  return data.toLocaleString('pt-BR');
}

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState([]);
  const [pedidoAbertoId, setPedidoAbertoId] = useState(null);
  const [detalhesPorPedido, setDetalhesPorPedido] = useState({});
  const [carregandoDetalhesId, setCarregandoDetalhesId] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [autenticado, setAutenticado] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;

    async function carregarPedidos() {
      setCarregando(true);
      setErro('');

      try {
        const data = await getPedidos();
        if (!ativo) {
          return;
        }

        setPedidos(Array.isArray(data.pedidos) ? data.pedidos : []);
        setAutenticado(true);
      } catch (error) {
        if (!ativo) {
          return;
        }

        if (isAuthErrorMessage(error.message)) {
          setAutenticado(false);
          setPedidos([]);
        } else {
          setErro(error.message || 'Não foi possível carregar o histórico de pedidos.');
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    carregarPedidos();

    return () => {
      ativo = false;
    };
  }, []);

  async function toggleDetalhesPedido(pedidoId) {
    if (pedidoAbertoId === pedidoId) {
      setPedidoAbertoId(null);
      return;
    }

    setPedidoAbertoId(pedidoId);

    if (detalhesPorPedido[pedidoId]) {
      return;
    }

    setCarregandoDetalhesId(pedidoId);
    try {
      const data = await getPedidoById(pedidoId);
      setDetalhesPorPedido((atual) => ({
        ...atual,
        [pedidoId]: {
          itens: Array.isArray(data.itens) ? data.itens : [],
          erro: ''
        }
      }));
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
        setPedidoAbertoId(null);
        return;
      }

      setDetalhesPorPedido((atual) => ({
        ...atual,
        [pedidoId]: {
          itens: [],
          erro: error.message || 'Não foi possível carregar os itens deste pedido.'
        }
      }));
    } finally {
      setCarregandoDetalhesId(null);
    }
  }

  if (autenticado === false) {
    return (
      <section className="page">
        <h1>Pedidos</h1>
        <p>Faça login para ver o histórico de pedidos da sua conta.</p>

        <div className="card-box">
          <p><strong>Você ainda não está conectado.</strong></p>
          <Link to="/conta" className="btn-primary" style={{ display: 'inline-block' }}>
            Ir para Conta
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>Pedidos</h1>
      <p>Histórico de pedidos da sua conta.</p>

      {erro ? <p className="error-text">{erro}</p> : null}

      {carregando ? <p className="muted-text">Carregando pedidos...</p> : null}

      {!carregando && pedidos.length === 0 ? (
        <div className="card-box">
          <p><strong>Nenhum pedido encontrado.</strong></p>
          <p>Quando você finalizar uma compra, o pedido aparecerá aqui.</p>
          <Link to="/produtos" className="btn-secondary" style={{ display: 'inline-block' }}>
            Ir para produtos
          </Link>
        </div>
      ) : null}

      {pedidos.length > 0 ? (
        <div className="list-box">
          {pedidos.map((pedido) => {
            const detalhesPedido = detalhesPorPedido[pedido.id];
            const estaAberto = pedidoAbertoId === pedido.id;
            const estaCarregando = carregandoDetalhesId === pedido.id;

            return (
              <div className="card-box" key={pedido.id}>
                <div className="item-box">
                  <div>
                    <p><strong>Pedido #{pedido.id}</strong></p>
                    <p><strong>Total:</strong> R$ {Number(pedido.total || 0).toFixed(2)}</p>
                    <p><strong>Pagamento:</strong> {String(pedido.forma_pagamento || 'pix').toUpperCase()}</p>
                    <p><strong>Data:</strong> {formatarDataPedido(pedido.criado_em || pedido.data_pedido)}</p>
                  </div>

                  <div className="pedido-history-actions">
                    <span className="pedido-status-badge">{pedido.status || 'pendente'}</span>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => toggleDetalhesPedido(pedido.id)}
                    >
                      {estaAberto ? 'Ocultar detalhes' : 'Ver detalhes'}
                    </button>
                  </div>
                </div>

                {estaAberto ? (
                  <div className="pedido-history-details">
                    {estaCarregando ? <p className="muted-text">Carregando detalhes...</p> : null}

                    {!estaCarregando && detalhesPedido?.erro ? (
                      <p className="error-text">{detalhesPedido.erro}</p>
                    ) : null}

                    {!estaCarregando && !detalhesPedido?.erro && (detalhesPedido?.itens || []).length === 0 ? (
                      <p className="muted-text">Nenhum item encontrado para este pedido.</p>
                    ) : null}

                    {!estaCarregando && !detalhesPedido?.erro && (detalhesPedido?.itens || []).length > 0 ? (
                      <div className="produto-lista">
                        {detalhesPedido.itens.map((item) => (
                          <div className="produto-item" key={item.id || `${pedido.id}-${item.produto_id}-${item.nome_produto}`}>
                            <div>
                              <p className="pedido-history-item-name">
                                {item.emoji || '📦'} {item.nome_produto || item.nome || 'Item'}
                              </p>
                              <p className="pedido-history-item-meta">
                                {Number(item.quantidade || 0)}x · R$ {Number(item.preco || 0).toFixed(2)}
                              </p>
                            </div>
                            <p><strong>Subtotal:</strong> R$ {Number(item.subtotal || 0).toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
