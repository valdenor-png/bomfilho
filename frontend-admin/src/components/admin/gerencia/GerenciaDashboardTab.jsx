import React from 'react';

export default function GerenciaDashboardTab({
  dashboard,
  carregandoDashboard,
  onAtualizar
}) {
  return (
    <div className="admin-gerencia-panel">
      <div className="toolbar-box">
        <button className="btn-secondary" type="button" onClick={onAtualizar} disabled={carregandoDashboard}>
          {carregandoDashboard ? 'Atualizando...' : 'Atualizar indicadores'}
        </button>
      </div>

      <div className="admin-kpis" style={{ marginTop: '0.8rem' }}>
        {carregandoDashboard ? (
          <p className="muted-text">Carregando indicadores...</p>
        ) : (
          <>
            <div className="kpi-card"><strong>Total produtos:</strong> {Number(dashboard?.total_produtos || 0)}</div>
            <div className="kpi-card"><strong>Com preco:</strong> {Number(dashboard?.produtos_com_preco || 0)}</div>
            <div className="kpi-card"><strong>Sem preco:</strong> {Number(dashboard?.produtos_sem_preco || 0)}</div>
            <div className="kpi-card"><strong>Com imagem:</strong> {Number(dashboard?.produtos_com_imagem || 0)}</div>
            <div className="kpi-card"><strong>Sem imagem:</strong> {Number(dashboard?.produtos_sem_imagem || 0)}</div>
            <div className="kpi-card"><strong>Enriquecidos:</strong> {Number(dashboard?.produtos_enriquecidos || 0)}</div>
            <div className="kpi-card"><strong>Nao encontrados:</strong> {Number(dashboard?.produtos_nao_encontrados || 0)}</div>
            <div className="kpi-card"><strong>Com erro:</strong> {Number(dashboard?.produtos_com_erro || 0)}</div>
          </>
        )}
      </div>
    </div>
  );
}
