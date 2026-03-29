import React from 'react';
import { STORE_WHATSAPP_URL, STORE_WHATSAPP_DISPLAY, STORE_TELEFONE_URL, STORE_TELEFONE_DISPLAY, STORE_CNPJ, STORE_ENDERECO } from '../config/store';

export default function PoliticaPrivacidadePage() {
  return (
    <section className="page legal-page">
      <h1>Politica de Privacidade</h1>
      <p className="legal-meta">Ultima atualizacao: Marco de 2026</p>

      <h2>1. Introducao</h2>
      <p>
        O BomFilho Supermercado ("BomFilho", "nos") valoriza a privacidade
        dos seus clientes e esta comprometido com a protecao dos seus dados
        pessoais, em conformidade com a Lei Geral de Protecao de Dados
        (Lei n 13.709/2018 — LGPD).
      </p>

      <h2>2. Dados que coletamos</h2>
      <p>Coletamos os seguintes dados pessoais:</p>
      <ul>
        <li><strong>Dados de cadastro:</strong> nome, email, telefone, CPF (quando necessario para nota fiscal)</li>
        <li><strong>Dados de entrega:</strong> endereco completo (CEP, logradouro, numero, bairro, cidade)</li>
        <li><strong>Dados de compra:</strong> historico de pedidos, itens comprados, valores, forma de pagamento utilizada</li>
        <li><strong>Dados de navegacao:</strong> paginas visitadas, produtos visualizados, termos buscados</li>
        <li><strong>Dados do dispositivo:</strong> tipo de navegador, sistema operacional (coletados automaticamente)</li>
      </ul>

      <h2>3. Como usamos seus dados</h2>
      <p>Utilizamos seus dados para:</p>
      <ul>
        <li>Processar e entregar seus pedidos</li>
        <li>Enviar confirmacoes e atualizacoes de status do pedido</li>
        <li>Personalizar sua experiencia de compra (recomendacoes, ofertas)</li>
        <li>Enviar promocoes e novidades (somente com seu consentimento)</li>
        <li>Cumprir obrigacoes legais e fiscais</li>
        <li>Melhorar nossos servicos e prevenir fraudes</li>
      </ul>

      <h2>4. Compartilhamento de dados</h2>
      <p>Seus dados podem ser compartilhados com:</p>
      <ul>
        <li><strong>Servicos de entrega:</strong> nome, endereco e telefone para realizar a entrega</li>
        <li><strong>Processadores de pagamento:</strong> dados necessarios para processar transacoes via PIX</li>
        <li><strong>Autoridades legais:</strong> quando exigido por lei ou ordem judicial</li>
      </ul>
      <p>
        Nao vendemos, alugamos ou compartilhamos seus dados pessoais com
        terceiros para fins de marketing.
      </p>

      <h2>5. Armazenamento e seguranca</h2>
      <p>
        Seus dados sao armazenados em servidores seguros com criptografia
        em transito (HTTPS/TLS). Adotamos medidas tecnicas e organizacionais
        para proteger seus dados contra acesso nao autorizado, alteracao,
        divulgacao ou destruicao.
      </p>
      <p>
        Alguns dados de preferencia (como configuracoes da conta) sao
        armazenados localmente no seu navegador (localStorage) e nao sao
        transmitidos a terceiros.
      </p>

      <h2>6. Seus direitos (LGPD)</h2>
      <p>Conforme a LGPD, voce tem direito a:</p>
      <ul>
        <li>Confirmar a existencia de tratamento de seus dados</li>
        <li>Acessar seus dados pessoais que mantemos</li>
        <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
        <li>Solicitar a anonimizacao, bloqueio ou eliminacao de dados desnecessarios</li>
        <li>Solicitar a portabilidade dos seus dados</li>
        <li>Revogar o consentimento para uso de dados em marketing</li>
        <li>Solicitar a eliminacao dos dados tratados com base no consentimento</li>
      </ul>
      <p>
        Para exercer qualquer destes direitos, entre em contato pelo WhatsApp{' '}
        <a href={STORE_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">{STORE_WHATSAPP_DISPLAY}</a>.
      </p>

      <h2>7. Cookies e tecnologias similares</h2>
      <p>
        Nosso site utiliza localStorage para armazenar preferencias da sua
        conta, itens do carrinho e dados de navegacao. Nao utilizamos cookies
        de rastreamento de terceiros. Os dados armazenados localmente sao
        essenciais para o funcionamento do site.
      </p>

      <h2>8. Retencao de dados</h2>
      <p>
        Mantemos seus dados pessoais pelo tempo necessario para cumprir as
        finalidades descritas nesta politica, ou conforme exigido por lei
        (ex: dados fiscais sao mantidos por 5 anos conforme legislacao tributaria).
      </p>

      <h2>9. Menores de idade</h2>
      <p>
        Nossos servicos nao sao direcionados a menores de 18 anos. Nao
        coletamos intencionalmente dados de menores. Se tomarmos conhecimento
        de que coletamos dados de um menor, tomaremos medidas para elimina-los.
      </p>

      <h2>10. Alteracoes</h2>
      <p>
        Esta politica pode ser atualizada periodicamente. Notificaremos sobre
        mudancas significativas por meio do site ou por email.
      </p>

      <h2>11. Contato e Encarregado (DPO)</h2>
      <p>Para questoes relacionadas a privacidade e protecao de dados:</p>
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
