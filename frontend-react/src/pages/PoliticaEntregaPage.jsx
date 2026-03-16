import React from 'react';

export default function PoliticaEntregaPage() {
  return (
    <section className="page legal-page">
      <h1>Politica de Entrega</h1>
      <p className="legal-meta">Ultima atualizacao: 16/03/2026</p>

      <p>
        Esta politica descreve regras de cobertura, prazos e condicoes de entrega dos pedidos realizados
        no Bom Filho Supermercado.
      </p>

      <h2>1. Area de atendimento</h2>
      <p>
        A entrega e realizada conforme cobertura de CEP e disponibilidade operacional da loja.
        Regiao principal atendida: [INSERIR_BAIRROS_OU_REGIAO_ATENDIDA].
      </p>

      <h2>2. Prazo estimado</h2>
      <p>
        O prazo e calculado no checkout e pode variar por distancia, horario de pico, clima,
        volume de pedidos e tipo de veiculo de entrega.
      </p>

      <h2>3. Frete e modalidades</h2>
      <ul>
        <li>valor de frete informado antes da confirmacao do pedido;</li>
        <li>modalidade selecionada conforme disponibilidade local (ex.: bike, moto ou carro);</li>
        <li>pedidos fora da area de cobertura podem ser recusados automaticamente.</li>
      </ul>

      <h2>4. Tentativa de entrega</h2>
      <ul>
        <li>o cliente deve manter contato e endereco acessiveis para recebimento;</li>
        <li>em ausencia do recebedor, pode haver nova tentativa ou cancelamento conforme analise operacional;</li>
        <li>divergencias de endereco podem gerar atraso ou impossibilidade de conclusao.</li>
      </ul>

      <h2>5. Acompanhamento</h2>
      <p>
        O status do pedido pode ser acompanhado pela area de pedidos e pelos canais de atendimento,
        com atualizacoes de preparo e entrega.
      </p>

      <h2>6. Contato de entrega</h2>
      <ul>
        <li>WhatsApp: [INSERIR_WHATSAPP_OFICIAL]</li>
        <li>Horario: [INSERIR_HORARIO_DE_ATENDIMENTO]</li>
      </ul>
    </section>
  );
}
