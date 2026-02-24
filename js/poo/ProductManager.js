// ============================================
// CLASSE DE PRODUTOS
// ============================================

class ProductManager {
  constructor(apiClient, cartManager) {
    this.api = apiClient;
    this.cart = cartManager;
    this.produtos = [];
    this.categoriaAtual = 'todas';
    this.buscaAtual = '';
    this.container = null;
  }

  async inicializar() {
    this.container = document.querySelector('.products');
    await this.carregar();
    this.renderizar();
    this.configurarBusca();
    this.configurarCategorias();
  }

  async carregar() {
    try {
      const resultado = await this.api.get('/produtos');
      if (resultado.produtos) {
        this.produtos = resultado.produtos;
      }
    } catch (erro) {
      console.error('Erro ao carregar produtos:', erro);
      alert('Erro ao carregar produtos. Verifique se o servidor está rodando.');
    }
  }

  filtrar() {
    return this.produtos.filter(produto => {
      const passaCategoria = this.categoriaAtual === 'todas' || produto.categoria === this.categoriaAtual;
      const passaBusca = this.buscaAtual === '' || produto.nome.toLowerCase().includes(this.buscaAtual.toLowerCase());
      return passaCategoria && passaBusca;
    });
  }

  renderizar() {
    if (!this.container) return;

    this.container.innerHTML = '';
    const produtosFiltrados = this.filtrar();

    if (produtosFiltrados.length === 0) {
      this.container.innerHTML = '<p class="no-products">Nenhum produto encontrado</p>';
      return;
    }

    produtosFiltrados.forEach(produto => {
      const card = this.criarCardProduto(produto);
      this.container.appendChild(card);
    });

    this.configurarBotoesCarrinho();
  }

  criarCardProduto(produto) {
    const article = document.createElement('article');
    article.className = 'product';

    const preco = parseFloat(produto.preco);
    const precoFormatado = 'R$ ' + preco.toFixed(2).replace('.', ',') + (produto.unidade ? ' / ' + produto.unidade : '');

    // Dados simulados para o hover
    const estoque = Math.floor(Math.random() * 50) + 10;
    const marcas = ['Aurora', 'Sadia', 'Qualy', 'Nestlé', 'Panco', 'Plus Vita', 'Taeq', 'Coca-Cola'];
    const marca = produto.marca || marcas[Math.floor(Math.random() * marcas.length)];
    
    const diasValidade = Math.floor(Math.random() * 150) + 30;
    const dataValidade = new Date();
    dataValidade.setDate(dataValidade.getDate() + diasValidade);
    const validade = dataValidade.toLocaleDateString('pt-BR');

    article.innerHTML = `
      <div class="product-image">${produto.emoji || '🛒'}</div>
      <h4>${produto.nome}</h4>
      <p class="price">${precoFormatado}</p>
      <div class="product-info">
        <div class="product-info-item">
          <span class="product-info-label">🏭 Marca:</span>
          <span>${marca}</span>
        </div>
        <div class="product-info-item">
          <span class="product-info-label">📅 Validade:</span>
          <span>${validade}</span>
        </div>
        <div class="product-info-item">
          <span class="product-info-label">📦 Estoque:</span>
          <span>${estoque} unidades</span>
        </div>
        <div class="product-info-item">
          <span class="product-info-label">💰 Preço unitário:</span>
          <span>R$ ${preco.toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="product-info-item">
          <span class="product-info-label">📏 Unidade:</span>
          <span>${produto.unidade || 'un'}</span>
        </div>
      </div>
      <button class="btn add-product" data-id="${produto.id}" data-name="${produto.nome}" data-price="${preco}">
        Adicionar
      </button>
    `;

    return article;
  }

  configurarBotoesCarrinho() {
    document.querySelectorAll('.add-product').forEach(btn => {
      btn.addEventListener('click', () => {
        const produto = {
          produto_id: parseInt(btn.getAttribute('data-id')),
          name: btn.getAttribute('data-name'),
          price: parseFloat(btn.getAttribute('data-price'))
        };
        
        this.cart.adicionar(produto);
        
        // Feedback visual
        btn.textContent = 'Adicionado ✓';
        btn.disabled = true;
        setTimeout(() => {
          btn.textContent = 'Adicionar';
          btn.disabled = false;
        }, 900);
      });
    });
  }

  configurarBusca() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
      this.buscaAtual = searchInput.value;
      this.renderizar();
    });
  }

  configurarCategorias() {
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.categoriaAtual = btn.getAttribute('data-category');
        this.renderizar();
      });
    });
  }

  setProdutos(produtos) {
    this.produtos = produtos;
  }

  getProdutos() {
    return this.produtos;
  }
}
