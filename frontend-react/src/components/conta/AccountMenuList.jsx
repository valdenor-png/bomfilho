import React from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeHelp,
  ChevronRight,
  CreditCard,
  MapPin,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Star,
  TicketPercent,
  User
} from 'lucide-react';

function Chevron() {
  return <ChevronRight className="account-menu-chevron" size={16} strokeWidth={2} aria-hidden="true" />;
}

function AccountMenuButton({ Icon, label, description, onClick, isActive = false }) {
  return (
    <button
      type="button"
      className={`account-menu-item ${isActive ? 'is-active' : ''}`.trim()}
      onClick={onClick}
    >
      <span className="account-menu-icon" aria-hidden="true">
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="account-menu-copy">
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <Chevron />
    </button>
  );
}

function AccountMenuLink({ Icon, label, description, to }) {
  return (
    <Link to={to} className="account-menu-item">
      <span className="account-menu-icon" aria-hidden="true">
        <Icon size={18} strokeWidth={2} />
      </span>
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
        Icon={MessageCircle}
        label="WhatsApp"
        description="Atendimento rapido da loja"
        onClick={onOpenWhatsapp}
      />

      <AccountMenuButton
        Icon={User}
        label="Dados da conta"
        description="Nome, e-mail, telefone e preferencias"
        onClick={() => onSelectPanel('dados')}
        isActive={activePanel === 'dados'}
      />

      <AccountMenuButton
        Icon={CreditCard}
        label="Pagamentos"
        description="Gestao segura com Mercado Pago"
        onClick={() => onSelectPanel('pagamentos')}
        isActive={activePanel === 'pagamentos'}
      />

      <AccountMenuButton
        Icon={MapPin}
        label="Enderecos"
        description="Principal, edicao e referencia"
        onClick={() => onSelectPanel('enderecos')}
        isActive={activePanel === 'enderecos'}
      />

      {showCupons ? (
        <AccountMenuButton
          Icon={TicketPercent}
          label="Cupons"
          description="Beneficios disponiveis"
          onClick={() => onSelectPanel('cupons')}
          isActive={activePanel === 'cupons'}
        />
      ) : null}

      <AccountMenuLink Icon={Receipt} label="Meus pedidos" description="Historico e acompanhamento" to="/pedidos" />
      <AccountMenuLink Icon={Star} label="Favoritos" description="Itens salvos para recompra" to="/produtos?recorrencia=favoritos" />

      <AccountMenuButton
        Icon={BadgeHelp}
        label="Ajuda e suporte"
        description="Falar com o atendimento"
        onClick={onOpenWhatsapp}
      />

      <AccountMenuButton
        Icon={ShieldCheck}
        label="Seguranca"
        description="Senha, sessoes e saida"
        onClick={() => onSelectPanel('seguranca')}
        isActive={activePanel === 'seguranca'}
      />
    </section>
  );
}
