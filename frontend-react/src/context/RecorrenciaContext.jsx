import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const RECORRENCIA_STORAGE_KEY = 'bomfilho_recorrencia_v1';
const RECORRENCIA_STORAGE_VERSION = 1;
const LIMITE_FAVORITOS = 120;
const LIMITE_RECENTES = 24;
const LIMITE_INTERACOES = 180;
const LIMITE_RECOMPRA = 18;

const RecorrenciaContext = createContext(null);

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizarProdutoId(produtoOuId) {
  if (produtoOuId === null || produtoOuId === undefined) {
    return null;
  }

  if (typeof produtoOuId === 'number' || typeof produtoOuId === 'string') {
    const idDireto = Number(produtoOuId);
    return Number.isFinite(idDireto) && idDireto > 0 ? idDireto : null;
  }

  const idObjeto = Number(produtoOuId?.id || produtoOuId?.produto_id || 0);
  return Number.isFinite(idObjeto) && idObjeto > 0 ? idObjeto : null;
}

function normalizarTexto(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function criarSnapshotProduto(produto, fallback = {}) {
  const id = normalizarProdutoId(produto);
  if (id === null) {
    return null;
  }

  const base = fallback && typeof fallback === 'object' ? fallback : {};

  return {
    id,
    nome: normalizarTexto(produto?.nome || produto?.nome_produto || base.nome, 'Produto'),
    preco: Math.max(0, toNumber(produto?.preco ?? produto?.preco_tabela ?? base.preco, 0)),
    emoji: normalizarTexto(produto?.emoji || base.emoji, ''),
    imagem: normalizarTexto(produto?.imagem || produto?.imagem_url || base.imagem, ''),
    categoria: normalizarTexto(produto?.categoria || base.categoria, ''),
    unidade: normalizarTexto(produto?.unidade || base.unidade, ''),
    marca: normalizarTexto(produto?.marca || base.marca, ''),
    descricao: normalizarTexto(produto?.descricao || base.descricao, '')
  };
}

function normalizarListaIds(raw, max) {
  if (!Array.isArray(raw)) {
    return [];
  }

  const ids = [];
  const vistos = new Set();

  raw.forEach((item) => {
    const id = normalizarProdutoId(item);
    if (id === null || vistos.has(id)) {
      return;
    }
    vistos.add(id);
    ids.push(id);
  });

  return ids.slice(0, max);
}

function normalizarInteracoes(raw) {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const entries = Object.entries(raw)
    .map(([idRaw, meta]) => {
      const id = normalizarProdutoId(idRaw);
      if (id === null || !meta || typeof meta !== 'object') {
        return null;
      }

      return [
        String(id),
        {
          views: Math.max(0, Math.floor(toNumber(meta.views, 0))),
          adds: Math.max(0, Math.floor(toNumber(meta.adds, 0))),
          favoritados: Math.max(0, Math.floor(toNumber(meta.favoritados, 0))),
          score: Math.max(0, toNumber(meta.score, 0)),
          lastAt: Math.max(0, Math.floor(toNumber(meta.lastAt, 0)))
        }
      ];
    })
    .filter(Boolean)
    .sort((a, b) => {
      const scoreDiff = Number(b[1].score || 0) - Number(a[1].score || 0);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return Number(b[1].lastAt || 0) - Number(a[1].lastAt || 0);
    })
    .slice(0, LIMITE_INTERACOES);

  return Object.fromEntries(entries);
}

function normalizarEstadoRecorrencia(raw) {
  const estado = raw && typeof raw === 'object' ? raw : {};

  const produtosRaw = estado.produtos && typeof estado.produtos === 'object'
    ? estado.produtos
    : {};

  const produtos = {};
  Object.entries(produtosRaw).forEach(([idRaw, snapshotRaw]) => {
    const id = normalizarProdutoId(idRaw);
    if (id === null) {
      return;
    }

    const snapshot = criarSnapshotProduto({ ...snapshotRaw, id }, snapshotRaw);
    if (!snapshot) {
      return;
    }

    produtos[String(id)] = snapshot;
  });

  const favoritos = normalizarListaIds(estado.favoritos, LIMITE_FAVORITOS);
  const recentes = normalizarListaIds(estado.recentes, LIMITE_RECENTES);
  const interacoes = normalizarInteracoes(estado.interacoes);

  const idsPermitidos = new Set([
    ...favoritos,
    ...recentes,
    ...Object.keys(interacoes).map((id) => Number(id))
  ]);

  const produtosFiltrados = {};
  idsPermitidos.forEach((id) => {
    const snapshot = produtos[String(id)];
    if (snapshot) {
      produtosFiltrados[String(id)] = snapshot;
    }
  });

  return {
    version: RECORRENCIA_STORAGE_VERSION,
    favoritos,
    recentes,
    produtos: produtosFiltrados,
    interacoes
  };
}

function lerEstadoRecorrencia() {
  if (typeof window === 'undefined') {
    return normalizarEstadoRecorrencia({});
  }

  try {
    const raw = window.localStorage.getItem(RECORRENCIA_STORAGE_KEY);
    if (!raw) {
      return normalizarEstadoRecorrencia({});
    }

    const parsed = JSON.parse(raw);
    return normalizarEstadoRecorrencia(parsed);
  } catch {
    return normalizarEstadoRecorrencia({});
  }
}

function promoverIdNoInicio(lista, id, limite) {
  return [id, ...lista.filter((itemId) => itemId !== id)].slice(0, limite);
}

function atualizarInteracoes(interacoesAtuais, id, delta = {}) {
  const key = String(id);
  const atual = interacoesAtuais[key] || {
    views: 0,
    adds: 0,
    favoritados: 0,
    score: 0,
    lastAt: 0
  };

  const proximo = {
    views: Math.max(0, atual.views + Math.floor(toNumber(delta.views, 0))),
    adds: Math.max(0, atual.adds + Math.floor(toNumber(delta.adds, 0))),
    favoritados: Math.max(0, atual.favoritados + Math.floor(toNumber(delta.favoritados, 0))),
    score: Math.max(0, Number((atual.score + toNumber(delta.score, 0)).toFixed(2))),
    lastAt: Date.now()
  };

  return {
    ...interacoesAtuais,
    [key]: proximo
  };
}

export function RecorrenciaProvider({ children }) {
  const [estado, setEstado] = useState(() => lerEstadoRecorrencia());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(RECORRENCIA_STORAGE_KEY, JSON.stringify(estado));
    } catch {
      // Falhas de storage nao devem bloquear navegacao.
    }
  }, [estado]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleStorage = (event) => {
      if (event.key !== RECORRENCIA_STORAGE_KEY) {
        return;
      }

      if (!event.newValue) {
        setEstado(normalizarEstadoRecorrencia({}));
        return;
      }

      try {
        setEstado(normalizarEstadoRecorrencia(JSON.parse(event.newValue)));
      } catch {
        // Ignora payload invalido recebido por storage event.
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const favoritosSet = useMemo(() => new Set(estado.favoritos), [estado.favoritos]);

  const isFavorito = useCallback((produtoOuId) => {
    const id = normalizarProdutoId(produtoOuId);
    return id !== null && favoritosSet.has(id);
  }, [favoritosSet]);

  const adicionarFavorito = useCallback((produto) => {
    const id = normalizarProdutoId(produto);
    if (id === null) {
      return;
    }

    setEstado((atual) => {
      const snapshot = criarSnapshotProduto(produto, atual.produtos[String(id)]);
      if (!snapshot) {
        return atual;
      }

      const proximo = {
        ...atual,
        favoritos: promoverIdNoInicio(atual.favoritos, id, LIMITE_FAVORITOS),
        recentes: promoverIdNoInicio(atual.recentes, id, LIMITE_RECENTES),
        produtos: {
          ...atual.produtos,
          [String(id)]: snapshot
        },
        interacoes: atualizarInteracoes(atual.interacoes, id, {
          favoritados: 1,
          score: 6
        })
      };

      return normalizarEstadoRecorrencia(proximo);
    });
  }, []);

  const removerFavorito = useCallback((produtoOuId) => {
    const id = normalizarProdutoId(produtoOuId);
    if (id === null) {
      return;
    }

    setEstado((atual) => {
      if (!atual.favoritos.includes(id)) {
        return atual;
      }

      const proximo = {
        ...atual,
        favoritos: atual.favoritos.filter((itemId) => itemId !== id),
        interacoes: atualizarInteracoes(atual.interacoes, id, {
          favoritados: -1,
          score: -2
        })
      };

      return normalizarEstadoRecorrencia(proximo);
    });
  }, []);

  const alternarFavorito = useCallback((produto) => {
    const id = normalizarProdutoId(produto);
    if (id === null) {
      return;
    }

    setEstado((atual) => {
      const snapshot = criarSnapshotProduto(produto, atual.produtos[String(id)]);
      if (!snapshot) {
        return atual;
      }

      const jaFavoritado = atual.favoritos.includes(id);
      const favoritos = jaFavoritado
        ? atual.favoritos.filter((itemId) => itemId !== id)
        : promoverIdNoInicio(atual.favoritos, id, LIMITE_FAVORITOS);

      const proximo = {
        ...atual,
        favoritos,
        recentes: promoverIdNoInicio(atual.recentes, id, LIMITE_RECENTES),
        produtos: {
          ...atual.produtos,
          [String(id)]: snapshot
        },
        interacoes: atualizarInteracoes(atual.interacoes, id, {
          favoritados: jaFavoritado ? -1 : 1,
          score: jaFavoritado ? -2 : 6
        })
      };

      return normalizarEstadoRecorrencia(proximo);
    });
  }, []);

  const registrarVisualizacao = useCallback((produto) => {
    const id = normalizarProdutoId(produto);
    if (id === null) {
      return;
    }

    setEstado((atual) => {
      const snapshot = criarSnapshotProduto(produto, atual.produtos[String(id)]);
      if (!snapshot) {
        return atual;
      }

      const proximo = {
        ...atual,
        recentes: promoverIdNoInicio(atual.recentes, id, LIMITE_RECENTES),
        produtos: {
          ...atual.produtos,
          [String(id)]: snapshot
        },
        interacoes: atualizarInteracoes(atual.interacoes, id, {
          views: 1,
          score: 1
        })
      };

      return normalizarEstadoRecorrencia(proximo);
    });
  }, []);

  const registrarAcaoCarrinho = useCallback((produto, { quantidade = 1 } = {}) => {
    const id = normalizarProdutoId(produto);
    if (id === null) {
      return;
    }

    const qtd = Math.max(1, Math.floor(toNumber(quantidade, 1)));

    setEstado((atual) => {
      const snapshot = criarSnapshotProduto(produto, atual.produtos[String(id)]);
      if (!snapshot) {
        return atual;
      }

      const proximo = {
        ...atual,
        recentes: promoverIdNoInicio(atual.recentes, id, LIMITE_RECENTES),
        produtos: {
          ...atual.produtos,
          [String(id)]: snapshot
        },
        interacoes: atualizarInteracoes(atual.interacoes, id, {
          adds: qtd,
          score: 5 + qtd * 2
        })
      };

      return normalizarEstadoRecorrencia(proximo);
    });
  }, []);

  const registrarRecompraItens = useCallback((itens = []) => {
    if (!Array.isArray(itens) || itens.length === 0) {
      return;
    }

    setEstado((atual) => {
      let mudou = false;
      let proximo = {
        ...atual,
        favoritos: [...atual.favoritos],
        recentes: [...atual.recentes],
        produtos: { ...atual.produtos },
        interacoes: { ...atual.interacoes }
      };

      itens.forEach((item) => {
        const id = normalizarProdutoId(item?.produto_id || item?.id || item);
        if (id === null) {
          return;
        }

        const snapshot = criarSnapshotProduto(
          {
            id,
            nome: item?.nome_produto || item?.nome,
            preco: item?.preco,
            emoji: item?.emoji,
            imagem: item?.imagem,
            categoria: item?.categoria,
            unidade: item?.unidade,
            marca: item?.marca,
            descricao: item?.descricao
          },
          proximo.produtos[String(id)]
        );

        if (!snapshot) {
          return;
        }

        const quantidade = Math.max(1, Math.floor(toNumber(item?.quantidade, 1)));

        proximo.recentes = promoverIdNoInicio(proximo.recentes, id, LIMITE_RECENTES);
        proximo.produtos[String(id)] = snapshot;
        proximo.interacoes = atualizarInteracoes(proximo.interacoes, id, {
          adds: quantidade,
          score: 8 + quantidade * 2
        });
        mudou = true;
      });

      if (!mudou) {
        return atual;
      }

      return normalizarEstadoRecorrencia(proximo);
    });
  }, []);

  const limparRecentes = useCallback(() => {
    setEstado((atual) => normalizarEstadoRecorrencia({
      ...atual,
      recentes: []
    }));
  }, []);

  const limparFavoritos = useCallback(() => {
    setEstado((atual) => normalizarEstadoRecorrencia({
      ...atual,
      favoritos: []
    }));
  }, []);

  const favoritosProdutos = useMemo(() => {
    return estado.favoritos
      .map((id) => estado.produtos[String(id)])
      .filter(Boolean);
  }, [estado.favoritos, estado.produtos]);

  const recentesProdutos = useMemo(() => {
    return estado.recentes
      .map((id) => estado.produtos[String(id)])
      .filter(Boolean);
  }, [estado.recentes, estado.produtos]);

  const recomprasProdutos = useMemo(() => {
    const favoritosIds = new Set(estado.favoritos);
    const recentesIds = new Set(estado.recentes);

    return Object.entries(estado.interacoes)
      .map(([idRaw, meta]) => {
        const id = Number(idRaw);
        const snapshot = estado.produtos[idRaw];

        if (!snapshot || !Number.isFinite(id) || id <= 0) {
          return null;
        }

        const scoreBase = Number(meta.score || 0)
          + (favoritosIds.has(id) ? 3 : 0)
          + (recentesIds.has(id) ? 1 : 0);

        if (scoreBase <= 0) {
          return null;
        }

        const motivo = meta.adds > 0
          ? 'Baseado nas suas recompras'
          : meta.favoritados > 0
            ? 'Favorito recorrente'
            : 'Visto recentemente';

        return {
          ...snapshot,
          scoreRecorrencia: scoreBase,
          motivoRecorrencia: motivo
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const scoreDiff = Number(b.scoreRecorrencia || 0) - Number(a.scoreRecorrencia || 0);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
      })
      .slice(0, LIMITE_RECOMPRA);
  }, [estado.favoritos, estado.interacoes, estado.produtos, estado.recentes]);

  const stats = useMemo(() => ({
    favoritos: favoritosProdutos.length,
    recentes: recentesProdutos.length,
    recompra: recomprasProdutos.length
  }), [favoritosProdutos.length, recentesProdutos.length, recomprasProdutos.length]);

  const value = useMemo(() => ({
    favoritosIds: estado.favoritos,
    recentesIds: estado.recentes,
    favoritosProdutos,
    recentesProdutos,
    recomprasProdutos,
    stats,
    isFavorito,
    adicionarFavorito,
    removerFavorito,
    alternarFavorito,
    registrarVisualizacao,
    registrarAcaoCarrinho,
    registrarRecompraItens,
    limparRecentes,
    limparFavoritos
  }), [
    estado.favoritos,
    estado.recentes,
    favoritosProdutos,
    recentesProdutos,
    recomprasProdutos,
    stats,
    isFavorito,
    adicionarFavorito,
    removerFavorito,
    alternarFavorito,
    registrarVisualizacao,
    registrarAcaoCarrinho,
    registrarRecompraItens,
    limparRecentes,
    limparFavoritos
  ]);

  return (
    <RecorrenciaContext.Provider value={value}>
      {children}
    </RecorrenciaContext.Provider>
  );
}

export function useRecorrencia() {
  const context = useContext(RecorrenciaContext);
  if (!context) {
    throw new Error('useRecorrencia deve ser usado dentro de RecorrenciaProvider');
  }
  return context;
}
