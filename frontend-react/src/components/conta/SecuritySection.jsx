import React from 'react';

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="conta-icon-svg">
      <path d="M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3Zm-1 13-3-3 1.41-1.41L11 12.17l3.59-3.58L16 10l-5 5Z" />
    </svg>
  );
}

export default function SecuritySection({
  carregando,
  onLogout,
  onAcaoEmBreve,
  onExcluirConta
}) {
  return (
    <article className="card-box conta-section-card">
      <div className="conta-section-head">
        <span className="conta-section-icon"><IconShield /></span>
        <div>
          <h3>Segurança</h3>
          <p>Ações de proteção e acesso da sua conta.</p>
        </div>
      </div>

      <div className="conta-security-list" aria-label="Ações de segurança">
        <button className="conta-security-item" type="button" onClick={() => onAcaoEmBreve('Troca de senha')}>
          <span className="conta-security-item-copy">
            <strong>Alterar senha</strong>
            <small>Troque sua senha quando precisar.</small>
          </span>
        </button>

        <button className="conta-security-item" type="button" onClick={() => onAcaoEmBreve('Sessões ativas')}>
          <span className="conta-security-item-copy">
            <strong>Sessões ativas</strong>
            <small>Veja onde sua conta está conectada.</small>
          </span>
        </button>

        <button className="conta-security-item conta-security-item-danger" type="button" onClick={onLogout} disabled={carregando}>
          <span className="conta-security-item-copy">
            <strong>Sair da conta</strong>
            <small>Encerrar sessão neste aparelho.</small>
          </span>
        </button>
      </div>

      <details className="conta-security-danger">
        <summary>Zona de risco</summary>
        <div className="conta-security-danger-content">
          <p className="muted-text">Use apenas quando realmente necessário.</p>
          <button className="btn-danger" type="button" onClick={onExcluirConta} disabled={carregando}>
            Excluir conta
          </button>
        </div>
      </details>
    </article>
  );
}
