import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProdutos } from '../lib/api';
import { useCart } from '../context/CartContext';

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
  const { addItem, resumo } = useCart();
  const categoriasLegado = [
    { id: 'todas', label: '🛒 Todas' },
    { id: 'promocoes', label: '🔥 Promoções', destaque: true },
    { id: 'hortifruti', label: '🥦 Hortifruti' },
    { id: 'bebidas', label: '🥤 Bebidas' },
    { id: 'limpeza', label: '🧴 Limpeza' }
  ];
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
      title: '🎉 Promoção de Inauguração',
      text: 'Até 50% OFF em produtos selecionados!'
    },
    {
      title: '🥦 Hortifruti Fresquinho',
      text: 'Frutas e verduras fresquinhas todos os dias.'
    },
    {
      title: '🚚 Entrega Grátis',
      text: 'Nas compras acima de R$ 100,00.'
    },
    {
      title: '🥩 Açougue Premium',
      text: 'Carnes selecionadas com o melhor preço.'
    },
    {
      title: 'ℹ️ Sobre o Bom Filho',
      text: 'Mercado local com foco em entrega rápida, compra simples e atendimento de confiança.',
      ctaLabel: 'Ver página Sobre',
      ctaHref: '/#/sobre'
    }
  ];
  const [produtos, setProdutos] = useState([]);
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('todas');
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

  const categorias = useMemo(() => {
    const values = new Set();
    produtos.forEach((produto) => {
      if (produto.categoria) {
        values.add(String(produto.categoria));
      }
    });
    return ['todas', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [produtos]);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((produto) => {
      const nome = String(produto.nome || '').toLowerCase();
      const categoriaAtual = String(produto.categoria || '').toLowerCase();
      const emPromocao =
        Number(produto.desconto || 0) > 0
        || Number(produto.percentual_desconto || 0) > 0
        || Number(produto.preco_promocional || 0) > 0
        || produto.promocao === true
        || Number(produto.promocao || 0) === 1;
      const matchBusca = !termo || nome.includes(termo);
      const matchCategoria = categoria === 'todas'
        ? true
        : categoria === 'promocoes'
          ? emPromocao
          : categoriaAtual === categoria;
      return matchBusca && matchCategoria;
    });
  }, [produtos, busca, categoria]);

  const maisVendidos = useMemo(() => {
    return [...produtos]
      .sort((a, b) => Number(b.estoque || 0) - Number(a.estoque || 0))
      .slice(0, 4);
  }, [produtos]);

  function selecionarCategoria(cat) {
    setCategoria(cat);
    const alvo = document.getElementById('produtos-lista');
    if (alvo) {
      alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
      <header className="store-header">
        <div className="store-brand">
          <img src="/img/logo-oficial.png" alt="Comércio Bom Filho" className="store-logo" />
          <div>
            <h1>Comércio Bom Filho</h1>
            <p>Seu mercado de confiança com pedidos online.</p>
          </div>
        </div>
      </header>

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
              onClick={() => {
                selecionarCategoria(setor.categoria);
                setBusca(setor.busca);
              }}
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
          <a href={slides[slideAtivo].ctaHref || '#produtos-lista'} className="btn-primary" style={{ width: 'fit-content' }}>
            {slides[slideAtivo].ctaLabel || 'Aproveitar ofertas'}
          </a>
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
            </article>
          ))}
        </div>
      </section>

      <section className="product-highlight-section" id="produtos" aria-label="Produtos em destaque">
        <h2>Produtos em destaque</h2>
        <p className="product-highlight-subtitle">Escolha por categoria ou pesquise direto pelo nome.</p>

        <div className="search-bar-react">
          <input
            className="field-input"
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="🔍 Buscar produtos..."
          />
        </div>

        <div className="toolbar-box">
          <select
            className="field-input"
            value={categoria}
            onChange={(event) => setCategoria(String(event.target.value).toLowerCase())}
          >
            {categorias.map((item) => (
              <option key={item} value={item}>
                {item === 'todas' ? 'Todas as categorias' : item}
              </option>
            ))}
          </select>

          <button className="btn-primary" type="button" onClick={carregarProdutos} disabled={carregando}>
            {carregando ? 'Atualizando...' : 'Atualizar produtos'}
          </button>
        </div>

        <div className="legacy-categories" aria-label="Filtros de categoria">
          {categoriasLegado.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`category-btn-react ${item.destaque ? 'category-promocoes-react' : ''} ${categoria === item.id ? 'active' : ''}`}
              onClick={() => setCategoria(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <div className="pedido-resumo" style={{ marginTop: '0.9rem' }}>
        <p><strong>Carrinho:</strong> {resumo.itens} item(ns)</p>
        <p><strong>Total parcial:</strong> R$ {resumo.total.toFixed(2)}</p>
        {resumo.itens > 0 ? (
          <Link to="/pagamento" className="btn-primary" style={{ display: 'inline-block', marginTop: '0.6rem' }}>
            Finalizar pedido
          </Link>
        ) : (
          <p className="muted-text" style={{ marginTop: '0.4rem' }}>Adicione itens para liberar o pagamento.</p>
        )}
      </div>

      {erro ? <p className="error-text">{erro}</p> : null}

      {produtosFiltrados.length === 0 ? (
        <p className="muted-text">Nenhum produto encontrado com os filtros atuais.</p>
      ) : (
        <div className="produto-grid" id="produtos-lista">
          {produtosFiltrados.map((produto) => (
            <article className="produto-card" key={produto.id}>
              <img
                className="produto-image"
                src={getProdutoImagem(produto)}
                alt={produto.nome}
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.src = '/img/logo-oficial.png';
                }}
              />
              <p className="produto-title">
                <span>{produto.emoji || '📦'}</span> {produto.nome}
              </p>
              <p className="muted-text">{produto.categoria || 'Sem categoria'}</p>
              <p className="produto-price">R$ {Number(produto.preco || 0).toFixed(2)}</p>
              <button className="btn-primary" type="button" onClick={() => addItem(produto, 1)}>
                Adicionar ao carrinho
              </button>
            </article>
          ))}
        </div>
      )}

      <footer className="home-footer">
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
