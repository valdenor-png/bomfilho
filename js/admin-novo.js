// ========== CONFIGURAÇÃO ==========
const API_BASE = (typeof API_CONFIG !== 'undefined' && API_CONFIG && API_CONFIG.baseURL)
    ? API_CONFIG.baseURL
    : 'http://localhost:3000/api';
let dadosCache = {
    pedidos: [],
    clientes: [],
    produtos: []
};

// ========== NAVEGAÇÃO ==========
function navegarPara(secao) {
    // Atualizar nav-items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.nav-item').classList.add('active');
    
    // Mostrar seção
    document.querySelectorAll('.secao').forEach(s => {
        s.classList.remove('active');
    });
    document.getElementById('secao-' + secao).classList.add('active');
    
    // Atualizar título
    const titulos = {
        'dashboard': 'Dashboard',
        'pedidos': 'Pedidos',
        'clientes': 'Clientes',
        'produtos': 'Produtos',
        'financeiro': 'Financeiro'
    };
    document.querySelector('.page-title').textContent = titulos[secao];
    
    // Carregar dados
    carregarSecao(secao);
}

function carregarSecao(secao) {
    switch(secao) {
        case 'dashboard': carregarDashboard(); break;
        case 'pedidos': carregarPedidos(); break;
        case 'clientes': carregarClientes(); break;
        case 'produtos': carregarProdutos(); break;
        case 'financeiro': carregarFinanceiro(); break;
    }
}

