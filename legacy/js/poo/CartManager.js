// ============================================
// CLASSE DE CARRINHO
// ============================================

class CartManager {
  constructor(apiClient, authManager) {
    this.api = apiClient;
    this.auth = authManager;
    this.items = [];
    this.total = 0;
    this.modal = null;
  }

  inicializar() {
    this.criarModal();
    this.configurarEventos();
    this.atualizarUI();
  }

  criarModal() {
    this.modal = document.createElement('div');
    this.modal.id = 'cartModal';
    this.modal.className = 'cart-modal';
    this.modal.innerHTML = `
      <div class="cart-modal-content">
        <div class="cart-header">
          <h3>🛒 Meu Carrinho</h3>
          <button id="closeCart" class="close-cart" aria-label="Fechar">✕</button>
        </div>
        <div id="cartItems" class="cart-items"></div>
        <div class="cart-footer">
          <div class="cart-total">
            <strong>Total:</strong> <span id="cartTotal">R$ 0,00</span>
          </div>
          <button id="clearCart" class="btn btn-secondary">Limpar Carrinho</button>
          <button id="checkoutBtn" class="btn btn-primary">Finalizar Pedido</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.modal);
  }

  configurarEventos() {
    const cartBtn = document.getElementById('cartBtn');
    cartBtn.addEventListener('click', () => this.abrirModal());

    document.getElementById('closeCart').addEventListener('click', () => this.fecharModal());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.fecharModal();
    });

    document.getElementById('clearCart').addEventListener('click', () => this.limpar());
    document.getElementById('checkoutBtn').addEventListener('click', () => this.finalizar());
  }

  adicionar(produto) {
    this.items.push(produto);
    this.total += produto.price;
    this.atualizarUI();
  }

  remover(index) {
    this.total -= this.items[index].price;
    this.items.splice(index, 1);
    this.atualizarUI();
  }

  limpar() {
    if (confirm('Deseja realmente limpar o carrinho?')) {
      this.items = [];
      this.total = 0;
      this.atualizarUI();
    }
  }

  atualizarUI() {
    this.atualizarContador();
    this.atualizarModal();
  }

  atualizarContador() {
    const cartCountEl = document.getElementById('cartCount');
    if (cartCountEl) {
      cartCountEl.textContent = this.items.length;
    }
  }

  atualizarModal() {
    const cartItemsEl = document.getElementById('cartItems');
    const cartTotalEl = document.getElementById('cartTotal');
    
    if (!cartItemsEl || !cartTotalEl) return;

    if (this.items.length === 0) {
      cartItemsEl.innerHTML = '<p class="cart-empty">Seu carrinho está vazio</p>';
    } else {
      cartItemsEl.innerHTML = '';
      this.items.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        itemDiv.innerHTML = `
          <div class="cart-item-info">
            <strong>${item.name}</strong>
            <span class="cart-item-price">R$ ${item.price.toFixed(2).replace('.', ',')}</span>
          </div>
          <button class="remove-item" data-index="${index}" aria-label="Remover">🗑️</button>
        `;
        cartItemsEl.appendChild(itemDiv);
      });

      document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const index = parseInt(btn.getAttribute('data-index'));
          this.remover(index);
        });
      });
    }

    cartTotalEl.textContent = 'R$ ' + this.total.toFixed(2).replace('.', ',');
  }

  async finalizar() {
    if (this.items.length === 0) {
      alert('Seu carrinho está vazio!');
      return;
    }

    if (!this.auth.estaLogado()) {
      alert('Faça login para finalizar o pedido!');
      this.fecharModal();
      document.getElementById('userModal').classList.add('show');
      this.auth.mostrarLogin();
      return;
    }

    try {
      const itens = this.items.map(item => ({
        produto_id: item.produto_id,
        nome: item.name,
        preco: item.price,
        quantidade: 1
      }));

      const resultado = await this.api.post('/pedidos', { itens }, this.auth.getToken());

      if (resultado.erro) {
        alert('Erro: ' + resultado.erro);
        return;
      }

      const mensagem = `🎉 Pedido realizado com sucesso!\n\nPedido #${resultado.pedido_id}\nTotal: R$ ${resultado.total.toFixed(2).replace('.', ',')}\n\nObrigado pela preferência!`;
      alert(mensagem);
      
      this.items = [];
      this.total = 0;
      this.atualizarUI();
      this.fecharModal();
    } catch (erro) {
      console.error('Erro ao finalizar pedido:', erro);
      alert('Erro ao finalizar pedido. Tente novamente.');
    }
  }

  abrirModal() {
    this.modal.classList.add('show');
  }

  fecharModal() {
    this.modal.classList.remove('show');
  }

  getItems() {
    return this.items;
  }

  getTotal() {
    return this.total;
  }
}
