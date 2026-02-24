// ============================================
// MÓDULO DE HISTÓRICO E CUPONS
// Histórico de compras e sistema de cupons
// ============================================

var historicoPedidos = [];
var cupomAtual = null;

// ============================================
// HISTÓRICO DE COMPRAS
// ============================================

async function mostrarHistorico() {
  if (!tokenAuth) {
    alert('Faça login para ver seu histórico!');
    document.getElementById('userModal').classList.add('show');
    mostrarLogin();
    return;
  }

  var modal = document.getElementById('historicoModal');
  if (!modal) {
    criarModalHistorico();
    modal = document.getElementById('historicoModal');
  }

  await carregarHistorico();
  renderizarHistorico();
  modal.classList.add('show');
}

async function carregarHistorico() {
  try {
    var resultado = await API.get('/pedidos', tokenAuth);
    if (resultado.pedidos) {
      historicoPedidos = resultado.pedidos;
    }
  } catch (erro) {
    console.error('Erro ao carregar histórico:', erro);
  }
}

function criarModalHistorico() {
  var modal = document.createElement('div');
  modal.id = 'historicoModal';
  modal.className = 'cart-modal';
  modal.innerHTML = '<div class="cart-modal-content historico-content">' +
    '<div class="cart-header">' +
      '<h3>📋 Meus Pedidos</h3>' +
      '<button id="closeHistorico" class="close-cart">✕</button>' +
    '</div>' +
    '<div id="historicoList" class="historico-list"></div>' +
  '</div>';
  document.body.appendChild(modal);

  document.getElementById('closeHistorico').addEventListener('click', function() {
    modal.classList.remove('show');
  });

  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.classList.remove('show');
  });
}

function renderizarHistorico() {
  var lista = document.getElementById('historicoList');
  
  if (historicoPedidos.length === 0) {
    lista.innerHTML = '<p class="cart-empty">Você ainda não fez pedidos</p>';
    return;
  }

  lista.innerHTML = '';
  
  historicoPedidos.forEach(function(pedido) {
    var data = new Date(pedido.criado_em);
    var dataFormatada = data.toLocaleDateString('pt-BR');
    
    var statusEmoji = {
      'pendente': '⏳',
      'preparando': '📦',
      'enviado': '🚚',
      'entregue': '✅',
      'cancelado': '❌'
    };

    var statusTexto = {
      'pendente': 'Pendente',
      'preparando': 'Preparando',
      'enviado': 'A caminho',
      'entregue': 'Entregue',
      'cancelado': 'Cancelado'
    };

    var item = document.createElement('div');
    item.className = 'historico-item';
    item.innerHTML = 
      '<div class="historico-header">' +
        '<div>' +
          '<strong>Pedido #' + pedido.id + '</strong>' +
          '<small>' + dataFormatada + '</small>' +
        '</div>' +
        '<span class="historico-status">' + statusEmoji[pedido.status] + ' ' + statusTexto[pedido.status] + '</span>' +
      '</div>' +
      '<div class="historico-total">Total: R$ ' + parseFloat(pedido.total).toFixed(2).replace('.', ',') + '</div>' +
      '<div class="historico-acoes">' +
        '<button class="btn btn-small" onclick="mostrarRastreamento(' + pedido.id + ')">🚚 Rastrear</button>' +
        '<button class="btn btn-small" onclick="verDetalhesPedido(' + pedido.id + ')">Ver Detalhes</button>' +
        (pedido.status === 'entregue' ? '<button class="btn btn-small" onclick="comprarNovamente(' + pedido.id + ')">🔄 Comprar Novamente</button>' : '') +
      '</div>';
    lista.appendChild(item);
  });
}