// ========== DASHBOARD ==========
async function carregarDashboard() {
    try {
        const pedidos = await fetch(`${API_BASE}/pedidos`).then(r => r.json());
        const produtos = await fetch(`${API_BASE}/produtos`).then(r => r.json());
        
        // Calcular KPIs
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const pedidosHoje = pedidos.filter(p => {
            const data = new Date(p.data_pedido);
            return data.toDateString() === hoje.toDateString();
        });
        const pedidosMes = pedidos.filter(p => {
            const data = new Date(p.data_pedido);
            return data >= inicioMes;
        });
        
        const vendasHoje = pedidosHoje.reduce((sum, p) => sum + parseFloat(p.valor_total || 0), 0);
        const vendasMes = pedidosMes.reduce((sum, p) => sum + parseFloat(p.valor_total || 0), 0);
        const ticketMedio = pedidosMes.length > 0 ? vendasMes / pedidosMes.length : 0;
        
        // Atualizar valores
        document.getElementById('vendas-hoje').textContent = `R$ ${vendasHoje.toFixed(2)}`;
        document.getElementById('pedidos-hoje').textContent = pedidosHoje.length;
        document.getElementById('ticket-medio').textContent = `R$ ${ticketMedio.toFixed(2)}`;
        document.getElementById('produtos-ativos').textContent = produtos.length;
        
        // Pedidos recentes
        const recentes = pedidos.slice(0, 5);
        const tbody = document.getElementById('pedidos-recentes');
        tbody.innerHTML = recentes.map(p => `
            <tr>
                <td>#${p.id}</td>
                <td>${p.nome_cliente || '-'}</td>
                <td>R$ ${parseFloat(p.valor_total || 0).toFixed(2)}</td>
                <td><span class="status-badge status-${p.status}">${p.status}</span></td>
                <td>${new Date(p.data_pedido).toLocaleDateString('pt-BR')}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

// ========== PEDIDOS ==========
async function carregarPedidos() {
    try {
        const response = await fetch(`${API_BASE}/pedidos`);
        dadosCache.pedidos = await response.json();
        renderizarPedidos(dadosCache.pedidos);
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        document.getElementById('tabela-pedidos').innerHTML = `
            <tr><td colspan="6" class="empty-state">Erro ao carregar pedidos</td></tr>
        `;
    }
}

function renderizarPedidos(pedidos) {
    const tbody = document.getElementById('tabela-pedidos');
    if (pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum pedido encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = pedidos.map(p => `
        <tr onclick="verDetalhesPedido(${p.id})">
            <td>#${p.id}</td>
            <td>${p.nome_cliente || '-'}</td>
            <td>${new Date(p.data_pedido).toLocaleDateString('pt-BR')} ${new Date(p.data_pedido).toLocaleTimeString('pt-BR')}</td>
            <td>R$ ${parseFloat(p.valor_total || 0).toFixed(2)}</td>
            <td><span class="status-badge status-${p.status}">${p.status}</span></td>
            <td>
                <button class="btn-secondary" onclick="event.stopPropagation(); alterarStatusPedido(${p.id})">Alterar Status</button>
            </td>
        </tr>
    `).join('');
}

function filtrarPedidos() {
    const status = document.getElementById('filtro-status').value;
    const busca = document.getElementById('busca-pedidos').value.toLowerCase();
    
    let filtrados = dadosCache.pedidos;
    
    if (status) {
        filtrados = filtrados.filter(p => p.status === status);
    }
    
    if (busca) {
        filtrados = filtrados.filter(p => 
            p.id.toString().includes(busca) ||
            (p.nome_cliente && p.nome_cliente.toLowerCase().includes(busca))
        );
    }
    
    renderizarPedidos(filtrados);
}

async function verDetalhesPedido(id) {
    try {
        const response = await fetch(`${API_BASE}/pedidos/${id}`);
        const pedido = await response.json();
        
        const modal = document.getElementById('modal-pedido');
        document.getElementById('detalhe-pedido-id').textContent = `#${pedido.id}`;
        document.getElementById('detalhe-cliente').textContent = pedido.nome_cliente || '-';
        document.getElementById('detalhe-telefone').textContent = pedido.telefone_cliente || '-';
        document.getElementById('detalhe-endereco').textContent = pedido.endereco_entrega || '-';
        document.getElementById('detalhe-data').textContent = new Date(pedido.data_pedido).toLocaleString('pt-BR');
        document.getElementById('detalhe-status').innerHTML = `<span class="status-badge status-${pedido.status}">${pedido.status}</span>`;
        document.getElementById('detalhe-total').textContent = `R$ ${parseFloat(pedido.valor_total || 0).toFixed(2)}`;
        
        // Itens
        const itens = JSON.parse(pedido.itens || '[]');
        document.getElementById('detalhe-itens').innerHTML = itens.map(item => `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
                <span>${item.quantidade}x ${item.nome}</span>
                <span>R$ ${(item.preco * item.quantidade).toFixed(2)}</span>
            </div>
        `).join('');
        
        modal.classList.add('show');
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        alert('Erro ao carregar detalhes do pedido');
    }
}

async function alterarStatusPedido(id) {
    const novoStatus = prompt('Digite o novo status:\npendente, pago, preparando, enviado, entregue, cancelado');
    if (!novoStatus) return;
    
    const statusValidos = ['pendente', 'pago', 'preparando', 'enviado', 'entregue', 'cancelado'];
    if (!statusValidos.includes(novoStatus)) {
        alert('Status inválido!');
        return;
    }
    
    try {
        await fetch(`${API_BASE}/pedidos/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: novoStatus })
        });
        alert('Status atualizado!');
        carregarPedidos();
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        alert('Erro ao alterar status');
    }
}

// ========== CLIENTES ==========
async function carregarClientes() {
    try {
        const response = await fetch(`${API_BASE}/usuarios`);
        dadosCache.clientes = await response.json();
        renderizarClientes(dadosCache.clientes);
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        document.getElementById('tabela-clientes').innerHTML = `
            <tr><td colspan="5" class="empty-state">Erro ao carregar clientes</td></tr>
        `;
    }
}

function renderizarClientes(clientes) {
    const tbody = document.getElementById('tabela-clientes');
    if (clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum cliente encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = clientes.map(c => `
        <tr>
            <td>${c.id}</td>
            <td>${c.nome}</td>
            <td>${c.email}</td>
            <td>${c.telefone || '-'}</td>
            <td>${new Date(c.data_cadastro).toLocaleDateString('pt-BR')}</td>
        </tr>
    `).join('');
}

function filtrarClientes() {
    const busca = document.getElementById('busca-clientes').value.toLowerCase();
    const filtrados = dadosCache.clientes.filter(c => 
        c.nome.toLowerCase().includes(busca) ||
        c.email.toLowerCase().includes(busca)
    );
    renderizarClientes(filtrados);
}

// ========== PRODUTOS ==========
async function carregarProdutos() {
    try {
        const response = await fetch(`${API_BASE}/produtos`);
        dadosCache.produtos = await response.json();
        renderizarProdutos(dadosCache.produtos);
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        document.getElementById('grid-produtos').innerHTML = `
            <div class="empty-state">Erro ao carregar produtos</div>
        `;
    }
}

function renderizarProdutos(produtos) {
    const grid = document.getElementById('grid-produtos');
    if (produtos.length === 0) {
        grid.innerHTML = '<div class="empty-state">Nenhum produto encontrado</div>';
        return;
    }
    
    grid.innerHTML = produtos.map(p => `
        <div class="product-card">
            <img src="${p.imagem || 'img/placeholder.jpg'}" class="product-img" alt="${p.nome}">
            <div class="product-name">${p.nome}</div>
            <div class="product-price">R$ ${parseFloat(p.preco).toFixed(2)}</div>
            <div class="product-stock">Estoque: ${p.estoque || 0}</div>
            <button class="btn-secondary" style="width: 100%; margin-top: 8px;" onclick="editarProduto(${p.id})">Editar</button>
        </div>
    `).join('');
}

function filtrarProdutos() {
    const busca = document.getElementById('busca-produtos').value.toLowerCase();
    const filtrados = dadosCache.produtos.filter(p => 
        p.nome.toLowerCase().includes(busca) ||
        (p.descricao && p.descricao.toLowerCase().includes(busca))
    );
    renderizarProdutos(filtrados);
}

function novoProduto() {
    document.getElementById('form-produto').reset();
    document.getElementById('produto-id').value = '';
    document.getElementById('modal-produto').classList.add('show');
}

async function editarProduto(id) {
    try {
        const produto = dadosCache.produtos.find(p => p.id === id);
        if (!produto) return;
        
        document.getElementById('produto-id').value = produto.id;
        document.getElementById('produto-nome').value = produto.nome;
        document.getElementById('produto-preco').value = produto.preco;
        document.getElementById('produto-estoque').value = produto.estoque || 0;
        document.getElementById('produto-descricao').value = produto.descricao || '';
        document.getElementById('produto-categoria').value = produto.categoria || '';
        
        document.getElementById('modal-produto').classList.add('show');
    } catch (error) {
        console.error('Erro ao editar produto:', error);
    }
}

async function salvarProduto() {
    const id = document.getElementById('produto-id').value;
    const dados = {
        nome: document.getElementById('produto-nome').value,
        preco: document.getElementById('produto-preco').value,
        estoque: document.getElementById('produto-estoque').value,
        descricao: document.getElementById('produto-descricao').value,
        categoria: document.getElementById('produto-categoria').value
    };
    
    if (!dados.nome || !dados.preco) {
        alert('Preencha nome e preço!');
        return;
    }
    
    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/produtos/${id}` : `${API_BASE}/produtos`;
        
        await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        alert('Produto salvo!');
        fecharModal('modal-produto');
        carregarProdutos();
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        alert('Erro ao salvar produto');
    }
}

// ========== FINANCEIRO ==========
async function carregarFinanceiro() {
    try {
        const response = await fetch(`${API_BASE}/pedidos`);
        const pedidos = await response.json();
        
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        
        // Faturamento total
        const totalGeral = pedidos
            .filter(p => p.status !== 'cancelado')
            .reduce((sum, p) => sum + parseFloat(p.valor_total || 0), 0);
        
        // Faturamento do mês
        const totalMes = pedidos
            .filter(p => {
                const data = new Date(p.data_pedido);
                return data >= inicioMes && p.status !== 'cancelado';
            })
            .reduce((sum, p) => sum + parseFloat(p.valor_total || 0), 0);
        
        // Pendentes
        const totalPendente = pedidos
            .filter(p => p.status === 'pendente')
            .reduce((sum, p) => sum + parseFloat(p.valor_total || 0), 0);
        
        // Cancelados
        const totalCancelado = pedidos
            .filter(p => p.status === 'cancelado')
            .reduce((sum, p) => sum + parseFloat(p.valor_total || 0), 0);
        
        document.getElementById('faturamento-total').textContent = `R$ ${totalGeral.toFixed(2)}`;
        document.getElementById('faturamento-mes').textContent = `R$ ${totalMes.toFixed(2)}`;
        document.getElementById('valores-pendentes').textContent = `R$ ${totalPendente.toFixed(2)}`;
        document.getElementById('valores-cancelados').textContent = `R$ ${totalCancelado.toFixed(2)}`;
        
        // Tabela de transações
        const tbody = document.getElementById('tabela-financeiro');
        tbody.innerHTML = pedidos.slice(0, 50).map(p => `
            <tr>
                <td>#${p.id}</td>
                <td>${new Date(p.data_pedido).toLocaleDateString('pt-BR')}</td>
                <td>${p.nome_cliente || '-'}</td>
                <td>R$ ${parseFloat(p.valor_total || 0).toFixed(2)}</td>
                <td><span class="status-badge status-${p.status}">${p.status}</span></td>
                <td>${p.forma_pagamento || 'PIX'}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar financeiro:', error);
    }
}

function exportarFinanceiro() {
    try {
        const linhas = [['ID', 'Data', 'Cliente', 'Valor', 'Status', 'Pagamento']];
        dadosCache.pedidos.forEach(p => {
            linhas.push([
                p.id,
                new Date(p.data_pedido).toLocaleDateString('pt-BR'),
                p.nome_cliente || '-',
                parseFloat(p.valor_total || 0).toFixed(2),
                p.status,
                p.forma_pagamento || 'PIX'
            ]);
        });
        
        const csv = linhas.map(l => l.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financeiro_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    } catch (error) {
        console.error('Erro ao exportar:', error);
        alert('Erro ao exportar dados');
    }
}

// ========== UTILITÁRIOS ==========
function fecharModal(id) {
    document.getElementById(id).classList.remove('show');
}

function atualizar() {
    const secaoAtiva = document.querySelector('.secao.active').id.replace('secao-', '');
    carregarSecao(secaoAtiva);
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('show');
}

// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', () => {
    carregarDashboard();
    
    // Fechar modais ao clicar fora
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
});
