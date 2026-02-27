import React from 'react';

export default function SobrePage() {
  return (
    <section className="page">
      <h1>Sobre</h1>
      <p>Comércio Bom Filho é um mercado local com foco em entrega rápida e compra simples.</p>

      <section className="benefits-strip" aria-label="Benefícios da loja">
        <div className="benefit-item"><span>🏪</span> Retirada na loja</div>
        <div className="benefit-item"><span>🚚</span> Entrega rápida</div>
        <div className="benefit-item"><span>💳</span> Pagamento fácil</div>
        <div className="benefit-item"><span>📲</span> Atendimento WhatsApp</div>
      </section>

      <div className="card-box">
        <p><strong>Atendimento:</strong> segunda a sábado</p>
        <p><strong>Contato:</strong> (91) 99965-2790</p>
        <p><strong>Endereço:</strong> consulte no link do Google Maps no site institucional</p>
      </div>
    </section>
  );
}
