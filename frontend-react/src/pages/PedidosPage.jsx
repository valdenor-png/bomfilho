import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPedidoById, getPedidos, isAuthErrorMessage } from '../lib/api';

const PEDIDOS_POR_PAGINA = 20;

const STATUS_PEDIDO_LABELS = {
  pendente: 'Aguardando confirmação',
  preparando: 'Em preparação',
  enviado: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  pago: 'Pago'
};

const FORMA_PAGAMENTO_LABELS = {
  pix: 'PIX',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro'
};

function formatarStatusPedido(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();
  return STATUS_PEDIDO_LABELS[status] || 'Em análise';
}

function formatarFormaPagamento(formaRaw) {
  const forma = String(formaRaw || '').trim().toLowerCase();
  return FORMA_PAGAMENTO_LABELS[forma] || 'Não informado';
}

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
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [autenticado, setAutenticado] = useState(null);
  const [erro, setErro] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [temMaisPedidos, setTemMaisPedidos] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function carregarPedidosIniciais() {
      setCarregando(true);
      setErro('');

      try {
        const data = await getPedidos({
          page: 1,
          limit: PEDIDOS_POR_PAGINA
        });
        if (!ativo) {
          return;
        }

        setPedidos(Array.isArray(data.pedidos) ? data.pedidos : []);
        setPaginaAtual(Number(data?.paginacao?.pagina || 1));
        setTemMaisPedidos(Boolean(data?.paginacao?.tem_mais));
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

    carregarPedidosIniciais();

    return () => {
      ativo = false;
    };
  }, []);

  async function carregarMaisPedidos() {
    if (carregando || carregandoMais || !temMaisPedidos) {
      return;
    }

    setCarregandoMais(true);
    setErro('');
    try {
      const proximaPagina = paginaAtual + 1;
      const data = await getPedidos({
        page: proximaPagina,
        limit: PEDIDOS_POR_PAGINA
      });

      const novosPedidos = Array.isArray(data.pedidos) ? data.pedidos : [];
      setPedidos((atuais) => {
        const mapa = new Map(atuais.map((pedido) => [Number(pedido.id), pedido]));
        novosPedidos.forEach((pedido) => {
          mapa.set(Number(pedido.id), pedido);
        });
        return Array.from(mapa.values());
      });

      setPaginaAtual(Number(data?.paginacao?.pagina || proximaPagina));
      setTemMaisPedidos(Boolean(data?.paginacao?.tem_mais));
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
        return;
      }

      setErro(error.message || 'Não foi possível carregar mais pedidos.');
    } finally {
      setCarregandoMais(false);
    }
  }

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
        <p>Faça login para acessar o histórico de pedidos da sua conta.</p>

        <div className="card-box">
          <p><strong>Sua sessão não está ativa.</strong></p>
          <Link to="/conta" className="btn-primary" style={{ display: 'inline-block' }}>
            Entrar na conta
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>Pedidos</h1>
      <p>Acompanhe o andamento e os detalhes dos seus pedidos.</p>

      {erro ? <p className="error-text">{erro}</p> : null}

      {carregando ? <p className="muted-text">Carregando seus pedidos...</p> : null}

      {!carregando && pedidos.length === 0 ? (
        <div className="card-box">
          <p><strong>Você ainda não possui pedidos.</strong></p>
          <p>Quando finalizar sua primeira compra, ela aparecerá aqui.</p>
          <Link to="/produtos" className="btn-secondary" style={{ display: 'inline-block' }}>
            Ver catálogo
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
                    <p><strong>Pagamento:</strong> {formatarFormaPagamento(pedido.forma_pagamento)}</p>
                    <p><strong>Data do pedido:</strong> {formatarDataPedido(pedido.criado_em || pedido.data_pedido)}</p>
                  </div>

                  <div className="pedido-history-actions">
                    <span className="pedido-status-badge">{formatarStatusPedido(pedido.status)}</span>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => toggleDetalhesPedido(pedido.id)}
                    >
                      {estaAberto ? 'Ocultar itens' : 'Ver itens'}
                    </button>
                  </div>
                </div>

                {estaAberto ? (
                  <div className="pedido-history-details">
                    {estaCarregando ? <p className="muted-text">Carregando itens do pedido...</p> : null}

                    {!estaCarregando && detalhesPedido?.erro ? (
                      <p className="error-text">{detalhesPedido.erro}</p>
                    ) : null}

                    {!estaCarregando && !detalhesPedido?.erro && (detalhesPedido?.itens || []).length === 0 ? (
                      <p className="muted-text">Não há itens registrados para este pedido.</p>
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

      {temMaisPedidos ? (
        <div className="card-box" style={{ marginTop: '0.8rem' }}>
          <button
            className="btn-primary"
            type="button"
            onClick={() => {
              void carregarMaisPedidos();
            }}
            disabled={carregandoMais || carregando}
          >
            {carregandoMais ? 'Carregando mais pedidos...' : 'Ver pedidos anteriores'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
