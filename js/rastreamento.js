// ===================================================================
// MÓDULO DE RASTREAMENTO DE PEDIDOS
// ===================================================================
// Permite rastrear pedidos em tempo real com timeline visual
// Status: Pendente → Preparando → Saiu para Entrega → Entregue
// ===================================================================

// Definir os estágios de um pedido
const ESTAGIOS_PEDIDO = [
  {
    id: 'pendente',
    nome: 'Pedido Recebido',
    icone: '📝',
    descricao: 'Seu pedido foi recebido e está sendo processado'
  },
  {
    id: 'preparando',
    nome: 'Em Preparação',
    icone: '📦',
    descricao: 'Estamos separando seus produtos'
  },
  {
    id: 'saiu_entrega',
    nome: 'Saiu para Entrega',
    icone: '🚚',
    descricao: 'Seu pedido está a caminho'
  },
  {
    id: 'entregue',
    nome: 'Entregue',
    icone: '✅',
    descricao: 'Pedido entregue com sucesso'
  }
];

// Mapear status do banco de dados para estágios
const STATUS_MAP = {
  'pendente': 0,
  'preparando': 1,
  'confirmado': 1,
  'saiu_entrega': 2,
  'em_transito': 2,
  'entregue': 3,
  'concluido': 3
};

// ===================================================================
// FUNÇÃO: Mostrar Modal de Rastreamento
// ===================================================================
function mostrarRastreamento(pedidoId) {
  if (!pedidoId) {
    console.error('ID do pedido não fornecido');
    return;
  }

  const usuarioLogado = JSON.parse(localStorage.getItem('usuarioLogado'));
  const token = (typeof tokenAuth !== 'undefined' && tokenAuth)
    ? tokenAuth
    : (localStorage.getItem('token') || sessionStorage.getItem('token'));
  
  if (!usuarioLogado || !token) {
    alert('Faça login para rastrear seu pedido');
    return;
  }

  // Buscar dados específicos do pedido
  API.get(`/pedidos/${pedidoId}`, token)
    .then(data => {
      renderizarModalRastreamento(data.pedido, data.itens);
    })
    .catch(error => {
      console.error('Erro ao carregar pedido:', error);
      alert('Erro ao carregar informações do pedido');
    });
}

