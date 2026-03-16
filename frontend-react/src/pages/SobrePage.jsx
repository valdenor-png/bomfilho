import React from 'react';

export default function SobrePage() {
  return (
    <section className="page">
      <h1>Sobre</h1>
      <p>A loja BomFilho e um supermercado de bairro com atendimento proximo e entrega agil.</p>

      <section className="benefits-strip" aria-label="Benefícios da loja">
        <div className="benefit-item"><span>🏪</span> Retirada na loja</div>
        <div className="benefit-item"><span>🚚</span> Entrega rápida</div>
        <div className="benefit-item"><span>💳</span> Pagamento seguro</div>
        <div className="benefit-item"><span>📲</span> Atendimento WhatsApp</div>
      </section>

      <div className="card-box">
        <p><strong>Nome/Razao exibida:</strong> BomFilho</p>
        <p><strong>CNPJ:</strong> 09.175.211/0001-30</p>
        <p><strong>Endereco:</strong> Travessa 07 de Setembro, CEP 68740-180</p>
        <p><strong>WhatsApp e telefone:</strong> (91) 99965-2790</p>
        <p><strong>Telefone fixo:</strong> (91) 3721-9780</p>
        <p><strong>Horario:</strong> segunda a sabado, 7h30 as 13h e 15h as 19h30; domingos e feriados, 8h as 12h30</p>
      </div>
    </section>
  );
}
