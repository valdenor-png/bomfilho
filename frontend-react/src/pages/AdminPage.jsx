import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  adminGetMe,
  adminLogin,
  adminLogout,
  adminAtualizarStatusPedido,
  adminBuscarProdutoPorCodigoBarras,
  adminCadastrarProduto,
  adminExcluirProduto,
  adminGetPedidos,
  getProdutos,
  isAuthErrorMessage
} from '../lib/api';

const STATUS_OPTIONS = ['pendente', 'preparando', 'enviado', 'entregue', 'cancelado'];

const initialProduto = {
  codigo_barras: '',
  nome: '',
  descricao: '',
  marca: '',
  imagem: '',
  preco: '',
  unidade: 'un',
  categoria: '',
  emoji: '📦',
  estoque: 0
};

export default function AdminPage() {
  const [adminUsuario, setAdminUsuario] = useState('admin');
  const [adminSenha, setAdminSenha] = useState('');
  const [adminAutenticado, setAdminAutenticado] = useState(null);
  const [tab, setTab] = useState('pedidos');
  const [pedidos, setPedidos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [statusDraft, setStatusDraft] = useState({});
  const [produtoForm, setProdutoForm] = useState(initialProduto);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [salvandoProduto, setSalvandoProduto] = useState(false);
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  const [filtroFinanceiroStatus, setFiltroFinanceiroStatus] = useState('todos');
  const [filtroFinanceiroPeriodo, setFiltroFinanceiroPeriodo] = useState('mes');
  const [filtroFinanceiroBusca, setFiltroFinanceiroBusca] = useState('');
  const [filtroFinanceiroOrdem, setFiltroFinanceiroOrdem] = useState('data_desc');
  const [filtroFinanceiroInicio, setFiltroFinanceiroInicio] = useState('');
  const [filtroFinanceiroFim, setFiltroFinanceiroFim] = useState('');

  const hostname = window.location.hostname;
  const isLocalHost = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';

  useEffect(() => {
    if (!isLocalHost) {
      return;
    }

    let ativo = true;

    async function validarSessaoAdmin() {
      setCarregando(true);
      setErro('');

      try {
        const data = await adminGetMe();
        if (!ativo) {
          return;
        }

        setAdminAutenticado(true);
        if (data?.admin?.usuario) {
          setAdminUsuario(String(data.admin.usuario));
        }
      } catch (error) {
        if (!ativo) {
          return;
        }

        setAdminAutenticado(false);
        if (!isAuthErrorMessage(error.message)) {
          setErro(error.message);
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    validarSessaoAdmin();

    return () => {
      ativo = false;
    };
  }, [isLocalHost]);

  useEffect(() => {
    if (adminAutenticado === true && isLocalHost) {
      carregarTudo();
    }
  }, [adminAutenticado, isLocalHost]);

  async function carregarTudo() {
    if (adminAutenticado !== true) {
      return;
    }

    setCarregando(true);
    setErro('');
    try {
      const [pedidosData, produtosData] = await Promise.all([
        adminGetPedidos(),
        getProdutos()
      ]);
      const pedidosList = pedidosData.pedidos || [];
      setPedidos(pedidosList);
      setProdutos(produtosData.produtos || []);

      const draft = {};
      pedidosList.forEach((pedido) => {
        draft[pedido.id] = pedido.status;
      });
      setStatusDraft(draft);
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAdminAutenticado(false);
        setPedidos([]);
        setProdutos([]);
      }
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  async function handleAdminLogin(event) {
    event.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const data = await adminLogin(adminUsuario.trim(), adminSenha);
      setAdminAutenticado(true);
      if (data?.usuario) {
        setAdminUsuario(String(data.usuario));
      }
      setAdminSenha('');
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  async function handleAdminLogout() {
    setErro('');
    setCarregando(true);
    try {
      await adminLogout();
    } catch (error) {
      if (!isAuthErrorMessage(error.message)) {
        setErro(error.message);
      }
    } finally {
      setCarregando(false);
    }

    setAdminAutenticado(false);
    setAdminSenha('');
    setPedidos([]);
    setProdutos([]);
  }

  const kpis = useMemo(() => {
    const total = pedidos.length;
    const pendentes = pedidos.filter((pedido) => pedido.status === 'pendente').length;
    const emEntrega = pedidos.filter((pedido) => pedido.status === 'enviado').length;
    const faturamento = pedidos
      .filter((pedido) => pedido.status !== 'cancelado')
      .reduce((acc, pedido) => acc + Number(pedido.total || 0), 0);

    return { total, pendentes, emEntrega, faturamento };
  }, [pedidos]);

  const financeiro = useMemo(() => {
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    const pedidosComData = pedidos.map((pedido) => {
      const dataRaw = pedido.criado_em || pedido.data_pedido || null;
      const data = dataRaw ? new Date(dataRaw) : null;
      const total = Number(pedido.total || 0);
      return { ...pedido, _data: data, _total: total };
    });

    const pedidosValidos = pedidosComData.filter((pedido) => pedido.status !== 'cancelado');
    const pedidosHoje = pedidosValidos.filter((pedido) => pedido._data && pedido._data >= inicioHoje);
    const pedidosMes = pedidosValidos.filter((pedido) => pedido._data && pedido._data >= inicioMes);
    const pedidosCancelados = pedidosComData.filter((pedido) => pedido.status === 'cancelado');
    const pendentes = pedidosComData.filter((pedido) => pedido.status === 'pendente');

    const faturamentoTotal = pedidosValidos.reduce((acc, pedido) => acc + pedido._total, 0);
    const faturamentoHoje = pedidosHoje.reduce((acc, pedido) => acc + pedido._total, 0);
    const faturamentoMes = pedidosMes.reduce((acc, pedido) => acc + pedido._total, 0);
    const ticketMedio = pedidosValidos.length > 0 ? faturamentoTotal / pedidosValidos.length : 0;

    return {
      pedidosComData,
      faturamentoTotal,
      faturamentoHoje,
      faturamentoMes,
      ticketMedio,
      canceladosTotal: pedidosCancelados.reduce((acc, pedido) => acc + pedido._total, 0),
      pendentesTotal: pendentes.reduce((acc, pedido) => acc + pedido._total, 0)
    };
  }, [pedidos]);

  const linhasFinanceiro = useMemo(() => {
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const inicioSemana = new Date(inicioHoje);
    inicioSemana.setDate(inicioHoje.getDate() - 6);
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    const textoBusca = filtroFinanceiroBusca.trim().toLowerCase();

    const resultado = financeiro.pedidosComData.filter((pedido) => {
      if (filtroFinanceiroStatus !== 'todos' && pedido.status !== filtroFinanceiroStatus) {
        return false;
      }

      if (filtroFinanceiroPeriodo === 'hoje') {
        if (!pedido._data || pedido._data < inicioHoje) {
          return false;
        }
      }

      if (filtroFinanceiroPeriodo === 'semana') {
        if (!pedido._data || pedido._data < inicioSemana) {
          return false;
        }
      }

      if (filtroFinanceiroPeriodo === 'mes') {
        if (!pedido._data || pedido._data < inicioMes) {
          return false;
        }
      }

      if (filtroFinanceiroPeriodo === 'custom') {
        const inicio = filtroFinanceiroInicio ? new Date(`${filtroFinanceiroInicio}T00:00:00`) : null;
        const fim = filtroFinanceiroFim ? new Date(`${filtroFinanceiroFim}T23:59:59`) : null;
        if (inicio && (!pedido._data || pedido._data < inicio)) {
          return false;
        }
        if (fim && (!pedido._data || pedido._data > fim)) {
          return false;
        }
      }

      if (textoBusca) {
        const cliente = String(pedido.cliente_nome || '').toLowerCase();
        const idPedido = String(pedido.id || '');
        if (!cliente.includes(textoBusca) && !idPedido.includes(textoBusca)) {
          return false;
        }
      }

      return true;
    });

    return resultado.sort((a, b) => {
      if (filtroFinanceiroOrdem === 'valor_desc') {
        return Number(b._total || 0) - Number(a._total || 0);
      }
      if (filtroFinanceiroOrdem === 'valor_asc') {
        return Number(a._total || 0) - Number(b._total || 0);
      }
      if (filtroFinanceiroOrdem === 'data_asc') {
        return (a._data?.getTime() || 0) - (b._data?.getTime() || 0);
      }
      return (b._data?.getTime() || 0) - (a._data?.getTime() || 0);
    });
  }, [
    financeiro.pedidosComData,
    filtroFinanceiroStatus,
    filtroFinanceiroPeriodo,
    filtroFinanceiroBusca,
    filtroFinanceiroOrdem,
    filtroFinanceiroInicio,
    filtroFinanceiroFim
  ]);

  const resumoFinanceiroFiltrado = useMemo(() => {
    const validos = linhasFinanceiro.filter((pedido) => pedido.status !== 'cancelado');
    const total = validos.reduce((acc, pedido) => acc + Number(pedido._total || 0), 0);
    const ticket = validos.length ? total / validos.length : 0;
    return {
      quantidade: linhasFinanceiro.length,
      faturamento: total,
      ticket
    };
  }, [linhasFinanceiro]);

  async function salvarStatusPedido(pedidoId) {
    const status = statusDraft[pedidoId];
    if (!status) {
      return;
    }

    try {
      await adminAtualizarStatusPedido(pedidoId, status);
      await carregarTudo();
    } catch (error) {
      setErro(error.message);
    }
  }

  async function handleCadastrarProduto(event) {
    event.preventDefault();
    setErro('');

    if (!produtoForm.nome || !produtoForm.preco || !produtoForm.categoria) {
      setErro('Preencha nome, preço e categoria do produto.');
      return;
    }

    setSalvandoProduto(true);
    try {
      await adminCadastrarProduto({
        codigo_barras: produtoForm.codigo_barras.trim(),
        nome: produtoForm.nome.trim(),
        descricao: produtoForm.descricao.trim(),
        marca: produtoForm.marca.trim(),
        imagem: produtoForm.imagem.trim(),
        preco: Number(produtoForm.preco),
        unidade: produtoForm.unidade.trim() || 'un',
        categoria: produtoForm.categoria.trim(),
        emoji: produtoForm.emoji.trim() || '📦',
        estoque: Number(produtoForm.estoque || 0)
      });

      setProdutoForm(initialProduto);
      await carregarTudo();
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvandoProduto(false);
    }
  }

  async function handleExcluirProduto(produtoId) {
    const ok = window.confirm('Deseja realmente excluir este produto?');
    if (!ok) {
      return;
    }

    setErro('');
    try {
      await adminExcluirProduto(produtoId);
      await carregarTudo();
    } catch (error) {
      setErro(error.message);
    }
  }

  async function handleBuscarProdutoPorCodigoBarras() {
    setErro('');
    const codigo = String(produtoForm.codigo_barras || '').replace(/\D/g, '');

    if (codigo.length < 8) {
      setErro('Informe um código de barras válido (mínimo 8 dígitos).');
      return;
    }

    setBuscandoCodigo(true);
    try {
      const data = await adminBuscarProdutoPorCodigoBarras(codigo);
      const produto = data?.produto || {};
      setProdutoForm((atual) => ({
        ...atual,
        codigo_barras: produto.codigo_barras || codigo,
        nome: produto.nome || atual.nome,
        descricao: produto.descricao || atual.descricao,
        marca: produto.marca || atual.marca,
        imagem: produto.imagem || atual.imagem,
        categoria: produto.categoria || atual.categoria,
        emoji: produto.emoji || atual.emoji
      }));
    } catch (error) {
      setErro(error.message);
    } finally {
      setBuscandoCodigo(false);
    }
  }

  function exportarFinanceiroCsv() {
    const linhas = [
      ['Pedido', 'Data', 'Cliente', 'Status', 'Pagamento', 'Valor']
    ];

    linhasFinanceiro.forEach((pedido) => {
      const data = pedido._data ? pedido._data.toLocaleString('pt-BR') : '-';
      linhas.push([
        `#${pedido.id}`,
        data,
        pedido.cliente_nome || '-',
        pedido.status || '-',
        pedido.forma_pagamento || 'pix',
        Number(pedido._total || 0).toFixed(2)
      ]);
    });

    const csv = linhas.map((linha) => linha.map((campo) => `"${String(campo).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `financeiro_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (!isLocalHost) {
    return (
      <section className="page">
        <h1>Admin</h1>
        <p>Acesso administrativo disponível apenas no computador da loja.</p>
      </section>
    );
  }

  if (adminAutenticado !== true) {
    return (
      <section className="page">
        <h1>Login Admin</h1>
        <p>Este painel funciona somente localmente e exige credenciais administrativas.</p>

        <form className="form-box" onSubmit={handleAdminLogin}>
          <label className="field-label" htmlFor="admin-usuario">Usuário</label>
          <input
            id="admin-usuario"
            className="field-input"
            value={adminUsuario}
            onChange={(event) => setAdminUsuario(event.target.value)}
            required
          />

          <label className="field-label" htmlFor="admin-senha">Senha</label>
          <input
            id="admin-senha"
            className="field-input"
            type="password"
            value={adminSenha}
            onChange={(event) => setAdminSenha(event.target.value)}
            required
          />

          {erro ? <p className="error-text">{erro}</p> : null}

          <button className="btn-primary" type="submit" disabled={carregando}>
            {carregando ? 'Processando...' : 'Entrar no Admin'}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>Painel Admin (React)</h1>
      <p>Gestão de pedidos e produtos usando API Node/Express.</p>

      <div className="admin-kpis">
        <div className="kpi-card"><strong>Pedidos:</strong> {kpis.total}</div>
        <div className="kpi-card"><strong>Pendentes:</strong> {kpis.pendentes}</div>
        <div className="kpi-card"><strong>Em entrega:</strong> {kpis.emEntrega}</div>
        <div className="kpi-card"><strong>Faturamento:</strong> R$ {kpis.faturamento.toFixed(2)}</div>
      </div>

      <div className="auth-switch" style={{ marginTop: '1rem' }}>
        <button
          type="button"
          className={`auth-switch-btn ${tab === 'pedidos' ? 'active' : ''}`}
          onClick={() => setTab('pedidos')}
        >
          Pedidos
        </button>
        <button
          type="button"
          className={`auth-switch-btn ${tab === 'produtos' ? 'active' : ''}`}
          onClick={() => setTab('produtos')}
        >
          Produtos
        </button>
        <button
          type="button"
          className={`auth-switch-btn ${tab === 'financeiro' ? 'active' : ''}`}
          onClick={() => setTab('financeiro')}
        >
          Financeiro
        </button>
      </div>

      <button className="btn-primary" type="button" style={{ marginTop: '0.8rem' }} onClick={() => carregarTudo()} disabled={carregando}>
        {carregando ? 'Atualizando...' : 'Atualizar painel'}
      </button>
      <button className="btn-secondary" type="button" style={{ marginTop: '0.8rem', marginLeft: '0.5rem' }} onClick={handleAdminLogout}>
        Sair do Admin
      </button>

      {erro ? <p className="error-text">{erro}</p> : null}

      {tab === 'pedidos' ? (
        <div className="table-wrap" style={{ marginTop: '1rem' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Status</th>
                <th>Data</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.length === 0 ? (
                <tr>
                  <td colSpan={6}>Nenhum pedido encontrado.</td>
                </tr>
              ) : (
                pedidos.map((pedido) => (
                  <tr key={pedido.id}>
                    <td>#{pedido.id}</td>
                    <td>{pedido.cliente_nome || '-'}</td>
                    <td>R$ {Number(pedido.total || 0).toFixed(2)}</td>
                    <td>
                      <select
                        className="field-input"
                        value={statusDraft[pedido.id] || pedido.status}
                        onChange={(event) =>
                          setStatusDraft((atual) => ({
                            ...atual,
                            [pedido.id]: event.target.value
                          }))
                        }
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td>{new Date(pedido.criado_em || pedido.data_pedido).toLocaleString('pt-BR')}</td>
                    <td>
                      <button className="btn-secondary" type="button" onClick={() => salvarStatusPedido(pedido.id)}>
                        Salvar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : tab === 'produtos' ? (
        <>
          <form className="form-box" style={{ marginTop: '1rem' }} onSubmit={handleCadastrarProduto}>
            <p><strong>Novo produto</strong></p>
            <div className="barcode-row">
              <input
                className="field-input"
                placeholder="Código de barras (EAN)"
                value={produtoForm.codigo_barras}
                onChange={(event) => setProdutoForm((atual) => ({ ...atual, codigo_barras: event.target.value }))}
              />
              <button
                className="btn-secondary"
                type="button"
                disabled={buscandoCodigo}
                onClick={handleBuscarProdutoPorCodigoBarras}
              >
                {buscandoCodigo ? 'Buscando...' : 'Buscar por código'}
              </button>
            </div>
            <input
              className="field-input"
              placeholder="Nome"
              value={produtoForm.nome}
              onChange={(event) => setProdutoForm((atual) => ({ ...atual, nome: event.target.value }))}
            />
            <textarea
              className="field-input"
              placeholder="Descrição"
              rows={3}
              value={produtoForm.descricao}
              onChange={(event) => setProdutoForm((atual) => ({ ...atual, descricao: event.target.value }))}
            />
            <input
              className="field-input"
              placeholder="Marca"
              value={produtoForm.marca}
              onChange={(event) => setProdutoForm((atual) => ({ ...atual, marca: event.target.value }))}
            />
            <input
              className="field-input"
              placeholder="URL da imagem"
              value={produtoForm.imagem}
              onChange={(event) => setProdutoForm((atual) => ({ ...atual, imagem: event.target.value }))}
            />
            {produtoForm.imagem ? (
              <img
                className="produto-preview-image"
                src={produtoForm.imagem}
                alt="Prévia do produto"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            <input
              className="field-input"
              placeholder="Preço"
              type="number"
              step="0.01"
              min="0"
              value={produtoForm.preco}
              onChange={(event) => setProdutoForm((atual) => ({ ...atual, preco: event.target.value }))}
            />
            <input
              className="field-input"
              placeholder="Categoria"
              value={produtoForm.categoria}
              onChange={(event) => setProdutoForm((atual) => ({ ...atual, categoria: event.target.value }))}
            />
            <div className="toolbar-box">
              <input
                className="field-input"
                placeholder="Unidade (ex: un, kg)"
                value={produtoForm.unidade}
                onChange={(event) => setProdutoForm((atual) => ({ ...atual, unidade: event.target.value }))}
              />
              <input
                className="field-input"
                placeholder="Emoji"
                value={produtoForm.emoji}
                onChange={(event) => setProdutoForm((atual) => ({ ...atual, emoji: event.target.value }))}
              />
              <input
                className="field-input"
                placeholder="Estoque"
                type="number"
                min="0"
                value={produtoForm.estoque}
                onChange={(event) => setProdutoForm((atual) => ({ ...atual, estoque: event.target.value }))}
              />
            </div>

            <button className="btn-primary" type="submit" disabled={salvandoProduto}>
              {salvandoProduto ? 'Salvando...' : 'Cadastrar produto'}
            </button>
          </form>

          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Preço</th>
                  <th>Estoque</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {produtos.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Nenhum produto cadastrado.</td>
                  </tr>
                ) : (
                  produtos.map((produto) => (
                    <tr key={produto.id}>
                      <td>{produto.id}</td>
                      <td>{produto.emoji || '📦'} {produto.nome}</td>
                      <td>{produto.categoria || '-'}</td>
                      <td>R$ {Number(produto.preco || 0).toFixed(2)}</td>
                      <td>{produto.estoque ?? 0}</td>
                      <td>
                        <button className="btn-secondary" type="button" onClick={() => handleExcluirProduto(produto.id)}>
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="admin-kpis" style={{ marginTop: '1rem' }}>
            <div className="kpi-card"><strong>Faturamento total:</strong> R$ {financeiro.faturamentoTotal.toFixed(2)}</div>
            <div className="kpi-card"><strong>Faturamento hoje:</strong> R$ {financeiro.faturamentoHoje.toFixed(2)}</div>
            <div className="kpi-card"><strong>Faturamento mês:</strong> R$ {financeiro.faturamentoMes.toFixed(2)}</div>
            <div className="kpi-card"><strong>Ticket médio:</strong> R$ {financeiro.ticketMedio.toFixed(2)}</div>
            <div className="kpi-card"><strong>Pendentes:</strong> R$ {financeiro.pendentesTotal.toFixed(2)}</div>
            <div className="kpi-card"><strong>Cancelados:</strong> R$ {financeiro.canceladosTotal.toFixed(2)}</div>
          </div>

          <div className="admin-kpis" style={{ marginTop: '0.7rem' }}>
            <div className="kpi-card"><strong>Pedidos filtrados:</strong> {resumoFinanceiroFiltrado.quantidade}</div>
            <div className="kpi-card"><strong>Faturamento filtrado:</strong> R$ {resumoFinanceiroFiltrado.faturamento.toFixed(2)}</div>
            <div className="kpi-card"><strong>Ticket filtrado:</strong> R$ {resumoFinanceiroFiltrado.ticket.toFixed(2)}</div>
          </div>

          <div className="financeiro-actions">
            <select
              className="field-input"
              value={filtroFinanceiroPeriodo}
              onChange={(event) => setFiltroFinanceiroPeriodo(event.target.value)}
            >
              <option value="hoje">Hoje</option>
              <option value="semana">Últimos 7 dias</option>
              <option value="mes">Mês atual</option>
              <option value="todos">Todo período</option>
              <option value="custom">Período personalizado</option>
            </select>

            <select
              className="field-input"
              value={filtroFinanceiroStatus}
              onChange={(event) => setFiltroFinanceiroStatus(event.target.value)}
            >
              <option value="todos">Todos os status</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            <select
              className="field-input"
              value={filtroFinanceiroOrdem}
              onChange={(event) => setFiltroFinanceiroOrdem(event.target.value)}
            >
              <option value="data_desc">Data mais recente</option>
              <option value="data_asc">Data mais antiga</option>
              <option value="valor_desc">Maior valor</option>
              <option value="valor_asc">Menor valor</option>
            </select>

            <input
              className="field-input"
              placeholder="Buscar cliente ou #pedido"
              value={filtroFinanceiroBusca}
              onChange={(event) => setFiltroFinanceiroBusca(event.target.value)}
            />

            <button className="btn-secondary" type="button" onClick={exportarFinanceiroCsv}>
              Exportar CSV
            </button>
          </div>

          {filtroFinanceiroPeriodo === 'custom' ? (
            <div className="financeiro-actions" style={{ marginTop: '0.5rem' }}>
              <input
                className="field-input"
                type="date"
                value={filtroFinanceiroInicio}
                onChange={(event) => setFiltroFinanceiroInicio(event.target.value)}
              />
              <input
                className="field-input"
                type="date"
                value={filtroFinanceiroFim}
                onChange={(event) => setFiltroFinanceiroFim(event.target.value)}
              />
            </div>
          ) : null}

          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Pagamento</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {linhasFinanceiro.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Nenhum registro financeiro encontrado.</td>
                  </tr>
                ) : (
                  linhasFinanceiro.map((pedido) => (
                    <tr key={pedido.id}>
                      <td>#{pedido.id}</td>
                      <td>{pedido._data ? pedido._data.toLocaleString('pt-BR') : '-'}</td>
                      <td>{pedido.cliente_nome || '-'}</td>
                      <td>{pedido.status || '-'}</td>
                      <td>{pedido.forma_pagamento || 'pix'}</td>
                      <td>R$ {Number(pedido._total || 0).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}