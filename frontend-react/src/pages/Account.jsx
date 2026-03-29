// pages/Account.jsx — Tela Minha Conta
// Props: user (null ou {name, initials}), onLogin, onLogout

import { colors, fonts } from '../theme';
import Icon from '../components/Icon';

const menuItems = [
  { icon: 'pin', label: 'Meus enderecos' },
  { icon: 'creditCard', label: 'Pagamentos' },
  { icon: 'ticket', label: 'Cupons' },
  { icon: 'message', label: 'Atendimento' },
  { icon: 'info', label: 'Sobre o BomFilho' },
];

export default function Account({ user = null, onLogin }) {
  return (
    <div style={{ padding: '16px' }}>
      <h1 style={{ fontSize: 17, fontWeight: 800, color: colors.white, margin: '0 0 4px', fontFamily: fonts.text }}>
        Minha conta
      </h1>
      <p style={{ fontSize: 11, color: colors.textMuted, marginBottom: 16, fontFamily: fonts.text }}>
        Seu perfil e preferencias
      </p>

      {/* Avatar */}
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: colors.goldBg, border: `2px solid ${colors.goldBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 8px',
        }}>
          {user ? (
            <span style={{ fontSize: 18, fontWeight: 800, color: colors.gold, fontFamily: fonts.text }}>
              {user.initials}
            </span>
          ) : (
            <Icon name="user" size={24} color={colors.gold} />
          )}
        </div>
        {user && (
          <p style={{ fontSize: 14, fontWeight: 800, color: colors.white, margin: 0, fontFamily: fonts.text }}>
            {user.name}
          </p>
        )}
      </div>

      {/* Botões de login */}
      {!user && (
        <>
          <button onClick={onLogin} style={{
            width: '100%', padding: 13,
            background: colors.gold, border: 'none', borderRadius: 12,
            color: colors.bgDeep, fontWeight: 800, fontSize: 13,
            cursor: 'pointer', fontFamily: fonts.text, marginBottom: 6,
            boxShadow: '0 4px 14px rgba(226,184,74,0.25)',
          }}>
            Entrar com WhatsApp
          </button>
          <button style={{
            width: '100%', padding: 13,
            background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12,
            color: colors.white, fontWeight: 700, fontSize: 13,
            cursor: 'pointer', fontFamily: fonts.text,
          }}>
            Criar conta
          </button>
        </>
      )}

      {/* Menu de opções */}
      <div style={{ marginTop: 22 }}>
        {menuItems.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 0', borderBottom: `1px solid ${colors.border}`, cursor: 'pointer',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: colors.card, border: `1px solid ${colors.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={item.icon} size={15} color={colors.textSecondary} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.white, fontFamily: fonts.text }}>
                {item.label}
              </span>
            </div>
            <Icon name="chevron" size={13} color={colors.textMuted} />
          </div>
        ))}
      </div>
    </div>
  );
}
