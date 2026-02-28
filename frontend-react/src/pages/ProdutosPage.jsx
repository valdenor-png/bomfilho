import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getProdutos } from '../lib/api';
import { useCart } from '../context/CartContext';

const DRINK_SECTIONS_BEBIDAS = [
  {
    id: 'agua',
    label: 'Água',
    image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=1400&q=60',
    matchers: ['agua', 'mineral', 'sem gas', 'com gas']
  },
  {
    id: 'refrigerante',
    label: 'Refrigerante',
    image: 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?auto=format&fit=crop&w=1400&q=60',
    matchers: ['refrigerante', 'coca', 'pepsi', 'guarana', 'guaraná', 'fanta', 'sprite']
  },
  {
    id: 'cervejas',
    label: 'Cervejas',
    image: 'https://images.unsplash.com/photo-1566633806327-68e152aaf26d?auto=format&fit=crop&w=1400&q=60',
    matchers: ['cerveja', 'beer', 'heineken', 'brahma', 'skol', 'antarctica', 'itaipava']
  },
  {
    id: 'vinho',
    label: 'Vinho',
    image: 'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&w=1400&q=60',
    matchers: ['vinho', 'wine', 'tinto', 'branco', 'rose', 'rosé']
  }
];

const BRAND_GROUPS_BY_SUBCATEGORY = {
  refrigerante: [
    {
      id: 'coca-cola',
      label: 'Coca-Cola',
      image: 'https://images.unsplash.com/photo-1629203432180-71e9bfe03d94?auto=format&fit=crop&w=1400&q=60',
      matchers: ['coca-cola', 'coca cola', 'coca']
    },
    {
      id: 'pepsi',
      label: 'Pepsi',
      image: 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?auto=format&fit=crop&w=1400&q=60',
      matchers: ['pepsi']
    },
    {
      id: 'guarana-e-outros',
      label: 'Guaraná e Outros',
      image: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=1400&q=60',
      matchers: ['guarana', 'guaraná', 'fanta', 'sprite', 'kuat', 'sukita', 'garoto']
    }
  ],
  cervejas: [
    {
      id: 'heineken',
      label: 'Heineken',
      image: 'https://images.unsplash.com/photo-1566633806327-68e152aaf26d?auto=format&fit=crop&w=1400&q=60',
      matchers: ['heineken']
    },
    {
      id: 'brahma-e-skol',
      label: 'Brahma e Skol',
      image: 'https://images.unsplash.com/photo-1618885472179-5e474019f2a9?auto=format&fit=crop&w=1400&q=60',
      matchers: ['brahma', 'skol', 'antarctica']
    }
  ],
  vinho: [
    {
      id: 'vinhos-tintos',
      label: 'Vinhos Tintos',
      image: 'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&w=1400&q=60',
      matchers: ['tinto']
    },
    {
      id: 'vinhos-brancos',
      label: 'Vinhos Brancos',
      image: 'https://images.unsplash.com/photo-1474722883778-792e7990302f?auto=format&fit=crop&w=1400&q=60',
      matchers: ['branco', 'rose', 'rosé']
    }
  ],
  agua: [
    {
      id: 'agua-sem-gas',
      label: 'Água sem gás',
      image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=1400&q=60',
      matchers: ['sem gas']
    },
    {
      id: 'agua-com-gas',
      label: 'Água com gás',
      image: 'https://images.unsplash.com/photo-1564417947365-8dbc9d0e718e?auto=format&fit=crop&w=1400&q=60',
      matchers: ['com gas']
    }
  ]
};

const TEST_BEBIDAS_ITEMS = [
  {
    id: 990001,
    nome: 'Água Mineral 500ml (Teste)',
    marca: 'Cristal',
    categoria: 'bebidas',
    descricao: 'agua mineral sem gas',
    preco: 2.5,
    emoji: '💧',
    imagem: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=900&q=60'
  },
  {
    id: 990002,
    nome: 'Refrigerante Cola 2L (Teste)',
    marca: 'Coca-Cola',
    categoria: 'bebidas',
    descricao: 'refrigerante cola',
    preco: 10.9,
    emoji: '🥤',
    imagem: 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?auto=format&fit=crop&w=900&q=60'
  },
  {
    id: 990003,
    nome: 'Cerveja Pilsen Lata 350ml (Teste)',
    marca: 'Heineken',
    categoria: 'bebidas',
    descricao: 'cerveja pilsen lager',
    preco: 5.99,
    emoji: '🍺',
    imagem: 'https://images.unsplash.com/photo-1566633806327-68e152aaf26d?auto=format&fit=crop&w=900&q=60'
  },
  {
    id: 990004,
    nome: 'Vinho Tinto Suave 750ml (Teste)',
    marca: 'Pérgola',
    categoria: 'bebidas',
    descricao: 'vinho tinto suave',
    preco: 29.9,
    emoji: '🍷',
    imagem: 'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&w=900&q=60'
  }
];

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

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBebidasCategoria(value) {
  return normalizeText(value).includes('bebida');
}

