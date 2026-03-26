import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CircleCheck, Package, Receipt, ShieldCheck } from 'lucide-react';
import { adminGetCatalogoSaude } from '../../lib/api';
import { formatarMoeda } from './ui/adminUtils';
import LoadingSkeleton from './ui/LoadingSkeleton';
import ErrorState from './ui/ErrorState';
import EmptyState from './ui/EmptyState';

export default function CatalogoSaude() {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [subTab, setSubTab] = useState('visao');

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminGetCatalogoSaude();
      setDados(data);
      setErro('');
    } catch (e) {
      setErro('Falha ao carregar saúde do catálogo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (loading && !dados) {
    return (
      <div className="ck-command-grid">
        <div className="ck-card"><LoadingSkeleton type="kpis" /></div>
      </div>
    );
  }

  if (erro && !dados) {
    return <ErrorState message={erro} onRetry={carregar} />;
  }

  const score = dados?.score || 0;
  const scoreClass = score >= 80 ? 'good' : score >= 50 ? 'mid' : 'bad';

  return (
    <div className="ck-command-grid">
      {/* Score geral + métricas */}
      <div className="ck-card">
        <div className="ck-card-header">
          <span className="ck-card-title"><span className="icon"><ShieldCheck size={16} aria-hidden="true" /></span> Score de Saúde do Catálogo</span>
          <div className="ck-subtab-nav">
            {['visao', 'top', 'problemas'].map(t => (
              <button key={t} type="button" onClick={() => setSubTab(t)}
                className={`ck-subtab-btn ${subTab === t ? 'active' : ''}`}>
                {t === 'visao' ? 'Visão Geral' : t === 'top' ? 'Top Vendidos' : 'Problemas'}
              </button>
            ))}
          </div>
        </div>

        <div className="ck-saude-score">
          <div className={`ck-saude-score-ring ${scoreClass}`} style={{ '--pct': `${score}%` }}>
            <span>{score}</span>
          </div>
          <span className="ck-saude-score-label">Score de saúde — {score >= 80 ? 'Bom' : score >= 50 ? 'Atenção' : 'Crítico'}</span>
        </div>

        <div className="ck-saude-metrics">
          <div className="ck-saude-metric ok">
            <span className="ck-saude-metric-val">{dados?.ativos || 0}</span>
            <span className="ck-saude-metric-label">Ativos</span>
          </div>
          <div className="ck-saude-metric">
            <span className="ck-saude-metric-val">{dados?.inativos || 0}</span>
            <span className="ck-saude-metric-label">Inativos</span>
          </div>
          <div className={`ck-saude-metric ${(dados?.sem_imagem || 0) > 5 ? 'warn' : 'ok'}`}>
            <span className="ck-saude-metric-val">{dados?.cobertura_imagem || 0}%</span>
            <span className="ck-saude-metric-label">Cobertura Imagem</span>
          </div>
          <div className={`ck-saude-metric ${(dados?.sem_descricao || 0) > 5 ? 'warn' : 'ok'}`}>
            <span className="ck-saude-metric-val">{dados?.cobertura_descricao || 0}%</span>
            <span className="ck-saude-metric-label">Cobert. Descrição</span>
          </div>
          <div className={`ck-saude-metric ${(dados?.sem_preco || 0) > 0 ? 'bad' : 'ok'}`}>
            <span className="ck-saude-metric-val">{dados?.sem_preco || 0}</span>
            <span className="ck-saude-metric-label">Sem Preço</span>
          </div>
          <div className={`ck-saude-metric ${(dados?.sem_imagem || 0) > 5 ? 'warn' : 'ok'}`}>
            <span className="ck-saude-metric-val">{dados?.sem_imagem || 0}</span>
            <span className="ck-saude-metric-label">Sem Imagem</span>
          </div>
        </div>
      </div>

      {/* Sub tabs content */}
      {subTab === 'top' ? (
        dados?.top_vendidos?.length > 0 ? (
          <div className="ck-card">
            <div className="ck-card-header">
              <span className="ck-card-title"><span className="icon"><Package size={16} aria-hidden="true" /></span> Top Vendidos (30 dias)</span>
            </div>
            <div className="ck-saude-lista">
              {dados.top_vendidos.map((p, i) => (
                <div className="ck-saude-lista-item" key={p.id}>
                  <span className="ck-saude-rank">#{i + 1}</span>
                  <span className="ck-saude-lista-nome">{p.nome}</span>
                  <span className="ck-saude-lista-qtd">{p.quantidade}x</span>
                  <span className="ck-saude-lista-val green">{formatarMoeda(p.receita)}</span>
                  {!p.imagem_url ? <span className="ck-tag warn">sem img</span> : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState icon={<Package size={18} aria-hidden="true" />} title="Sem dados de vendas" description="Ainda não há vendas registradas nos últimos 30 dias." />
        )
      ) : null}

      {subTab === 'problemas' ? (
        <React.Fragment>
          {dados?.campeoes_frageis?.length > 0 ? (
            <div className="ck-card">
              <div className="ck-card-header">
                <span className="ck-card-title red"><span className="icon"><AlertTriangle size={16} aria-hidden="true" /></span> Campeões com Cadastro Fraco</span>
                <span className="ck-card-subtitle">Top vendidos com dados incompletos</span>
              </div>
              <div className="ck-saude-lista">
                {dados.campeoes_frageis.map(p => (
                  <div className="ck-saude-lista-item border-red" key={p.id}>
                    <span className="ck-saude-lista-nome">{p.nome}</span>
                    <span className="ck-tag danger">{p.problema === 'sem_imagem' ? 'sem imagem' : p.problema}</span>
                    <span className="ck-saude-lista-val muted">{formatarMoeda(p.receita)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {dados?.sem_saida?.length > 0 ? (
            <div className="ck-card">
              <div className="ck-card-header">
                <span className="ck-card-title"><span className="icon"><Package size={16} aria-hidden="true" /></span> Sem Saída (30 dias)</span>
                <span className="ck-card-subtitle">Produtos ativos sem vendas recentes</span>
              </div>
              <div className="ck-saude-lista">
                {dados.sem_saida.slice(0, 20).map(p => (
                  <div className="ck-saude-lista-item" key={p.id}>
                    <span className="ck-saude-lista-nome">{p.nome}</span>
                    <span className="ck-saude-lista-cat">{p.categoria || '—'}</span>
                    <span className="ck-saude-lista-val yellow">{formatarMoeda(p.preco)}</span>
                  </div>
                ))}
                {dados.sem_saida.length > 20 && (
                  <div className="ck-saude-mais">+{dados.sem_saida.length - 20} produtos sem saída</div>
                )}
              </div>
            </div>
          ) : null}

          {!dados?.campeoes_frageis?.length && !dados?.sem_saida?.length ? (
            <EmptyState icon={<CircleCheck size={18} aria-hidden="true" />} title="Catálogo saudável" description="Nenhum problema identificado no catálogo." />
          ) : null}
        </React.Fragment>
      ) : null}

      {subTab === 'visao' ? (
        <div className="ck-card">
          <div className="ck-card-header">
            <span className="ck-card-title"><span className="icon"><Receipt size={16} aria-hidden="true" /></span> Resumo do Catálogo</span>
          </div>
          <div className="ck-saude-bars">
            <div className="ck-saude-bar-group">
              <div className="ck-saude-bar-label">Cobertura de Imagem</div>
              <div className="ck-progress-track">
                <div className={`ck-progress-fill ${(dados?.cobertura_imagem || 0) >= 80 ? 'green' : 'yellow'}`} style={{ width: `${dados?.cobertura_imagem || 0}%` }} />
              </div>
              <div className="ck-saude-bar-note">{dados?.cobertura_imagem || 0}% — {dados?.sem_imagem || 0} sem imagem</div>
            </div>
            <div className="ck-saude-bar-group">
              <div className="ck-saude-bar-label">Cobertura de Descrição</div>
              <div className="ck-progress-track">
                <div className={`ck-progress-fill ${(dados?.cobertura_descricao || 0) >= 80 ? 'green' : 'yellow'}`} style={{ width: `${dados?.cobertura_descricao || 0}%` }} />
              </div>
              <div className="ck-saude-bar-note">{dados?.cobertura_descricao || 0}% — {dados?.sem_descricao || 0} sem descrição</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
