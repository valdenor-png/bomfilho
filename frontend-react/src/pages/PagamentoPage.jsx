import { useEffect, useState } from 'react';
import {
  criarPedido,
  gerarPix,
  getPedidos,
  getProdutos,
  getStoredToken
} from '../lib/api';

export default function PagamentoPage() {
  const [produtos, setProdutos] = useState([]);
  const [quantidades, setQuantidades] = useState({});
  const [pedidos, setPedidos] = useState([]);
  const [resultadoPedido, setResultadoPedido] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultadoPix, setResultadoPix] = useState(null);
  const token = getStoredToken();

  const resumoPedido = produtos.reduce(
    (acumulado, produto) => {
      const quantidade = Number(quantidades[produto.id] || 0);
      if (quantidade <= 0) {
        return acumulado;
      }

      return {
        itens: acumulado.itens + quantidade,
        total: acumulado.total + Number(produto.preco || 0) * quantidade
      };
    },
    { itens: 0, total: 0 }
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    carregarDadosIniciais();
  }, [token]);

  async function carregarDadosIniciais() {
    setCarregando(true);
    setErro('');

    try {
      const [produtosData, pedidosData] = await Promise.all([
        getProdutos(),
        getPedidos(token)
      ]);
      setProdutos(produtosData.produtos || []);
      setPedidos(pedidosData.pedidos || []);
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  async function carregarPedidos() {
    setCarregando(true);
    setErro('');
    try {
      const data = await getPedidos(token);
      setPedidos(data.pedidos || []);
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  function atualizarQuantidade(produtoId, valor) {
    const quantidade = Math.max(0, Number(valor || 0));
    setQuantidades((estadoAtual) => ({
      ...estadoAtual,
      [produtoId]: quantidade
    }));
  }

  async function handleCriarPedido() {
    setResultadoPix(null);
    setResultadoPedido(null);
    setErro('');

    const itens = produtos
      .map((produto) => {
        const quantidade = Number(quantidades[produto.id] || 0);
        if (quantidade <= 0) {
          return null;
        }

        return {
          produto_id: produto.id,
          nome: produto.nome,
          preco: Number(produto.preco),
          quantidade
        };
      })
      .filter(Boolean);

    if (itens.length === 0) {
      setErro('Selecione ao menos 1 produto com quantidade maior que zero.');
      return;
    }

    setCarregando(true);
    try {
      const data = await criarPedido(token, {
        itens,
        formaPagamento: 'pix'
      });

      setResultadoPedido(data);
      setQuantidades({});
      await carregarPedidos();

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
        <p>Você precisa fazer login na página Conta para gerar PIX.</p>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>Pagamento</h1>
      <p>Monte seu pedido e gere o pagamento PIX.</p>

      <button className="btn-primary" type="button" onClick={carregarDadosIniciais} disabled={carregando}>
        {carregando ? 'Carregando...' : 'Atualizar dados'}
      </button>

      {erro ? <p className="error-text">{erro}</p> : null}

      <div className="card-box">
        <p><strong>Novo pedido</strong></p>
        {produtos.length === 0 ? (
          <p className="muted-text">Nenhum produto disponível no catálogo.</p>
        ) : (
          <div className="produto-lista">
            {produtos.slice(0, 12).map((produto) => (
              <div className="produto-item" key={produto.id}>
                <div>
                  <p><strong>{produto.emoji || '📦'} {produto.nome}</strong></p>
                  <p>R$ {Number(produto.preco || 0).toFixed(2)}</p>
                </div>
                <input
                  className="qtd-input"
                  type="number"
                  min="0"
                  value={quantidades[produto.id] || 0}
                  onChange={(event) => atualizarQuantidade(produto.id, event.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        <div className="pedido-resumo">
          <p><strong>Resumo:</strong> {resumoPedido.itens} item(ns)</p>
          <p><strong>Total previsto:</strong> R$ {resumoPedido.total.toFixed(2)}</p>
        </div>

        <button className="btn-primary" type="button" onClick={handleCriarPedido} disabled={carregando}>
          Criar pedido com PIX
        </button>
      </div>

      {resultadoPedido ? (
        <div className="card-box">
          <p><strong>Pedido criado</strong></p>
          <p>Número: #{resultadoPedido.pedido_id}</p>
          <p>Total: R$ {Number(resultadoPedido.total || 0).toFixed(2)}</p>
          <p>Forma de pagamento: {resultadoPedido.forma_pagamento}</p>
        </div>
      ) : null}

      {pedidos.length === 0 ? (
        <p className="muted-text">Nenhum pedido encontrado para este usuário.</p>
      ) : (
        <div className="list-box">
          {pedidos.map((pedido) => (
            <div className="item-box" key={pedido.id}>
              <div>
                <p><strong>Pedido #{pedido.id}</strong></p>
                <p>Total: R$ {Number(pedido.total || 0).toFixed(2)}</p>
                <p>Status: {pedido.status}</p>
              </div>
              <button className="btn-primary" type="button" disabled={carregando} onClick={() => handleGerarPix(pedido.id)}>
                Gerar PIX
              </button>
            </div>
          ))}
        </div>
      )}

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
    </section>
  );
}

