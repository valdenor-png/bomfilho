import React from 'react';
import { useState, useEffect } from 'react';
import { colors, fonts } from '../theme';
import Icon from '../components/Icon';
import { login as apiLogin, cadastrar, logout as apiLogout, getMe, getEndereco, salvarEndereco, buscarEnderecoViaCep } from '../lib/api';

const menuItems = [
  { icon: 'pin', label: 'Meus enderecos', action: 'enderecos' },
  { icon: 'creditCard', label: 'Pagamentos', action: 'soon' },
  { icon: 'ticket', label: 'Cupons', action: 'soon' },
  { icon: 'message', label: 'Atendimento', action: 'whatsapp' },
  { icon: 'info', label: 'Sobre', action: 'whatsapp' },
];

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

/* ===== SUB-TELA: ENDEREÇOS ===== */
function AddressScreen({ onBack }) {
  const [endereco, setEndereco] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    cep: '', rua: '', numero: '', bairro: '', cidade: '', estado: '', complemento: '', referencia: '',
  });

  useEffect(() => {
    getEndereco()
      .then((data) => {
        if (data && (data.rua || data.cep)) {
          setEndereco(data);
          setForm({
            cep: data.cep || '', rua: data.rua || data.logradouro || '',
            numero: data.numero || '', bairro: data.bairro || '',
            cidade: data.cidade || '', estado: data.estado || '',
            complemento: data.complemento || '', referencia: data.referencia || '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCepBlur = async () => {
    const cep = String(form.cep || '').replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      const data = await buscarEnderecoViaCep(cep);
      if (data) {
        setForm(f => ({
          ...f,
          rua: data.logradouro || f.rua,
          bairro: data.bairro || f.bairro,
          cidade: data.cidade || data.localidade || f.cidade,
          estado: data.estado || data.uf || f.estado,
        }));
      }
    } catch {}
  };

  const handleSave = async () => {
    setMsg('');
    setSaving(true);
    try {
      await salvarEndereco(form);
      setEndereco({ ...form });
      setEditing(false);
      setMsg('Endereço salvo!');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(err?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ padding: '40px 16px', textAlign: 'center' }}>
      <p style={{ color: colors.textMuted }}>Carregando...</p>
    </div>
  );

  return (
    <div style={{ padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          width: 34, height: 34, borderRadius: 10,
          background: colors.card, border: `1px solid ${colors.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <Icon name="back" size={14} color={colors.textSecondary} />
        </button>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: colors.white, margin: 0, fontFamily: fonts.text }}>
          Meus enderecos
        </h2>
      </div>

      {/* Endereço salvo ou vazio */}
      {!editing && endereco ? (
        <div style={{
          background: colors.card, border: `1px solid ${colors.border}`,
          borderRadius: 14, padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              background: colors.goldBg, border: `1px solid ${colors.goldBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="pin" size={15} color={colors.gold} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: colors.white, margin: 0, fontFamily: fonts.text }}>
                {endereco.rua || endereco.logradouro}{endereco.numero ? `, ${endereco.numero}` : ''}
              </p>
              {endereco.complemento ? (
                <p style={{ fontSize: 11, color: colors.textSecondary, margin: '2px 0 0' }}>{endereco.complemento}</p>
              ) : null}
              <p style={{ fontSize: 11, color: colors.textMuted, margin: '2px 0 0' }}>
                {endereco.bairro}{endereco.cidade ? ` · ${endereco.cidade}` : ''}{endereco.estado ? `/${endereco.estado}` : ''}
              </p>
              <p style={{ fontSize: 11, color: colors.textMuted, margin: '2px 0 0', fontFamily: fonts.number }}>
                CEP {endereco.cep}
              </p>
              {endereco.referencia ? (
                <p style={{ fontSize: 10, color: colors.textMuted, margin: '4px 0 0', fontStyle: 'italic' }}>
                  Ref: {endereco.referencia}
                </p>
              ) : null}
            </div>
          </div>
          <button onClick={() => setEditing(true)} style={{
            width: '100%', marginTop: 12, padding: 11,
            background: colors.card, border: `1px solid ${colors.border}`,
            borderRadius: 10, color: colors.white,
            fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: fonts.text,
          }}>
            Editar endereço
          </button>
        </div>
      ) : !editing ? (
        <div style={{
          background: colors.card, border: `1px solid ${colors.border}`,
          borderRadius: 14, padding: 20, textAlign: 'center',
        }}>
          <Icon name="pin" size={28} color={colors.textMuted} />
          <p style={{ fontSize: 13, fontWeight: 700, color: colors.white, margin: '8px 0 4px', fontFamily: fonts.text }}>
            Nenhum endereço salvo
          </p>
          <p style={{ fontSize: 11, color: colors.textMuted, margin: '0 0 12px' }}>
            Adicione seu endereço para entregas
          </p>
          <button onClick={() => setEditing(true)} style={{
            padding: '10px 20px', background: colors.gold, border: 'none',
            borderRadius: 10, color: colors.bgDeep,
            fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: fonts.text,
          }}>
            Adicionar endereço
          </button>
        </div>
      ) : null}

      {/* Formulário de edição */}
      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>CEP</label>
              <input value={form.cep} onChange={e => setForm({ ...form, cep: e.target.value })}
                onBlur={handleCepBlur} placeholder="68740-000" style={inputStyle} maxLength={9} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Número</label>
              <input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })}
                placeholder="123" style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Rua</label>
            <input value={form.rua} onChange={e => setForm({ ...form, rua: e.target.value })}
              placeholder="Nome da rua" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Bairro</label>
              <input value={form.bairro} onChange={e => setForm({ ...form, bairro: e.target.value })}
                placeholder="Bairro" style={inputStyle} />
            </div>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Cidade</label>
              <input value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })}
                placeholder="Castanhal" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>UF</label>
              <input value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}
                placeholder="PA" style={inputStyle} maxLength={2} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Complemento</label>
            <input value={form.complemento} onChange={e => setForm({ ...form, complemento: e.target.value })}
              placeholder="Apto, bloco..." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Referência</label>
            <input value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })}
              placeholder="Próximo a..." style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => setEditing(false)} style={{
              flex: 1, padding: 12, background: colors.card,
              border: `1px solid ${colors.border}`, borderRadius: 10,
              color: colors.white, fontWeight: 700, fontSize: 12,
              cursor: 'pointer', fontFamily: fonts.text,
            }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{
              flex: 2, padding: 12, background: saving ? 'rgba(226,184,74,0.5)' : colors.gold,
              border: 'none', borderRadius: 10, color: colors.bgDeep,
              fontWeight: 800, fontSize: 12, cursor: saving ? 'default' : 'pointer',
              fontFamily: fonts.text,
            }}>{saving ? 'Salvando...' : 'Salvar endereço'}</button>
          </div>
        </div>
      )}

      {msg && (
        <p style={{
          fontSize: 11, fontWeight: 600, margin: '10px 0 0', textAlign: 'center',
          color: msg.includes('Erro') ? '#EF5350' : colors.success, fontFamily: fonts.text,
        }}>{msg}</p>
      )}
    </div>
  );
}