function getTextoProduto(produto) {
  return [
    normalizeText(produto?.nome),
    normalizeText(produto?.marca),
    normalizeText(produto?.categoria),
    normalizeText(produto?.descricao)
  ]
    .filter(Boolean)
    .join(' ');
}

function belongsToDrinkSection(produto, sectionConfig) {
  const texto = getTextoProduto(produto);
  return sectionConfig.matchers.some((matcher) => texto.includes(normalizeText(matcher)));
}

function getBebidaSubcategoriaId(produto) {
  const found = DRINK_SECTIONS_BEBIDAS.find((section) => belongsToDrinkSection(produto, section));
  return found?.id || 'outras-bebidas';
}

function belongsToBrandGroup(produto, brandConfig) {
  const texto = getTextoProduto(produto);
  return brandConfig.matchers.some((matcher) => texto.includes(normalizeText(matcher)));
}

export default function ProdutosPage() {
  const { addItem, resumo } = useCart();
  const [searchParams] = useSearchParams();
  const categoriaInicial = String(searchParams.get('categoria') || 'todas').toLowerCase();
  const buscaInicial = String(searchParams.get('busca') || '');

  const categoriasLegado = [
    { id: 'todas', label: '🛒 Todas' },
    { id: 'promocoes', label: '🔥 Promoções', destaque: true },
    { id: 'hortifruti', label: '🥦 Hortifruti' },
    { id: 'bebidas', label: '🥤 Bebidas' },
    { id: 'limpeza', label: '🧴 Limpeza' }
  ];

  const [produtos, setProdutos] = useState([]);
  const [busca, setBusca] = useState(buscaInicial);
  const [categoria, setCategoria] = useState(categoriaInicial || 'todas');
  const [bebidaSubcategoria, setBebidaSubcategoria] = useState('todas');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    carregarProdutos();
  }, []);

  useEffect(() => {
    setBusca(String(searchParams.get('busca') || ''));
    setCategoria(String(searchParams.get('categoria') || 'todas').toLowerCase());
  }, [searchParams]);

  useEffect(() => {
    if (!isBebidasCategoria(categoria)) {
      setBebidaSubcategoria('todas');
    }
  }, [categoria]);

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

  const produtosComTeste = useMemo(() => {
    const base = [...produtos];

    TEST_BEBIDAS_ITEMS.forEach((teste) => {
      const jaExiste = base.some((item) => normalizeText(item.nome) === normalizeText(teste.nome));
      if (!jaExiste) {
        base.push(teste);
      }
    });

    return base;
  }, [produtos]);

  const categorias = useMemo(() => {
    const values = new Set();
    produtosComTeste.forEach((produto) => {
      if (produto.categoria) {
        values.add(String(produto.categoria));
      }
    });
    return ['todas', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [produtosComTeste]);

  const produtosFiltrados = useMemo(() => {
    const termoNormalizado = normalizeText(busca);
    const termo = isBebidasCategoria(categoria) && (termoNormalizado === 'bebida' || termoNormalizado === 'bebidas')
      ? ''
      : termoNormalizado;
    return produtosComTeste.filter((produto) => {
      const nome = normalizeText(produto.nome);
      const categoriaAtual = String(produto.categoria || '').toLowerCase();
      const categoriaAtualNormalizada = normalizeText(categoriaAtual);
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
          : categoria === 'bebidas'
            ? categoriaAtualNormalizada.includes('bebida')
            : categoriaAtual === categoria;
      return matchBusca && matchCategoria;
    });
  }, [produtosComTeste, busca, categoria]);

  const secoesBebidas = useMemo(() => {
    if (!isBebidasCategoria(categoria)) {
      return [];
    }

    const usados = new Set();
    const secoes = DRINK_SECTIONS_BEBIDAS.map((section) => {
      const itens = produtosFiltrados.filter((produto) => {
        const match = belongsToDrinkSection(produto, section);
        if (match) {
          usados.add(produto.id);
        }
        return match;
      });

      return {
        ...section,
        itens
      };
    });

    const outrasBebidas = produtosFiltrados.filter((produto) => !usados.has(produto.id));

    if (outrasBebidas.length > 0) {
      secoes.push({
        id: 'outras-bebidas',
        label: 'Outras bebidas',
        image: CATEGORY_IMAGES.bebidas,
        itens: outrasBebidas
      });
    }

    return secoes.filter((secao) => secao.itens.length > 0);
  }, [produtosFiltrados, categoria]);

  const produtosBebidasSubcategoria = useMemo(() => {
    if (!isBebidasCategoria(categoria) || bebidaSubcategoria === 'todas') {
      return [];
    }
    return produtosFiltrados.filter((produto) => getBebidaSubcategoriaId(produto) === bebidaSubcategoria);
  }, [categoria, bebidaSubcategoria, produtosFiltrados]);

  const gruposMarcaBebidas = useMemo(() => {
    if (!isBebidasCategoria(categoria) || bebidaSubcategoria === 'todas') {
      return [];
    }

    const defs = BRAND_GROUPS_BY_SUBCATEGORY[bebidaSubcategoria] || [];
    const usados = new Set();
    const grupos = defs.map((def) => {
      const itens = produtosBebidasSubcategoria.filter((produto) => {
        const match = belongsToBrandGroup(produto, def);
        if (match) {
          usados.add(produto.id);
        }
        return match;
      });

      return {
        ...def,
        itens
      };
    }).filter((grupo) => grupo.itens.length > 0);

    const outros = produtosBebidasSubcategoria.filter((produto) => !usados.has(produto.id));
    if (outros.length > 0) {
      grupos.push({
        id: 'outras-marcas',
        label: 'Outras marcas',
        image: CATEGORY_IMAGES.bebidas,
        itens: outros
      });
    }

    return grupos;
  }, [categoria, bebidaSubcategoria, produtosBebidasSubcategoria]);

  function renderProdutoCard(produto) {
    return (
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
    );
  }

  return (
    <section className="page">
      <section className="product-highlight-section" id="produtos" aria-label="Página de produtos">
        <h1>Produtos</h1>
        <p className="product-highlight-subtitle">Use a busca para encontrar rápido e filtre por categoria.</p>

        <div className="search-bar-highlight">
          <label className="field-label" htmlFor="busca-produtos">Buscar produtos</label>
          <div className="search-bar-react">
            <input
              id="busca-produtos"
              className="field-input"
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="🔍 Ex: arroz, café, detergente..."
            />
          </div>
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
              onClick={() => {
                setCategoria(item.id);
                if (item.id !== 'bebidas') {
                  setBebidaSubcategoria('todas');
                }
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isBebidasCategoria(categoria) ? (
          <div className="bebidas-subcats" aria-label="Subcategorias de bebidas">
            <p className="bebidas-subcats-title">Subcategorias de bebidas</p>
            <div className="bebidas-subcats-actions">
              <button
                type="button"
                className={`category-btn-react ${bebidaSubcategoria === 'todas' ? 'active' : ''}`}
                onClick={() => setBebidaSubcategoria('todas')}
              >
                Todas
              </button>
              {secoesBebidas.map((secao) => (
                <button
                  key={secao.id}
                  type="button"
                  className={`category-btn-react ${bebidaSubcategoria === secao.id ? 'active' : ''}`}
                  onClick={() => setBebidaSubcategoria(secao.id)}
                >
                  {secao.label} ({secao.itens.length})
                </button>
              ))}
            </div>
          </div>
        ) : null}
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
      ) : isBebidasCategoria(categoria) ? (
        bebidaSubcategoria === 'todas' ? (
          <div className="brand-sections-list" id="produtos-lista">
            {secoesBebidas.map((secao) => (
              <section className="brand-section" key={secao.id} aria-label={`Produtos da categoria ${secao.label}`}>
                <div className="brand-section-banner" style={{ '--brand-bg': `url('${secao.image}')` }}>
                  <h2>{secao.label}</h2>
                  <p>{secao.itens.length} item(ns) nesta categoria</p>
                </div>
              </section>
            ))}
          </div>
        ) : gruposMarcaBebidas.length === 0 ? (
          <p className="muted-text">Nenhum item encontrado para essa subcategoria.</p>
        ) : (
          <div className="brand-sections-list" id="produtos-lista">
            {gruposMarcaBebidas.map((grupo) => (
              <section className="brand-section" key={grupo.id} aria-label={`Produtos da marca ${grupo.label}`}>
                <div className="brand-section-banner" style={{ '--brand-bg': `url('${grupo.image}')` }}>
                  <h2>{grupo.label}</h2>
                  <p>{grupo.itens.length} item(ns) nesta marca</p>
                </div>
                <div className="produto-grid brand-produto-grid">
                  {grupo.itens.map((produto) => renderProdutoCard(produto))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : (
        <div className="produto-grid" id="produtos-lista">
          {produtosFiltrados.map((produto) => renderProdutoCard(produto))}
        </div>
      )}
    </section>
  );
}