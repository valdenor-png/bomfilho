import React from 'react';
import { useState, useEffect } from 'react';
import { colors, fonts } from '../theme';
import Icon from '../components/Icon';
import { login as apiLogin, cadastrar, logout as apiLogout, getMe } from '../lib/api';

const menuItems = [
  { icon: 'pin', label: 'Meus enderecos', action: 'soon' },
  { icon: 'creditCard', label: 'Pagamentos', action: 'soon' },
  { icon: 'ticket', label: 'Cupons', action: 'soon' },
  { icon: 'message', label: 'Atendimento', action: 'whatsapp' },
  { icon: 'info', label: 'Sobre', action: 'whatsapp' },
];

export default function Account() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', senha: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getMe()
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = async () => {
    setError('');
    setSubmitting(true);
    try {
      const data = await apiLogin(form.email, form.senha);
      setUser(data);
    } catch (err) {
      setError(err?.message || 'Email ou senha incorretos');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    if (!form.nome || !form.email || !form.senha) {
      setError('Preencha todos os campos');
      return;
    }
    setSubmitting(true);
    try {
      const data = await cadastrar({
        nome: form.nome,
        email: form.email,
        senha: form.senha,
        telefone: form.telefone,
        whatsappOptIn: true,
      });
      setUser(data);
    } catch (err) {
      setError(err?.message || 'Erro ao criar conta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (tab === 'login') handleLogin();
    else handleRegister();
  };

  const handleLogout = async () => {
    try { await apiLogout(); } catch {}
    setUser(null);
  };

  const handleWhatsApp = () => {
    window.open('https://wa.me/5591999652790?text=Olá, preciso de ajuda', '_blank');
  };

  const inputStyle = {
    width: '100%', padding: '11px 13px', borderRadius: 10,
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${colors.border}`,
    color: colors.white, fontSize: 13, fontFamily: fonts.text,
    outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle = {
    fontSize: 11, color: colors.textSecondary, fontWeight: 600,
    marginBottom: 4, display: 'block', fontFamily: fonts.text,
  };

  if (loading) return (
    <div style={{ padding: '40px 16px', textAlign: 'center' }}>
      <p style={{ color: colors.textMuted }}>Carregando...</p>
    </div>
  );

  // ===== LOGADO =====
  if (user) {
    const nome = user.nome || user.name || 'Usuário';
    const initials = nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    return (
      <div style={{ padding: '16px' }}>
        <div style={{
          background: colors.card, border: `1px solid ${colors.border}`,
          borderRadius: 14, padding: 18, textAlign: 'center', marginBottom: 16,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: colors.goldBg, border: `2px solid ${colors.goldBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 10px',
          }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: colors.gold, fontFamily: fonts.text }}>
              {initials}
            </span>
          </div>
          <p style={{ fontSize: 16, fontWeight: 800, color: colors.white, margin: 0, fontFamily: fonts.text }}>
            {nome}
          </p>
          <p style={{ fontSize: 11, color: colors.textMuted, margin: '3px 0 0', fontFamily: fonts.text }}>
            {user.email}
          </p>
          {user.telefone && (
            <p style={{ fontSize: 11, color: colors.textMuted, margin: '2px 0 0', fontFamily: fonts.text }}>
              {user.telefone}
            </p>
          )}
        </div>

        {menuItems.map((item, i) => (
          <div key={i} onClick={() => {
            if (item.action === 'whatsapp') handleWhatsApp();
            else if (item.action === 'soon') alert('Em breve! Estamos preparando essa funcionalidade.');
          }} style={{
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

        <button onClick={handleLogout} style={{
          width: '100%', marginTop: 20, padding: 13,
          background: 'rgba(239,83,80,0.08)', border: '1px solid rgba(239,83,80,0.15)',
          borderRadius: 12, color: '#EF5350',
          fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: fonts.text,
        }}>
          Sair da conta
        </button>
      </div>
    );
  }

  // ===== DESLOGADO =====
  return (
    <div style={{ padding: '16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: colors.goldBg, border: `2px solid ${colors.goldBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto',
        }}>
          <Icon name="user" size={24} color={colors.gold} />
        </div>
        <p style={{ fontSize: 17, fontWeight: 800, color: colors.white, margin: '10px 0 2px', fontFamily: fonts.text }}>
          Minha conta
        </p>
        <p style={{ fontSize: 11, color: colors.textMuted, fontFamily: fonts.text }}>
          Entre para acompanhar seus pedidos
        </p>
      </div>

      <div style={{
        display: 'flex', gap: 4, marginBottom: 16,
        background: colors.card, borderRadius: 10, padding: 3,
        border: `1px solid ${colors.border}`,
      }}>
        {['login', 'register'].map(t => (
          <button key={t} onClick={() => { setTab(t); setError(''); }} style={{
            flex: 1, padding: 9, borderRadius: 8, border: 'none',
            background: tab === t ? colors.gold : 'transparent',
            color: tab === t ? colors.bgDeep : colors.textMuted,
            fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: fonts.text,
          }}>
            {t === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tab === 'register' && (
          <>
            <div>
              <label style={labelStyle}>Nome completo</label>
              <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
                placeholder="Seu nome" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Telefone (WhatsApp)</label>
              <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })}
                placeholder="(91) 99999-9999" style={inputStyle} />
            </div>
          </>
        )}
        <div>
          <label style={labelStyle}>E-mail</label>
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="seu@email.com" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Senha</label>
          <input type="password" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })}
            placeholder="Sua senha" style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>
      </div>

      {error && (
        <p style={{ fontSize: 11, color: '#EF5350', margin: '8px 0 0', fontFamily: fonts.text, fontWeight: 600 }}>
          {error}
        </p>
      )}

      <button onClick={handleSubmit} disabled={submitting} style={{
        width: '100%', marginTop: 14, padding: 14,
        background: submitting ? 'rgba(226,184,74,0.5)' : colors.gold,
        border: 'none', borderRadius: 12,
        color: colors.bgDeep, fontWeight: 800, fontSize: 14,
        cursor: submitting ? 'default' : 'pointer', fontFamily: fonts.text,
      }}>
        {submitting ? 'Aguarde...' : tab === 'login' ? 'Entrar' : 'Criar conta'}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
        <div style={{ flex: 1, height: 1, background: colors.border }} />
        <span style={{ fontSize: 10, color: colors.textMuted }}>ou</span>
        <div style={{ flex: 1, height: 1, background: colors.border }} />
      </div>

      <button onClick={handleWhatsApp} style={{
        width: '100%', padding: 13,
        background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.25)',
        borderRadius: 12, color: '#25D366',
        fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: fonts.text,
      }}>
        Falar pelo WhatsApp
      </button>
    </div>
  );
}
