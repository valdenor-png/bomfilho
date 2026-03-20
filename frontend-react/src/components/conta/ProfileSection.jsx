import React from 'react';
import { Link } from 'react-router-dom';

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="conta-icon-svg">
      <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm8 6 8-5H4l8 5Z" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="conta-icon-svg">
      <path d="M6.62 10.79a15.46 15.46 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1-.24 11.7 11.7 0 0 0 3.69.59 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.47a1 1 0 0 1 1 1 11.7 11.7 0 0 0 .59 3.69 1 1 0 0 1-.25 1Z" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="conta-icon-svg">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
    </svg>
  );
}

export default function ProfileSection({
  nomeExibicao,
  emailExibicao,
  telefoneExibicao,
  iniciaisAvatar,
  textoStatusConta,
  carregando,
  onAcaoEmBreve
}) {
  return (
    <article className="card-box conta-profile-card">
      <div className="conta-profile-top">
        <div className="conta-avatar" aria-hidden="true">{iniciaisAvatar}</div>

        <div className="conta-profile-copy">
          <span className="conta-pill">Conta ativa</span>
          <h2>{nomeExibicao}</h2>
          <p className="muted-text conta-profile-subtitle">{textoStatusConta}</p>
        </div>

        <div className="conta-profile-actions">
          <Link to="/pedidos" className="btn-primary conta-profile-orders">
            Ver meus pedidos
          </Link>
          <button
            className="btn-secondary conta-profile-edit is-subtle"
            type="button"
            disabled={carregando}
            onClick={() => onAcaoEmBreve('Edição de perfil')}
          >
            Editar perfil
          </button>
        </div>
      </div>

      <div className="conta-profile-lines">
        <p className="conta-line-item">
          <span className="conta-line-icon"><IconMail /></span>
          <span className="conta-line-copy">
            <small>E-mail</small>
            <strong>{emailExibicao}</strong>
          </span>
        </p>

        <p className="conta-line-item">
          <span className="conta-line-icon"><IconPhone /></span>
          <span className="conta-line-copy">
            <small>Telefone</small>
            <strong>{telefoneExibicao}</strong>
          </span>
        </p>

        <p className="conta-line-item">
          <span className="conta-line-icon"><IconUser /></span>
          <span className="conta-line-copy">
            <small>Cadastro</small>
            <strong>Cliente desde {new Date().getFullYear()}</strong>
          </span>
        </p>
      </div>
    </article>
  );
}
