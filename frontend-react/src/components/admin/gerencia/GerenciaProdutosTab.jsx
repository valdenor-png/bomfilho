import React from 'react';
import SmartImage from '../../ui/SmartImage';
import { formatarMoeda, formatarData, normalizarStatusEnriquecimento, estadoInicialEdicao } from '../../../lib/adminGerenciaUtils';

export default function GerenciaProdutosTab({
  produtos,
  carregandoProdutos,
  paginacaoProdutos,
  filtros,
  setFiltros,
  edicaoProduto,
  setEdicaoProduto,
  salvandoProduto,
  enriquecendoProdutoId,
  onCarregarProdutos,
  onAbrirEdicao,
  onSalvarEdicao,
  onEnriquecerProduto
}) {
  return (
    <div className="admin-gerencia-panel">
      <div className="admin-gerencia-filtros">
        <input
          className="field-input"
          placeholder="Buscar por nome ou codigo de barras"
          value={filtros.search}
          onChange={(event) => setFiltros((atual) => ({ ...atual, search: event.target.value }))}
        />

        <select className="field-input" value={filtros.com_imagem} onChange={(event) => setFiltros((atual) => ({ ...atual, com_imagem: event.target.value }))}>
          <option value="">Imagem: todos</option>
          <option value="true">Com imagem</option>
          <option value="false">Sem imagem</option>
        </select>

        <select className="field-input" value={filtros.enrichment_status} onChange={(event) => setFiltros((atual) => ({ ...atual, enrichment_status: event.target.value }))}>
          <option value="">Enriquecimento: todos</option>
          <option value="enriquecido">Enriquecidos</option>
          <option value="nao_encontrado">Nao encontrados</option>
          <option value="erro">Com erro</option>
          <option value="pendente">Pendentes</option>
        </select>

        <select className="field-input" value={filtros.com_erro} onChange={(event) => setFiltros((atual) => ({ ...atual, com_erro: event.target.value }))}>
          <option value="">Erro: todos</option>
          <option value="true">Com erro</option>
          <option value="false">Sem erro</option>
        </select>

        <select className="field-input" value={filtros.com_preco} onChange={(event) => setFiltros((atual) => ({ ...atual, com_preco: event.target.value }))}>
          <option value="">Preco: todos</option>
          <option value="true">Com preco</option>
          <option value="false">Sem preco</option>
        </select>

        <select className="field-input" value={`${filtros.orderBy}:${filtros.orderDir}`} onChange={(event) => {
          const [orderBy, orderDir] = String(event.target.value).split(':');
          setFiltros((atual) => ({ ...atual, orderBy, orderDir }));
        }}>
          <option value="updated_at:desc">Atualizacao (mais recente)</option>
          <option value="updated_at:asc">Atualizacao (mais antiga)</option>
          <option value="nome:asc">Nome A-Z</option>
          <option value="nome:desc">Nome Z-A</option>
          <option value="preco_tabela:desc">Preco maior</option>
          <option value="preco_tabela:asc">Preco menor</option>
        </select>
      </div>

      <div className="table-wrap" style={{ marginTop: '0.8rem' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Produto</th>
              <th>Codigo</th>
              <th>Preco tabela</th>
              <th>Status</th>
              <th>Atualizado</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {carregandoProdutos ? (
              <tr>
                <td colSpan={7}>Carregando produtos...</td>
              </tr>
            ) : produtos.length === 0 ? (
              <tr>
                <td colSpan={7}>Nenhum produto encontrado para os filtros selecionados.</td>
              </tr>
            ) : (
              produtos.map((produto) => (
                <tr key={produto.id}>
                  <td>
                    {produto.imagem_url ? (
                      <SmartImage className="admin-produto-thumb" src={produto.imagem_url} alt={produto.nome} loading="lazy" />
                    ) : (
                      <span className="muted-text">Sem foto</span>
                    )}
                  </td>
                  <td>{produto.nome || '-'}</td>
                  <td>{produto.codigo_barras || '-'}</td>
                  <td>{formatarMoeda(produto.preco_tabela)}</td>
                  <td>
                    <span className={`importacao-status-badge status-${normalizarStatusEnriquecimento(produto.enrichment_status)}`}>
                      {normalizarStatusEnriquecimento(produto.enrichment_status)}
                    </span>
                  </td>
                  <td>{formatarData(produto.updated_at)}</td>
                  <td>
                    <div className="admin-row-actions">
                      <button className="btn-secondary" type="button" onClick={() => onAbrirEdicao(produto)}>
                        Editar
                      </button>
                      <button
                        className="btn-secondary"
                        type="button"
                        disabled={enriquecendoProdutoId === produto.id}
                        onClick={() => { void onEnriquecerProduto(produto.id); }}
                      >
                        {enriquecendoProdutoId === produto.id ? 'Processando...' : 'Reprocessar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="toolbar-box" style={{ marginTop: '0.8rem', alignItems: 'center' }}>
        <p className="muted-text" style={{ margin: 0 }}>
          Pagina {paginacaoProdutos.pagina} de {paginacaoProdutos.total_paginas} · {paginacaoProdutos.total} registro(s)
        </p>
        <button
          className="btn-secondary"
          type="button"
          disabled={carregandoProdutos || paginacaoProdutos.pagina <= 1}
          onClick={() => { void onCarregarProdutos(paginacaoProdutos.pagina - 1); }}
        >
          Pagina anterior
        </button>
        <button
          className="btn-secondary"
          type="button"
          disabled={carregandoProdutos || !paginacaoProdutos.tem_mais}
          onClick={() => { void onCarregarProdutos(paginacaoProdutos.pagina + 1); }}
        >
          Proxima pagina
        </button>
      </div>

      {edicaoProduto.id ? (
        <div className="card-box" style={{ marginTop: '1rem' }}>
          <p><strong>Editar produto #{edicaoProduto.id}</strong></p>
          <div className="admin-gerencia-edit-grid">
            <input className="field-input" placeholder="Codigo de barras" value={edicaoProduto.codigo_barras} onChange={(event) => setEdicaoProduto((atual) => ({ ...atual, codigo_barras: event.target.value }))} />
            <input className="field-input" placeholder="Nome" value={edicaoProduto.nome} onChange={(event) => setEdicaoProduto((atual) => ({ ...atual, nome: event.target.value }))} />
            <input className="field-input" placeholder="Preco tabela" type="number" step="0.01" min="0" value={edicaoProduto.preco_tabela} onChange={(event) => setEdicaoProduto((atual) => ({ ...atual, preco_tabela: event.target.value }))} />
            <input className="field-input" placeholder="URL da imagem" value={edicaoProduto.imagem_url} onChange={(event) => setEdicaoProduto((atual) => ({ ...atual, imagem_url: event.target.value }))} />
          </div>
          <textarea className="field-input" rows={3} placeholder="Descricao" value={edicaoProduto.descricao} onChange={(event) => setEdicaoProduto((atual) => ({ ...atual, descricao: event.target.value }))} />

          <div className="toolbar-box" style={{ marginTop: '0.6rem' }}>
            <button className="btn-primary" type="button" disabled={salvandoProduto} onClick={onSalvarEdicao}>
              {salvandoProduto ? 'Salvando...' : 'Salvar alteracoes'}
            </button>
            <button className="btn-secondary" type="button" onClick={() => setEdicaoProduto(estadoInicialEdicao)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
