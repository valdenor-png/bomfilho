// ============================================
// APLICAÇÃO PRINCIPAL (POO)
// Orquestra todas as classes
// ============================================

class App {
  constructor() {
    this.api = null;
    this.auth = null;
    this.cart = null;
    this.products = null;
    this.carousel = null;
  }

  async inicializar() {
    console.log('🚀 Inicializando aplicação (POO)...');

    // Inicializar API Client
    this.api = new ApiClient('http://localhost:3000/api');

    // Inicializar sistema de autenticação
    this.auth = new AuthManager(this.api);
    await this.auth.inicializar();

    // Inicializar carrinho
    this.cart = new CartManager(this.api, this.auth);
    this.cart.inicializar();

    // Inicializar produtos
    this.products = new ProductManager(this.api, this.cart);
    await this.products.inicializar();

    // Inicializar carrossel
    this.carousel = new CarouselManager();
    this.carousel.inicializar();

    // Configurar menu mobile
    this.configurarMenuMobile();

    // Configurar formulário de contato
    this.configurarFormularioContato();

    console.log('✅ Aplicação iniciada com sucesso!');
  }

  configurarMenuMobile() {
    const menuToggle = document.getElementById('menuToggle');
    const mainNav = document.getElementById('mainNav');
    
    if (menuToggle && mainNav) {
      menuToggle.addEventListener('click', () => {
        mainNav.classList.toggle('show');
      });
    }
  }

  configurarFormularioContato() {
    const form = document.getElementById('contactForm');
    const formMessage = document.getElementById('formMessage');
    
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!formMessage) return;

      formMessage.textContent = '';
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const message = document.getElementById('message').value.trim();

      if (!name || !email || !message) {
        formMessage.style.color = 'crimson';
        formMessage.textContent = 'Preencha todos os campos.';
        return;
      }

      formMessage.style.color = 'green';
      formMessage.textContent = 'Mensagem enviada! Entraremos em contato.';
      form.reset();
    });
  }

  // Métodos para acessar instâncias
  getAuth() {
    return this.auth;
  }

  getCart() {
    return this.cart;
  }

  getProducts() {
    return this.products;
  }

  getCarousel() {
    return this.carousel;
  }
}

// Instância global da aplicação
let app;

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
  app = new App();
  await app.inicializar();
});
