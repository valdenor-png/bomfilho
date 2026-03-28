import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Heart, MessageCircle, Repeat2, Search, ShoppingCart, Store, Truck, Wallet } from '../icons';
import { useNavigate } from 'react-router-dom';
import { getProdutos } from '../lib/api';
import { getProdutoEstoqueInfo, getEstoqueBadge } from '../lib/produtosUtils';
import SmartImage from '../components/ui/SmartImage';
import { useRecorrencia } from '../context/RecorrenciaContext';
import { useCart } from '../context/CartContext';
import usePreloadImage from '../hooks/usePreloadImage';
import useDocumentHead from '../hooks/useDocumentHead';
import { STORE_WHATSAPP_URL, STORE_WHATSAPP_DISPLAY, STORE_TELEFONE_URL, STORE_TELEFONE_DISPLAY, STORE_CNPJ, STORE_ENDERECO, STORE_HORARIO_CURTO } from '../config/store';

const CATEGORY_IMAGES = {
  frios: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=900&q=60',
  refrigerantes: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=60',
  bebidas: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=900&q=60',
  agua: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=900&q=60',
  salgadinhos: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=900&q=60',
  doces: 'https://images.unsplash.com/photo-1582176604856-e824b4736522?auto=format&fit=crop&w=900&q=60',
  biscoitos: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=900&q=60',
  leites_fermentados: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=900&q=60',
  derivados_lacteos: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=900&q=60',
  mercearia: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=900&q=60',
  limpeza: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=900&q=60',
  higiene: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=900&q=60',
  hortifruti: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=900&q=60'
};
const HOME_PRODUTOS_LIMIT = 60;

const CATEGORIAS_GRID = [
  { slug: 'bebidas', emoji: '🥤', nome: 'Bebidas' },
  { slug: 'mercearia', emoji: '🛒', nome: 'Mercearia' },
  { slug: 'hortifruti', emoji: '🥬', nome: 'Hortifruti' },
  { slug: 'higiene', emoji: '🧴', nome: 'Higiene' },
  { slug: 'limpeza', emoji: '🧹', nome: 'Limpeza' },
  { slug: 'frios', emoji: '🧊', nome: 'Frios' },
];

const BANNERS = [
  { id: 1, gradient: 'linear-gradient(135deg, #1E7D1E, #27A027)', titulo: 'Primeira compra', subtitulo: '20% OFF com Pix', codigo: 'BOM20' },
  { id: 2, gradient: 'linear-gradient(135deg, #F9A825, #FFD600)', titulo: 'Frete Grátis', subtitulo: 'Pedidos acima de R$80', codigo: 'FRETEBOM', dark: true },
  { id: 3, gradient: 'linear-gradient(135deg, #0A4D0A, #145A14)', titulo: 'Hortifruti', subtitulo: 'Até 30% OFF esta semana', codigo: 'HORTA30' },
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
  if (percentual >= 5) return `${Math.round(percentual)}% OFF`;
  return 'OFERTA';
}

function getProdutoImagem(produto) {
  const imagem = String(produto?.imagem || '').trim();
  if (imagem) return imagem;
  const categoria = String(produto?.categoria || '').toLowerCase();
  return CATEGORY_IMAGES[categoria] || 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=900&q=60';
}

