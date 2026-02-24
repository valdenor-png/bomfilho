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

  // Menu mobile
  var menuToggle = document.getElementById('menuToggle');
  var mainNav = document.getElementById('mainNav');
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', function () {
      mainNav.classList.toggle('show');
    });
  }
});
