import React from 'react';
import { useEffect, useState } from 'react';
import {
  cadastrar,
  clearStoredToken,
  getMe,
  getStoredToken,
  login,
  setStoredToken
} from '../lib/api';

export default function ContaPage() {
  const [modo, setModo] = useState('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telefone, setTelefone] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [usuario, setUsuario] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      return;
    }

    setCarregando(true);
    getMe(token)
      .then((data) => setUsuario(data.usuario))
      .catch(() => {
        clearStoredToken();
        setUsuario(null);
      })
      .finally(() => setCarregando(false));
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const data = await login(email.trim(), senha);
      setStoredToken(data.token);
      setUsuario(data.usuario);
      setSenha('');
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  async function handleCadastro(event) {
    event.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const data = await cadastrar({
        nome: nome.trim(),
        email: email.trim(),
        senha,
        telefone: telefone.trim(),
        whatsappOptIn
      });
      setStoredToken(data.token);
      setUsuario(data.usuario);
      setSenha('');
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  function handleLogout() {
    clearStoredToken();
    setUsuario(null);
    setNome('');
    setEmail('');
    setSenha('');
    setTelefone('');
    setWhatsappOptIn(true);
    setErro('');
  }

  return (
    <section className="page">
      <h1>Conta</h1>

      {usuario ? (
        <div className="card-box">
          <p><strong>Nome:</strong> {usuario.nome}</p>
          <p><strong>E-mail:</strong> {usuario.email}</p>
          <p><strong>Telefone:</strong> {usuario.telefone || 'Não informado'}</p>
          <button className="btn-primary" type="button" onClick={handleLogout}>
            Sair
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
              }}
            >
              Cadastrar
            </button>
          </div>

          <p>
            {modo === 'login'
              ? 'Faça login para liberar conta e pagamento.'
              : 'Crie sua conta e já entre automaticamente.'}
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
              Receber atualizações no WhatsApp
            </label>
          ) : null}

          {erro ? <p className="error-text">{erro}</p> : null}

          <button className="btn-primary" type="submit" disabled={carregando}>
            {carregando
              ? modo === 'login'
                ? 'Entrando...'
                : 'Cadastrando...'
              : modo === 'login'
                ? 'Entrar'
                : 'Cadastrar'}
          </button>
        </form>
      )}
    </section>
  );
}

