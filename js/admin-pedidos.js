// ========== CONFIGURAÇÃO ==========
const API_BASE_URL = (typeof API_CONFIG !== 'undefined' && API_CONFIG && API_CONFIG.baseURL)
    ? API_CONFIG.baseURL
    : 'http://localhost:3000/api';

let pedidos = [];
let pedidoAtual = null;

// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', () => {
    carregarPedidos();
    
    // Atualizar automaticamente a cada 30 segundos
    setInterval(carregarPedidos, 30000);
});

// ========== CARREGAR PEDIDOS ==========
async function carregarPedidos() {
    try {
        const response = await fetch(`${API_BASE_URL}/pedidos`);
        
        if (!response.ok) {
            throw new Error('Erro ao carregar pedidos');
        }
        
        pedidos = await response.json();
        
        atualizarDashboard();
        renderizarPedidos();
        
    } catch (error) {
        console.error('Erro:', error);
        mostrarErro('Erro ao carregar pedidos. Verifique se o servidor está rodando.');
    }
}

// ========== ATUALIZAR DASHBOARD ==========
function atualizarDashboard() {
    const hoje = new Date().toISOString().split('T')[0];
    
    const pendentes = pedidos.filter(p => p.status === 'pendente').length;
    const pagos = pedidos.filter(p => p.status === 'pago').length;
    const enviados = pedidos.filter(p => p.status === 'enviado').length;
    
    const faturamentoHoje = pedidos
        .filter(p => p.data_pedido && p.data_pedido.startsWith(hoje) && p.status !== 'cancelado')
        .reduce((total, p) => total + parseFloat(p.total || 0), 0);
    
    document.getElementById('totalPedidos').textContent = pedidos.length;
    document.getElementById('pedidosPendentes').textContent = pendentes;
    document.getElementById('pedidosPagos').textContent = pagos;
    document.getElementById('pedidosEnviados').textContent = enviados;
    document.getElementById('faturamentoTotal').textContent = `R$ ${faturamentoHoje.toFixed(2)}`;
}

