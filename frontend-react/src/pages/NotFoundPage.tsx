import React from 'react';
import { Link } from 'react-router-dom';
import { colors, fonts } from '../theme';
import Icon from '../components/Icon';

const NotFoundPage = () => {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center',
      minHeight: '60vh', padding: '2rem 1.5rem', gap: 12,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'rgba(255,255,255,0.07)',
        border: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="search" size={28} color={colors.textMuted} />
      </div>
      <h1 style={{
        fontSize: 18, fontWeight: 900, color: colors.white, margin: 0, fontFamily: fonts.text,
      }}>
        Pagina nao encontrada
      </h1>
      <p style={{
        fontSize: 12, color: colors.textMuted, margin: 0, maxWidth: 280,
        lineHeight: 1.4, fontFamily: fonts.text,
      }}>
        A pagina que voce procura nao existe ou foi movida.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <Link to="/" style={{
          padding: '10px 20px', borderRadius: 12,
          background: colors.gold, color: colors.bgDeep,
          fontWeight: 800, fontSize: 13, textDecoration: 'none',
          fontFamily: fonts.text,
        }}>
          Ir ao inicio
        </Link>
        <Link to="/produtos" style={{
          padding: '10px 20px', borderRadius: 12,
          background: 'rgba(255,255,255,0.07)',
          border: `1px solid ${colors.border}`,
          color: colors.white, fontWeight: 700, fontSize: 13,
          textDecoration: 'none', fontFamily: fonts.text,
        }}>
          Ver produtos
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
