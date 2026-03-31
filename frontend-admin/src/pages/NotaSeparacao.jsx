import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminGetMe, adminGetPedidoDetalhes, isAuthErrorMessage } from '../lib/api';
import { Printer, ArrowLeft } from '../icons';

const formatarDataHora = (valor) => {
  if (!valor) return '';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).replace(',', ' —');
};

export default function NotaSeparacao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [semPermissao, setSemPermissao] = useState(false);

  useEffect(() => {
    if (!id) return;
    let ativo = true;
    setCarregando(true);
    setErro('');

    adminGetMe()
      .then(() => adminGetPedidoDetalhes(id))
      .then((data) => { if (ativo) setPedido(data); })
      .catch((err) => {
        if (!ativo) return;
        if (isAuthErrorMessage(err?.message)) {
          setSemPermissao(true);
        } else {
          setErro('Erro ao carregar pedido.');
        }
      })
      .finally(() => { if (ativo) setCarregando(false); });

    return () => { ativo = false; };
  }, [id]);

  if (carregando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#666', fontSize: 14 }}>
        Carregando...
      </div>
    );
  }

  if (semPermissao) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#666', fontSize: 14, gap: 12 }}>
        <span>Sessão expirada. Faça login no painel admin primeiro.</span>
        <button onClick={() => navigate('/admin')} style={{ background: '#1F5C50', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Ir para o Admin</button>
      </div>
    );
  }

  if (erro || !pedido) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#666', fontSize: 14, gap: 12 }}>
        <span>{erro || 'Pedido não encontrado.'}</span>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: '1px solid #999', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: 13 }}>Voltar</button>
      </div>
    );
  }

  const pedidoInfo = pedido.pedido || {};
  const clienteInfo = pedido.cliente || {};
  const enderecoInfo = pedido.endereco || null;
  const itensLista = Array.isArray(pedido.itens) ? pedido.itens : [];
  const isEntrega = String(pedidoInfo.tipo_entrega || '').toLowerCase() === 'entrega';

  const enderecoTexto = enderecoInfo
    ? [enderecoInfo.logradouro, enderecoInfo.numero, enderecoInfo.bairro, enderecoInfo.cidade].filter(Boolean).join(', ')
    : '';
  const complemento = String(enderecoInfo?.complemento || '').trim();
  const referencia = String(enderecoInfo?.referencia || '').trim();
  const obs = String(pedidoInfo.instrucoes || '').trim();
  const obsTexto = [complemento, referencia, obs].filter(Boolean).join('. ');

  const pedidoNum = `PED-${String(pedidoInfo.id || id).padStart(5, '0')}`;
  const dataFormatada = formatarDataHora(pedidoInfo.criado_em);
  const pagamento = String(pedidoInfo.forma_pagamento || '-').toUpperCase();
  const totalItens = itensLista.reduce((s, item) => s + Number(item.quantidade || 0), 0);

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", maxWidth: 400, margin: '0 auto', padding: 16, color: '#111', fontSize: 13, background: '#fff', minHeight: '100vh' }}>

      {/* Cabecalho */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #111', paddingBottom: 10, marginBottom: 10 }}>
        <img src="/img/logo-bomfilho.png" alt="BomFilho Mercado" style={{ height: 48, marginBottom: 4, objectFit: 'contain' }} />
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 700, margin: '4px 0' }}>{pedidoNum}</div>
        <div style={{ fontSize: 11, color: '#666' }}>{dataFormatada}</div>
      </div>

      {/* Cliente + Pagamento */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #aaa' }}>
        <div>
          <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#666' }}>Cliente</span><br />
          <strong>{String(clienteInfo.nome || 'Nao informado')}</strong>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#666' }}>Pagamento</span><br />
          <strong>{pagamento}</strong>
        </div>
      </div>

      {/* Endereco */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 0', borderBottom: '1px dashed #aaa' }}>
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#666' }}>Endereço</span>
        <span>{isEntrega ? (enderecoTexto || 'Nao informado') : 'Retirada na loja'}</span>
      </div>

      {/* Observacao */}
      {obsTexto && (
        <div style={{ background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 4, padding: '6px 8px', fontSize: 12, margin: '8px 0' }}>
          📌 {obsTexto}
        </div>
      )}

      {/* Tabela de itens */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'center', width: 30, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#666', borderBottom: '1px solid #999', padding: '6px 4px' }}>✓</th>
            <th style={{ textAlign: 'center', width: 40, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#666', borderBottom: '1px solid #999', padding: '6px 4px' }}>Qtd</th>
            <th style={{ textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#666', borderBottom: '1px solid #999', padding: '6px 4px' }}>Produto</th>
          </tr>
        </thead>
        <tbody>
          {itensLista.map((item, i) => (
            <tr key={i}>
              <td style={{ textAlign: 'center', padding: '7px 4px', borderBottom: '1px solid #eee' }}>
                <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid #333', borderRadius: 3 }} />
              </td>
              <td style={{ textAlign: 'center', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 15, padding: '7px 4px', borderBottom: '1px solid #eee' }}>
                {Number(item.quantidade || 0)}
              </td>
              <td style={{ padding: '7px 4px', borderBottom: '1px solid #eee' }}>
                {String(item.nome_produto || item.nome || 'Item sem nome')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ textAlign: 'right', marginTop: 8, fontSize: 12, color: '#666' }}>
        {totalItens} itens
      </div>

      {/* Assinaturas */}
      <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
        <div style={{ flex: 1, borderBottom: '1px solid #999', paddingBottom: 4, fontSize: 10, color: '#666', textAlign: 'center', marginTop: 30 }}>Separado por</div>
        <div style={{ flex: 1, borderBottom: '1px solid #999', paddingBottom: 4, fontSize: 10, color: '#666', textAlign: 'center', marginTop: 30 }}>Conferido por</div>
      </div>

      {/* Botoes — no-print */}
      <div className="no-print" style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', gap: 8 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: '#fff', color: '#333', border: '1px solid #ccc', borderRadius: 8, padding: '12px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={16} /> Voltar
        </button>
        <button
          onClick={() => window.print()}
          style={{ background: '#1F5C50', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
        >
          <Printer size={16} /> Imprimir
        </button>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #fff; }
        }
      `}</style>
    </div>
  );
}
