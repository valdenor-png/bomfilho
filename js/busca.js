// ===================================================================
// MÓDULO DE BUSCA INTELIGENTE
// ===================================================================
// Sistema de busca com autocomplete, sugestões e filtros
// ===================================================================

var searchCache = [];
var searchTimeout = null;
var MIN_SEARCH_LENGTH = 2;

// ===================================================================
// FUNÇÃO: Inicializar Sistema de Busca
// ===================================================================
function inicializarBusca() {
  var inputBusca = document.getElementById('searchInput');
  if (!inputBusca) return;

  // Evitar múltiplas inicializações (e listeners duplicados)
  if (inputBusca.dataset.buscaInit === '1') return;
  inputBusca.dataset.buscaInit = '1';

  // Event listeners
  inputBusca.addEventListener('input', handleSearchInput);
  inputBusca.addEventListener('focus', handleSearchFocus);
  inputBusca.addEventListener('blur', handleSearchBlur);
  inputBusca.addEventListener('keydown', handleSearchKeydown);

  // Carregar todos os produtos para o cache
  carregarCacheBusca();

  // Criar container de sugestões se não existir
  if (!document.getElementById('searchSuggestions')) {
    var suggestions = document.createElement('div');
    suggestions.id = 'searchSuggestions';
    suggestions.className = 'search-suggestions';
    inputBusca.parentNode.appendChild(suggestions);
  }
}

// ===================================================================
// FUNÇÃO: Carregar Cache de Produtos
// ===================================================================
async function carregarCacheBusca() {
  try {
    // Preferir dados já carregados pelo módulo de produtos
    if (typeof produtos !== 'undefined' && Array.isArray(produtos) && produtos.length > 0) {
      searchCache = produtos;
      return;
    }

    // Preferir o client central (api-config.js) para respeitar a baseURL
    if (typeof API !== 'undefined' && API && typeof API.get === 'function') {
      var data = await API.get('/produtos');
      searchCache = (data && data.produtos) ? data.produtos : [];
      return;
    }

    // Fallback
    var baseUrl = (typeof API_CONFIG !== 'undefined' && API_CONFIG && API_CONFIG.baseURL)
      ? API_CONFIG.baseURL
      : 'http://localhost:3000/api';
    var response = await fetch(baseUrl + '/produtos');
    var dataFallback = await response.json();
    searchCache = dataFallback.produtos || [];
  } catch (error) {
    console.error('Erro ao carregar produtos para busca:', error);
  }
}

// ===================================================================
// FUNÇÃO: Handle Input de Busca
// ===================================================================
function handleSearchInput(e) {
  var termo = e.target.value.trim();

  // Limpar timeout anterior
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  // Se o termo for muito curto, esconder sugestões
  if (termo.length < MIN_SEARCH_LENGTH) {
    esconderSugestoes();

    // Ainda assim, aplica o filtro na listagem (sem autocomplete)
    if (termo.length > 0) {
      filtrarProdutosExibidos(termo);
      return;
    }
    
    // Se estiver vazio, mostrar todos os produtos
    if (termo.length === 0) {
      filtrarProdutosExibidos('');
    }
    return;
  }

  // Debounce: aguardar 300ms após parar de digitar
  searchTimeout = setTimeout(function() {
    realizarBusca(termo);
  }, 300);
}

// ===================================================================
// FUNÇÃO: Handle Focus
// ===================================================================
function handleSearchFocus(e) {
  var termo = e.target.value.trim();
  if (termo.length >= MIN_SEARCH_LENGTH) {
    realizarBusca(termo);
  }
}

// ===================================================================
// FUNÇÃO: Handle Blur
// ===================================================================
function handleSearchBlur() {
  // Delay para permitir clique nas sugestões
  setTimeout(function() {
    esconderSugestoes();
  }, 200);
}

// ===================================================================
// FUNÇÃO: Handle Keydown (navegação por teclado)
// ===================================================================
function handleSearchKeydown(e) {
  var suggestions = document.getElementById('searchSuggestions');
  var items = suggestions.querySelectorAll('.suggestion-item');
  var activeItem = suggestions.querySelector('.suggestion-item.active');
  var activeIndex = Array.from(items).indexOf(activeItem);

  switch(e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (activeIndex < items.length - 1) {
        if (activeItem) activeItem.classList.remove('active');
        items[activeIndex + 1].classList.add('active');
      } else if (items.length > 0) {
        if (activeItem) activeItem.classList.remove('active');
        items[0].classList.add('active');
      }
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (activeIndex > 0) {
        activeItem.classList.remove('active');
        items[activeIndex - 1].classList.add('active');
      } else if (items.length > 0) {
        if (activeItem) activeItem.classList.remove('active');
        items[items.length - 1].classList.add('active');
      }
      break;

    case 'Enter':
      e.preventDefault();
      if (activeItem) {
        activeItem.click();
      }
      break;

    case 'Escape':
      esconderSugestoes();
      e.target.blur();
      break;
  }
}

