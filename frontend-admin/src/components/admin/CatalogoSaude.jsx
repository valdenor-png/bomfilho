import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, CircleCheck, Package, RefreshCw, ShieldCheck } from '../../icons';
import { adminGetCatalogoSaudeProdutos, adminGetCatalogoSaude } from '../../lib/api';
import { formatarMoeda } from './ui/adminUtils';
import LoadingSkeleton from './ui/LoadingSkeleton';
import ErrorState from './ui/ErrorState';

/* ─── Configuração dos filtros de problema ─── */
const FILTROS_PROBLEMA = [
  { id: 'todos',            label: 'Todos',              cor: 'neutro' },
  { id: 'sem_estoque',      label: 'Sem estoque',        cor: 'critico' },
  { id: 'estoque_baixo',    label: 'Estoque baixo',      cor: 'alerta' },
  { id: 'estoque_negativo', label: 'Estoque negativo',   cor: 'critico' },
  { id: 'sem_imagem',       label: 'Sem foto',           cor: 'alerta' },
  { id: 'sem_preco',        label: 'Sem preço',          cor: 'critico' },
  { id: 'sem_descricao',    label: 'Sem descrição',      cor: 'info' },
  { id: 'inativos',         label: 'Inativos',           cor: 'info' },
];

const LABEL_PROBLEMA = {
  sem_estoque:      'Sem estoque',
  estoque_baixo:    'Estoque baixo',
  estoque_negativo: 'Estoque negativo',
  sem_imagem:       'Sem foto',
  sem_preco:        'Sem preço',
  sem_descricao:    'Sem descrição',
  inativo:          'Inativo',
};

function BadgeProblema({ tipo }) {
  const COR = {
    sem_estoque:      'cs-badge-critico',
    estoque_baixo:    'cs-badge-alerta',
    estoque_negativo: 'cs-badge-critico',
    sem_imagem:       'cs-badge-alerta',
    sem_preco:        'cs-badge-critico',
    sem_descricao:    'cs-badge-info',
    inativo:          'cs-badge-info',
  };
  return (
    <span className={`cs-badge ${COR[tipo] || 'cs-badge-info'}`}>
      {LABEL_PROBLEMA[tipo] || tipo}
    </span>
  );
}

function EstoqueNum({ valor }) {
  const n = Number(valor || 0);
  if (n === 0) return <span className="cs-estoque cs-estoque-zero">0</span>;
  if (n < 0)   return <span className="cs-estoque cs-estoque-neg">{n}</span>;
  if (n <= 5)  return <span className="cs-estoque cs-estoque-baixo">{n}</span>;
  return <span className="cs-estoque cs-estoque-ok">{n}</span>;
}

function SkeletonLista() {
  return (
    <div className="cs-lista">
      {Array.from({ length: 8 }).map((_, i) => (
        <div className="cs-linha cs-linha-skeleton" key={i}>
          <div className="cs-skeleton-bloco cs-sk-nome" />
          <div className="cs-skeleton-bloco cs-sk-cat" />
          <div className="cs-skeleton-bloco cs-sk-est" />
          <div className="cs-skeleton-bloco cs-sk-preco" />
          <div className="cs-skeleton-bloco cs-sk-badge" />
          <div className="cs-skeleton-bloco cs-sk-btn" />
        </div>
      ))}
    </div>
  );
}

/* ─── Contador de problemas no topo ─── */
function ContadorFiltro({ filtro, contadores, ativo, onClick }) {
  const count = filtro.id === 'todos'
    ? (contadores?.total_ativos || 0)
    : (contadores?.[filtro.id] || 0);

  const COR_CLASSE = {
    critico: 'cs-contador-critico',
    alerta:  'cs-contador-alerta',
    info:    'cs-contador-info',
    neutro:  'cs-contador-neutro',
  };

  return (
    <button
      type="button"
      className={`cs-contador ${COR_CLASSE[filtro.cor] || ''} ${ativo ? 'is-ativo' : ''}`}
      onClick={() => onClick(filtro.id)}
      aria-pressed={ativo}
    >
      <span className="cs-contador-num">{count}</span>
      <span className="cs-contador-label">{filtro.label}</span>
    </button>
  );
}