// ========== RENDERIZAR PEDIDOS ==========
function renderizarPedidos(lista = pedidos) {
    const tbody = document.getElementById('tabelaPedidos');
    
    if (lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px;">
                    <p style="color: #999;">Nenhum pedido encontrado</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = lista.map(pedido => `
        <tr>
            <td><strong>#${pedido.id}</strong></td>
            <td>${formatarDataHora(pedido.data_pedido)}</td>
            <td>${pedido.nome_completo || 'N/A'}</td>
            <td>${contarItens(pedido)}</td>
            <td><strong>R$ ${parseFloat(pedido.total || 0).toFixed(2)}</strong></td>
            <td><span class="status-badge status-${pedido.status}">${formatarStatus(pedido.status)}</span></td>
            <td>${formatarMetodoPagamento(pedido.metodo_pagamento)}</td>
            <td>
                <button class="btn-ver" onclick="abrirDetalhes(${pedido.id})">
                    👁️ Ver
                </button>
            </td>
        </tr>
    `).join('');
}

// ========== ABRIR DETALHES DO PEDIDO ==========
async function abrirDetalhes(pedidoId) {
    try {
        const response = await fetch(`${API_BASE_URL}/pedidos/${pedidoId}`);
        
        if (!response.ok) {
            throw new Error('Erro ao carregar detalhes');
        }
        
        pedidoAtual = await response.json();
        
        // Preencher modal
        document.getElementById('modalPedidoId').textContent = pedidoAtual.id;
        document.getElementById('detNome').textContent = pedidoAtual.nome_completo || 'N/A';
        document.getElementById('detEmail').textContent = pedidoAtual.email || 'N/A';
        document.getElementById('detTelefone').textContent = pedidoAtual.telefone || 'N/A';
        
        // Endereço
        const endereco = [
            pedidoAtual.endereco,
            pedidoAtual.numero,
            pedidoAtual.complemento,
            pedidoAtual.bairro,
            `${pedidoAtual.cidade} - ${pedidoAtual.estado}`,
            `CEP: ${pedidoAtual.cep}`
        ].filter(Boolean).join(', ');
        document.getElementById('detEndereco').textContent = endereco || 'N/A';
        
        // Produtos
        const produtosHtml = pedidoAtual.itens ? pedidoAtual.itens.map(item => `
            <div style="border-bottom: 1px solid #ddd; padding: 10px 0;">
                <strong>${item.nome}</strong><br>
                Quantidade: ${item.quantidade} x R$ ${parseFloat(item.preco).toFixed(2)} = 
                <strong>R$ ${(item.quantidade * parseFloat(item.preco)).toFixed(2)}</strong>
            </div>
        `).join('') : '<p>Sem itens</p>';
        document.getElementById('detProdutos').innerHTML = produtosHtml;
        
        // Pagamento
        document.getElementById('detMetodo').textContent = formatarMetodoPagamento(pedidoAtual.metodo_pagamento);
        document.getElementById('detStatusPag').textContent = formatarStatus(pedidoAtual.status);
        document.getElementById('detPixCodigo').textContent = pedidoAtual.pix_codigo || 'N/A';
        
        // Status atual
        document.getElementById('novoStatus').value = pedidoAtual.status;
        
        // Mostrar modal
        document.getElementById('modalDetalhes').style.display = 'block';
        
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao carregar detalhes do pedido');
    }
}

// ========== FECHAR MODAL ==========
function fecharModal() {
    document.getElementById('modalDetalhes').style.display = 'none';
    pedidoAtual = null;
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('modalDetalhes');
    if (event.target === modal) {
        fecharModal();
    }
};

// ========== ATUALIZAR STATUS DO PEDIDO ==========
async function atualizarStatus() {
    if (!pedidoAtual) return;
    
    const novoStatus = document.getElementById('novoStatus').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/pedidos/${pedidoAtual.id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: novoStatus })
        });
        
        if (!response.ok) {
            throw new Error('Erro ao atualizar status');
        }
        
        alert('✅ Status atualizado com sucesso!');
        fecharModal();
        carregarPedidos();
        
    } catch (error) {
        console.error('Erro:', error);
        alert('❌ Erro ao atualizar status. Tente novamente.');
    }
}

// ========== FILTRAR PEDIDOS ==========
function filtrarPedidos() {
    const status = document.getElementById('filtroStatus').value;
    const data = document.getElementById('filtroData').value;
    
    let filtrados = [...pedidos];
    
    if (status) {
        filtrados = filtrados.filter(p => p.status === status);
    }
    
    if (data) {
        filtrados = filtrados.filter(p => p.data_pedido && p.data_pedido.startsWith(data));
    }
    
    renderizarPedidos(filtrados);
}

// ========== BUSCAR PEDIDOS ==========
function buscarPedidos() {
    const termo = document.getElementById('busca').value.toLowerCase();
    
    if (!termo) {
        renderizarPedidos(pedidos);
        return;
    }
    
    const resultados = pedidos.filter(p => 
        p.id.toString().includes(termo) ||
        (p.nome_completo && p.nome_completo.toLowerCase().includes(termo)) ||
        (p.email && p.email.toLowerCase().includes(termo)) ||
        (p.telefone && p.telefone.includes(termo))
    );
    
    renderizarPedidos(resultados);
}

