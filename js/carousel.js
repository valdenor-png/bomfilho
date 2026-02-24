// ============================================
// MÓDULO DE CARROSSEL
// Carrossel automático de promoções e banners
// ============================================

function inicializarCarrossel() {
  var slides = document.querySelectorAll('.carousel-slide');
  var dots = document.querySelectorAll('.carousel-dot');
  var btnPrev = document.querySelector('.carousel-btn.prev');
  var btnNext = document.querySelector('.carousel-btn.next');
  
  if (slides.length === 0) return;
  
  var slideAtual = 0;
  var intervaloAuto;

  function mostrarSlide(index) {
    // Garantir que o índice está dentro dos limites
    if (index >= slides.length) slideAtual = 0;
    else if (index < 0) slideAtual = slides.length - 1;
    else slideAtual = index;

    // Remover classe active de todos
    slides.forEach(function(slide) {
      slide.classList.remove('active');
    });
    dots.forEach(function(dot) {
      dot.classList.remove('active');
    });

    // Adicionar classe active ao slide e dot atuais
    slides[slideAtual].classList.add('active');
    if (dots[slideAtual]) dots[slideAtual].classList.add('active');
  }

  function proximoSlide() {
    mostrarSlide(slideAtual + 1);
  }

  function slideAnterior() {
    mostrarSlide(slideAtual - 1);
  }

  function iniciarAutoPlay() {
    pararAutoPlay();
    intervaloAuto = setInterval(proximoSlide, 4000); // Muda a cada 4 segundos
  }

  function pararAutoPlay() {
    if (intervaloAuto) clearInterval(intervaloAuto);
  }

  // Botões de navegação
  if (btnNext) {
    btnNext.addEventListener('click', function() {
      proximoSlide();
      iniciarAutoPlay(); // Reiniciar o timer após click manual
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', function() {
      slideAnterior();
      iniciarAutoPlay(); // Reiniciar o timer após click manual
    });
  }

  // Dots de navegação
  dots.forEach(function(dot, index) {
    dot.addEventListener('click', function() {
      mostrarSlide(index);
      iniciarAutoPlay(); // Reiniciar o timer após click manual
    });
  });

  // Pausar ao passar o mouse
  var carousel = document.querySelector('.carousel');
  if (carousel) {
    carousel.addEventListener('mouseenter', pararAutoPlay);
    carousel.addEventListener('mouseleave', iniciarAutoPlay);
  }

  // Iniciar
  mostrarSlide(0);
  iniciarAutoPlay();
}
