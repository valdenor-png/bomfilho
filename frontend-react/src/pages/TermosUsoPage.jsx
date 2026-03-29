import React from 'react';
import { STORE_WHATSAPP_URL, STORE_WHATSAPP_DISPLAY, STORE_TELEFONE_URL, STORE_TELEFONE_DISPLAY, STORE_CNPJ, STORE_ENDERECO } from '../config/store';

export default function TermosUsoPage() {
  return (
    <section className="page legal-page">
      <h1>Termos de Uso</h1>
      <p className="legal-meta">Ultima atualizacao: Marco de 2026</p>

      <h2>1. Aceitacao dos Termos</h2>
      <p>
        Ao acessar e utilizar o site e os servicos do BomFilho Supermercado
        ("BomFilho", "nos"), voce ("Usuario", "Cliente") concorda com estes
        Termos de Uso. Caso nao concorde com qualquer disposicao, nao utilize
        nossos servicos.
      </p>

      <h2>2. Descricao do Servico</h2>
      <p>
        O BomFilho oferece uma plataforma digital para compra de produtos de
        supermercado com as seguintes modalidades de recebimento:
      </p>
      <ul>
        <li>Retirada na loja: {STORE_ENDERECO}</li>
        <li>Entrega no endereco: dentro da area de cobertura em Castanhal - PA</li>
      </ul>

      <h2>3. Cadastro e Conta</h2>
      <p>
        Para realizar pedidos, o Usuario deve criar uma conta fornecendo
        informacoes verdadeiras e atualizadas. O Usuario e responsavel pela
        seguranca de suas credenciais de acesso e por todas as atividades
        realizadas em sua conta.
      </p>

      <h2>4. Produtos e Precos</h2>
      <p>
        Os precos exibidos sao validos exclusivamente para compras realizadas
        pelo site e podem diferir dos precos praticados na loja fisica.
        Nos reservamos o direito de alterar precos a qualquer momento sem
        aviso previo. O preco valido e o exibido no momento da finalizacao
        do pedido.
      </p>
      <p>
        As fotos dos produtos sao meramente ilustrativas. A disponibilidade
        dos produtos esta sujeita ao estoque no momento da separacao do pedido.
      </p>

      <h2>5. Pedidos e Pagamento</h2>
      <p>
        Ao finalizar um pedido, o Cliente se compromete a efetuar o pagamento
        na forma selecionada. Pedidos com pagamento via PIX que nao forem
        confirmados em ate 30 minutos serao automaticamente cancelados.
      </p>
      <p>
        O BomFilho reserva-se o direito de recusar ou cancelar pedidos em
        caso de indicios de fraude, dados incorretos ou indisponibilidade
        de produtos.
      </p>

      <h2>6. Entrega</h2>
      <p>
        Os prazos de entrega sao estimativas e podem variar conforme a demanda
        e condicoes operacionais. O BomFilho nao se responsabiliza por atrasos
        causados por fatores externos como condicoes climaticas, transito ou
        endereco incorreto fornecido pelo Cliente. Para mais detalhes, consulte
        nossa <a href="/politica-de-entrega">Politica de Entrega</a>.
      </p>

      <h2>7. Cancelamento e Troca</h2>
      <p>
        O Cliente pode solicitar o cancelamento do pedido antes do inicio da
        separacao dos produtos. Apos a separacao, o cancelamento fica sujeito
        a analise. Para trocas e devolucoes, consulte nossa{' '}
        <a href="/politica-troca-devolucao">Politica de Trocas e Devolucoes</a>.
      </p>

      <h2>8. Propriedade Intelectual</h2>
      <p>
        Todo o conteudo do site — incluindo textos, imagens, logotipos, layout
        e codigo — e propriedade do BomFilho Supermercado ou de seus licenciadores
        e esta protegido pelas leis de propriedade intelectual.
      </p>

      <h2>9. Limitacao de Responsabilidade</h2>
      <p>
        O BomFilho nao se responsabiliza por danos indiretos, incidentais ou
        consequenciais decorrentes do uso ou da impossibilidade de uso do site.
        Em caso de falha tecnica, nos comprometemos a resolver o problema no
        menor tempo possivel.
      </p>

      <h2>10. Modificacoes</h2>
      <p>
        Podemos atualizar estes Termos de Uso a qualquer momento. As alteracoes
        entram em vigor na data de publicacao. O uso continuado do site apos
        alteracoes constitui aceitacao dos novos termos.
      </p>

      <h2>11. Foro</h2>
      <p>
        Fica eleito o foro da Comarca de Castanhal - PA para dirimir quaisquer
        questoes decorrentes destes Termos de Uso.
      </p>

      <h2>12. Contato</h2>
      <ul>
        <li>BomFilho Supermercado</li>
        <li>CNPJ: {STORE_CNPJ}</li>
        <li>Endereco: {STORE_ENDERECO} — Castanhal/PA</li>
        <li>WhatsApp: <a href={STORE_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">{STORE_WHATSAPP_DISPLAY}</a></li>
        <li>Telefone: <a href={STORE_TELEFONE_URL}>{STORE_TELEFONE_DISPLAY}</a></li>
      </ul>
    </section>
  );
}
