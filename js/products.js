// ============================================
// MÓDULO DE PRODUTOS
// Carregamento, busca e exibição de produtos
// ============================================

var produtos = [];
var categoriaAtual = 'todas';
var buscaAtual = '';

// Controle de paginação
var produtosPorPagina = 24;
var paginaAtual = 1;

function parseDataLocalYYYYMMDD(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;

  // MySQL DATE normalmente vem como "YYYY-MM-DD"; evita shift de fuso criando data local.
  if (typeof valor === 'string') {
    var partes = valor.split('T')[0].split('-');
    if (partes.length === 3) {
      var ano = parseInt(partes[0], 10);
      var mes = parseInt(partes[1], 10);
      var dia = parseInt(partes[2], 10);
      if (!isNaN(ano) && !isNaN(mes) && !isNaN(dia)) {
        return new Date(ano, mes - 1, dia);
      }
    }
  }

  var d = new Date(valor);
  return isNaN(d.getTime()) ? null : d;
}

function diasParaVencer(produto) {
  if (!produto || !produto.validade) return null;

  var dataValidade = parseDataLocalYYYYMMDD(produto.validade);
  if (!dataValidade) return null;

  var hoje = new Date();
  var hojeLocal = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  var diffMs = dataValidade.getTime() - hojeLocal.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function produtoEhPromocaoValidade(produto) {
  var dias = diasParaVencer(produto);
  return dias !== null && dias >= 0 && dias <= 30;
}

async function carregarProdutos() {
  try {
    var resultado = await API.get('/produtos');
    if (resultado.produtos) {
      produtos = resultado.produtos;
    }
  } catch (erro) {
    console.error('Erro ao carregar produtos:', erro);
    alert('Erro ao carregar produtos. Verifique se o servidor está rodando.');
  }
}

function renderizarProdutos() {
  var productsContainer = document.querySelector('.products');
  if (!productsContainer) return;

  // Limpar container
  productsContainer.innerHTML = '';

  // Filtrar produtos
  var produtosFiltrados = produtos.filter(function(produto) {
    var passaCategoria = true;
    if (categoriaAtual === 'todas') {
      passaCategoria = true;
    } else if (categoriaAtual === 'promocoes') {
      passaCategoria = produtoEhPromocaoValidade(produto);
    } else {
      passaCategoria = produto.categoria === categoriaAtual;
    }
    var passaBusca = buscaAtual === '' || produto.nome.toLowerCase().includes(buscaAtual.toLowerCase());
    return passaCategoria && passaBusca;
  });

  if (categoriaAtual === 'promocoes') {
    produtosFiltrados.sort(function(a, b) {
      var da = diasParaVencer(a);
      var db = diasParaVencer(b);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  }

  if (produtosFiltrados.length === 0) {
    productsContainer.innerHTML = '<p class="no-products">Nenhum produto encontrado</p>';
    atualizarPaginacao(0);
    return;
  }

  // Calcular paginação
  var totalPaginas = Math.ceil(produtosFiltrados.length / produtosPorPagina);
  var inicio = (paginaAtual - 1) * produtosPorPagina;
  var fim = inicio + produtosPorPagina;
  var produtosPagina = produtosFiltrados.slice(inicio, fim);

  // Criar elementos HTML para cada produto da página atual
  produtosPagina.forEach(function (produto) {
    var article = document.createElement('article');
    article.className = 'product';
    article.dataset.productId = produto.id;
    article.dataset.category = produto.categoria;

    // Emoji como imagem do produto
    var emojiDiv = document.createElement('div');
    emojiDiv.className = 'product-image';
    emojiDiv.textContent = produto.emoji || '🛒';

    // Badge de promo por validade (vence em até 30 dias)
    var diasVencer = diasParaVencer(produto);
    if (diasVencer !== null && diasVencer >= 0 && diasVencer <= 30) {
      var badge = document.createElement('div');
      badge.className = 'product-badge-expiry' + (diasVencer <= 7 ? ' urgent' : '');
      badge.textContent = diasVencer === 0 ? 'Vence hoje' : ('Vence em ' + diasVencer + 'd');
      article.appendChild(badge);
      article.classList.add('product-expiry');
    }

    var h4 = document.createElement('h4');
    h4.textContent = produto.nome;

    var priceP = document.createElement('p');
    priceP.className = 'price';
    var preco = parseFloat(produto.preco);
    var precoFormatado = 'R$ ' + preco.toFixed(2).replace('.', ',');
    if (produto.unidade) {
      precoFormatado += ' / ' + produto.unidade;
    }
    priceP.textContent = precoFormatado;

    // Informações adicionais que aparecem no hover
    var infoDiv = document.createElement('div');
    infoDiv.className = 'product-info';
    
    // Usar dados reais do produto
    var marcaProduto = produto.marca || 'Marca não informada';
    var estoqueDisponivel = produto.estoque || 0;
    
    // Formatar data de validade
    var validadeFormatada = 'Não informada';
    if (produto.validade) {
      var dataValidade = parseDataLocalYYYYMMDD(produto.validade) || new Date(produto.validade);
      validadeFormatada = dataValidade.toLocaleDateString('pt-BR');
    }
    
    var descricaoProduto = produto.descricao || 'Produto de qualidade';
    
    infoDiv.innerHTML = 
      '<div class="product-description">' + descricaoProduto + '</div>' +
      '<div class="product-info-item">' +
        '<span class="product-info-label">🏭 Marca:</span>' +
        '<span>' + marcaProduto + '</span>' +
      '</div>' +
      '<div class="product-info-item">' +
        '<span class="product-info-label">📅 Validade:</span>' +
        '<span>' + validadeFormatada + '</span>' +
      '</div>' +
      '<div class="product-info-item">' +
        '<span class="product-info-label">📦 Estoque:</span>' +
        '<span>' + estoqueDisponivel + ' ' + (produto.unidade || 'unidades') + '</span>' +
      '</div>' +
      '<div class="product-info-item">' +
        '<span class="product-info-label">💰 Preço unitário:</span>' +
        '<span>R$ ' + preco.toFixed(2).replace('.', ',') + '</span>' +
      '</div>' +
      '<div class="product-info-item">' +
        '<span class="product-info-label">📏 Unidade:</span>' +
        '<span>' + (produto.unidade || 'un') + '</span>' +
      '</div>';

    // Botão de adicionar/controles de quantidade
    var btnContainer = document.createElement('div');
    btnContainer.className = 'product-btn-container';
    btnContainer.setAttribute('data-product-id', produto.id);
    
    var button = document.createElement('button');
    button.className = 'btn add-product';
    button.setAttribute('data-id', produto.id);
    button.setAttribute('data-name', produto.nome);
    button.setAttribute('data-price', preco);
    button.textContent = 'Adicionar';
    
    // Controles de quantidade (inicialmente ocultos)
    var quantityControls = document.createElement('div');
    quantityControls.className = 'quantity-controls hidden';
    quantityControls.innerHTML = 
      '<button class="qty-btn qty-minus" data-id="' + produto.id + '">−</button>' +
      '<span class="qty-display">1</span>' +
      '<button class="qty-btn qty-plus" data-id="' + produto.id + '">+</button>';
    
    btnContainer.appendChild(button);
    btnContainer.appendChild(quantityControls);

    // Botões de ação
    var actionsDiv = document.createElement('div');
    actionsDiv.className = 'product-actions';
    
    // Botão de detalhes
    var btnDetalhes = document.createElement('button');
    btnDetalhes.className = 'btn btn-detalhes';
    btnDetalhes.textContent = '🔍 Detalhes';
    btnDetalhes.onclick = function(e) {
      e.stopPropagation();
      mostrarDetalhesProduto(produto);
    };
    
    // Botão de avaliar
    var btnAvaliar = document.createElement('button');
    btnAvaliar.className = 'btn btn-avaliar';
    btnAvaliar.textContent = '⭐ Avaliar';
    btnAvaliar.onclick = function(e) {
      e.stopPropagation();
      mostrarAvaliacoesProduto(produto.id, produto.nome);
    };
    
    actionsDiv.appendChild(btnDetalhes);
    actionsDiv.appendChild(btnAvaliar);

    article.appendChild(emojiDiv);
    article.appendChild(h4);
    article.appendChild(priceP);
    article.appendChild(infoDiv);
    article.appendChild(btnContainer);
    article.appendChild(actionsDiv);
    productsContainer.appendChild(article);
  });

  // Reconfigurar event listeners após renderizar
  configurarBotoesCarrinho();
  
  // Atualizar controles de paginação
  atualizarPaginacao(produtosFiltrados.length);
}

function configurarBusca() {
  var searchInput = document.getElementById('searchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', function() {
    buscaAtual = searchInput.value;
    paginaAtual = 1; // Voltar para primeira página ao buscar
    renderizarProdutos();
  });
}

function configurarCategorias() {
  document.querySelectorAll('.category-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.category-btn').forEach(function(b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      categoriaAtual = btn.getAttribute('data-category');
      paginaAtual = 1; // Voltar para primeira página ao trocar categoria
      renderizarProdutos();
    });
  });
}

function configurarBotoesCarrinho() {
  // Armazenar quantidades de cada produto
  var produtoQuantidades = {};
  
  // Botões de adicionar
  document.querySelectorAll('.add-product').forEach(function (btn) {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function () {
      var id = parseInt(btn.getAttribute('data-id'));
      var name = btn.getAttribute('data-name') || 'Produto';
      var price = parseFloat(btn.getAttribute('data-price')) || 0;
      var container = btn.parentElement;
      
      // Inicializar quantidade
      if (!produtoQuantidades[id]) {
        produtoQuantidades[id] = 0;
      }
      produtoQuantidades[id] = 1;
      
      // Adicionar ao carrinho
      window.adicionarAoCarrinho({ produto_id: id, name: name, price: price });
      
      // Trocar para controles de quantidade
      btn.classList.add('hidden');
      var controls = container.querySelector('.quantity-controls');
      controls.classList.remove('hidden');
      controls.querySelector('.qty-display').textContent = '1';
    });
  });
  
  // Botões de diminuir quantidade
  document.querySelectorAll('.qty-minus').forEach(function(btn) {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function() {
      var id = parseInt(btn.getAttribute('data-id'));
      var container = btn.closest('.product-btn-container');
      var display = container.querySelector('.qty-display');
      var quantidade = parseInt(display.textContent);
      
      if (quantidade > 1) {
        quantidade--;
        display.textContent = quantidade;
        produtoQuantidades[id] = quantidade;
      } else {
        // Remover do carrinho e voltar ao botão adicionar
        var produto = encontrarProdutoPorId(id);
        if (produto && window.removerDoCarrinho) {
          window.removerDoCarrinho(id);
        }
        container.querySelector('.add-product').classList.remove('hidden');
        container.querySelector('.quantity-controls').classList.add('hidden');
        produtoQuantidades[id] = 0;
      }
    });
  });
  
  // Botões de aumentar quantidade
  document.querySelectorAll('.qty-plus').forEach(function(btn) {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function() {
      var id = parseInt(btn.getAttribute('data-id'));
      var container = btn.closest('.product-btn-container');
      var display = container.querySelector('.qty-display');
      var quantidade = parseInt(display.textContent);
      var produto = encontrarProdutoPorId(id);
      
      if (produto && quantidade < (produto.estoque || 999)) {
        quantidade++;
        display.textContent = quantidade;
        produtoQuantidades[id] = quantidade;
        
        // Adicionar mais um ao carrinho
        window.adicionarAoCarrinho({ 
          produto_id: id, 
          name: produto.nome, 
          price: parseFloat(produto.preco) 
        });
      }
    });
  });
}

