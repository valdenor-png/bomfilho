import React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProdutos } from '../lib/api';
import BrandLogo from '../components/BrandLogo';
import { useCart } from '../context/CartContext';
import { useRecorrencia } from '../context/RecorrenciaContext';

const CATEGORY_IMAGES = {
  hortifruti: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=60',
  bebidas: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=900&q=60',
  mercearia: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=900&q=60',
  acougue: 'https://images.unsplash.com/photo-1607623814143-16f56c7d0980?auto=format&fit=crop&w=900&q=60',
  limpeza: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=900&q=60'
};

const HOME_HERO_HIGHLIGHTS = [
  'Entrega rapida na regiao',
  'Compra online simples e segura',
  'Mercado local com atendimento humano'
];

const HOME_SETORES = [
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

const HOME_SLIDES = [
  {
    title: '🥦 Hortifruti Fresquinho',
    text: 'Frutas e verduras fresquinhas todos os dias.'
  },
  {
    title: '⚡ Ofertas da Semana',
    text: 'Aproveite precos especiais nos produtos mais procurados.'
  }
];

const HOME_ATALHOS_COMPRA = [
  { id: 'atalho-promocoes', label: 'Ver promocoes', categoria: 'promocoes', busca: '' },
  { id: 'atalho-mercearia', label: 'Mercearia basica', categoria: 'mercearia', busca: '' },
  { id: 'atalho-bebidas', label: 'Bebidas', categoria: 'bebidas', busca: '' },
  { id: 'atalho-cafe', label: 'Cafe e matinais', categoria: 'todas', busca: 'cafe' }
];

const HOME_CONFIANCA_BLOCOS = [
  {
    id: 'confianca-entrega',
    icon: '🚚',
    title: 'Entrega e retirada',
    description: 'Compre online e escolha a melhor opcao para sua rotina.'
  },
  {
    id: 'confianca-atendimento',
    icon: '📞',
    title: 'Atendimento local',
    description: 'WhatsApp e telefone com suporte direto da loja.'
  },
  {
    id: 'confianca-praticidade',
    icon: '🛍️',
    title: 'Compra rapida',
    description: 'Encontre categorias e produtos em poucos toques, no celular.'
  }
];

function isProdutoEmPromocao(produto) {
  return (
    Number(produto?.desconto || 0) > 0
    || Number(produto?.percentual_desconto || 0) > 0
    || Number(produto?.preco_promocional || 0) > 0
    || produto?.promocao === true
    || Number(produto?.promocao || 0) === 1
  );
}

function HomeShelfSkeleton({ quantidade = 4 }) {
  return (
    <div className="home-shelf-skeleton-grid" aria-hidden="true">
      {Array.from({ length: quantidade }).map((_, index) => (
        <article className="home-shelf-skeleton-card" key={`home-skeleton-${index}`}>
          <div className="home-shelf-skeleton-media" />
          <div className="home-shelf-skeleton-line home-shelf-skeleton-line-title" />
          <div className="home-shelf-skeleton-line" />
          <div className="home-shelf-skeleton-line home-shelf-skeleton-line-price" />
        </article>
      ))}
    </div>
  );
}

function HomeRecorrenciaCard({
  produto,
  favorito,
  onAbrir,
  onRecomprar,
  onAlternarFavorito
}) {
  return (
    <article className="home-recorrencia-card">
      <button
        type="button"
        className={`home-recorrencia-favorite ${favorito ? 'is-active' : ''}`}
        onClick={() => onAlternarFavorito(produto)}
        aria-label={favorito ? `Remover ${produto.nome} dos favoritos` : `Salvar ${produto.nome} nos favoritos`}
      >
        {favorito ? '♥' : '♡'}
      </button>

      <button
        type="button"
        className="home-recorrencia-media"
        onClick={() => onAbrir(produto)}
        aria-label={`Abrir ${produto.nome}`}
      >
        <img
          src={getProdutoImagem(produto)}
          alt={produto.nome}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.src = '/img/logo-oficial.png';
          }}
        />
      </button>

      <div className="home-recorrencia-body">
        <p className="home-recorrencia-name" title={produto.nome}>{produto.emoji || '🛒'} {produto.nome}</p>
        <p className="home-recorrencia-price">R$ {Number(produto.preco || 0).toFixed(2)}</p>
      </div>

      <button className="btn-secondary home-recorrencia-cta" type="button" onClick={() => onRecomprar(produto)}>
        Recomprar
      </button>
    </article>
  );
}

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
  const { addItem } = useCart();
  const {
    favoritosProdutos,
    recentesProdutos,
    recomprasProdutos,
    stats: recorrenciaStats,
    isFavorito,
    alternarFavorito,
    registrarVisualizacao,
    registrarAcaoCarrinho
  } = useRecorrencia();
  const [produtos, setProdutos] = useState([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [slideAtivo, setSlideAtivo] = useState(0);
  const [feedbackRecorrencia, setFeedbackRecorrencia] = useState('');
  const feedbackRecorrenciaTimerRef = useRef(null);

  useEffect(() => {
    carregarProdutos();
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackRecorrenciaTimerRef.current) {
        clearTimeout(feedbackRecorrenciaTimerRef.current);
      }
    };
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
      setSlideAtivo((atual) => (atual + 1) % HOME_SLIDES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const maisVendidos = useMemo(() => {
    return [...produtos]
      .sort((a, b) => Number(b.estoque || 0) - Number(a.estoque || 0))
      .slice(0, 4);
  }, [produtos]);

  const ofertasEmDestaque = useMemo(() => {
    return [...produtos]
      .filter((produto) => isProdutoEmPromocao(produto))
      .slice(0, 4);
  }, [produtos]);

  const favoritosHome = useMemo(() => favoritosProdutos.slice(0, 4), [favoritosProdutos]);
  const recentesHome = useMemo(() => recentesProdutos.slice(0, 4), [recentesProdutos]);
  const recompraHome = useMemo(() => recomprasProdutos.slice(0, 4), [recomprasProdutos]);
  const temDadosRecorrencia = recorrenciaStats.favoritos > 0 || recorrenciaStats.recentes > 0 || recorrenciaStats.recompra > 0;

  function abrirProdutos(params = {}) {
    const query = new URLSearchParams();
    if (params.categoria) {
      query.set('categoria', params.categoria);
    }
    if (params.busca) {
      query.set('busca', params.busca);
    }
    if (params.recorrencia) {
      query.set('recorrencia', params.recorrencia);
    }
    const suffix = query.toString();
    navigate(`/produtos${suffix ? `?${suffix}` : ''}`);
  }

  function mudarSlide(direcao) {
    setSlideAtivo((atual) => {
      const proximo = atual + direcao;
      if (proximo < 0) return HOME_SLIDES.length - 1;
      if (proximo >= HOME_SLIDES.length) return 0;
      return proximo;
    });
  }

  function mostrarFeedbackRecorrencia(texto) {
    const mensagem = String(texto || '').trim();
    if (!mensagem) {
      return;
    }

    setFeedbackRecorrencia(mensagem);
    if (feedbackRecorrenciaTimerRef.current) {
      clearTimeout(feedbackRecorrenciaTimerRef.current);
    }

    feedbackRecorrenciaTimerRef.current = setTimeout(() => {
      setFeedbackRecorrencia('');
      feedbackRecorrenciaTimerRef.current = null;
    }, 2200);
  }

  function abrirProdutoRecorrente(produto) {
    registrarVisualizacao(produto);
    abrirProdutos({ busca: String(produto?.nome || '') });
  }

  function recomprarProduto(produto) {
    addItem(produto, 1);
    registrarAcaoCarrinho(produto, { quantidade: 1 });
    mostrarFeedbackRecorrencia(`${String(produto?.nome || 'Produto')} adicionado para recompra rapida.`);
  }

  function alternarFavoritoHome(produto) {
    const nome = String(produto?.nome || 'Produto');
    const favoritadoAntes = isFavorito(produto?.id);
    alternarFavorito(produto);
    mostrarFeedbackRecorrencia(
      favoritadoAntes
        ? `${nome} removido dos favoritos.`
        : `${nome} salvo nos favoritos.`
    );
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
            <button className="btn-secondary home-hero-btn" type="button" onClick={() => abrirProdutos({ categoria: 'mercearia' })}>
              Comprar itens basicos
            </button>
          </div>

          <div className="home-hero-highlights" aria-label="Destaques Bomfilho">
            {HOME_HERO_HIGHLIGHTS.map((item) => (
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

      <section className="home-quick-buy" aria-label="Atalhos de compra rapida">
        <div className="home-quick-buy-head">
          <h2>Compra rapida</h2>
          <p>Use atalhos para montar seu carrinho em menos tempo.</p>
        </div>
        <div className="home-quick-buy-actions">
          {HOME_ATALHOS_COMPRA.map((atalho) => (
            <button
              key={atalho.id}
              type="button"
              className="home-quick-buy-chip"
              onClick={() => abrirProdutos({ categoria: atalho.categoria, busca: atalho.busca })}
            >
              {atalho.label}
            </button>
          ))}
        </div>
      </section>

      <section className="home-recorrencia" aria-label="Atalhos de recorrencia e recompra">
        <div className="home-recorrencia-head">
          <h2>Volte ao que interessa</h2>
          <p>
            Seus atalhos de recorrencia ajudam voce a favoritar, rever itens vistos e recomprar com menos esforco.
          </p>
        </div>

        <div className="home-recorrencia-actions">
          <button type="button" className="home-recorrencia-chip" onClick={() => abrirProdutos({ recorrencia: 'favoritos' })}>
            Meus favoritos
          </button>
          <button type="button" className="home-recorrencia-chip" onClick={() => abrirProdutos({ recorrencia: 'recentes' })}>
            Vistos recentemente
          </button>
          <button type="button" className="home-recorrencia-chip" onClick={() => abrirProdutos({ recorrencia: 'recompra' })}>
            Comprar novamente
          </button>
        </div>

        {feedbackRecorrencia ? (
          <p className="home-recorrencia-feedback" role="status" aria-live="polite">{feedbackRecorrencia}</p>
        ) : null}

        {!temDadosRecorrencia ? (
          <p className="muted-text home-recorrencia-empty">
            Ainda nao temos itens recorrentes. Ao abrir produtos e favoritar, seus atalhos personalizados aparecem aqui.
          </p>
        ) : (
          <div className="home-recorrencia-groups">
            {favoritosHome.length > 0 ? (
              <article className="home-recorrencia-group">
                <div className="home-recorrencia-group-head">
                  <h3>Favoritos</h3>
                  <button type="button" className="btn-secondary" onClick={() => abrirProdutos({ recorrencia: 'favoritos' })}>
                    Ver todos
                  </button>
                </div>
                <div className="home-recorrencia-grid">
                  {favoritosHome.map((produto) => (
                    <HomeRecorrenciaCard
                      key={`home-fav-${produto.id}`}
                      produto={produto}
                      favorito={isFavorito(produto.id)}
                      onAbrir={abrirProdutoRecorrente}
                      onRecomprar={recomprarProduto}
                      onAlternarFavorito={alternarFavoritoHome}
                    />
                  ))}
                </div>
              </article>
            ) : null}

            {recentesHome.length > 0 ? (
              <article className="home-recorrencia-group">
                <div className="home-recorrencia-group-head">
                  <h3>Vistos recentemente</h3>
                  <button type="button" className="btn-secondary" onClick={() => abrirProdutos({ recorrencia: 'recentes' })}>
                    Retomar itens
                  </button>
                </div>
                <div className="home-recorrencia-grid">
                  {recentesHome.map((produto) => (
                    <HomeRecorrenciaCard
                      key={`home-recentes-${produto.id}`}
                      produto={produto}
                      favorito={isFavorito(produto.id)}
                      onAbrir={abrirProdutoRecorrente}
                      onRecomprar={recomprarProduto}
                      onAlternarFavorito={alternarFavoritoHome}
                    />
                  ))}
                </div>
              </article>
            ) : null}

            {recompraHome.length > 0 ? (
              <article className="home-recorrencia-group">
                <div className="home-recorrencia-group-head">
                  <h3>Comprar novamente</h3>
                  <button type="button" className="btn-secondary" onClick={() => abrirProdutos({ recorrencia: 'recompra' })}>
                    Abrir atalho
                  </button>
                </div>
                <div className="home-recorrencia-grid">
                  {recompraHome.map((produto) => (
                    <HomeRecorrenciaCard
                      key={`home-recompra-${produto.id}`}
                      produto={produto}
                      favorito={isFavorito(produto.id)}
                      onAbrir={abrirProdutoRecorrente}
                      onRecomprar={recomprarProduto}
                      onAlternarFavorito={alternarFavoritoHome}
                    />
                  ))}
                </div>
              </article>
            ) : null}
          </div>
        )}
      </section>

      <section className="home-trust-grid" aria-label="Sinais de confiança da loja">
        {HOME_CONFIANCA_BLOCOS.map((item) => (
          <article className="home-trust-card" key={item.id}>
            <span className="home-trust-icon" aria-hidden="true">{item.icon}</span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </section>

      <section className="home-offers" aria-label="Ofertas em destaque">
        <div className="home-offers-head">
          <h2>Ofertas em destaque</h2>
          <p>Produtos com condicoes especiais para facilitar sua compra da semana.</p>
        </div>

        {carregando ? (
          <HomeShelfSkeleton quantidade={4} />
        ) : ofertasEmDestaque.length > 0 ? (
          <div className="home-offers-grid">
            {ofertasEmDestaque.map((produto) => (
              <article className="home-offer-card" key={`offer-${produto.id}`}>
                <span className="home-offer-badge">Oferta</span>
                <img
                  className="home-offer-image"
                  src={getProdutoImagem(produto)}
                  alt={produto.nome}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.src = '/img/logo-oficial.png';
                  }}
                />
                <p className="home-offer-name">{produto.emoji || '🛒'} {produto.nome}</p>
                <p className="home-offer-price">R$ {Number(produto.preco || 0).toFixed(2)}</p>
                <button className="btn-secondary" type="button" onClick={() => abrirProdutos({ busca: produto.nome })}>
                  Ver produto
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted-text">Novas ofertas serao destacadas aqui ao longo do dia.</p>
        )}
      </section>

      <section className="sector-section" aria-label="Navegar por setor">
        <div className="sector-header">
          <h2>Compre por setor</h2>
          <p>Acesse os setores mais buscados e monte seu carrinho em minutos.</p>
        </div>
        <div className="sector-grid">
          {HOME_SETORES.map((setor) => (
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
          <h2>{HOME_SLIDES[slideAtivo].title}</h2>
          <p>{HOME_SLIDES[slideAtivo].text}</p>
        </div>
        <button className="carousel-btn-react prev" type="button" onClick={() => mudarSlide(-1)} aria-label="Slide anterior">❮</button>
        <button className="carousel-btn-react next" type="button" onClick={() => mudarSlide(1)} aria-label="Próximo slide">❯</button>
        <div className="carousel-dots-react" aria-label="Indicadores do carrossel">
          {HOME_SLIDES.map((_, index) => (
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
        {carregando ? (
          <HomeShelfSkeleton quantidade={4} />
        ) : maisVendidos.length > 0 ? (
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
        ) : (
          <p className="muted-text">Estamos preparando novos destaques para voce.</p>
        )}
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
