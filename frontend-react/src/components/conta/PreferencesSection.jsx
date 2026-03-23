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
          <p>Controle comunicação e alertas operacionais de forma simples.</p>
        </div>
      </div>

      <div className="conta-preferences-groups" aria-label="Preferências da conta">
        <section className="conta-preferences-group" aria-label="Comunicação e promoções">
          <h4>Comunicação e promoções</h4>
          <div className="switch-list">
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
          </div>
        </section>

        <section className="conta-preferences-group" aria-label="Atualizações essenciais">
          <h4>Atualizações essenciais</h4>
          <div className="switch-list">
            <SwitchControl
              id="pref-notificacoes-pedidos"
              label="Notificações de pedidos"
              description="Status do pedido e entrega em tempo real."
              checked={preferencias.notificacoesPedidos}
              onChange={(checked) => onAtualizarPreferencia('notificacoesPedidos', checked)}
            />
          </div>
        </section>
      </div>
    </article>
  );
}
