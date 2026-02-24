// ===================================================================
// MÓDULO DE LISTAS DE COMPRAS PERSONALIZADAS
// ===================================================================
// Permite criar e gerenciar múltiplas listas de compras
// Ex: "Compras do Mês", "Churrasco", "Aniversário"
// ===================================================================

var listas = [];
var listaAtual = null;

// ===================================================================
// FUNÇÃO: Inicializar Sistema de Listas
// ===================================================================
function inicializarListas() {
  carregarListasLocalStorage();
}

// ===================================================================
// FUNÇÃO: Carregar Listas do LocalStorage
// ===================================================================
function carregarListasLocalStorage() {
  var listasStorage = localStorage.getItem('listasCompras');
  if (listasStorage) {
    listas = JSON.parse(listasStorage);
  }
}

// ===================================================================
// FUNÇÃO: Salvar Listas no LocalStorage
// ===================================================================
function salvarListasLocalStorage() {
  localStorage.setItem('listasCompras', JSON.stringify(listas));
}

// ===================================================================
// FUNÇÃO: Mostrar Modal de Listas
// ===================================================================
function mostrarListas() {
  var modal = document.getElementById('listasModal');
  if (!modal) {
    criarModalListas();
    modal = document.getElementById('listasModal');
  }

  renderizarListas();
  modal.classList.add('show');
}

