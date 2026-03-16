import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProdutos } from '../lib/api';
import BrandLogo from '../components/BrandLogo';

const CATEGORY_IMAGES = {
  hortifruti: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=60',
  bebidas: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=900&q=60',
  mercearia: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=900&q=60',
  acougue: 'https://images.unsplash.com/photo-1607623814143-16f56c7d0980?auto=format&fit=crop&w=900&q=60',
  limpeza: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=900&q=60'
};

function getProdutoImagem(produto) {
  const imagem = String(produto?.imagem || '').trim();
  if (imagem) {
    return imagem;
  }

  const categoria = String(produto?.categoria || '').toLowerCase();
  return CATEGORY_IMAGES[categoria] || 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=900&q=60';
}

export default function HomePage() {
  const navigate = useNavigate();
  const destaquesHero = [
    'Entrega rapida na regiao',
    'Hortifruti e mercearia selecionados',
    'Ofertas atualizadas todos os dias'
  ];

  const setores = [
    {
      categoria: 'bebidas',
      label: 'Bebidas',
      busca: '',
      imagem: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=60'
    },
    {
      categoria: 'hortifruti',
      label: 'Hortifruti',
      busca: '',
      imagem: 'https://images.unsplash.com/photo-1506806732259-39c2d0268443?auto=format&fit=crop&w=900&q=60'
    },
    {
      categoria: 'limpeza',
      label: 'Limpeza de casa',
      busca: 'limpeza',
      imagem: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=60'
    }
  ];
  const slides = [
    {
      title: '🥦 Hortifruti Fresquinho',
      text: 'Frutas e verduras fresquinhas todos os dias.'
    },
    {
      title: '⚡ Ofertas da Semana',
      text: 'Aproveite preços especiais nos produtos mais procurados.'
    }
  ];
  const [produtos, setProdutos] = useState([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [slideAtivo, setSlideAtivo] = useState(0);

  useEffect(() => {
    carregarProdutos();
  }, []);

  async function carregarProdutos() {
    setCarregando(true);
    setErro('');
    try {
      const data = await getProdutos({
        page: 1,
        limit: 120
      });
      setProdutos(data.produtos || []);
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setSlideAtivo((atual) => (atual + 1) % slides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [slides.length]);

  const maisVendidos = useMemo(() => {
    return [...produtos]
      .sort((a, b) => Number(b.estoque || 0) - Number(a.estoque || 0))
      .slice(0, 4);
  }, [produtos]);

  function abrirProdutos(params = {}) {
    const query = new URLSearchParams();
    if (params.categoria) {
      query.set('categoria', params.categoria);
    }
    if (params.busca) {
      query.set('busca', params.busca);
    }
    const suffix = query.toString();
    navigate(`/produtos${suffix ? `?${suffix}` : ''}`);
  }

  function mudarSlide(direcao) {
    setSlideAtivo((atual) => {
      const proximo = atual + direcao;
      if (proximo < 0) return slides.length - 1;
      if (proximo >= slides.length) return 0;
      return proximo;
    });
  }

  return (
    <section className="page home-page">
      {/* Hero principal com branding para reforcar a identidade Bomfilho no primeiro impacto */}
      <section className="home-hero" aria-label="Boas-vindas Bomfilho">
        <div className="home-hero-main">
          <BrandLogo
            subtitle="Seu supermercado online"
            tagline="Ofertas, hortifruti e entrega rapida"
          />

          <p className="home-hero-description">
            Facilidade para comprar no dia a dia, com precos competitivos e atendimento proximo da sua casa.
          </p>

          <div className="home-hero-actions">
            <Link to="/produtos" className="btn-primary home-hero-btn">Ver ofertas do dia</Link>
            <button className="btn-secondary home-hero-btn" type="button" onClick={() => abrirProdutos({ categoria: 'hortifruti' })}>
              Comprar hortifruti
            </button>
          </div>

          <div className="home-hero-highlights" aria-label="Destaques Bomfilho">
            {destaquesHero.map((item) => (
              <span key={item} className="home-hero-pill">{item}</span>
            ))}
          </div>
        </div>

        <aside className="home-hero-panel" aria-label="Informacoes principais da loja">
          <p className="home-hero-panel-title">Atendimento Bomfilho</p>
          <p>Segunda a sabado: 7h30 as 13h e 15h as 19h30</p>
          <p>Domingos e feriados: 8h as 12h30</p>
          <p>Entrega rapida para pedidos online.</p>
          <a className="home-hero-panel-link" href="https://wa.me/5591999652790?text=Ol%C3%A1!%20Quero%20fazer%20um%20pedido." target="_blank" rel="noopener noreferrer">
            Falar no WhatsApp
          </a>
        </aside>
      </section>

      <section className="sector-section" aria-label="Navegar por setor">
        <div className="sector-header">
          <h2>Compre por setor</h2>
          <p>Acesse os setores mais buscados e monte seu carrinho em minutos.</p>
        </div>
        <div className="sector-grid">
          {setores.map((setor) => (
            <button
              key={`${setor.categoria}-${setor.label}`}
              className="sector-card"
              type="button"
              style={{ '--bg': `url('${setor.imagem}')` }}
              onClick={() => abrirProdutos({ categoria: setor.categoria, busca: setor.busca })}
            >
              <span className="sector-label">{setor.label}</span>
              <span className="sector-cta">Ver produtos</span>
            </button>
          ))}
        </div>
      </section>

      <section className="carousel-box" aria-label="Promoções">
        <div className={`carousel-slide-react slide-${slideAtivo + 1}`}>
          <h2>{slides[slideAtivo].title}</h2>
          <p>{slides[slideAtivo].text}</p>
        </div>
        <button className="carousel-btn-react prev" type="button" onClick={() => mudarSlide(-1)} aria-label="Slide anterior">❮</button>
        <button className="carousel-btn-react next" type="button" onClick={() => mudarSlide(1)} aria-label="Próximo slide">❯</button>
        <div className="carousel-dots-react" aria-label="Indicadores do carrossel">
          {slides.map((_, index) => (
            <button
              key={`dot-${index}`}
              type="button"
              className={`carousel-dot-react ${slideAtivo === index ? 'active' : ''}`}
              onClick={() => setSlideAtivo(index)}
              aria-label={`Ir para slide ${index + 1}`}
            />
          ))}
        </div>
      </section>

      <section className="best-sellers">
        <div className="best-sellers-head">
          <h2>Mais pedidos da semana</h2>
          <p>Selecao de produtos que os clientes Bomfilho levam primeiro.</p>
        </div>
        <div className="best-sellers-list">
          {maisVendidos.map((produto) => (
            <article key={`best-${produto.id}`} className="best-item">
              <img
                className="best-item-img"
                src={getProdutoImagem(produto)}
                alt={produto.nome}
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.src = '/img/logo-oficial.png';
                }}
              />
              <p className="best-item-name">{produto.emoji || '📦'} {produto.nome}</p>
              <p className="best-item-price">R$ {Number(produto.preco || 0).toFixed(2)}</p>
              <button className="btn-secondary" type="button" onClick={() => abrirProdutos({ busca: produto.nome })}>
                Ver produto
              </button>
            </article>
          ))}
        </div>
      </section>

      <div style={{ marginTop: '0.85rem' }}>
        <Link to="/produtos" className="btn-primary">Explorar catalogo completo</Link>
      </div>

      {erro ? <p className="error-text">{erro}</p> : null}
      {carregando ? <p className="muted-text">Carregando produtos...</p> : null}

      <footer className="home-footer">
        <div className="footer-brand">
          <BrandLogo compact titleTag="h2" subtitle="Supermercado de confianca" />
        </div>
        <div className="footer-info-simple" aria-label="Informações da loja">
          <div className="footer-info-line"><strong>BomFilho</strong></div>
          <div className="footer-info-line">CNPJ: 09.175.211/0001-30</div>
          <div className="footer-info-line">Endereco: Travessa 07 de Setembro, CEP 68740-180</div>
          <div className="footer-info-line">
            Mapa:{' '}
            <a className="footer-link" href="https://share.google/0Ss9eHp9dv9AC4h1t" target="_blank" rel="noopener noreferrer">
              Ver no Google Maps
            </a>
          </div>
          <div className="footer-info-line">
            WhatsApp e telefone:{' '}
            <a className="footer-link" href="https://wa.me/5591999652790?text=Ol%C3%A1!%20Quero%20fazer%20um%20pedido." target="_blank" rel="noopener noreferrer">
              (91) 99965-2790
            </a>
          </div>
          <div className="footer-info-line">
            Telefone fixo:{' '}
            <a className="footer-link" href="tel:+559137219780">(91) 3721-9780</a>
          </div>
          <div className="footer-info-line">Horario: segunda a sabado, 7h30 as 13h e 15h as 19h30 | domingos e feriados, 8h as 12h30</div>
        </div>
        <small>© 2026 BomFilho. Todos os direitos reservados.</small>
      </footer>
    </section>
  );
}
