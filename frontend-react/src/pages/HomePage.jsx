import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProdutos } from '../lib/api';
import { getProdutoEstoqueInfo, getEstoqueBadge } from '../lib/produtosUtils';
import BrandLogo from '../components/BrandLogo';
import SmartImage from '../components/ui/SmartImage';
import { useRecorrencia } from '../context/RecorrenciaContext';
import usePreloadImage from '../hooks/usePreloadImage';
import useDocumentHead from '../hooks/useDocumentHead';
import { STORE_WHATSAPP_URL, STORE_WHATSAPP_DISPLAY, STORE_TELEFONE_URL, STORE_TELEFONE_DISPLAY, STORE_CNPJ, STORE_ENDERECO, STORE_HORARIO_CURTO } from '../config/store';

const CATEGORY_IMAGES = {
  hortifruti: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=60',
  bebidas: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=900&q=60',
  mercearia: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=900&q=60',
  acougue: 'https://images.unsplash.com/photo-1607623814143-16f56c7d0980?auto=format&fit=crop&w=900&q=60',
  limpeza: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=900&q=60'
};

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
    categoria: 'mercearia',
    label: 'Mercearia',
    busca: '',
    imagem: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=900&q=60'
  },
  {
    categoria: 'limpeza',
    label: 'Limpeza',
    busca: 'limpeza',
    imagem: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=60'
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

function getProdutoId(produto) {
  const id = Number(produto?.id || 0);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function getOfertaComercialLabel(produto) {
  const percentual = Number(produto?.percentual_desconto || 0);
  const descontoValor = Number(produto?.desconto || 0);

  if (percentual >= 5) {
    return `${Math.round(percentual)}% OFF`;
  }

  if (descontoValor >= 1) {
    return 'OFERTA';
  }

  return 'OFERTA';
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

function getProdutoImagem(produto) {
  const imagem = String(produto?.imagem || '').trim();
  if (imagem) {
    return imagem;
  }

  const categoria = String(produto?.categoria || '').toLowerCase();
  return CATEGORY_IMAGES[categoria] || 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=900&q=60';
}

function isUnsplashImageUrl(value) {
  return String(value || '').includes('images.unsplash.com');
}

function buildUnsplashBlurVariant(url) {
  if (!isUnsplashImageUrl(url)) {
    return '';
  }

  try {
    const parsed = new URL(url);
    parsed.searchParams.set('auto', 'format');
    parsed.searchParams.set('fit', 'crop');
    parsed.searchParams.set('q', '24');
    parsed.searchParams.set('w', '64');
    return parsed.toString();
  } catch {
    return '';
  }
}

function getProdutoImagemBlur(produto) {
  return buildUnsplashBlurVariant(getProdutoImagem(produto));
}

export default function HomePage() {
  useDocumentHead({ description: 'Supermercado online BomFilho — ofertas reais, entrega rápida e compra simples pelo celular.' });
  const navigate = useNavigate();
  const {
    favoritosProdutos,
    recentesProdutos,
    recomprasProdutos,
    stats: recorrenciaStats
  } = useRecorrencia();
  const [produtos, setProdutos] = useState([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [buscaRapida, setBuscaRapida] = useState('');

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

  const favoritosHome = useMemo(() => favoritosProdutos.slice(0, 4), [favoritosProdutos]);
  const recentesHome = useMemo(() => recentesProdutos.slice(0, 4), [recentesProdutos]);
  const recompraHome = useMemo(() => recomprasProdutos.slice(0, 4), [recomprasProdutos]);
  const temDadosRecorrencia = recorrenciaStats.favoritos > 0 || recorrenciaStats.recentes > 0 || recorrenciaStats.recompra > 0;

  const idsRecorrenciaHome = useMemo(() => {
    const ids = [
      ...favoritosProdutos,
      ...recentesProdutos,
      ...recomprasProdutos
    ]
      .map((produto) => getProdutoId(produto))
      .filter((id) => id !== null);

    return new Set(ids);
  }, [favoritosProdutos, recentesProdutos, recomprasProdutos]);

  const oportunidadesComerciais = useMemo(() => {
    return produtos
      .map((produto) => {
        const id = getProdutoId(produto);
        let score = 0;

        if (isProdutoEmPromocao(produto)) {
          score += 6;
        }

        if (id !== null && idsRecorrenciaHome.has(id)) {
          score += 4;
        }

        if (Number(produto?.preco_pix || 0) > 0) {
          score += 1;
        }

        return {
          produto,
          id,
          score
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        const scoreDiff = b.score - a.score;
        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        return String(a.produto?.nome || '').localeCompare(String(b.produto?.nome || ''), 'pt-BR');
      })
      .slice(0, 4);
  }, [idsRecorrenciaHome, produtos]);

  const imagemLcpHome = useMemo(() => {
    const candidatoPrincipal = oportunidadesComerciais[0]?.produto;
    if (candidatoPrincipal) {
      return getProdutoImagem(candidatoPrincipal);
    }

    const candidatoRecorrente = favoritosHome[0] || recentesHome[0] || recompraHome[0];
    return candidatoRecorrente ? getProdutoImagem(candidatoRecorrente) : '';
  }, [favoritosHome, oportunidadesComerciais, recentesHome, recompraHome]);

  usePreloadImage(imagemLcpHome);

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

  function handleBuscaRapidaSubmit(event) {
    event.preventDefault();
    const termo = String(buscaRapida || '').trim();
    if (!termo) {
      abrirProdutos();
      return;
    }

    abrirProdutos({ busca: termo });
  }

  return (
    <section className="page home-page home-page-clean">
      <form className="home-quick-search home-quick-search-top" aria-label="Busca rapida no catalogo" onSubmit={handleBuscaRapidaSubmit}>
        <div className="home-quick-search-row">
          <label htmlFor="home-quick-search-input" className="sr-only">Buscar no catálogo</label>
          <input
            id="home-quick-search-input"
            className="field-input home-quick-search-input"
            type="search"
            value={buscaRapida}
            onChange={(event) => setBuscaRapida(event.target.value)}
            placeholder="Buscar: arroz, cafe, leite..."
          />
          <button className="btn-primary home-quick-search-btn" type="submit">Buscar</button>
        </div>
      </form>

      <section className="home-hero home-hero-clean" aria-label="Boas-vindas Bomfilho">
        <BrandLogo subtitle="Seu supermercado online" />
        <p className="home-hero-description">
          Ofertas reais, entrega rapida e compra simples pelo celular.
        </p>
        <Link to="/produtos" className="btn-primary home-hero-btn">Ver produtos e ofertas</Link>
      </section>

      <section className="home-opportunities home-section-clean" aria-label="Ofertas do dia">
        <h2>Ofertas do dia</h2>

        {carregando ? (
          <HomeShelfSkeleton quantidade={4} />
        ) : oportunidadesComerciais.length > 0 ? (
          <div className="home-opportunities-grid">
            {oportunidadesComerciais.map(({ produto, id }, index) => {
              const temOferta = isProdutoEmPromocao(produto);
              const blurSrc = getProdutoImagemBlur(produto);
              const precoLabel = Number(produto.preco || 0).toFixed(2);

              return (
                <article className="home-opportunity-card" key={`home-opportunity-${id || produto.nome}`}>
                  {temOferta ? (
                    <span className="home-opportunity-badge">{getOfertaComercialLabel(produto)}</span>
                  ) : null}

                  <SmartImage
                    className="home-opportunity-image"
                    src={getProdutoImagem(produto)}
                    blurSrc={blurSrc}
                    alt={produto.nome}
                    priority={index === 0}
                    loading="lazy"
                    fallbackSrc="/img/logo-oficial.png"
                  />

                  <p className="home-opportunity-name">{produto.nome}</p>
                  <p className="home-opportunity-price">R$ {precoLabel}</p>

                  {(() => {
                    const badge = getEstoqueBadge(getProdutoEstoqueInfo(produto));
                    return (
                      <span className={`estoque-badge estoque-badge-sm ${badge.classe}`}>{badge.label}</span>
                    );
                  })()}

                  <button className="btn-primary home-card-cta" type="button" onClick={() => abrirProdutos({ busca: produto.nome })}>
                    Comprar
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="muted-text">As melhores ofertas aparecem aqui.</p>
        )}
      </section>

      <section className="sector-section home-section-clean" aria-label="Navegar por setor">
        <h2>Setores</h2>
        <div className="sector-grid">
          {HOME_SETORES.map((setor) => (
            <button
              key={`${setor.categoria}-${setor.label}`}
              className="sector-card"
              type="button"
              style={{ '--bg': `url('${setor.imagem}')` }}
              onClick={() => abrirProdutos({ categoria: setor.categoria, busca: setor.busca })}
              aria-label={`Ver produtos de ${setor.label}`}
            >
              <span className="sector-label">{setor.label}</span>
            </button>
          ))}
        </div>
      </section>

      {temDadosRecorrencia ? (
        <section className="home-recorrencia home-section-clean" aria-label="Continue de onde parou">
          <h2>Continue de onde parou</h2>

          <div className="home-recorrencia-actions">
            {favoritosHome.length > 0 ? (
              <button type="button" className="home-recorrencia-chip" onClick={() => abrirProdutos({ recorrencia: 'favoritos' })}>
                ❤️ Favoritos ({favoritosHome.length})
              </button>
            ) : null}
            {recentesHome.length > 0 ? (
              <button type="button" className="home-recorrencia-chip" onClick={() => abrirProdutos({ recorrencia: 'recentes' })}>
                👁️ Vistos ({recentesHome.length})
              </button>
            ) : null}
            {recompraHome.length > 0 ? (
              <button type="button" className="home-recorrencia-chip" onClick={() => abrirProdutos({ recorrencia: 'recompra' })}>
                🔁 Comprar de novo ({recompraHome.length})
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {erro ? <p className="error-text" role="alert">{erro}</p> : null}

      <footer className="home-footer">
        <div className="footer-brand">
          <BrandLogo compact titleTag="h2" subtitle="Supermercado de confianca" />
        </div>
        <div className="home-trust-inline">
          <span>🚚 Entrega e retirada</span>
          <span>📞 Atendimento por WhatsApp</span>
          <span>🛍️ Compra rapida no celular</span>
        </div>
        <div className="footer-info-simple" aria-label="Informações da loja">
          <div className="footer-info-line">
            <a className="footer-link" href={STORE_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              WhatsApp: {STORE_WHATSAPP_DISPLAY}
            </a>
            {' · '}
            <a className="footer-link" href={STORE_TELEFONE_URL}>Fixo: {STORE_TELEFONE_DISPLAY}</a>
          </div>
          <div className="footer-info-line">Horario: {STORE_HORARIO_CURTO}</div>
          <div className="footer-info-line">CNPJ: {STORE_CNPJ} · {STORE_ENDERECO}</div>
        </div>
        <small>© 2026 BomFilho. Todos os direitos reservados.</small>
      </footer>
    </section>
  );
}