// ===================================================================
// FUNÇÃO: Criar Modal de Listas
// ===================================================================
function criarModalListas() {
  var modal = document.createElement('div');
  modal.id = 'listasModal';
  modal.className = 'cart-modal';
  modal.innerHTML = `
    <div class="cart-modal-content listas-content">
      <div class="cart-header">
        <h3>📝 Minhas Listas de Compras</h3>
        <button id="closeListas" class="close-cart">✕</button>
      </div>
      
      <div class="listas-toolbar">
        <button class="btn btn-primary" onclick="mostrarCriarLista()">
          ➕ Nova Lista
        </button>
      </div>
      
      <div id="listasContainer" class="listas-container"></div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('closeListas').addEventListener('click', function() {
    modal.classList.remove('show');
  });

  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.classList.remove('show');
  });
}

// ===================================================================
// FUNÇÃO: Renderizar Listas
// ===================================================================
function renderizarListas() {
  var container = document.getElementById('listasContainer');
  
  if (listas.length === 0) {
    container.innerHTML = `
      <div class="listas-empty">
        <p>📝 Você ainda não criou nenhuma lista</p>
        <p class="listas-empty-hint">Crie listas personalizadas como "Churrasco", "Aniversário" ou "Compras do Mês"</p>
      </div>
    `;
    return;
  }

  var html = '<div class="listas-grid">';
  
  listas.forEach(function(lista) {
    var totalItens = lista.itens.length;
    var totalValor = calcularTotalLista(lista);
    var emoji = lista.emoji || '📝';
    
    html += `
      <div class="lista-card">
        <div class="lista-header">
          <span class="lista-emoji">${emoji}</span>
          <h4 class="lista-nome">${lista.nome}</h4>
        </div>
        <div class="lista-info">
          <span class="lista-stat">📦 ${totalItens} ${totalItens === 1 ? 'item' : 'itens'}</span>
          <span class="lista-stat">💰 R$ ${totalValor.toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="lista-acoes">
          <button class="btn btn-small" onclick="abrirLista(${lista.id})">
            👁️ Ver Lista
          </button>
          <button class="btn btn-small btn-success" onclick="adicionarListaAoCarrinho(${lista.id})">
            🛒 Adicionar ao Carrinho
          </button>
          <button class="btn btn-small btn-danger" onclick="excluirLista(${lista.id})">
            🗑️
          </button>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// ===================================================================
// FUNÇÃO: Calcular Total da Lista
// ===================================================================
function calcularTotalLista(lista) {
  return lista.itens.reduce(function(total, item) {
    return total + (item.preco * item.quantidade);
  }, 0);
}

// ===================================================================
// FUNÇÃO: Mostrar Criar Nova Lista
// ===================================================================
function mostrarCriarLista() {
  var container = document.getElementById('listasContainer');
  
  container.innerHTML = `
    <div class="criar-lista-form">
      <h3>➕ Criar Nova Lista</h3>
      
      <div class="form-group">
        <label>Nome da Lista *</label>
        <input type="text" id="novaListaNome" placeholder="Ex: Churrasco do Final de Semana" maxlength="50" />
      </div>
      
      <div class="form-group">
        <label>Emoji (opcional)</label>
        <div class="emoji-selector">
          <button class="emoji-btn" onclick="selecionarEmoji('📝')">📝</button>
          <button class="emoji-btn" onclick="selecionarEmoji('🛒')">🛒</button>
          <button class="emoji-btn" onclick="selecionarEmoji('🎉')">🎉</button>
          <button class="emoji-btn" onclick="selecionarEmoji('🍖')">🍖</button>
          <button class="emoji-btn" onclick="selecionarEmoji('🎂')">🎂</button>
          <button class="emoji-btn" onclick="selecionarEmoji('🏠')">🏠</button>
          <button class="emoji-btn" onclick="selecionarEmoji('💼')">💼</button>
          <button class="emoji-btn" onclick="selecionarEmoji('🎁')">🎁</button>
        </div>
        <input type="hidden" id="novaListaEmoji" value="📝" />
      </div>
      
      <div class="form-acoes">
        <button class="btn btn-secondary" onclick="renderizarListas()">Cancelar</button>
        <button class="btn btn-primary" onclick="criarNovaLista()">Criar Lista</button>
      </div>
    </div>
  `;
}

// ===================================================================
// FUNÇÃO: Selecionar Emoji
// ===================================================================
function selecionarEmoji(emoji) {
  document.getElementById('novaListaEmoji').value = emoji;
  
  // Highlight visual
  var botoes = document.querySelectorAll('.emoji-btn');
  botoes.forEach(function(btn) {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
}

// ===================================================================
// FUNÇÃO: Criar Nova Lista
// ===================================================================
function criarNovaLista() {
  var nome = document.getElementById('novaListaNome').value.trim();
  var emoji = document.getElementById('novaListaEmoji').value;
  
  if (!nome) {
    alert('Digite um nome para a lista!');
    return;
  }
  
  var novaLista = {
    id: Date.now(),
    nome: nome,
    emoji: emoji,
    itens: [],
    criada_em: new Date().toISOString()
  };
  
  listas.push(novaLista);
  salvarListasLocalStorage();
  
  renderizarListas();
}

// ===================================================================
// FUNÇÃO: Abrir Lista
// ===================================================================
function abrirLista(listaId) {
  var lista = listas.find(function(l) { return l.id === listaId; });
  if (!lista) return;
  
  listaAtual = lista;
  renderizarDetalhesLista(lista);
}

// ===================================================================
// FUNÇÃO: Renderizar Detalhes da Lista
// ===================================================================
function renderizarDetalhesLista(lista) {
  var container = document.getElementById('listasContainer');
  
  var html = `
    <div class="lista-detalhes">
      <div class="lista-detalhes-header">
        <button class="btn btn-small" onclick="renderizarListas()">⬅️ Voltar</button>
        <h3>${lista.emoji} ${lista.nome}</h3>
      </div>
      
      <div class="lista-produtos-add">
        <button class="btn btn-primary" onclick="mostrarAdicionarProdutoLista(${lista.id})">
          ➕ Adicionar Produto
        </button>
      </div>
  `;
  
  if (lista.itens.length === 0) {
    html += '<p class="lista-vazia">Esta lista está vazia. Adicione produtos!</p>';
  } else {
    html += '<div class="lista-itens">';
    
    lista.itens.forEach(function(item, index) {
      var subtotal = item.preco * item.quantidade;
      
      html += `
        <div class="lista-item">
          <span class="lista-item-emoji">${item.emoji || '📦'}</span>
          <div class="lista-item-info">
            <strong>${item.nome}</strong>
            <small>R$ ${item.preco.toFixed(2).replace('.', ',')} × ${item.quantidade}</small>
          </div>
          <div class="lista-item-controles">
            <button class="btn-quantidade" onclick="alterarQuantidadeLista(${lista.id}, ${index}, -1)">−</button>
            <span class="quantidade-display">${item.quantidade}</span>
            <button class="btn-quantidade" onclick="alterarQuantidadeLista(${lista.id}, ${index}, 1)">+</button>
          </div>
          <span class="lista-item-preco">R$ ${subtotal.toFixed(2).replace('.', ',')}</span>
          <button class="btn-remove" onclick="removerItemLista(${lista.id}, ${index})">🗑️</button>
        </div>
      `;
    });
    
    html += '</div>';
    
    var total = calcularTotalLista(lista);
    html += `
      <div class="lista-total">
        <strong>Total:</strong>
        <span>R$ ${total.toFixed(2).replace('.', ',')}</span>
      </div>
    `;
  }
  
  html += '</div>';
  container.innerHTML = html;
}

// ===================================================================
// FUNÇÃO: Mostrar Adicionar Produto à Lista
// ===================================================================
async function obterProdutosParaListas() {
  if (typeof produtos !== 'undefined' && Array.isArray(produtos) && produtos.length > 0) {
    return produtos;
  }

  if (typeof API !== 'undefined' && API && typeof API.get === 'function') {
    var data = await API.get('/produtos');
    return (data && data.produtos) ? data.produtos : [];
  }

  // Fallback (ambiente antigo)
  var baseUrl = (typeof API_CONFIG !== 'undefined' && API_CONFIG && API_CONFIG.baseURL)
    ? API_CONFIG.baseURL
    : 'http://localhost:3000/api';
  var response = await fetch(baseUrl + '/produtos');
  var dataFallback = await response.json();
  return dataFallback.produtos || [];
}

async function mostrarAdicionarProdutoLista(listaId) {
  try {
    var listaProdutos = await obterProdutosParaListas();
    
    var container = document.getElementById('listasContainer');
    var lista = listas.find(function(l) { return l.id === listaId; });
    
    var html = `
      <div class="lista-detalhes">
        <div class="lista-detalhes-header">
          <button class="btn btn-small" onclick="abrirLista(${listaId})">⬅️ Voltar</button>
          <h3>Adicionar Produto</h3>
        </div>
        
        <div class="produtos-lista-add">
    `;
    
    listaProdutos.forEach(function(produto) {
      var preco = parseFloat(produto.preco).toFixed(2).replace('.', ',');
      var jaAdicionado = lista.itens.some(function(item) { return item.produto_id === produto.id; });
      
      html += `
        <div class="produto-lista-card ${jaAdicionado ? 'adicionado' : ''}">
          <span class="produto-emoji">${produto.emoji}</span>
          <div class="produto-info-lista">
            <strong>${produto.nome}</strong>
            <span class="produto-preco">R$ ${preco}</span>
          </div>
          ${jaAdicionado 
            ? '<span class="badge-adicionado">✓ Adicionado</span>'
            : `<button class="btn btn-small btn-success" onclick="adicionarProdutoNaLista(${listaId}, ${produto.id})">➕</button>`
          }
        </div>
      `;
    });
    
    html += '</div></div>';
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    alert('Erro ao carregar produtos');
  }
}

// ===================================================================
// FUNÇÃO: Adicionar Produto na Lista
// ===================================================================
async function adicionarProdutoNaLista(listaId, produtoId) {
  var lista = listas.find(function(l) { return l.id === listaId; });
  if (!lista) return;
  
  try {
    var listaProdutos = await obterProdutosParaListas();
    var produto = listaProdutos.find(function(p) { return p.id === produtoId; });
    if (!produto) return;

    lista.itens.push({
      produto_id: produto.id,
      nome: produto.nome,
      emoji: produto.emoji,
      preco: parseFloat(produto.preco),
      quantidade: 1
    });

    salvarListasLocalStorage();
    mostrarAdicionarProdutoLista(listaId);
  } catch (e) {
    console.error('Erro ao adicionar produto na lista:', e);
    alert('Erro ao adicionar produto na lista');
  }
}

// ===================================================================
// FUNÇÃO: Alterar Quantidade na Lista
// ===================================================================
function alterarQuantidadeLista(listaId, itemIndex, delta) {
  var lista = listas.find(function(l) { return l.id === listaId; });
  if (!lista) return;
  
  lista.itens[itemIndex].quantidade += delta;
  
  if (lista.itens[itemIndex].quantidade <= 0) {
    lista.itens.splice(itemIndex, 1);
  }
  
  salvarListasLocalStorage();
  renderizarDetalhesLista(lista);
}

// ===================================================================
// FUNÇÃO: Remover Item da Lista
// ===================================================================
function removerItemLista(listaId, itemIndex) {
  var lista = listas.find(function(l) { return l.id === listaId; });
  if (!lista) return;
  
  if (confirm('Remover este item da lista?')) {
    lista.itens.splice(itemIndex, 1);
    salvarListasLocalStorage();
    renderizarDetalhesLista(lista);
  }
}

// ===================================================================
// FUNÇÃO: Adicionar Lista ao Carrinho
// ===================================================================
function adicionarListaAoCarrinho(listaId) {
  var lista = listas.find(function(l) { return l.id === listaId; });
  if (!lista || lista.itens.length === 0) {
    alert('Esta lista está vazia!');
    return;
  }
  
  if (confirm(`Adicionar ${lista.itens.length} itens de "${lista.nome}" ao carrinho?`)) {
    lista.itens.forEach(function(item) {
      for (var i = 0; i < item.quantidade; i++) {
        adicionarAoCarrinho({
          produto_id: item.produto_id,
          name: item.nome,
          price: item.preco,
          emoji: item.emoji
        });
      }
    });
    
    document.getElementById('listasModal').classList.remove('show');
    document.getElementById('cartModal').classList.add('show');
  }
}

// ===================================================================
// FUNÇÃO: Excluir Lista
// ===================================================================
function excluirLista(listaId) {
  var lista = listas.find(function(l) { return l.id === listaId; });
  if (!lista) return;
  
  if (confirm(`Excluir a lista "${lista.nome}"?`)) {
    listas = listas.filter(function(l) { return l.id !== listaId; });
    salvarListasLocalStorage();
    renderizarListas();
  }
}

// ===================================================================
// EXPORT GLOBAL
// ===================================================================
window.inicializarListas = inicializarListas;
window.mostrarListas = mostrarListas;
window.mostrarCriarLista = mostrarCriarLista;
window.selecionarEmoji = selecionarEmoji;
window.criarNovaLista = criarNovaLista;
window.abrirLista = abrirLista;
window.mostrarAdicionarProdutoLista = mostrarAdicionarProdutoLista;
window.adicionarProdutoNaLista = adicionarProdutoNaLista;
window.alterarQuantidadeLista = alterarQuantidadeLista;
window.removerItemLista = removerItemLista;
window.adicionarListaAoCarrinho = adicionarListaAoCarrinho;
window.excluirLista = excluirLista;

console.log('✅ Módulo de Listas de Compras carregado');