// ===================================================================
// FUNÇÃO: Realizar Busca
// ===================================================================
function realizarBusca(termo) {
  termo = termo.toLowerCase();

  // Buscar produtos que correspondem ao termo
  var resultados = searchCache.filter(function(produto) {
    var nomeMatch = produto.nome.toLowerCase().includes(termo);
    var categoriaMatch = produto.categoria.toLowerCase().includes(termo);
    var marcaMatch = produto.marca && produto.marca.toLowerCase().includes(termo);
    var descricaoMatch = produto.descricao && produto.descricao.toLowerCase().includes(termo);
    
    return nomeMatch || categoriaMatch || marcaMatch || descricaoMatch;
  });

  // Ordenar por relevância (nome primeiro, depois categoria)
  resultados.sort(function(a, b) {
    var aNome = a.nome.toLowerCase().startsWith(termo) ? 0 : 1;
    var bNome = b.nome.toLowerCase().startsWith(termo) ? 0 : 1;
    return aNome - bNome;
  });

  // Limitar a 8 resultados
  resultados = resultados.slice(0, 8);

  // Mostrar sugestões
  mostrarSugestoes(resultados, termo);

  // Filtrar produtos exibidos
  filtrarProdutosExibidos(termo);
}

// ===================================================================
// FUNÇÃO: Mostrar Sugestões
// ===================================================================
function mostrarSugestoes(resultados, termo) {
  var container = document.getElementById('searchSuggestions');
  
  if (resultados.length === 0) {
    container.innerHTML = '<div class="suggestion-empty">Nenhum produto encontrado</div>';
    container.classList.add('show');
    return;
  }

  var html = '';
  
  resultados.forEach(function(produto, index) {
    var nomeHighlight = highlightTermo(produto.nome, termo);
    var preco = parseFloat(produto.preco).toFixed(2).replace('.', ',');
    
    html += '<div class="suggestion-item' + (index === 0 ? ' active' : '') + '" ' +
            'onclick="selecionarSugestao(' + produto.id + ')">' +
            '<span class="suggestion-emoji">' + produto.emoji + '</span>' +
            '<div class="suggestion-info">' +
              '<div class="suggestion-nome">' + nomeHighlight + '</div>' +
              '<div class="suggestion-details">' +
                '<span class="suggestion-categoria">' + produto.categoria + '</span>' +
                (produto.marca ? '<span class="suggestion-marca">' + produto.marca + '</span>' : '') +
              '</div>' +
            '</div>' +
            '<span class="suggestion-preco">R$ ' + preco + '</span>' +
          '</div>';
  });

  container.innerHTML = html;
  container.classList.add('show');
}

// ===================================================================
// FUNÇÃO: Highlight do Termo de Busca
// ===================================================================
function highlightTermo(texto, termo) {
  // Escapa caracteres especiais para evitar RegExp inválida
  var termoEscapado = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var regex = new RegExp('(' + termoEscapado + ')', 'gi');
  return texto.replace(regex, '<strong>$1</strong>');
}

// ===================================================================
// FUNÇÃO: Esconder Sugestões
// ===================================================================
function esconderSugestoes() {
  var container = document.getElementById('searchSuggestions');
  container.classList.remove('show');
}

// ===================================================================
// FUNÇÃO: Selecionar Sugestão
// ===================================================================
function selecionarSugestao(produtoId) {
  // Encontrar o produto
  var produto = searchCache.find(function(p) { return p.id === produtoId; });
  
  if (produto) {
    // Atualizar input de busca
    document.getElementById('searchInput').value = produto.nome;

    // Aplicar filtro usando o render/paginação do módulo de produtos
    filtrarProdutosExibidos(produto.nome);

    // Rolar até o produto
    setTimeout(function () {
      var produtoElement = document.querySelector('[data-product-id="' + produtoId + '"]');
      if (!produtoElement) return;

      produtoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Highlight temporário
      produtoElement.classList.add('highlight-product');
      setTimeout(function() {
        produtoElement.classList.remove('highlight-product');
      }, 2000);
    }, 0);
  }
  
  esconderSugestoes();
}

// ===================================================================
// FUNÇÃO: Filtrar Produtos Exibidos
// ===================================================================
function filtrarProdutosExibidos(termo) {
  // Integrar com o módulo de produtos (paginação + render)
  if (typeof buscaAtual !== 'undefined') {
    buscaAtual = (termo || '').toString();
  }
  if (typeof paginaAtual !== 'undefined') {
    paginaAtual = 1;
  }
  if (typeof renderizarProdutos === 'function') {
    renderizarProdutos();
  }
}

// ===================================================================
// FUNÇÃO: Limpar Busca
// ===================================================================
function limparBusca() {
  var input = document.getElementById('searchInput');
  input.value = '';
  esconderSugestoes();
  filtrarProdutosExibidos('');
}

// ===================================================================
// EXPORT GLOBAL
// ===================================================================
window.inicializarBusca = inicializarBusca;
window.selecionarSugestao = selecionarSugestao;
window.limparBusca = limparBusca;

console.log('✅ Módulo de Busca Inteligente carregado');
