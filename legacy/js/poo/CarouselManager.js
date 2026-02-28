// ============================================
// CLASSE DE CARROSSEL
// ============================================

class CarouselManager {
  constructor() {
    this.slideAtual = 0;
    this.slides = [];
    this.dots = [];
    this.intervalo = null;
    this.tempoTransicao = 4000; // 4 segundos
  }

  inicializar() {
    this.slides = document.querySelectorAll('.carousel-slide');
    this.dots = document.querySelectorAll('.carousel-dot');
    
    if (this.slides.length === 0) return;

    this.configurarBotoes();
    this.configurarDots();
    this.configurarPausa();
    this.mostrarSlide(0);
    this.iniciarAutoPlay();
  }

  mostrarSlide(index) {
    if (index >= this.slides.length) {
      this.slideAtual = 0;
    } else if (index < 0) {
      this.slideAtual = this.slides.length - 1;
    } else {
      this.slideAtual = index;
    }

    this.slides.forEach(slide => slide.classList.remove('active'));
    this.dots.forEach(dot => dot.classList.remove('active'));

    this.slides[this.slideAtual].classList.add('active');
    if (this.dots[this.slideAtual]) {
      this.dots[this.slideAtual].classList.add('active');
    }
  }

  proximoSlide() {
    this.mostrarSlide(this.slideAtual + 1);
  }

  slideAnterior() {
    this.mostrarSlide(this.slideAtual - 1);
  }

  configurarBotoes() {
    const btnPrev = document.querySelector('.carousel-btn.prev');
    const btnNext = document.querySelector('.carousel-btn.next');

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        this.proximoSlide();
        this.reiniciarAutoPlay();
      });
    }

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        this.slideAnterior();
        this.reiniciarAutoPlay();
      });
    }
  }

  configurarDots() {
    this.dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        this.mostrarSlide(index);
        this.reiniciarAutoPlay();
      });
    });
  }

  configurarPausa() {
    const carousel = document.querySelector('.carousel');
    if (carousel) {
      carousel.addEventListener('mouseenter', () => this.pararAutoPlay());
      carousel.addEventListener('mouseleave', () => this.iniciarAutoPlay());
    }
  }

  iniciarAutoPlay() {
    this.pararAutoPlay();
    this.intervalo = setInterval(() => this.proximoSlide(), this.tempoTransicao);
  }

  pararAutoPlay() {
    if (this.intervalo) {
      clearInterval(this.intervalo);
      this.intervalo = null;
    }
  }

  reiniciarAutoPlay() {
    this.iniciarAutoPlay();
  }

  destruir() {
    this.pararAutoPlay();
  }
}
