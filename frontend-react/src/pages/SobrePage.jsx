import React from 'react';

export default function SobrePage() {
  return (
    <section className="page">
      <h1>Sobre</h1>
      <p>O Comércio Bom Filho é um supermercado de bairro com atendimento próximo e entrega ágil.</p>

      <section className="benefits-strip" aria-label="Benefícios da loja">
        <div className="benefit-item"><span>🏪</span> Retirada na loja</div>
        <div className="benefit-item"><span>🚚</span> Entrega rápida</div>
        <div className="benefit-item"><span>💳</span> Pagamento seguro</div>
        <div className="benefit-item"><span>📲</span> Atendimento WhatsApp</div>
      </section>

      <div className="card-box">
        <p><strong>Atendimento:</strong> segunda a sábado</p>
        <p><strong>Contato:</strong> (91) 99965-2790</p>
        <p><strong>Endereço:</strong> consulte o link do Google Maps disponível na página inicial</p>
      </div>
    </section>
  );
}
