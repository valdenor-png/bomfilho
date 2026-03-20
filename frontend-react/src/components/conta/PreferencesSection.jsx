import React from 'react';
import SwitchControl from './SwitchControl';

function IconPreferences() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="conta-icon-svg">
      <path d="M10.59 3.41 9.17 4.83l1.41 1.41 1.42-1.41 1.41 1.41 1.42-1.41-1.42-1.42a2 2 0 0 0-2.82 0ZM5 9h14v2H5Zm2 4h10v2H7Z" />
    </svg>
  );
}

export default function PreferencesSection({
  preferencias,
  onToggleWhatsapp,
  onAtualizarPreferencia
}) {
  return (
    <article className="card-box conta-section-card">
      <div className="conta-section-head">
        <span className="conta-section-icon"><IconPreferences /></span>
        <div>
          <h3>Preferências</h3>
          <p>Escolha como quer receber avisos e novidades.</p>
        </div>
      </div>

      <div className="switch-list" aria-label="Preferências da conta">
        <SwitchControl
          id="pref-whatsapp-promocoes"
          label="Promoções no WhatsApp"
          description="Ofertas e novidades no número cadastrado."
          checked={preferencias.promocoesWhatsapp}
          onChange={(checked) => { void onToggleWhatsapp(checked); }}
        />

        <SwitchControl
          id="pref-email-promocoes"
          label="Promoções por e-mail"
          description="Cupons e campanhas na sua caixa de entrada."
          checked={preferencias.promocoesEmail}
          onChange={(checked) => onAtualizarPreferencia('promocoesEmail', checked)}
        />

        <SwitchControl
          id="pref-notificacoes-pedidos"
          label="Notificações de pedidos"
          description="Atualizações de preparo e entrega."
          checked={preferencias.notificacoesPedidos}
          onChange={(checked) => onAtualizarPreferencia('notificacoesPedidos', checked)}
        />

        <SwitchControl
          id="pref-tema-escuro"
          label="Tema escuro"
          description="Disponível em breve."
          checked={preferencias.temaEscuro}
          onChange={(checked) => onAtualizarPreferencia('temaEscuro', checked)}
          disabled
        />
      </div>
    </article>
  );
}
