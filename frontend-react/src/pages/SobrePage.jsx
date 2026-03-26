import React from 'react';
import { CreditCard, MessageCircle, Store, Truck } from '../icons';
import useDocumentHead from '../hooks/useDocumentHead';
import { STORE_NAME, STORE_CNPJ, STORE_ENDERECO, STORE_WHATSAPP_DISPLAY, STORE_TELEFONE_DISPLAY, STORE_HORARIO_CURTO } from '../config/store';

export default function SobrePage() {
  useDocumentHead({ title: 'Sobre', description: 'Conheça o BomFilho Supermercado — um supermercado de bairro com atendimento próximo e entrega ágil.' });
  return (
    <section className="page">
      <h1>Sobre</h1>
      <p>A loja BomFilho e um supermercado de bairro com atendimento proximo e entrega agil.</p>

      <section className="benefits-strip" aria-label="Benefícios da loja">
        <div className="benefit-item"><Store size={16} aria-hidden="true" /> Retirada na loja</div>
        <div className="benefit-item"><Truck size={16} aria-hidden="true" /> Entrega rápida</div>
        <div className="benefit-item"><CreditCard size={16} aria-hidden="true" /> Pagamento seguro</div>
        <div className="benefit-item"><MessageCircle size={16} aria-hidden="true" /> Atendimento WhatsApp</div>
      </section>

      <div className="card-box">
        <p><strong>Nome/Razao exibida:</strong> {STORE_NAME}</p>
        <p><strong>CNPJ:</strong> {STORE_CNPJ}</p>
        <p><strong>Endereco:</strong> {STORE_ENDERECO}</p>
        <p><strong>WhatsApp e telefone:</strong> {STORE_WHATSAPP_DISPLAY}</p>
        <p><strong>Telefone fixo:</strong> {STORE_TELEFONE_DISPLAY}</p>
        <p><strong>Horario:</strong> {STORE_HORARIO_CURTO}</p>
      </div>
    </section>
  );
}