/* ─── Linha de produto ─── */
function LinhaProduto({ produto, onVerProduto }) {
  return (
    <div className={`cs-linha ${!produto.ativo ? 'cs-linha-inativa' : ''}`}>
      <div className="cs-linha-nome">
        <span className="cs-nome-texto">{produto.nome}</span>
        {produto.marca ? <span className="cs-nome-marca">{produto.marca}</span> : null}
      </div>
      <div className="cs-linha-cat">
        {produto.categoria || <span className="cs-sem-dado">—</span>}
      </div>
      <div className="cs-linha-estoque">
        <EstoqueNum valor={produto.estoque} />
        <span className="cs-unidade">{produto.unidade || '—'}</span>
      </div>
      <div className="cs-linha-preco">
        {produto.preco > 0
          ? formatarMoeda(produto.preco)
          : <span className="cs-sem-dado">Sem preço</span>}
      </div>
      <div className="cs-linha-problemas">
        {produto.problemas.length > 0
          ? produto.problemas.map(p => <BadgeProblema key={p} tipo={p} />)
          : <span className="cs-ok-badge"><CircleCheck size={13} aria-hidden="true" /> OK</span>}
      </div>
      <div className="cs-linha-acoes">
        <a
          href={`/admin#produtos?id=${produto.id}`}
          className="cs-btn-ver"
          onClick={e => { e.preventDefault(); onVerProduto(produto); }}
        >
          Ver produto
        </a>
      </div>
    </div>
  );
}

/* ─── Paginação ─── */
function Paginacao({ paginacao, onPagina }) {
  if (!paginacao || paginacao.total_paginas <= 1) return null;
  const { page, total_paginas, total } = paginacao;

  return (
    <div className="cs-paginacao" role="navigation" aria-label="Paginação de produtos">
      <span className="cs-paginacao-info">
        Página {page} de {total_paginas} — {total} produtos
      </span>
      <div className="cs-paginacao-btns">
        <button
          type="button"
          className="cs-pag-btn"
          disabled={page <= 1}
          onClick={() => onPagina(page - 1)}
          aria-label="Página anterior"
        >
          ← Anterior
        </button>
        {page > 2 && (
          <button type="button" className="cs-pag-btn cs-pag-num" onClick={() => onPagina(1)}>1</button>
        )}
        {page > 3 && <span className="cs-pag-ellipsis">…</span>}
        {page > 1 && (
          <button type="button" className="cs-pag-btn cs-pag-num" onClick={() => onPagina(page - 1)}>{page - 1}</button>
        )}
        <button type="button" className="cs-pag-btn cs-pag-num is-current" disabled>{page}</button>
        {page < total_paginas && (
          <button type="button" className="cs-pag-btn cs-pag-num" onClick={() => onPagina(page + 1)}>{page + 1}</button>
        )}
        {page < total_paginas - 2 && <span className="cs-pag-ellipsis">…</span>}
        {page < total_paginas - 1 && (
          <button type="button" className="cs-pag-btn cs-pag-num" onClick={() => onPagina(total_paginas)}>{total_paginas}</button>
        )}
        <button
          type="button"
          className="cs-pag-btn"
          disabled={page >= total_paginas}
          onClick={() => onPagina(page + 1)}
          aria-label="Próxima página"
        >
          Próxima →
        </button>
      </div>
    </div>
  );
}

