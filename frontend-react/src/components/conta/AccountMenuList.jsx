import React from 'react';
import { Link } from 'react-router-dom';

function Chevron() {
  return <span className="account-menu-chevron" aria-hidden="true">›</span>;
}

function AccountMenuButton({ icon, label, description, onClick, isActive = false }) {
  return (
    <button
      type="button"
      className={`account-menu-item ${isActive ? 'is-active' : ''}`.trim()}
      onClick={onClick}
    >
      <span className="account-menu-icon" aria-hidden="true">{icon}</span>
      <span className="account-menu-copy">
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <Chevron />
    </button>
  );
}

function AccountMenuLink({ icon, label, description, to }) {
  return (
    <Link to={to} className="account-menu-item">
      <span className="account-menu-icon" aria-hidden="true">{icon}</span>
      <span className="account-menu-copy">
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <Chevron />
    </Link>
  );
}

export default function AccountMenuList({
  onOpenWhatsapp,
  onSelectPanel,
  activePanel,
  showCupons = false
}) {
  return (
    <section className="account-menu-list" aria-label="Atalhos da conta">
      <AccountMenuButton
        icon="💬"
        label="WhatsApp"
        description="Atendimento rápido da loja"
        onClick={onOpenWhatsapp}
      />

      <AccountMenuButton
        icon="👤"
        label="Dados da conta"
        description="Nome, e-mail, telefone e preferências"
        onClick={() => onSelectPanel('dados')}
        isActive={activePanel === 'dados'}
      />

      <AccountMenuButton
        icon="💳"
        label="Pagamentos"
        description="Gestão segura com Mercado Pago"
        onClick={() => onSelectPanel('pagamentos')}
        isActive={activePanel === 'pagamentos'}
      />

      <AccountMenuButton
        icon="📍"
        label="Endereços"
        description="Principal, edição e referência"
        onClick={() => onSelectPanel('enderecos')}
        isActive={activePanel === 'enderecos'}
      />

      {showCupons ? (
        <AccountMenuButton
          icon="🎟️"
          label="Cupons"
          description="Benefícios disponíveis"
          onClick={() => onSelectPanel('cupons')}
          isActive={activePanel === 'cupons'}
        />
      ) : null}

      <AccountMenuLink icon="🧾" label="Meus pedidos" description="Histórico e acompanhamento" to="/pedidos" />
      <AccountMenuLink icon="⭐" label="Favoritos" description="Itens salvos para recompra" to="/produtos?recorrencia=favoritos" />

      <AccountMenuButton
        icon="🆘"
        label="Ajuda e suporte"
        description="Falar com o atendimento"
        onClick={onOpenWhatsapp}
      />

      <AccountMenuButton
        icon="🔒"
        label="Segurança"
        description="Senha, sessões e saída"
        onClick={() => onSelectPanel('seguranca')}
        isActive={activePanel === 'seguranca'}
      />
    </section>
  );
}
