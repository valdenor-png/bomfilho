import React from 'react';

export default function GerenciaExportarTab({
  baixandoExportacao,
  onExportarCatalogo
}) {
  return (
    <div className="admin-gerencia-panel">
      <div className="card-box" style={{ marginTop: '0.8rem' }}>
        <p><strong>Exportacao de catalogo (Excel)</strong></p>
        <p className="muted-text">
          O arquivo sera gerado com codigo de barras, nome, descricao, preco de tabela, imagem, status de enriquecimento e ultima atualizacao.
        </p>
        <button
          className="btn-primary"
          type="button"
          disabled={baixandoExportacao}
          onClick={onExportarCatalogo}
        >
          {baixandoExportacao ? 'Gerando exportacao...' : 'Exportar produtos em Excel'}
        </button>
        <p className="muted-text" style={{ marginTop: '0.6rem' }}>
          A exportacao respeita os filtros atuais da aba Produtos.
        </p>
      </div>
    </div>
  );
}
