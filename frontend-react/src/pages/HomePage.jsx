import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProdutos } from '../lib/api';

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
  const setores = [
    {
      categoria: 'bebidas',
      label: 'Bebidas',
      busca: 'bebida',
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
      const data = await getProdutos();
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
    <section className="page">
      <h1>Início</h1>
      <p>Escolha uma categoria, veja o carrossel e confira os mais vendidos.</p>

      <section className="sector-section" aria-label="Navegar por setor">
        <div className="sector-header">
          <h2>Compre por setor</h2>
          <p>Atalhos rápidos para as categorias mais buscadas.</p>
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
              <span className="sector-cta">Quero ver</span>
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
          <h2>🔥 Mais vendidos</h2>
          <p>Os produtos mais pedidos do momento.</p>
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
        <Link to="/produtos" className="btn-primary">Ir para página de produtos</Link>
      </div>

      {erro ? <p className="error-text">{erro}</p> : null}
      {carregando ? <p className="muted-text">Atualizando produtos...</p> : null}

      <footer className="home-footer">
        <div className="footer-brand">
          <img src="/img/logo-oficial.png" alt="Comércio Bom Filho" className="store-logo" />
          <div>
            <strong>Comércio Bom Filho</strong>
            <p>Seu mercado de confiança com pedidos online.</p>
          </div>
        </div>
        <div className="footer-info-simple" aria-label="Informações da loja">
          <div className="footer-info-line"><strong>Bom Filho — Supermercado</strong></div>
          <div className="footer-info-line">Endereço: Travessa 07 de setembro | Nº 70</div>
          <div className="footer-info-line">
            Mapa:{' '}
            <a className="footer-link" href="https://share.google/0Ss9eHp9dv9AC4h1t" target="_blank" rel="noopener noreferrer">
              Ver no Google Maps
            </a>
          </div>
          <div className="footer-info-line">
            WhatsApp:{' '}
            <a className="footer-link" href="https://wa.me/5591999652790?text=Ol%C3%A1!%20Quero%20fazer%20um%20pedido." target="_blank" rel="noopener noreferrer">
              (91) 99965-2790
            </a>
          </div>
          <div className="footer-info-line">Horário: Seg a Sáb 07:00–19:00 | Dom 07:00–12:00</div>
        </div>
        <small>© 2026 Bom Filho - Supermercado — Construído com React + Node.js</small>
      </footer>
    </section>
  );
}