function pontuacaoMaisVendido(produto) {
  if (!produto) return 0;

  var campos = ['vendas', 'total_vendas', 'qtd_vendida', 'vendidos', 'popularidade', 'score'];
  for (var i = 0; i < campos.length; i++) {
    var valor = produto[campos[i]];
    if (typeof valor === 'number' && !isNaN(valor)) return valor;
    if (typeof valor === 'string') {
      var n = parseFloat(valor);
      if (!isNaN(n)) return n;
    }
  }

  // Fallback: usa estoque como proxy (melhor que aleatório)
  var estoque = produto.estoque;
  if (typeof estoque === 'number' && !isNaN(estoque)) return estoque;
  if (typeof estoque === 'string') {
    var e = parseFloat(estoque);
    if (!isNaN(e)) return e;
  }
  return 0;
}

function renderizarMaisVendidos() {
  var lista = document.getElementById('bestSellersList');
  if (!lista) return;
  if (!Array.isArray(produtos) || produtos.length === 0) {
    lista.innerHTML = '<p class="no-products">Carregando destaques...</p>';
    return;
  }

  var candidatos = produtos.slice();
  candidatos.sort(function(a, b) {
    return pontuacaoMaisVendido(b) - pontuacaoMaisVendido(a);
  });

  // Pega os 10 primeiros e evita itens sem preço
  var top = candidatos.filter(function(p){
    return p && p.nome && p.preco !== undefined && p.preco !== null;
  }).slice(0, 10);

  lista.innerHTML = '';

  top.forEach(function(produto){
    var article = document.createElement('article');
    article.className = 'mini-product';
    article.dataset.productId = produto.id;

    var emojiDiv = document.createElement('div');
    emojiDiv.className = 'product-image';
    emojiDiv.textContent = produto.emoji || '🛒';

    var h4 = document.createElement('h4');
    h4.textContent = produto.nome;

    var priceP = document.createElement('p');
    priceP.className = 'price';
    var preco = parseFloat(produto.preco);
    var precoFormatado = 'R$ ' + preco.toFixed(2).replace('.', ',');
    if (produto.unidade) {
      precoFormatado += ' / ' + produto.unidade;
    }
    priceP.textContent = precoFormatado;

    var btnContainer = document.createElement('div');
    btnContainer.className = 'product-btn-container';
    btnContainer.setAttribute('data-product-id', produto.id);

    var button = document.createElement('button');
    button.className = 'btn add-product';
    button.setAttribute('data-id', produto.id);
    button.setAttribute('data-name', produto.nome);
    button.setAttribute('data-price', preco);
    button.textContent = 'Adicionar';

    var quantityControls = document.createElement('div');
    quantityControls.className = 'quantity-controls hidden';
    quantityControls.innerHTML =
      '<button class="qty-btn qty-minus" data-id="' + produto.id + '">−</button>' +
      '<span class="qty-display">1</span>' +
      '<button class="qty-btn qty-plus" data-id="' + produto.id + '">+</button>';

    btnContainer.appendChild(button);
    btnContainer.appendChild(quantityControls);

    article.appendChild(emojiDiv);
    article.appendChild(h4);
    article.appendChild(priceP);
    article.appendChild(btnContainer);
    lista.appendChild(article);
  });

  // Reaproveita o mesmo sistema de carrinho sem duplicar listeners
  configurarBotoesCarrinho();
}

