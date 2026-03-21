'use strict';

const LARGURA = 42;
const LINHA_CHEIA = '='.repeat(LARGURA);
const LINHA_MEIA = '-'.repeat(LARGURA);

function centralizar(texto) {
  const espacos = Math.max(0, Math.floor((LARGURA - texto.length) / 2));
  return ' '.repeat(espacos) + texto;
}

function formatarDinheiro(valor) {
  return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;
}

function quebrarLinha(texto, maxColunas = LARGURA) {
  if (!texto || texto.length <= maxColunas) {
    return [texto || ''];
  }
  const linhas = [];
  let restante = texto;
  while (restante.length > maxColunas) {
    let corte = restante.lastIndexOf(' ', maxColunas);
    if (corte <= 0) {
      corte = maxColunas;
    }
    linhas.push(restante.slice(0, corte));
    restante = restante.slice(corte).trimStart();
  }
  if (restante) {
    linhas.push(restante);
  }
  return linhas;
}

function formatarPagamento(formaPagamento) {
  const mapa = {
    pix: 'Pix',
    credito: 'Cartao de Credito',
    debito: 'Cartao de Debito',
    credit_card: 'Cartao de Credito',
    debit_card: 'Cartao de Debito'
  };
  return mapa[String(formaPagamento || '').toLowerCase()] || String(formaPagamento || 'Pix');
}

function formatarStatus(status, pixStatus) {
  const pago = ['pago', 'preparando', 'pronto_para_retirada', 'enviado', 'entregue', 'retirado'];
  if (pago.includes(status) || pixStatus === 'approved' || pixStatus === 'PAID') {
    return 'Ja Pago';
  }
  return 'Cobrar na Entrega';
}

function formatarData(data) {
  if (!data) {
    return '__/__/____';
  }
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) {
    return '__/__/____';
  }
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatarHora(data) {
  if (!data) {
    return '__:__';
  }
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) {
    return '__:__';
  }
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatarNumPedido(id) {
  return String(id || 0).padStart(6, '0');
}

/**
 * Gera o espelho/nota de pedido formatado para impressora térmica (bobina ~42 colunas).
 *
 * @param {object} dados
 * @param {object} dados.pedido - Dados do pedido (id, total, taxa_servico, status, forma_pagamento, pix_status, criado_em)
 * @param {object} dados.cliente - Dados do cliente (nome, telefone, email)
 * @param {object|null} dados.endereco - Endereço (rua/logradouro, numero, bairro, cidade, estado, cep, complemento, referencia)
 * @param {Array} dados.itens - Lista de itens ({nome_produto, quantidade, preco, subtotal})
 * @param {number} [dados.desconto] - Valor de desconto aplicado
 * @param {string} [dados.instrucoes] - Instruções especiais de entrega
 * @param {string} [dados.tipo_entrega] - 'entrega' ou 'retirada'
 * @returns {string} Texto formatado para impressão
 */
