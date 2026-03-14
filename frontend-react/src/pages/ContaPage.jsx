import React from 'react';
import { useEffect, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import {
  cadastrar,
  getMe,
  isAuthErrorMessage,
  login,
  logout
} from '../lib/api';
import {
  FONT_SCALE_OPTIONS,
  getStoredFontScale,
  getStoredHighContrast,
  getStoredReducedMotion,
  setStoredFontScale,
  setStoredHighContrast,
  setStoredReducedMotion
} from '../lib/accessibility';

export default function ContaPage() {
  const recaptchaSiteKey = String(import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim();
  const recaptchaEnabled = recaptchaSiteKey.length > 0;
  const recaptchaRef = useRef(null);
  const [modo, setModo] = useState('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telefone, setTelefone] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [recaptchaErroCarregamento, setRecaptchaErroCarregamento] = useState('');
  const [usuario, setUsuario] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [fontScale, setFontScale] = useState(() => getStoredFontScale());
  const [highContrast, setHighContrast] = useState(() => getStoredHighContrast());
  const [reducedMotion, setReducedMotion] = useState(() => getStoredReducedMotion());

  useEffect(() => {
    let ativo = true;

    setCarregando(true);
    getMe()
      .then((data) => {
        if (ativo) {
          setUsuario(data.usuario || null);
        }
      })
      .catch((error) => {
        if (!ativo) {
          return;
        }

        if (!isAuthErrorMessage(error.message)) {
          setErro(error.message);
        }

        setUsuario(null);
      })
      .finally(() => {
        if (ativo) {
          setCarregando(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  function resetRecaptcha() {
    setRecaptchaToken('');
    setRecaptchaErroCarregamento('');
    if (recaptchaRef.current && typeof recaptchaRef.current.reset === 'function') {
      recaptchaRef.current.reset();
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setErro('');

    if (recaptchaEnabled && !recaptchaToken) {
      setErro(recaptchaErroCarregamento || 'Confirme o reCAPTCHA para continuar.');
      return;
    }

    setCarregando(true);

    try {
      const data = await login(email.trim(), senha, recaptchaToken);
      setUsuario(data.usuario);
      setSenha('');
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
      resetRecaptcha();
    }
  }

  async function handleCadastro(event) {
    event.preventDefault();
    setErro('');

    if (recaptchaEnabled && !recaptchaToken) {
      setErro(recaptchaErroCarregamento || 'Confirme o reCAPTCHA para continuar.');
      return;
    }

    setCarregando(true);

    try {
      const data = await cadastrar({
        nome: nome.trim(),
        email: email.trim(),
        senha,
        telefone: telefone.trim(),
        whatsappOptIn,
        recaptchaToken
      });
      setUsuario(data.usuario);
      setSenha('');
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
      resetRecaptcha();
    }
  }

  async function handleLogout() {
    setCarregando(true);
    let mensagemErro = '';

    try {
      await logout();
    } catch (error) {
      if (!isAuthErrorMessage(error.message)) {
        mensagemErro = error.message;
      }
    }

    setUsuario(null);
    setNome('');
    setEmail('');
    setSenha('');
    setTelefone('');
    setWhatsappOptIn(true);
    setErro(mensagemErro);
    setCarregando(false);
  }

  function handleFontScaleChange(scaleValue) {
    const normalizedScale = setStoredFontScale(scaleValue);
    setFontScale(normalizedScale);
  }

  function handleHighContrastChange(enabled) {
    const normalizedEnabled = setStoredHighContrast(enabled);
    setHighContrast(normalizedEnabled);
  }

  function handleReducedMotionChange(enabled) {
    const normalizedEnabled = setStoredReducedMotion(enabled);
    setReducedMotion(normalizedEnabled);
  }

  return (
    <section className="page">
      <h1>Minha conta</h1>

      <div className="card-box accessibility-box">
        <p><strong>Acessibilidade</strong></p>
        <p className="muted-text accessibility-helper">Defina como deseja visualizar o sistema.</p>
        <div className="accessibility-controls" role="group" aria-label="Ajustar tamanho da fonte">
          {FONT_SCALE_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              className={`btn-secondary accessibility-btn ${fontScale === option.value ? 'active' : ''}`}
              aria-pressed={fontScale === option.value}
              onClick={() => handleFontScaleChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="accessibility-toggles">
          <label className="check-row accessibility-toggle" htmlFor="toggle-high-contrast">
            <input
              id="toggle-high-contrast"
              type="checkbox"
              checked={highContrast}
              onChange={(event) => handleHighContrastChange(event.target.checked)}
            />
            Alto contraste
          </label>

          <label className="check-row accessibility-toggle" htmlFor="toggle-reduced-motion">
            <input
              id="toggle-reduced-motion"
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => handleReducedMotionChange(event.target.checked)}
            />
            Reduzir animações
          </label>
        </div>
      </div>

      {usuario ? (
        <div className="card-box">
          <p><strong>Nome:</strong> {usuario.nome}</p>
          <p><strong>E-mail:</strong> {usuario.email}</p>
          <p><strong>Telefone:</strong> {usuario.telefone || 'Não informado'}</p>
          <button className="btn-primary" type="button" onClick={handleLogout} disabled={carregando}>
            Sair da conta
          </button>
        </div>
      ) : (
        <form className="form-box" onSubmit={modo === 'login' ? handleLogin : handleCadastro}>
          <div className="auth-switch">
            <button
              type="button"
              className={`auth-switch-btn ${modo === 'login' ? 'active' : ''}`}
              onClick={() => {
                setModo('login');
                setErro('');
                resetRecaptcha();
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              className={`auth-switch-btn ${modo === 'cadastro' ? 'active' : ''}`}
              onClick={() => {
                setModo('cadastro');
                setErro('');
                resetRecaptcha();
              }}
            >
              Criar conta
            </button>
          </div>

          <p>
            {modo === 'login'
              ? 'Entre para acompanhar seus pedidos e concluir pagamentos com segurança.'
              : 'Crie sua conta para salvar seus dados e acompanhar seus pedidos.'}
          </p>

          {modo === 'cadastro' ? (
            <>
              <label className="field-label" htmlFor="nome">Nome</label>
              <input
                id="nome"
                className="field-input"
                type="text"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                required
              />

              <label className="field-label" htmlFor="telefone">Telefone</label>
              <input
                id="telefone"
                className="field-input"
                type="tel"
                value={telefone}
                onChange={(event) => setTelefone(event.target.value)}
                required
              />
            </>
          ) : null}

          <label className="field-label" htmlFor="email">E-mail</label>
          <input
            id="email"
            className="field-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label className="field-label" htmlFor="senha">Senha</label>
          <input
            id="senha"
            className="field-input"
            type="password"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            required
          />

          {modo === 'cadastro' ? (
            <label className="check-row">
              <input
                type="checkbox"
                checked={whatsappOptIn}
                onChange={(event) => setWhatsappOptIn(event.target.checked)}
              />
              Quero receber atualizações do pedido no WhatsApp
            </label>
          ) : null}

          {erro ? <p className="error-text">{erro}</p> : null}

          {recaptchaEnabled ? (
            <div style={{ marginBottom: '12px' }}>
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={recaptchaSiteKey}
                hl="pt-BR"
                onChange={(token) => {
                  setRecaptchaToken(String(token || '').trim());
                  if (token) {
                    setRecaptchaErroCarregamento('');
                  }
                }}
                onExpired={() => setRecaptchaToken('')}
                onErrored={() => {
                  setRecaptchaToken('');
                  setRecaptchaErroCarregamento('Não foi possível validar o reCAPTCHA neste domínio. Acesse o endereço oficial da loja ou atualize os domínios permitidos no Google reCAPTCHA.');
                }}
              />

              {recaptchaErroCarregamento ? (
                <p className="error-text" style={{ marginTop: '0.5rem' }}>
                  {recaptchaErroCarregamento}
                </p>
              ) : null}
            </div>
          ) : null}

          <button className="btn-primary" type="submit" disabled={carregando}>
            {carregando
              ? modo === 'login'
                ? 'Entrando...'
                : 'Criando conta...'
              : modo === 'login'
                ? 'Entrar na conta'
                : 'Criar conta'}
          </button>
        </form>
      )}
    </section>
  );
}

