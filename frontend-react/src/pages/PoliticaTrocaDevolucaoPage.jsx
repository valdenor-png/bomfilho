import React from 'react';
import { STORE_WHATSAPP_URL, STORE_WHATSAPP_DISPLAY, STORE_TELEFONE_URL, STORE_TELEFONE_DISPLAY } from '../config/store';

export default function PoliticaTrocaDevolucaoPage() {
  return (
    <section className="page legal-page">
      <h1>Politica de Troca e Devolucao</h1>
      <p className="legal-meta">Ultima atualizacao: 16/03/2026</p>

      <p>
        Esta e uma versao provisoria da politica de troca e devolucao para compras realizadas na plataforma
        digital da loja BomFilho.
      </p>

      <h2>1. Conferencia no recebimento</h2>
      <p>O cliente deve conferir os produtos no recebimento.</p>

      <h2>2. Quando acionar a loja</h2>
      <ul>
        <li>em caso de produto avariado, item trocado, item faltante ou divergencia evidente no pedido, o cliente deve entrar em contato pelos canais oficiais o quanto antes apos o recebimento;</li>
        <li>produtos pereciveis, sensiveis ou que dependam de conservacao adequada devem ser comunicados imediatamente em caso de problema.</li>
      </ul>

      <h2>3. Analise das solicitacoes</h2>
      <p>
        As solicitacoes serao analisadas conforme o caso concreto, a natureza do produto e as condicoes de conservacao.
      </p>

      <h2>4. Possiveis formas de resolucao</h2>
      <ul>
        <li>conforme analise, a loja podera oferecer substituicao, credito, ajuste ou estorno, quando cabivel;</li>
        <li>a forma de resolucao considera o historico do pedido e a viabilidade operacional.</li>
      </ul>

      <h2>5. Situacoes que podem nao ser aceitas</h2>
      <p>
        Itens com indicios de uso indevido, armazenamento inadequado apos a entrega ou reclamacao fora de
        prazo razoavel poderao nao ser aceitos.
      </p>

      <h2>6. Canal de atendimento</h2>
      <ul>
        <li>WhatsApp e telefone: <a href={STORE_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">{STORE_WHATSAPP_DISPLAY}</a></li>
        <li>Telefone fixo: <a href={STORE_TELEFONE_URL}>{STORE_TELEFONE_DISPLAY}</a></li>
        <li>Horario de atendimento: segunda a sabado, 7h30 as 13h e 15h as 19h30; domingos e feriados, 8h as 12h30</li>
      </ul>
    </section>
  );
}