// ========== EXPORTAR PEDIDOS ==========
function exportarPedidos() {
    if (pedidos.length === 0) {
        alert('Nenhum pedido para exportar');
        return;
    }
    
    // Criar CSV
    const headers = ['Pedido', 'Data', 'Cliente', 'Email', 'Telefone', 'Total', 'Status', 'Pagamento'];
    const rows = pedidos.map(p => [
        p.id,
        formatarDataHora(p.data_pedido),
        p.nome_completo || '',
        p.email || '',
        p.telefone || '',
        `R$ ${parseFloat(p.total || 0).toFixed(2)}`,
        formatarStatus(p.status),
        formatarMetodoPagamento(p.metodo_pagamento)
    ]);
    
    let csv = headers.join(';') + '\n';
    rows.forEach(row => {
        csv += row.join(';') + '\n';
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pedidos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// ========== IMPRIMIR PEDIDO ==========
function imprimirPedido() {
    if (!pedidoAtual) return;
    
    const conteudo = `
        <html>
        <head>
            <title>Pedido #${pedidoAtual.id}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #667eea; }
                .secao { margin: 20px 0; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
                .item { padding: 5px 0; }
                .total { font-size: 20px; font-weight: bold; color: #2ecc71; }
            </style>
        </head>
        <body>
            <h1>🛒 Bom Filho - Pedido #${pedidoAtual.id}</h1>
            
            <div class="secao">
                <h3>Cliente</h3>
                <p><strong>Nome:</strong> ${pedidoAtual.nome_completo}</p>
                <p><strong>Email:</strong> ${pedidoAtual.email}</p>
                <p><strong>Telefone:</strong> ${pedidoAtual.telefone}</p>
            </div>
            
            <div class="secao">
                <h3>Endereço de Entrega</h3>
                <p>${pedidoAtual.endereco}, ${pedidoAtual.numero}</p>
                <p>${pedidoAtual.bairro} - ${pedidoAtual.cidade}/${pedidoAtual.estado}</p>
                <p>CEP: ${pedidoAtual.cep}</p>
            </div>
            
            <div class="secao">
                <h3>Produtos</h3>
                ${pedidoAtual.itens.map(item => `
                    <div class="item">
                        ${item.quantidade}x ${item.nome} - R$ ${parseFloat(item.preco).toFixed(2)} = 
                        R$ ${(item.quantidade * parseFloat(item.preco)).toFixed(2)}
                    </div>
                `).join('')}
            </div>
            
            <div class="secao">
                <p class="total">Total: R$ ${parseFloat(pedidoAtual.total).toFixed(2)}</p>
            </div>
            
            <p style="margin-top: 40px; color: #999;">
                Data: ${formatarDataHora(pedidoAtual.data_pedido)}
            </p>
        </body>
        </html>
    `;
    
    const janela = window.open('', '_blank');
    janela.document.write(conteudo);
    janela.document.close();
    janela.print();
}

// ========== FUNÇÕES AUXILIARES ==========
function formatarDataHora(data) {
    if (!data) return 'N/A';
    const d = new Date(data);
    return d.toLocaleString('pt-BR');
}

function formatarStatus(status) {
    const statusMap = {
        'pendente': 'Pendente',
        'pago': 'Pago',
        'preparando': 'Preparando',
        'enviado': 'Enviado',
        'entregue': 'Entregue',
        'cancelado': 'Cancelado'
    };
    return statusMap[status] || status;
}

function formatarMetodoPagamento(metodo) {
    const metodoMap = {
        'pix': 'PIX',
        'boleto': 'Boleto',
        'cartao': 'Cartão'
    };
    return metodoMap[metodo] || metodo || 'N/A';
}

function contarItens(pedido) {
    if (!pedido.itens || !Array.isArray(pedido.itens)) return '0 itens';
    const total = pedido.itens.reduce((sum, item) => sum + (item.quantidade || 0), 0);
    return `${total} ${total === 1 ? 'item' : 'itens'}`;
}

function mostrarErro(mensagem) {
    const tbody = document.getElementById('tabelaPedidos');
    tbody.innerHTML = `
        <tr>
            <td colspan="8" style="text-align: center; padding: 40px;">
                <p style="color: #e74c3c;">⚠️ ${mensagem}</p>
            </td>
        </tr>
    `;
}
