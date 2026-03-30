import React, { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { colors, fonts } from '../theme';

const RESULTS = {
  sucesso: {
    icon: '\u2705',
    iconBg: 'rgba(90,228,167,0.12)',
    iconBorder: 'rgba(90,228,167,0.3)',
    title: 'Pagamento aprovado!',
    text: (id) => `Seu pedido #${id || ''} foi confirmado e esta sendo preparado.`,
  },
  falha: {
    icon: '\u274C',
    iconBg: 'rgba(248,113,113,0.12)',
    iconBorder: 'rgba(248,113,113,0.3)',
    title: 'Pagamento nao aprovado',
    text: (id) => `Houve um problema com o pagamento do pedido #${id || ''}. Verifique os dados ou tente outra forma.`,
  },
  pendente: {
    icon: '\u23F3',
    iconBg: 'rgba(251,191,36,0.12)',
    iconBorder: 'rgba(251,191,36,0.3)',
    title: 'Pagamento em analise',
    text: (id) => `O pagamento do pedido #${id || ''} esta sendo processado. Boletos podem levar ate 3 dias uteis.`,
  },
};

export default function PaymentResultPage({ type }) {
  const [params] = useSearchParams();
  const orderId = params.get('order') || params.get('external_reference');
  const result = RESULTS[type] || RESULTS.pendente;

  useEffect(() => {
    if (type === 'sucesso') {
      try { localStorage.removeItem('bomfilho_cart'); } catch {}
    }
  }, [type]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center',
      minHeight: '60vh', padding: '2rem 1.5rem', gap: 8,
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: result.iconBg, border: `2px solid ${result.iconBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, marginBottom: 8,
      }}>
        {result.icon}
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: colors.white, margin: 0, fontFamily: fonts.text }}>
        {result.title}
      </h1>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0, maxWidth: 300, lineHeight: 1.4, fontFamily: fonts.text }}>
        {result.text(orderId)}
      </p>
      <Link to="/pedidos" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '12px 24px', borderRadius: 12,
        background: colors.gold, color: colors.bgDeep,
        fontWeight: 800, fontSize: 13, textDecoration: 'none',
        marginTop: 12, fontFamily: fonts.text,
      }}>
        Ver meus pedidos
      </Link>
      <Link to="/produtos" style={{
        padding: '10px 20px', borderRadius: 12,
        background: 'rgba(255,255,255,0.07)', border: `1px solid ${colors.border}`,
        color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 12,
        textDecoration: 'none', fontFamily: fonts.text,
      }}>
        Continuar comprando
      </Link>
    </div>
  );
}