function HomeCardSkeleton({ count = 4 }) {
  return (
    <div className="v2-home-skeleton-rail" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="v2-home-skeleton-card" key={i}>
          <div className="v2-home-skeleton-img" />
          <div className="v2-home-skeleton-line" />
          <div className="v2-home-skeleton-line v2-home-skeleton-line--short" />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  useDocumentHead({ description: 'Supermercado online BomFilho — ofertas reais, entrega rápida e compra simples pelo celular.' });
  const navigate = useNavigate();
  const { addItem } = useCart();
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
  const [recorrenciaTab, setRecorrenciaTab] = useState('recentes');

  useEffect(() => {
    carregarProdutos();
  }, []);

  async function carregarProdutos() {
    setCarregando(true);
    setErro('');
    try {
      const data = await getProdutos({ page: 1, limit: HOME_PRODUTOS_LIMIT });
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

  const oportunidadesComerciais = useMemo(() => {
    const idsRecorrencia = new Set(
      [...favoritosProdutos, ...recentesProdutos, ...recomprasProdutos]
        .map(p => getProdutoId(p))
        .filter(id => id !== null)
    );
    return produtos
      .map((produto) => {
        const id = getProdutoId(produto);
        let score = 0;
        if (isProdutoEmPromocao(produto)) score += 6;
        if (id !== null && idsRecorrencia.has(id)) score += 4;
        if (Number(produto?.preco_pix || 0) > 0) score += 1;
        return { produto, id, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || String(a.produto?.nome || '').localeCompare(String(b.produto?.nome || ''), 'pt-BR'))
      .slice(0, 8);
  }, [produtos, favoritosProdutos, recentesProdutos, recomprasProdutos]);

  const imagemLcpHome = useMemo(() => {
    const p = oportunidadesComerciais[0]?.produto || favoritosHome[0] || recentesHome[0] || recompraHome[0];
    return p ? getProdutoImagem(p) : '';
  }, [favoritosHome, oportunidadesComerciais, recentesHome, recompraHome]);

  usePreloadImage(imagemLcpHome);

  function abrirProdutos(params = {}) {
    const query = new URLSearchParams();
    if (params.categoria) query.set('categoria', params.categoria);
    if (params.busca) query.set('busca', params.busca);
    if (params.recorrencia) query.set('recorrencia', params.recorrencia);
    const suffix = query.toString();
    navigate(`/produtos${suffix ? `?${suffix}` : ''}`);
  }

  function handleBuscaRapidaSubmit(event) {
    event.preventDefault();
    const termo = String(buscaRapida || '').trim();
    abrirProdutos(termo ? { busca: termo } : {});
  }

  const recorrenciaItens = recorrenciaTab === 'favoritos' ? favoritosHome
    : recorrenciaTab === 'recompra' ? recompraHome
    : recentesHome;

  return (
    <section className="page v2-home">
      {/* Saudação */}
      <div className="v2-home-greeting">
        <p className="v2-home-greeting-sub">Seu supermercado online</p>
        <h2 className="v2-home-greeting-title">
          O que você precisa <span className="v2-accent-green">hoje</span><span className="v2-accent-yellow">?</span>
        </h2>
      </div>

      {/* Busca */}
      <form className="v2-home-search" onSubmit={handleBuscaRapidaSubmit} aria-label="Busca rápida">
        <div className="v2-home-search-row">
          <Search size={16} className="v2-home-search-icon" aria-hidden="true" />
          <input
            className="v2-home-search-input"
            type="search"
            value={buscaRapida}
            onChange={(e) => setBuscaRapida(e.target.value)}
            placeholder="Buscar: arroz, café, leite..."
          />
          <button className="v2-home-search-btn" type="submit">Buscar</button>
        </div>
      </form>

      {/* Badges informativos */}
      <div className="v2-home-badges">
        <span className="v2-home-badge">⚡ Entrega rápida</span>
        <span className="v2-home-badge">💰 Desconto no Pix</span>
        <span className="v2-home-badge">📦 +21 mil produtos</span>
      </div>

      {/* Banners de promoção */}
      <div className="v2-home-banners">
        {BANNERS.map((b) => (
          <div className={`v2-home-banner ${b.dark ? 'is-dark-text' : ''}`} key={b.id} style={{ background: b.gradient }}>
            <div className="v2-home-banner-circle" />
            <p className="v2-home-banner-title">{b.titulo}</p>
            <p className="v2-home-banner-sub">{b.subtitulo}</p>
            <span className="v2-home-banner-code">{b.codigo}</span>
          </div>
        ))}
      </div>

      {/* Grid de categorias */}
      <div className="v2-home-cats">
        {CATEGORIAS_GRID.map((cat) => (
          <button key={cat.slug} className="v2-home-cat" type="button" onClick={() => abrirProdutos({ categoria: cat.slug })}>
            <span className="v2-home-cat-emoji">{cat.emoji}</span>
            <span className="v2-home-cat-name">{cat.nome}</span>
          </button>
        ))}
        <button className="v2-home-cat v2-home-cat--all" type="button" onClick={() => abrirProdutos()}>
          <span className="v2-home-cat-emoji">📋</span>
          <span className="v2-home-cat-name">Ver tudo</span>
        </button>
      </div>

      {/* Ofertas do dia */}
      <section className="v2-home-section" aria-label="Ofertas do dia">
        <div className="v2-home-section-head">
          <h2>🔥 Ofertas do dia</h2>
          <button type="button" className="v2-home-section-link" onClick={() => abrirProdutos()}>Ver todas →</button>
        </div>

        {carregando ? (
          <HomeCardSkeleton count={4} />
        ) : oportunidadesComerciais.length > 0 ? (
          <div className="v2-home-product-rail">
            {oportunidadesComerciais.map(({ produto, id }, index) => {
              const temOferta = isProdutoEmPromocao(produto);
              const preco = Number(produto.preco || 0);
              const precoPromo = Number(produto.preco_promocional || 0);
              const descontoPercent = Number(produto.percentual_desconto || 0);

              return (
                <article className="v2-product-card-compact" key={`oferta-${id || index}`} style={{ animationDelay: `${index * 0.04}s` }}>
                  <div className="v2-product-card-media">
                    {temOferta && descontoPercent >= 5 ? (
                      <span className="v2-product-card-discount">-{Math.round(descontoPercent)}%</span>
                    ) : temOferta ? (
                      <span className="v2-product-card-tag">Oferta</span>
                    ) : null}
                    <SmartImage className="v2-product-card-img" src={getProdutoImagem(produto)} alt={produto.nome} loading={index < 2 ? 'eager' : 'lazy'} />
                  </div>
                  <p className="v2-product-card-name">{produto.nome}</p>
                  <div className="v2-product-card-price-row">
                    <span className="v2-product-card-price">R$ {(precoPromo > 0 ? precoPromo : preco).toFixed(2).replace('.', ',')}</span>
                    {precoPromo > 0 && preco > precoPromo ? (
                      <span className="v2-product-card-old-price">R$ {preco.toFixed(2).replace('.', ',')}</span>
                    ) : null}
                  </div>
                  <button className="v2-product-card-add" type="button" onClick={() => addItem(produto)} aria-label={`Adicionar ${produto.nome}`}>+</button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="v2-home-empty">As melhores ofertas aparecem aqui.</p>
        )}
      </section>

      {/* Continue de onde parou */}
      {temDadosRecorrencia ? (
        <section className="v2-home-section" aria-label="Continue de onde parou">
          <h2>Continue de onde parou</h2>
          <div className="v2-home-tabs">
            {recentesHome.length > 0 ? (
              <button type="button" className={`v2-home-tab ${recorrenciaTab === 'recentes' ? 'is-active' : ''}`} onClick={() => setRecorrenciaTab('recentes')}>
                Vistos ({recentesHome.length})
              </button>
            ) : null}
            {recompraHome.length > 0 ? (
              <button type="button" className={`v2-home-tab ${recorrenciaTab === 'recompra' ? 'is-active' : ''}`} onClick={() => setRecorrenciaTab('recompra')}>
                Comprar de novo ({recompraHome.length})
              </button>
            ) : null}
            {favoritosHome.length > 0 ? (
              <button type="button" className={`v2-home-tab ${recorrenciaTab === 'favoritos' ? 'is-active' : ''}`} onClick={() => setRecorrenciaTab('favoritos')}>
                Favoritos ({favoritosHome.length})
              </button>
            ) : null}
          </div>
          <div className="v2-home-recurrence-grid">
            {recorrenciaItens.map((produto, i) => (
              <article className="v2-product-card-compact v2-product-card-compact--grid" key={`rec-${getProdutoId(produto) || i}`}>
                <div className="v2-product-card-media">
                  <SmartImage className="v2-product-card-img" src={getProdutoImagem(produto)} alt={produto.nome} loading="lazy" />
                </div>
                <p className="v2-product-card-name">{produto.nome}</p>
                <div className="v2-product-card-price-row">
                  <span className="v2-product-card-price">R$ {Number(produto.preco || 0).toFixed(2).replace('.', ',')}</span>
                </div>
                <button className="v2-product-card-add" type="button" onClick={() => addItem(produto)} aria-label={`Adicionar ${produto.nome}`}>+</button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {erro ? <p className="error-text" role="alert">{erro}</p> : null}

      {/* Footer da loja */}
      <footer className="v2-home-footer">
        <div className="v2-home-footer-brand">
          <div className="app-header-logo-icon" aria-hidden="true" style={{ width: 40, height: 40, fontSize: '1.2rem' }}>🛒</div>
          <div>
            <p className="v2-home-footer-name"><strong>Bom</strong><span style={{ color: 'var(--bf-green-500)' }}>Filho</span></p>
            <p className="v2-home-footer-sub">Supermercado de confiança</p>
          </div>
        </div>
        <div className="v2-home-footer-info">
          <p>📱 WhatsApp: <a href={STORE_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">{STORE_WHATSAPP_DISPLAY}</a></p>
          <p>📞 Fixo: <a href={STORE_TELEFONE_URL}>{STORE_TELEFONE_DISPLAY}</a></p>
          <p>🕐 {STORE_HORARIO_CURTO}</p>
          <p style={{ fontSize: '0.68rem', color: 'var(--bf-ink-400)' }}>CNPJ: {STORE_CNPJ} · {STORE_ENDERECO}</p>
        </div>
        <small style={{ color: 'var(--bf-ink-400)' }}>© 2026 BomFilho. Todos os direitos reservados.</small>
      </footer>
    </section>
  );
}
