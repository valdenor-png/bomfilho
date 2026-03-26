import React from 'react';
import { Circle, CircleCheck } from 'lucide-react';
import ReCAPTCHA from 'react-google-recaptcha';
import { formatarTelefoneCadastro } from '../../lib/contaUtils';

export default function AuthSection({
  modo,
  nome,
  email,
  senha,
  confirmacaoSenha,
  mostrarSenha,
  telefone,
  whatsappOptIn,
  carregando,
  recaptchaEnabled,
  recaptchaSiteKey,
  recaptchaRef,
  recaptchaErroCarregamento,
  senhaStrength,
  senhaFracaCadastro,
  confirmacaoSenhaInvalida,
  telefoneCadastroNormalizado,
  onModoChange,
  onNomeChange,
  onEmailChange,
  onSenhaChange,
  onConfirmacaoSenhaChange,
  onMostrarSenhaToggle,
  onTelefoneChange,
  onWhatsappOptInChange,
  onRecaptchaChange,
  onRecaptchaExpired,
  onRecaptchaError,
  onLogin,
  onCadastro
}) {
  return (
    <div className="conta-auth-layout">
      <form className="form-box conta-auth-card" onSubmit={modo === 'login' ? onLogin : onCadastro}>
        <div className="auth-switch">
          <button
            type="button"
            className={`auth-switch-btn ${modo === 'login' ? 'active' : ''}`}
            onClick={() => onModoChange('login')}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`auth-switch-btn ${modo === 'cadastro' ? 'active' : ''}`}
            onClick={() => onModoChange('cadastro')}
          >
            Criar conta
          </button>
        </div>

        <p className="conta-auth-description">
          {modo === 'login'
            ? 'Entre para acompanhar pedidos e concluir pagamentos com segurança.'
            : 'Crie sua conta para salvar dados e agilizar suas próximas compras.'}
        </p>

        {modo === 'cadastro' ? (
          <>
            <label className="field-label" htmlFor="nome">Nome completo</label>
            <input
              id="nome"
              className="field-input"
              type="text"
              value={nome}
              onChange={(event) => onNomeChange(event.target.value)}
              required
            />

            <label className="field-label" htmlFor="telefone">Telefone</label>
            <input
              id="telefone"
              className="field-input"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={15}
              placeholder="(91) 99999-9999"
              value={telefone}
              onChange={(event) => onTelefoneChange(formatarTelefoneCadastro(event.target.value))}
              required
            />

            <p className="conta-auth-field-note">
              Telefone com DDD para receber atualizações de entrega.
            </p>
          </>
        ) : null}

        <label className="field-label" htmlFor="email">E-mail</label>
        <input
          id="email"
          className="field-input"
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          required
        />

        <label className="field-label" htmlFor="senha">Senha</label>
        <div className="conta-password-field">
          <input
            id="senha"
            className="field-input"
            type={mostrarSenha ? 'text' : 'password'}
            value={senha}
            onChange={(event) => onSenhaChange(event.target.value)}
            required
          />

          <button
            className="conta-password-toggle"
            type="button"
            onClick={onMostrarSenhaToggle}
            aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {mostrarSenha ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {modo === 'cadastro' ? (
          <>
            <div className="conta-password-strength-box" aria-live="polite">
              <div className="conta-password-meter" aria-hidden="true">
                <span
                  className={`conta-password-meter-fill is-${senhaStrength.tone}`}
                  style={{ width: `${(senhaStrength.score / 4) * 100}%` }}
                />
              </div>

              <p className={`conta-password-strength-label is-${senhaStrength.tone}`}>
                Força da senha: {senhaStrength.level}
              </p>

              <ul className="conta-password-checklist">
                {senhaStrength.checks.map((check) => (
                  <li key={check.id} className={check.ok ? 'is-ok' : ''}>
                    <span aria-hidden="true">{check.ok ? <CircleCheck size={14} /> : <Circle size={10} />}</span>
                    <span>{check.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <label className="field-label" htmlFor="confirmacao-senha">Confirmar senha</label>
            <input
              id="confirmacao-senha"
              className="field-input"
              type={mostrarSenha ? 'text' : 'password'}
              value={confirmacaoSenha}
              onChange={(event) => onConfirmacaoSenhaChange(event.target.value)}
              required
            />

            {confirmacaoSenha ? (
              <p className={`conta-auth-field-note ${confirmacaoSenhaInvalida ? 'is-error' : 'is-success'}`}>
                {confirmacaoSenhaInvalida ? 'As senhas não coincidem.' : 'As senhas conferem.'}
              </p>
            ) : null}
          </>
        ) : null}

        {senhaFracaCadastro ? (
          <p className="conta-auth-field-note is-error">
            Reforce sua senha para seguir com o cadastro.
          </p>
        ) : null}

        {modo === 'cadastro' && telefoneCadastroNormalizado.length > 0 && telefoneCadastroNormalizado.length < 10 ? (
          <p className="conta-auth-field-note is-error">
            Telefone incompleto. Informe DDD e número.
          </p>
        ) : null}

        {modo === 'cadastro' ? (
          <label className="check-row">
            <input
              type="checkbox"
              checked={whatsappOptIn}
              onChange={(event) => onWhatsappOptInChange(event.target.checked)}
            />
            Quero receber atualizações do pedido no WhatsApp
          </label>
        ) : null}

        {recaptchaEnabled ? (
          <div style={{ marginBottom: '12px' }}>
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={recaptchaSiteKey}
              hl="pt-BR"
              onChange={onRecaptchaChange}
              onExpired={onRecaptchaExpired}
              onErrored={onRecaptchaError}
            />

            {recaptchaErroCarregamento ? (
              <p className="error-text" role="alert" style={{ marginTop: '0.5rem' }}>
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

      <aside className="card-box conta-auth-side">
        <p><strong>Vantagens da conta</strong></p>
        <ul className="conta-benefits-list">
          <li>Checkout mais rápido com dados salvos</li>
          <li>Histórico completo de pedidos</li>
          <li>Acompanhamento de status em tempo real</li>
          <li>Preferências personalizadas de contato</li>
        </ul>
        <p className="muted-text conta-auth-note">Seu cadastro é protegido e usado apenas para melhorar sua experiência de compra.</p>
      </aside>
    </div>
  );
}
