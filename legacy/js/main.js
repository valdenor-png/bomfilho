// ============================================
// ARQUIVO PRINCIPAL
// Inicialização e coordenação dos módulos
// ============================================

document.addEventListener('DOMContentLoaded', async function () {
  // Inicializar carrossel de promoções
  inicializarCarrossel();

  // Inicializar sistema de usuário (login/cadastro)
  await inicializarSistemaUsuario();

  // Inicializar carrinho de compras
  inicializarCarrinho();

  // Inicializar listas de compras
  inicializarListas();

  // Carregar cupons disponíveis
  await carregarCuponsDisponiveis();

  // Carregar produtos do backend
  await carregarProdutos();

  // Renderizar produtos dinamicamente
  renderizarProdutos();

  // Renderizar seção "Mais vendidos"
  if (typeof renderizarMaisVendidos === 'function') {
    renderizarMaisVendidos();
  }
  
  // Mostrar seção de ofertas
  mostrarSecaoOfertas();
  
  // Inicializar sistema de busca inteligente
  inicializarBusca();
  
  // Configurar filtros de categoria
  configurarCategorias();

  // Configurar setores (atalhos visuais)
  configurarSetores();

  // Sidebar fixo
  var menuToggle = document.getElementById('menuToggle');
  var mainNav = document.getElementById('mainNav');
  var cartBtn = document.getElementById('cartBtn');
  var userBtn = document.getElementById('userBtn');
  var historicoBtn = document.getElementById('historicoBtn');

  function expandirSidebar() {
    mainNav.classList.add('show');
  }

  function recolherSidebar() {
    mainNav.classList.remove('show');
  }

  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', function () {
      if (mainNav.classList.contains('show')) {
        recolherSidebar();
      } else {
        expandirSidebar();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && mainNav.classList.contains('show')) {
        recolherSidebar();
      }
    });

    mainNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function (event) {
        var action = link.getAttribute('data-action');

        if (!mainNav.classList.contains('show')) {
          expandirSidebar();
        }

        if (action === 'cart') {
          event.preventDefault();
          if (cartBtn) {
            cartBtn.click();
          }
        }

        if (action === 'historico') {
          event.preventDefault();
          if (historicoBtn) {
            historicoBtn.click();
          }
        }
        
        if (action === 'account') {
          event.preventDefault();
          if (userBtn) {
            userBtn.click();
          }
        }
      });
    });
  }
});