// Função auxiliar para encontrar produto por ID
function encontrarProdutoPorId(id) {
  return produtos.find(function(p) { return p.id === id; });
}

// Modal de detalhes do produto
function mostrarDetalhesProduto(produto) {
  var modal = document.getElementById('detalhesModal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'detalhesModal';
    modal.className = 'modal-detalhes';
    document.body.appendChild(modal);
  }
  
  var preco = parseFloat(produto.preco);
  var validadeFormatada = 'Não informada';
  if (produto.validade) {
    var dataValidade = new Date(produto.validade);
    validadeFormatada = dataValidade.toLocaleDateString('pt-BR');
  }
  
  modal.innerHTML = 
    '<div class="modal-detalhes-content">' +
      '<button class="modal-close" onclick="fecharDetalhes()">✕</button>' +
      '<div class="detalhes-grid">' +
        '<div class="detalhes-imagem">' +
          '<div class="detalhes-emoji">' + (produto.emoji || '🛒') + '</div>' +
        '</div>' +
        '<div class="detalhes-info">' +
          '<h2>' + produto.nome + '</h2>' +
          '<p class="detalhes-descricao">' + (produto.descricao || 'Produto de qualidade') + '</p>' +
          '<div class="detalhes-preco">' +
            '<span class="preco-valor">R$ ' + preco.toFixed(2).replace('.', ',') + '</span>' +
            (produto.unidade ? '<span class="preco-unidade"> / ' + produto.unidade + '</span>' : '') +
          '</div>' +
          '<div class="detalhes-specs">' +
            '<div class="spec-item">' +
              '<span class="spec-label">🏭 Marca:</span>' +
              '<span class="spec-value">' + (produto.marca || 'Não informada') + '</span>' +
            '</div>' +
            '<div class="spec-item">' +
              '<span class="spec-label">📦 Estoque:</span>' +
              '<span class="spec-value">' + (produto.estoque || 0) + ' ' + (produto.unidade || 'unidades') + '</span>' +
            '</div>' +
            '<div class="spec-item">' +
              '<span class="spec-label">📅 Validade:</span>' +
              '<span class="spec-value">' + validadeFormatada + '</span>' +
            '</div>' +
            '<div class="spec-item">' +
              '<span class="spec-label">🏷️ Categoria:</span>' +
              '<span class="spec-value">' + produto.categoria + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="detalhes-actions">' +
            '<button class="btn btn-primary btn-adicionar-detalhes" ' +
              'data-id="' + produto.id + '" ' +
              'data-name="' + produto.nome + '" ' +
              'data-price="' + preco + '">' +
              '🛒 Adicionar ao Carrinho' +
            '</button>' +
            '<div class="quantity-controls-detalhes hidden" data-produto-id="' + produto.id + '">' +
              '<button class="qty-btn qty-minus-detalhes" data-id="' + produto.id + '">−</button>' +
              '<span class="qty-display">1</span>' +
              '<button class="qty-btn qty-plus-detalhes" data-id="' + produto.id + '">+</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  
  modal.classList.add('show');
  
  // Event listener para adicionar ao carrinho
  modal.querySelector('.btn-adicionar-detalhes').addEventListener('click', function() {
    var id = parseInt(this.getAttribute('data-id'));
    var name = this.getAttribute('data-name');
    var price = parseFloat(this.getAttribute('data-price'));
    
    window.adicionarAoCarrinho({ produto_id: id, name: name, price: price });
    
    // Esconder botão e mostrar controles
    this.classList.add('hidden');
    var controls = modal.querySelector('.quantity-controls-detalhes');
    controls.classList.remove('hidden');
    controls.querySelector('.qty-display').textContent = '1';
  });
  
  // Event listener para botão de diminuir quantidade no modal
  modal.querySelector('.qty-minus-detalhes').addEventListener('click', function() {
    var id = parseInt(this.getAttribute('data-id'));
    var controls = modal.querySelector('.quantity-controls-detalhes');
    var display = controls.querySelector('.qty-display');
    var quantidade = parseInt(display.textContent);
    
    if (quantidade > 1) {
      quantidade--;
      display.textContent = quantidade;
    } else {
      // Remover do carrinho e voltar ao botão adicionar
      if (window.removerDoCarrinho) {
        window.removerDoCarrinho(id);
      }
      controls.classList.add('hidden');
      modal.querySelector('.btn-adicionar-detalhes').classList.remove('hidden');
    }
  });
  
  // Event listener para botão de aumentar quantidade no modal
  modal.querySelector('.qty-plus-detalhes').addEventListener('click', function() {
    var id = parseInt(this.getAttribute('data-id'));
    var controls = modal.querySelector('.quantity-controls-detalhes');
    var display = controls.querySelector('.qty-display');
    var quantidade = parseInt(display.textContent);
    var produtoAtual = encontrarProdutoPorId(id);
    
    if (produtoAtual && quantidade < (produtoAtual.estoque || 999)) {
      quantidade++;
      display.textContent = quantidade;
      
      // Adicionar mais um ao carrinho
      window.adicionarAoCarrinho({ 
        produto_id: id, 
        name: produtoAtual.nome, 
        price: parseFloat(produtoAtual.preco) 
      });
    }
  });
  
  // Fechar ao clicar fora
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      fecharDetalhes();
    }
  });
}