// ===================================================================
// FUNÇÃO: Renderizar Modal de Rastreamento
// ===================================================================
function renderizarModalRastreamento(pedido, itens) {
  // Determinar estágio atual baseado no status
  const statusAtual = pedido.status.toLowerCase();
  const estagioAtual = STATUS_MAP[statusAtual] || 0;

  // Criar o HTML do modal
  const modalHTML = `
    <div id="modalRastreamento" class="modal-overlay" onclick="fecharModalRastreamento(event)">
      <div class="modal-content modal-rastreamento" onclick="event.stopPropagation()">
        
        <!-- Cabeçalho -->
        <div class="modal-header">
          <h2>🚚 Rastreamento do Pedido</h2>
          <button class="close-btn" onclick="fecharModalRastreamento()">&times;</button>
        </div>

        <!-- Informações do Pedido -->
        <div class="info-pedido-rastreamento">
          <div class="info-item">
            <span class="label">Número do Pedido:</span>
            <span class="valor">#${pedido.id}</span>
          </div>
          <div class="info-item">
            <span class="label">Data:</span>
            <span class="valor">${new Date(pedido.criado_em).toLocaleDateString('pt-BR')}</span>
          </div>
          <div class="info-item">
            <span class="label">Total:</span>
            <span class="valor">R$ ${parseFloat(pedido.total).toFixed(2).replace('.', ',')}</span>
          </div>
          <div class="info-item">
            <span class="label">Forma de Pagamento:</span>
            <span class="valor">${formatarFormaPagamento(pedido.forma_pagamento)}</span>
          </div>
        </div>

        <!-- Timeline de Rastreamento -->
        <div class="timeline-rastreamento">
          ${ESTAGIOS_PEDIDO.map((estagio, index) => `
            <div class="timeline-item ${index <= estagioAtual ? 'ativo' : ''} ${index === estagioAtual ? 'atual' : ''}">
              <div class="timeline-marker">
                <span class="icone">${estagio.icone}</span>
              </div>
              <div class="timeline-content">
                <h3>${estagio.nome}</h3>
                <p>${estagio.descricao}</p>
                ${index === estagioAtual ? '<span class="badge-atual">ATUAL</span>' : ''}
                ${index < estagioAtual ? '<span class="badge-concluido">✓ CONCLUÍDO</span>' : ''}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Endereço de Entrega -->
        <div class="endereco-entrega-rastreamento">
          <h3>📍 Endereço de Entrega</h3>
          <p>${formatarEndereco(pedido.endereco_entrega)}</p>
        </div>

        <!-- Itens do Pedido -->
        <div class="itens-pedido-rastreamento">
          <h3>🛒 Itens do Pedido</h3>
          <div class="lista-itens-rastreamento">
            ${itens && itens.length > 0 ? itens.map(item => `
              <div class="item-rastreamento">
                <span class="emoji">${item.emoji || '📦'}</span>
                <span class="nome">${item.nome || item.nome_produto}</span>
                <span class="quantidade">${item.quantidade}x</span>
                <span class="preco">R$ ${parseFloat(item.preco_unitario).toFixed(2).replace('.', ',')}</span>
              </div>
            `).join('') : '<p>Itens não disponíveis</p>'}
          </div>
        </div>

        <!-- Botão Fechar -->
        <div class="modal-footer">
          <button class="btn-secondary" onclick="fecharModalRastreamento()">Fechar</button>
        </div>

      </div>
    </div>
  `;

  // Inserir no body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// ===================================================================
// FUNÇÃO: Fechar Modal de Rastreamento
// ===================================================================
function fecharModalRastreamento(event) {
  // Se event existe, verificar se clicou no overlay
  if (event && event.target.id !== 'modalRastreamento') {
    return;
  }

  const modal = document.getElementById('modalRastreamento');
  if (modal) {
    modal.remove();
  }
}

// ===================================================================
// FUNÇÃO: Formatar Forma de Pagamento
// ===================================================================
function formatarFormaPagamento(forma) {
  const formas = {
    'pix': '💳 PIX',
    'entrega': '💵 Pagar na Entrega',
    'credito': '💳 Cartão de Crédito',
    'debito': '💳 Cartão de Débito'
  };
  
  return formas[forma] || forma;
}

// ===================================================================
// FUNÇÃO: Formatar Endereço
// ===================================================================
function formatarEndereco(endereco) {
  if (typeof endereco === 'string') {
    return endereco;
  }
  
  if (!endereco) {
    return 'Endereço não disponível';
  }

  return `${endereco.rua}, ${endereco.numero}${endereco.complemento ? ' - ' + endereco.complemento : ''}, ${endereco.bairro}, ${endereco.cidade} - ${endereco.estado}, CEP: ${endereco.cep}`;
}

// ===================================================================
// FUNÇÃO: Simular Atualização de Status (Para Demonstração)
// ===================================================================
function simularAtualizacaoStatus(pedidoId) {
  // Esta função seria usada em um cenário real para atualizar o status
  // via WebSocket ou polling periódico
  console.log('Simulando atualização de status para pedido:', pedidoId);
  
  // Exemplo de como seria implementado:
  // setInterval(() => {
  //   fetch(`http://localhost:3000/api/pedidos/${pedidoId}/status`)
  //     .then(response => response.json())
  //     .then(data => {
  //       // Atualizar a timeline se houver mudança de status
  //     });
  // }, 30000); // Verificar a cada 30 segundos
}

// ===================================================================
// EXPORT GLOBAL
// ===================================================================
window.mostrarRastreamento = mostrarRastreamento;
window.fecharModalRastreamento = fecharModalRastreamento;

console.log('✅ Módulo de Rastreamento carregado');