async function verDetalhesPedido(pedidoId) {
  try {
    var resultado = await API.get('/pedidos/' + pedidoId, tokenAuth);
    
    var detalhesHTML = '<div class="pedido-detalhes">' +
      '<h4>Pedido #' + resultado.pedido.id + '</h4>' +
      '<p><strong>Status:</strong> ' + resultado.pedido.status + '</p>' +
      '<p><strong>Total:</strong> R$ ' + parseFloat(resultado.pedido.total).toFixed(2).replace('.', ',') + '</p>' +
      '<p><strong>Pagamento:</strong> ' + (resultado.pedido.forma_pagamento === 'pix' ? 'PIX' : 'Na Entrega') + '</p>' +
      '<h5>Itens:</h5>' +
      '<ul>';
    
    resultado.itens.forEach(function(item) {
      detalhesHTML += '<li>' + item.quantidade + 'x ' + item.nome_produto + ' - R$ ' + 
        parseFloat(item.subtotal).toFixed(2).replace('.', ',') + '</li>';
    });
    
    detalhesHTML += '</ul></div>';
    
    alert(detalhesHTML.replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n'));
  } catch (erro) {
    console.error('Erro ao carregar detalhes:', erro);
  }
}

async function comprarNovamente(pedidoId) {
  try {
    var resultado = await API.get('/pedidos/' + pedidoId, tokenAuth);
    
    // Limpar carrinho atual
    cart.items = [];
    cart.total = 0;
    
    // Adicionar itens do pedido ao carrinho
    resultado.itens.forEach(function(item) {
      for (var i = 0; i < item.quantidade; i++) {
        adicionarAoCarrinho({
          produto_id: item.produto_id,
          name: item.nome_produto,
          price: parseFloat(item.preco)
        });
      }
    });
    
    // Fechar modal e abrir carrinho
    document.getElementById('historicoModal').classList.remove('show');
    document.getElementById('cartModal').classList.add('show');
    
    alert('✅ Itens adicionados ao carrinho!');
  } catch (erro) {
    console.error('Erro ao comprar novamente:', erro);
    alert('Erro ao adicionar itens ao carrinho');
  }
}

// ============================================
// SISTEMA DE CUPONS
// ============================================

var cuponsDisponiveis = [];

async function carregarCuponsDisponiveis() {
  try {
    var resultado = await API.get('/cupons/disponiveis');
    if (resultado.cupons) {
      cuponsDisponiveis = resultado.cupons;
    }
  } catch (erro) {
    console.error('Erro ao carregar cupons:', erro);
  }
}

async function validarCupom(codigo, valorPedido) {
  if (!tokenAuth) {
    alert('Faça login para usar cupons!');
    return null;
  }

  try {
    var resultado = await API.post('/cupons/validar', { 
      codigo: codigo,
      valorPedido: valorPedido
    }, tokenAuth);
    
    if (resultado.valido) {
      cupomAtual = resultado;
      return resultado;
    }
  } catch (erro) {
    if (erro.response && erro.response.data && erro.response.data.erro) {
      alert(erro.response.data.erro);
    } else {
      alert('Cupom inválido');
    }
    return null;
  }
}

function limparCupom() {
  cupomAtual = null;
}

function mostrarCuponsDisponiveis() {
  var modal = document.getElementById('cuponsModal');
  if (!modal) {
    criarModalCupons();
    modal = document.getElementById('cuponsModal');
  }

  renderizarCupons();
  modal.classList.add('show');
}

function criarModalCupons() {
  var modal = document.createElement('div');
  modal.id = 'cuponsModal';
  modal.className = 'cart-modal';
  modal.innerHTML = '<div class="cart-modal-content">' +
    '<div class="cart-header">' +
      '<h3>🎟️ Cupons Disponíveis</h3>' +
      '<button id="closeCupons" class="close-cart">✕</button>' +
    '</div>' +
    '<div id="cuponsList" class="cupons-list"></div>' +
  '</div>';
  document.body.appendChild(modal);

  document.getElementById('closeCupons').addEventListener('click', function() {
    modal.classList.remove('show');
  });

  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.classList.remove('show');
  });
}

function renderizarCupons() {
  var lista = document.getElementById('cuponsList');
  
  if (cuponsDisponiveis.length === 0) {
    lista.innerHTML = '<p class="cart-empty">Nenhum cupom disponível no momento</p>';
    return;
  }

  lista.innerHTML = '';
  
  cuponsDisponiveis.forEach(function(cupom) {
    var valorTexto = cupom.tipo === 'percentual' ? 
      cupom.valor + '% OFF' : 
      'R$ ' + parseFloat(cupom.valor).toFixed(2) + ' OFF';
    
    var validade = cupom.validade ? 
      'Válido até ' + new Date(cupom.validade).toLocaleDateString('pt-BR') : 
      'Sem data de validade';

    var item = document.createElement('div');
    item.className = 'cupom-item';
    item.innerHTML = 
      '<div class="cupom-info">' +
        '<strong class="cupom-codigo">' + cupom.codigo + '</strong>' +
        '<p class="cupom-descricao">' + cupom.descricao + '</p>' +
        '<span class="cupom-valor">' + valorTexto + '</span>' +
        '<small>Compra mínima: R$ ' + parseFloat(cupom.valor_minimo).toFixed(2) + '</small>' +
        '<small class="cupom-validade">' + validade + '</small>' +
      '</div>' +
      '<button class="btn-copiar-cupom" onclick="copiarCupom(\'' + cupom.codigo + '\')">📋 Copiar</button>';
    lista.appendChild(item);
  });
}

function copiarCupom(codigo) {
  navigator.clipboard.writeText(codigo).then(function() {
    alert('✅ Cupom ' + codigo + ' copiado!');
    document.getElementById('cuponsModal').classList.remove('show');
  }).catch(function() {
    alert('Código do cupom: ' + codigo);
  });
}

// Expor funções globais
window.mostrarHistorico = mostrarHistorico;
window.mostrarCuponsDisponiveis = mostrarCuponsDisponiveis;
window.validarCupom = validarCupom;
window.limparCupom = limparCupom;
window.carregarCuponsDisponiveis = carregarCuponsDisponiveis;
window.copiarCupom = copiarCupom;
window.verDetalhesPedido = verDetalhesPedido;
window.comprarNovamente = comprarNovamente;