function gerarEspelhoPedido(dados) {
  const { pedido, cliente, endereco, itens, desconto, instrucoes, tipo_entrega } = dados;
  const linhas = [];

  // --- Cabeçalho empresa ---
  linhas.push(LINHA_CHEIA);
  linhas.push(centralizar('MERCADO BOMFILHO'));
  linhas.push(LINHA_CHEIA);
  linhas.push('CNPJ: 09.175.211/0001-30');
  linhas.push('End: Tv 07 de Setembro, n 70');
  linhas.push('CEP: 68740-180');
  linhas.push('WhatsApp: (91) 99965-2790');
  linhas.push('Fixo: (91) 3721-9780');
  linhas.push('Instagram: @bomfilhooficial');
  linhas.push('');
  linhas.push('Seg a Sab: 7h30-13h e 15h-19h30');
  linhas.push('Dom e Feriados: 8h as 12h30');

  // --- Dados do pedido ---
  linhas.push(LINHA_MEIA);
  linhas.push(`PEDIDO N: ${formatarNumPedido(pedido?.id)}`);
  linhas.push(`DATA: ${formatarData(pedido?.criado_em)}  HORA: ${formatarHora(pedido?.criado_em)}`);

  // --- Entrega ---
  linhas.push(LINHA_CHEIA);
  const ehRetirada = tipo_entrega === 'retirada' || pedido?.tipo_entrega === 'retirada';
  linhas.push(centralizar(ehRetirada ? 'RETIRADA NO BALCAO' : 'DADOS DA ENTREGA'));
  linhas.push(LINHA_MEIA);
  linhas.push(`Cliente: ${cliente?.nome || '-'}`);
  linhas.push(`Contato: ${cliente?.telefone || '-'}`);

  if (!ehRetirada && endereco) {
    linhas.push('');
    const rua = endereco.logradouro || endereco.rua || '';
    const num = endereco.numero || 's/n';
    const bairro = endereco.bairro || '';
    const endLinha = `${rua}, ${num}` + (bairro ? ` - ${bairro}` : '');
    quebrarLinha(`End: ${endLinha}`).forEach((l) => linhas.push(l));

    if (endereco.complemento) {
      linhas.push(`Complemento: ${endereco.complemento}`);
    }
    if (endereco.cep) {
      linhas.push(`CEP: ${endereco.cep}`);
    }
    if (endereco.referencia) {
      quebrarLinha(`Referencia: ${endereco.referencia}`).forEach((l) => linhas.push(l));
    }
  }

  if (instrucoes) {
    linhas.push('');
    linhas.push('Atencao (Instrucoes):');
    quebrarLinha(instrucoes).forEach((l) => linhas.push(l));
  }

  // --- Itens ---
  linhas.push(LINHA_CHEIA);
  linhas.push(centralizar('ITENS DO PEDIDO (SEPARACAO)'));
  linhas.push(LINHA_MEIA);
  linhas.push('[ ] QTD  | DESCRICAO          | TOTAL');
  linhas.push(LINHA_MEIA);

  const listaItens = Array.isArray(itens) ? itens : [];
  for (const item of listaItens) {
    const qty = Number(item.quantidade || 1);
    const nome = String(item.nome_produto || item.nome || '').slice(0, 20);
    const totalItem = Number(item.subtotal || (qty * Number(item.preco || 0)));
    const qtyStr = `${qty} un`.padEnd(5);
    const nomeStr = nome.padEnd(20);
    const totalStr = formatarDinheiro(totalItem).padStart(9);
    linhas.push(`[ ] ${qtyStr}| ${nomeStr}| ${totalStr}`);
  }

  // --- Financeiro ---
  linhas.push(LINHA_MEIA);
  const subtotalProdutos = listaItens.reduce(
    (acc, item) => acc + Number(item.subtotal || (Number(item.quantidade || 1) * Number(item.preco || 0))),
    0
  );
  const taxaEntrega = Number(pedido?.taxa_servico || 0);
  const descontoValor = Number(desconto || 0);
  const totalFinal = Number(pedido?.total || (subtotalProdutos + taxaEntrega - descontoValor));

  linhas.push(`Subtotal Produtos:    ${formatarDinheiro(subtotalProdutos).padStart(10)}`);
  linhas.push(`Taxa de Entrega:      ${formatarDinheiro(taxaEntrega).padStart(10)}`);
  linhas.push(`Descontos:            ${formatarDinheiro(descontoValor).padStart(10)}`);
  linhas.push(LINHA_MEIA);
  linhas.push(`TOTAL DO PEDIDO:      ${formatarDinheiro(totalFinal).padStart(10)}`);

  // --- Pagamento ---
  linhas.push(LINHA_CHEIA);
  linhas.push(centralizar('PAGAMENTO'));
  linhas.push(LINHA_MEIA);
  linhas.push(`Metodo: ${formatarPagamento(pedido?.forma_pagamento)}`);
  linhas.push(`Status: ${formatarStatus(pedido?.status, pedido?.pix_status)}`);

  // --- Assinatura ---
  linhas.push(LINHA_CHEIA);
  linhas.push('Recebido por:');
  linhas.push('');
  linhas.push('________________________________________');
  linhas.push('Data/Hora: ___/___/___ as ___:___');
  linhas.push(LINHA_CHEIA);
  linhas.push(centralizar('Obrigado pela preferencia!'));
  linhas.push(LINHA_CHEIA);

  return linhas.join('\n');
}

module.exports = { gerarEspelhoPedido };