function fecharDetalhes() {
  var modal = document.getElementById('detalhesModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Configurar setores (atalhos visuais)
function configurarSetores() {
  document.querySelectorAll('.sector-card').forEach(function(card) {
    card.addEventListener('click', function() {
      var category = card.getAttribute('data-category') || 'todas';
      var searchTerm = card.getAttribute('data-search') || '';

      categoriaAtual = category;
      buscaAtual = searchTerm;

      var searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = searchTerm;

      document.querySelectorAll('.category-btn').forEach(function(b) {
        var isActive = b.getAttribute('data-category') === category;
        b.classList.toggle('active', isActive);
      });

      paginaAtual = 1; // Voltar para primeira página
      renderizarProdutos();

      var produtosSection = document.getElementById('produtos');
      if (produtosSection) {
        produtosSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ============================================
// SISTEMA DE PAGINAÇÃO
// ============================================

function atualizarPaginacao(totalProdutos) {
  var paginationContainer = document.querySelector('.pagination-container');
  
  // Criar container se não existir
  if (!paginationContainer) {
    var productsSection = document.getElementById('produtos');
    if (!productsSection) return;
    
    paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-container';
    productsSection.appendChild(paginationContainer);
  }
  
  // Limpar container
  paginationContainer.innerHTML = '';
  
  if (totalProdutos === 0) return;
  
  var totalPaginas = Math.ceil(totalProdutos / produtosPorPagina);
  
  if (totalPaginas <= 1) return; // Não mostrar paginação se houver apenas 1 página
  
  // Info de produtos
  var inicio = (paginaAtual - 1) * produtosPorPagina + 1;
  var fim = Math.min(paginaAtual * produtosPorPagina, totalProdutos);
  
  var infoDiv = document.createElement('div');
  infoDiv.className = 'pagination-info';
  infoDiv.textContent = 'Mostrando ' + inicio + '-' + fim + ' de ' + totalProdutos + ' produtos';
  
  // Controles de navegação
  var controlsDiv = document.createElement('div');
  controlsDiv.className = 'pagination-controls';
  
  // Botão Anterior
  var btnAnterior = document.createElement('button');
  btnAnterior.className = 'pagination-btn';
  btnAnterior.textContent = '← Anterior';
  btnAnterior.disabled = paginaAtual === 1;
  btnAnterior.onclick = function() {
    if (paginaAtual > 1) {
      paginaAtual--;
      renderizarProdutos();
      scrollParaTopo();
    }
  };
  
  // Números de página
  var numerosDiv = document.createElement('div');
  numerosDiv.className = 'pagination-numbers';
  
  // Lógica para mostrar números de página
  var inicio = Math.max(1, paginaAtual - 2);
  var fim = Math.min(totalPaginas, paginaAtual + 2);
  
  // Primeira página
  if (inicio > 1) {
    var btn1 = criarBotaoPagina(1);
    numerosDiv.appendChild(btn1);
    if (inicio > 2) {
      var span = document.createElement('span');
      span.textContent = '...';
      span.className = 'pagination-ellipsis';
      numerosDiv.appendChild(span);
    }
  }
  
  // Páginas intermediárias
  for (var i = inicio; i <= fim; i++) {
    var btnPagina = criarBotaoPagina(i);
    numerosDiv.appendChild(btnPagina);
  }
  
  // Última página
  if (fim < totalPaginas) {
    if (fim < totalPaginas - 1) {
      var span = document.createElement('span');
      span.textContent = '...';
      span.className = 'pagination-ellipsis';
      numerosDiv.appendChild(span);
    }
    var btnUltima = criarBotaoPagina(totalPaginas);
    numerosDiv.appendChild(btnUltima);
  }
  
  // Botão Próximo
  var btnProximo = document.createElement('button');
  btnProximo.className = 'pagination-btn';
  btnProximo.textContent = 'Próximo →';
  btnProximo.disabled = paginaAtual === totalPaginas;
  btnProximo.onclick = function() {
    if (paginaAtual < totalPaginas) {
      paginaAtual++;
      renderizarProdutos();
      scrollParaTopo();
    }
  };
  
  controlsDiv.appendChild(btnAnterior);
  controlsDiv.appendChild(numerosDiv);
  controlsDiv.appendChild(btnProximo);
  
  paginationContainer.appendChild(infoDiv);
  paginationContainer.appendChild(controlsDiv);
}

function criarBotaoPagina(numero) {
  var btn = document.createElement('button');
  btn.className = 'pagination-number';
  if (numero === paginaAtual) {
    btn.classList.add('active');
  }
  btn.textContent = numero;
  btn.onclick = function() {
    paginaAtual = numero;
    renderizarProdutos();
    scrollParaTopo();
  };
  return btn;
}

function scrollParaTopo() {
  var produtosSection = document.getElementById('produtos');
  if (produtosSection) {
    produtosSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