/* ===== ACCOUNT PRINCIPAL ===== */
export default function Account() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', senha: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [screen, setScreen] = useState('main'); // 'main' | 'enderecos'

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
        nome: form.nome, email: form.email, senha: form.senha,
        telefone: form.telefone, whatsappOptIn: true,
      });
      setUser(data);
    } catch (err) {
      setError(err?.message || 'Erro ao criar conta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => tab === 'login' ? handleLogin() : handleRegister();
  const handleLogout = async () => { try { await apiLogout(); } catch {} setUser(null); };
  const handleWhatsApp = () => window.open('https://wa.me/5591999652790?text=Olá, preciso de ajuda', '_blank');

  const handleMenuClick = (action) => {
    if (action === 'whatsapp') handleWhatsApp();
    else if (action === 'enderecos') setScreen('enderecos');
    else if (action === 'soon') alert('Em breve!');
  };

  if (loading) return (
    <div style={{ padding: '40px 16px', textAlign: 'center' }}>
      <p style={{ color: colors.textMuted }}>Carregando...</p>
    </div>
  );

  // Sub-tela endereços
  if (screen === 'enderecos' && user) {
    return <AddressScreen onBack={() => setScreen('main')} />;
  }

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
            <span style={{ fontSize: 18, fontWeight: 800, color: colors.gold, fontFamily: fonts.text }}>{initials}</span>
          </div>
          <p style={{ fontSize: 16, fontWeight: 800, color: colors.white, margin: 0, fontFamily: fonts.text }}>{nome}</p>
          <p style={{ fontSize: 11, color: colors.textMuted, margin: '3px 0 0', fontFamily: fonts.text }}>{user.email}</p>
          {user.telefone && <p style={{ fontSize: 11, color: colors.textMuted, margin: '2px 0 0', fontFamily: fonts.text }}>{user.telefone}</p>}
        </div>

        {menuItems.map((item, i) => (
          <div key={i} onClick={() => handleMenuClick(item.action)} style={{
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
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.white, fontFamily: fonts.text }}>{item.label}</span>
            </div>
            <Icon name="chevron" size={13} color={colors.textMuted} />
          </div>
        ))}

        <button onClick={handleLogout} style={{
          width: '100%', marginTop: 20, padding: 13,
          background: 'rgba(239,83,80,0.08)', border: '1px solid rgba(239,83,80,0.15)',
          borderRadius: 12, color: '#EF5350',
          fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: fonts.text,
        }}>Sair da conta</button>
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
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
        }}>
          <Icon name="user" size={24} color={colors.gold} />
        </div>
        <p style={{ fontSize: 17, fontWeight: 800, color: colors.white, margin: '10px 0 2px', fontFamily: fonts.text }}>Minha conta</p>
        <p style={{ fontSize: 11, color: colors.textMuted, fontFamily: fonts.text }}>Entre para acompanhar seus pedidos</p>
      </div>

      <div style={{
        display: 'flex', gap: 4, marginBottom: 16,
        background: colors.card, borderRadius: 10, padding: 3, border: `1px solid ${colors.border}`,
      }}>
        {['login', 'register'].map(t => (
          <button key={t} onClick={() => { setTab(t); setError(''); }} style={{
            flex: 1, padding: 9, borderRadius: 8, border: 'none',
            background: tab === t ? colors.gold : 'transparent',
            color: tab === t ? colors.bgDeep : colors.textMuted,
            fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: fonts.text,
          }}>{t === 'login' ? 'Entrar' : 'Criar conta'}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tab === 'register' && (
          <>
            <div>
              <label style={labelStyle}>Nome completo</label>
              <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Seu nome" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Telefone (WhatsApp)</label>
              <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(91) 99999-9999" style={inputStyle} />
            </div>
          </>
        )}
        <div>
          <label style={labelStyle}>E-mail</label>
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="seu@email.com" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Senha</label>
          <input type="password" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })}
            placeholder="Sua senha" style={inputStyle} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>
      </div>

      {error && <p style={{ fontSize: 11, color: '#EF5350', margin: '8px 0 0', fontFamily: fonts.text, fontWeight: 600 }}>{error}</p>}

      <button onClick={handleSubmit} disabled={submitting} style={{
        width: '100%', marginTop: 14, padding: 14,
        background: submitting ? 'rgba(226,184,74,0.5)' : colors.gold,
        border: 'none', borderRadius: 12, color: colors.bgDeep,
        fontWeight: 800, fontSize: 14, cursor: submitting ? 'default' : 'pointer', fontFamily: fonts.text,
      }}>{submitting ? 'Aguarde...' : tab === 'login' ? 'Entrar' : 'Criar conta'}</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
        <div style={{ flex: 1, height: 1, background: colors.border }} />
        <span style={{ fontSize: 10, color: colors.textMuted }}>ou</span>
        <div style={{ flex: 1, height: 1, background: colors.border }} />
      </div>

      <button onClick={handleWhatsApp} style={{
        width: '100%', padding: 13, background: 'rgba(37,211,102,0.10)',
        border: '1px solid rgba(37,211,102,0.25)', borderRadius: 12, color: '#25D366',
        fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: fonts.text,
      }}>Falar pelo WhatsApp</button>
    </div>
  );
}