/* ─── Componente principal ─── */
export default function CatalogoSaude({ onVerProduto }) {
  const [produtos, setProdutos]     = useState([]);
  const [paginacao, setPaginacao]   = useState(null);
  const [contadores, setContadores] = useState(null);
  const [resumo, setResumo]         = useState(null);
  const [schemaInfo, setSchemaInfo] = useState(null);
  const [filtro, setFiltro]         = useState('todos');
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [recarregando, setRecarregando] = useState(false);
  const [erro, setErro]             = useState('');
  const mountedRef = useRef(true);

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const carregar = useCallback(async (filtroAtual, paginaAtual, showFullLoading = false) => {
    if (showFullLoading) setLoading(true);
    else setRecarregando(true);
    setErro('');

    try {
      const [dadosProdutos, dadosResumo] = await Promise.allSettled([
        adminGetCatalogoSaudeProdutos({ problema: filtroAtual, page: paginaAtual, limit: 100 }),
        paginaAtual === 1 ? adminGetCatalogoSaude() : Promise.resolve(null)
      ]);

      if (!mountedRef.current) return;

      if (dadosProdutos.status === 'fulfilled' && dadosProdutos.value) {
        setProdutos(dadosProdutos.value.produtos || []);
        setPaginacao(dadosProdutos.value.paginacao || null);
        if (dadosProdutos.value.contadores) {
          setContadores(dadosProdutos.value.contadores);
        }
        if (dadosProdutos.value.schema_info) {
          setSchemaInfo(dadosProdutos.value.schema_info);
        }
      } else {
        throw new Error('Falha ao carregar produtos.');
      }

      if (dadosResumo.status === 'fulfilled' && dadosResumo.value) {
        setResumo(dadosResumo.value);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setErro('Não foi possível carregar a lista de produtos agora. Tente novamente.');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRecarregando(false);
      }
    }
  }, []);

  // Carregamento inicial
  useEffect(() => {
    carregar('todos', 1, true);
  }, [carregar]);

  const handleFiltro = useCallback((novoFiltro) => {
    setFiltro(novoFiltro);
    setPage(1);
    carregar(novoFiltro, 1, false);
  }, [carregar]);

  const handlePagina = useCallback((novaPagina) => {
    setPage(novaPagina);
    carregar(filtro, novaPagina, false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [carregar, filtro]);

  const handleRecarregar = useCallback(() => {
    carregar(filtro, page, false);
  }, [carregar, filtro, page]);

  const handleVerProduto = useCallback((produto) => {
    if (typeof onVerProduto === 'function') {
      onVerProduto(produto);
    }
  }, [onVerProduto]);

  if (loading) {
    return (
      <div className="cs-shell">
        <div className="cs-topo-skeleton">
          <LoadingSkeleton type="kpis" />
        </div>
        <SkeletonLista />
      </div>
    );
  }

  if (erro && !produtos.length) {
    return (
      <ErrorState
        message={erro}
        onRetry={handleRecarregar}
      />
    );
  }

  const totalProblemas = contadores
    ? (contadores.sem_estoque || 0) + (contadores.estoque_negativo || 0) + (contadores.sem_preco || 0)
    : 0;

  const score = resumo?.score || 0;
  const scoreClasse = score >= 80 ? 'bom' : score >= 50 ? 'medio' : 'ruim';
  const scoreTexto = score >= 80 ? 'Bom' : score >= 50 ? 'Atenção' : 'Crítico';

  // Ocultar filtros cujas colunas não existem no schema (schema_info vem do backend)
  const filtrosDisponiveis = FILTROS_PROBLEMA.filter(f => {
    if (f.id === 'sem_imagem'    && schemaInfo?.optional_fields?.imagem_url === false) return false;
    if (f.id === 'sem_descricao' && schemaInfo?.optional_fields?.descricao  === false) return false;
    return true;
  });

  return (
    <div className="cs-shell">

      {/* ─── Cabeçalho ─── */}
      <div className="cs-cabecalho">
        <div className="cs-cabecalho-esq">
          <span className="cs-cabecalho-icone"><ShieldCheck size={20} aria-hidden="true" /></span>
          <div>
            <h2 className="cs-titulo">Lista de Estoque e Produtos</h2>
            <p className="cs-subtitulo">
              Veja os produtos com menos estoque primeiro. Use os filtros para encontrar problemas.
            </p>
          </div>
        </div>
        <div className="cs-cabecalho-dir">
          {resumo && (
            <div className={`cs-score cs-score-${scoreClasse}`}>
              <span className="cs-score-num">{score}</span>
              <span className="cs-score-label">Saúde do catálogo — {scoreTexto}</span>
            </div>
          )}
          <button
            type="button"
            className="cs-btn-recarregar"
            onClick={handleRecarregar}
            disabled={recarregando}
          >
            <RefreshCw size={14} aria-hidden="true" />
            {recarregando ? 'Atualizando…' : 'Atualizar lista'}
          </button>
        </div>
      </div>

      {/* ─── Alerta de problemas críticos ─── */}
      {totalProblemas > 0 && (
        <div className="cs-aviso-critico" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            <strong>{totalProblemas} produto{totalProblemas > 1 ? 's' : ''}</strong> com problema crítico:
            sem estoque, estoque negativo ou sem preço.
            Clique em <strong>"Sem estoque"</strong> ou <strong>"Sem preço"</strong> abaixo para ver a lista.
          </span>
        </div>
      )}

      {/* ─── Filtros por problema ─── */}
      <div className="cs-filtros" role="group" aria-label="Filtrar por tipo de problema">
        {filtrosDisponiveis.map(f => (
          <ContadorFiltro
            key={f.id}
            filtro={f}
            contadores={contadores}
            ativo={filtro === f.id}
            onClick={handleFiltro}
          />
        ))}
      </div>

      {/* ─── Cabeçalho da tabela ─── */}
      <div className="cs-tabela">
        <div className="cs-linha cs-linha-cabecalho" aria-hidden="true">
          <div className="cs-linha-nome">Produto</div>
          <div className="cs-linha-cat">Categoria</div>
          <div className="cs-linha-estoque">Estoque</div>
          <div className="cs-linha-preco">Preço</div>
          <div className="cs-linha-problemas">Situação</div>
          <div className="cs-linha-acoes"></div>
        </div>

        {/* ─── Lista de produtos ─── */}
        {recarregando ? (
          <SkeletonLista />
        ) : produtos.length === 0 ? (
          <div className="cs-vazio">
            <CircleCheck size={32} aria-hidden="true" />
            <p>
              {filtro === 'todos'
                ? 'Nenhum produto encontrado no catálogo.'
                : `Nenhum produto com o problema "${FILTROS_PROBLEMA.find(f => f.id === filtro)?.label || filtro}".`}
            </p>
            {filtro !== 'todos' && (
              <button type="button" className="cs-btn-ver" onClick={() => handleFiltro('todos')}>
                Ver todos os produtos
              </button>
            )}
          </div>
        ) : (
          produtos.map(produto => (
            <LinhaProduto
              key={produto.id}
              produto={produto}
              onVerProduto={handleVerProduto}
            />
          ))
        )}
      </div>

      {/* ─── Paginação ─── */}
      {!recarregando && (
        <Paginacao paginacao={paginacao} onPagina={handlePagina} />
      )}

      {/* ─── Resumo do catálogo no rodapé ─── */}
      {resumo && contadores && (
        <div className="cs-rodape-resumo">
          <div className="cs-resumo-item">
            <span className="cs-resumo-num">{contadores.total_ativos}</span>
            <span className="cs-resumo-label">Produtos ativos</span>
          </div>
          <div className="cs-resumo-item cs-resumo-alerta">
            <span className="cs-resumo-num">{contadores.sem_estoque}</span>
            <span className="cs-resumo-label">Sem estoque</span>
          </div>
          <div className="cs-resumo-item cs-resumo-alerta">
            <span className="cs-resumo-num">{contadores.estoque_baixo}</span>
            <span className="cs-resumo-label">Estoque baixo (≤5)</span>
          </div>
          <div className="cs-resumo-item cs-resumo-critico">
            <span className="cs-resumo-num">{contadores.sem_preco}</span>
            <span className="cs-resumo-label">Sem preço</span>
          </div>
          {contadores.sem_imagem != null && (
            <div className="cs-resumo-item">
              <span className="cs-resumo-num">{contadores.sem_imagem}</span>
              <span className="cs-resumo-label">Sem foto</span>
            </div>
          )}
          <div className="cs-resumo-item">
            <span className="cs-resumo-num">{contadores.inativos}</span>
            <span className="cs-resumo-label">Inativos</span>
          </div>
          {contadores.sem_imagem != null && resumo?.cobertura_imagem != null && (
            <div className="cs-resumo-item">
              <span className="cs-resumo-num">{resumo.cobertura_imagem}%</span>
              <span className="cs-resumo-label">Com foto</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
