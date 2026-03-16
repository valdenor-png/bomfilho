import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import ReCAPTCHA from 'react-google-recaptcha';
import {
  buscarEnderecoViaCep,
  criarPedido,
  criarSessao3DSPagBank,
  gerarPix,
  getMe,
  getPagBankPublicKey,
  getPedidos,
  isAuthErrorMessage,
  pagarCartao,
  simularFretePorCep
} from '../lib/api';
import {
  autenticar3DSPagBank,
  configurarSessao3DSPagBank,
  criptografarCartaoPagBank
} from '../lib/pagbank';
import {
  CHECKOUT_RECAPTCHA_ENABLED,
  IS_DEVELOPMENT,
  RECAPTCHA_SITE_KEY
} from '../config/api';
import { useCart } from '../context/CartContext';

const ETAPAS = {
  CARRINHO: 'carrinho',
  ENTREGA: 'entrega',
  PAGAMENTO: 'pagamento',
  PIX: 'pix',
  STATUS: 'status'
};

const CHECKOUT_STEPS = ['Carrinho', 'Entrega', 'Pagamento', 'Confirmação'];

const PARCELAMENTO_MINIMO_CREDITO = 100;
const PARCELAMENTO_MAXIMO_CREDITO = 3;
const SESSAO_3DS_TTL_MS = 29 * 60 * 1000;

const STATUS_3DS_LABELS = {
  idle: 'Autenticacao 3DS ainda nao iniciada.',
  iniciando: 'Iniciando autenticacao 3DS...',
  aguardando_validacao: 'Aguardando validacao de seguranca...',
  desafio: 'Desafio 3DS em andamento. Siga as instrucoes do emissor.',
  concluida: 'Autenticacao 3DS concluida com sucesso.',
  processando_pagamento: 'Autenticacao concluida. Processando pagamento...',
  pagamento_aprovado: 'Pagamento aprovado.',
  nao_suportado: 'Cartao nao elegivel para 3DS no debito.',
  trocar_metodo: 'Autenticacao negada. Escolha outro meio de pagamento.',
  erro: 'Nao foi possivel concluir a autenticacao 3DS.'
};

const CEP_MERCADO = '68740-180';
const NUMERO_MERCADO = '70';
const LIMITE_BIKE_KM = 1;

const VEICULOS_ENTREGA = {
  bike: {
    label: 'Bike',
    imagem: '/img/veiculos/bike.svg',
    icone: '🚲',
    descricao: 'Mais econômica para distâncias curtas',
    vantagem: 'Ideal para entregas rápidas no entorno da loja',
    consumo: 'Sem combustível',
    fatorReparo: 1.1,
    observacao: `Até ${LIMITE_BIKE_KM.toFixed(1)} km do mercado`
  },
  moto: {
    label: 'Moto',
    imagem: '/img/veiculos/moto.svg',
    icone: '🏍️',
    descricao: 'Melhor equilíbrio entre velocidade e custo',
    vantagem: 'Opção mais indicada para a maioria dos pedidos',
    consumo: '30 km/l',
    fatorReparo: 1.5,
    observacao: 'Equilíbrio entre velocidade e custo'
  },
  carro: {
    label: 'Carro',
    imagem: '/img/veiculos/carro.svg',
    icone: '🚗',
    descricao: 'Ideal para pedidos maiores e volumosos',
    vantagem: 'Mais capacidade para compras completas',
    consumo: '12 km/l',
    fatorReparo: 2.2,
    observacao: 'Ideal para pedidos maiores'
  }
};

const FORMAS_PAGAMENTO_OPCOES = {
  pix: {
    icon: '💠',
    title: 'PIX',
    headline: 'Pagamento instantâneo com confirmação automática',
    details: ['QR Code e código Copia e Cola', 'Confirmação automática após pagamento'],
    summaryTitle: 'Pagamento via PIX',
    summaryDescription: [
      'Gere o QR Code na próxima etapa e pague na hora.',
      'A confirmação acontece automaticamente após aprovação.'
    ],
    ctaText: 'Gerar PIX e continuar'
  },
  credito: {
    icon: '💳',
    title: 'Cartão de crédito',
    headline: 'Pagamento protegido com opção de parcelamento',
    details: ['Parcelamento em até 3x', `Disponível para pedidos acima de R$ ${PARCELAMENTO_MINIMO_CREDITO.toFixed(2).replace('.', ',')}`],
    summaryTitle: 'Pagamento com cartão de crédito',
    summaryDescription: [
      'Preencha os dados do cartão para concluir com segurança.',
      'Você pode escolher as parcelas disponíveis para este pedido.'
    ],
    ctaText: 'Continuar para confirmação'
  },
  debito: {
    icon: '🏧',
    title: 'Cartão de débito',
    headline: 'Pagamento à vista com aprovação da operadora',
    details: ['Pagamento à vista', 'Confirmação após aprovação da operadora'],
    summaryTitle: 'Pagamento com cartão de débito',
    summaryDescription: [
      'Finalize o pedido com pagamento à vista no cartão.',
      'A confirmação ocorre após a autorização da operadora.'
    ],
    ctaText: 'Continuar para confirmação'
  }
};

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function erroEntregaEhCobertura(mensagem) {
  const texto = String(mensagem || '').toLowerCase();
  return (
    texto.includes('cobertura')
    || texto.includes('fora da area')
    || texto.includes('fora da área')
    || texto.includes('não atend')
    || texto.includes('nao atend')
  );
}

function normalizarCep(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 8);
}

function formatarCep(valor) {
  const cep = normalizarCep(valor);
  if (cep.length <= 5) {
    return cep;
  }

  return `${cep.slice(0, 5)}-${cep.slice(5)}`;
}

function normalizarDocumentoFiscal(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 14);
}

function formatarDocumentoFiscal(valor) {
  const digits = normalizarDocumentoFiscal(valor);

  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function normalizarNumeroCartao(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 19);
}

function formatarNumeroCartao(valor) {
  const digits = normalizarNumeroCartao(valor);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function formatarMesCartao(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 2);
}

function formatarAnoCartao(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 4);
}

function formatarCvvCartao(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 4);
}

function normalizarTelefonePara3DS(telefone) {
  const digits = String(telefone || '').replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  const semPais = digits.startsWith('55') && digits.length >= 12
    ? digits.slice(2)
    : digits;
  if (semPais.length < 10) {
    return null;
  }

  const area = semPais.slice(0, 2);
  const number = semPais.slice(2);
  if (!area || !number) {
    return null;
  }

  return {
    country: '55',
    area,
    number,
    type: 'MOBILE'
  };
}

function construirEndereco3DS({ endereco, cepFallback } = {}) {
  const cepDigits = normalizarCep(endereco?.cep || cepFallback || '');
  return {
    street: String(endereco?.logradouro || 'Endereco').trim() || 'Endereco',
    number: String(endereco?.numero || '0').trim() || '0',
    complement: String(endereco?.complemento || '').trim(),
    regionCode: String(endereco?.estado || 'SP').trim().toUpperCase().slice(0, 2) || 'SP',
    country: 'BRA',
    city: String(endereco?.cidade || 'Sao Paulo').trim() || 'Sao Paulo',
    postalCode: cepDigits || '01001000'
  };
}

const STATUS_PEDIDO_LABELS = {
  pendente: 'Aguardando confirmação',
  preparando: 'Em preparação',
  enviado: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  pago: 'Pago'
};

const STATUS_PAGAMENTO_LABELS = {
  WAITING: 'Aguardando pagamento',
  IN_ANALYSIS: 'Em análise',
  AUTHORIZED: 'Autorizado',
  PAID: 'Pagamento aprovado',
  DECLINED: 'Pagamento recusado',
  CANCELED: 'Pagamento cancelado',
  EXPIRED: 'Pagamento expirado'
};

const PIX_STATUS_META = {
  WAITING: {
    tone: 'warning',
    icon: '⏳',
    guidance: 'Aguardando confirmação do banco. Assim que for aprovado, a etapa de confirmação será liberada.'
  },
  IN_ANALYSIS: {
    tone: 'info',
    icon: '🔎',
    guidance: 'Seu pagamento está em análise. Isso pode levar alguns instantes.'
  },
  AUTHORIZED: {
    tone: 'info',
    icon: '🛡️',
    guidance: 'Pagamento autorizado. A confirmação final será atualizada automaticamente.'
  },
  PAID: {
    tone: 'success',
    icon: '✅',
    guidance: 'Pagamento confirmado com sucesso. Você já pode seguir para a confirmação do pedido.'
  },
  EXPIRED: {
    tone: 'danger',
    icon: '⌛',
    guidance: 'Este PIX expirou. Gere um novo QR Code para tentar novamente.'
  },
  CANCELED: {
    tone: 'danger',
    icon: '⛔',
    guidance: 'Pagamento cancelado. Gere um novo PIX para concluir o pedido.'
  },
  DECLINED: {
    tone: 'danger',
    icon: '⚠️',
    guidance: 'Pagamento não aprovado. Gere um novo PIX e tente novamente.'
  }
};

function resolverStatusPix({ status, statusInterno, pagamentoConfirmado }) {
  const statusNormalizado = String(status || '').trim().toUpperCase();
  if (statusNormalizado) {
    return statusNormalizado;
  }

  const statusInternoNormalizado = String(statusInterno || '').trim().toLowerCase();
  if (pagamentoConfirmado || statusInternoNormalizado === 'pago' || statusInternoNormalizado === 'entregue') {
    return 'PAID';
  }

  if (statusInternoNormalizado === 'cancelado') {
    return 'CANCELED';
  }

  return 'WAITING';
}

function obterStatusPixVisual({ status, statusInterno, pagamentoConfirmado }) {
  const code = resolverStatusPix({ status, statusInterno, pagamentoConfirmado });
  const meta = PIX_STATUS_META[code] || {
    tone: 'neutral',
    icon: 'ℹ️',
    guidance: 'Atualize o status para confirmar a situação do pagamento.'
  };

  return {
    code,
    tone: meta.tone,
    icon: meta.icon,
    label: formatarStatusPagamento(code),
    guidance: meta.guidance,
    aprovado: code === 'PAID'
  };
}

function formatarStatusPedido(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();
  return STATUS_PEDIDO_LABELS[status] || 'Em análise';
}

function formatarStatusPagamento(statusRaw) {
  const status = String(statusRaw || '').trim().toUpperCase();
  return STATUS_PAGAMENTO_LABELS[status] || 'Em processamento';
}

function BotaoVoltarSeta({ onClick, label, disabled = false, text = '', className = '' }) {
  return (
    <button
      className={`btn-secondary entrega-voltar-carrinho-btn ${text ? 'has-text' : ''} ${className}`.trim()}
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
    >
      <span className="entrega-voltar-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14.5 5.5L8 12L14.5 18.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {text ? <span className="entrega-voltar-label">{text}</span> : null}
    </button>
  );
}

function LinkVoltarSeta({ to, label, text = '', className = '' }) {
  return (
    <Link
      to={to}
      className={`btn-secondary entrega-voltar-carrinho-btn ${text ? 'has-text' : ''} ${className}`.trim()}
      aria-label={label}
    >
      <span className="entrega-voltar-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14.5 5.5L8 12L14.5 18.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {text ? <span className="entrega-voltar-label">{text}</span> : null}
    </Link>
  );
}

function CheckoutStepper({ currentIndex }) {
  return (
    <ol className="checkout-steps" aria-label="Etapas do checkout">
      {CHECKOUT_STEPS.map((titulo, index) => {
        const estado = index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'upcoming';
        return (
          <li
            key={titulo}
            className={`checkout-step is-${estado}`}
            aria-current={estado === 'current' ? 'step' : undefined}
          >
            <span className="checkout-step-index" aria-hidden="true">
              {estado === 'completed' ? '✓' : index + 1}
            </span>
            <span className="checkout-step-label">{titulo}</span>
          </li>
        );
      })}
    </ol>
  );
}

function DeliveryOptionCard({
  veiculo,
  selecionado,
  recomendado,
  onSelect
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selecionado}
      className={`delivery-option-card ${selecionado ? 'is-selected' : ''}`}
      onClick={onSelect}
    >
      <div className="delivery-option-head">
        <div className="delivery-option-icon-wrap" aria-hidden="true">
          <img src={veiculo.imagem} alt="" className="delivery-option-icon" loading="lazy" />
        </div>

        <div className="delivery-option-title-wrap">
          <p className="delivery-option-title-row">
            <span className="delivery-option-title">{veiculo.label}</span>
            {recomendado ? <span className="delivery-option-badge">Mais recomendado</span> : null}
          </p>
          <p className="delivery-option-description">{veiculo.descricao}</p>
        </div>

        {selecionado ? <span className="delivery-option-check" aria-hidden="true">✓</span> : null}
      </div>

      <p className="delivery-option-advantage">{veiculo.vantagem}</p>
      <p className="delivery-option-meta">
        {veiculo.icone} {veiculo.consumo} • {veiculo.observacao}
      </p>
    </button>
  );
}

function DeliverySummaryCard({
  veiculoLabel,
  cepDestino,
  distanciaTexto,
  freteTexto,
  totalTexto,
  cepOrigem,
  numeroOrigem
}) {
  return (
    <article className="delivery-summary-card" aria-label="Resumo da entrega selecionada">
      <div className="delivery-summary-card-head">
        <div>
          <p className="delivery-summary-kicker">Entrega selecionada</p>
          <h3>{veiculoLabel}</h3>
        </div>
        <span className="delivery-summary-icon" aria-hidden="true">📦</span>
      </div>

      <div className="delivery-summary-grid">
        <div>
          <span className="delivery-summary-label">CEP de destino</span>
          <strong>{cepDestino}</strong>
        </div>
        <div>
          <span className="delivery-summary-label">Distância estimada</span>
          <strong>{distanciaTexto}</strong>
        </div>
        <div>
          <span className="delivery-summary-label">Frete</span>
          <strong className="delivery-summary-frete">{freteTexto}</strong>
        </div>
        <div>
          <span className="delivery-summary-label">Total com entrega</span>
          <strong className="delivery-summary-total">{totalTexto}</strong>
        </div>
      </div>

      <p className="delivery-summary-origin">Origem: CEP {cepOrigem}, nº {numeroOrigem}</p>
    </article>
  );
}

function DeliveryAddressLookupCard({
  cep,
  endereco,
  carregando,
  erro,
  cepIncompleto
}) {
  const estadoVisual = carregando
    ? 'loading'
    : erro
      ? 'error'
      : endereco
        ? 'success'
        : 'neutral';

  const rua = String(endereco?.logradouro || '').trim();
  const bairro = String(endereco?.bairro || '').trim();
  const cidade = String(endereco?.cidade || '').trim();
  const estado = String(endereco?.estado || '').trim();

  const linhaPrincipal = [rua, bairro].filter(Boolean).join(', ');
  const linhaSecundaria = [cidade, estado].filter(Boolean).join(' - ');

  return (
    <article
      className={`delivery-address-card is-${estadoVisual}`}
      role={estadoVisual === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <p className="delivery-address-kicker">Endereço do CEP {cep}</p>

      {carregando ? (
        <p className="delivery-address-line">Buscando endereço...</p>
      ) : erro ? (
        <p className="delivery-address-line">{erro}</p>
      ) : endereco ? (
        <>
          <p className="delivery-address-line">{linhaPrincipal || 'Logradouro não identificado para este CEP.'}</p>
          <p className="delivery-address-subline">{linhaSecundaria || 'Cidade/UF não identificada.'}</p>
        </>
      ) : cepIncompleto ? (
        <p className="delivery-address-line">Digite os 8 dígitos do CEP para identificar o endereço.</p>
      ) : (
        <p className="delivery-address-line">Informe um CEP para consultar o endereço.</p>
      )}
    </article>
  );
}

function CartItemRow({
  item,
  onUpdateQuantity,
  onRemove
}) {
  const quantidade = Math.max(1, Number(item?.quantidade || 1));
  const precoUnitario = Number(item?.preco || 0);
  const subtotal = Number((precoUnitario * quantidade).toFixed(2));
  const imagem = String(item?.imagem || '').trim();
  const categoria = String(item?.categoria || '').trim();
  const unidade = String(item?.unidade || '').trim();
  const [imagemFalhou, setImagemFalhou] = useState(false);
  const exibirImagem = Boolean(imagem) && !imagemFalhou;

  const unidadeLabel = unidade
    ? unidade.toLowerCase() === 'un'
      ? 'Unidade'
      : unidade
    : '';

  const meta = [categoria, unidadeLabel].filter(Boolean).join(' • ');

  return (
    <article className="cart-item-row" aria-label={`Item ${item.nome}`}>
      <div className="cart-item-media" aria-hidden="true">
        {exibirImagem ? (
          <img
            src={imagem}
            alt=""
            className="cart-item-image"
            loading="lazy"
            onError={() => setImagemFalhou(true)}
          />
        ) : (
          <span className="cart-item-emoji" aria-hidden="true">{item.emoji || '📦'}</span>
        )}
      </div>

      <div className="cart-item-main">
        <p className="cart-item-name">{item.nome}</p>
        <p className="cart-item-meta">{meta || 'Produto selecionado para o pedido'}</p>
        <p className="cart-item-unitary">
          Unitário: <strong>{formatarMoeda(precoUnitario)}</strong>
        </p>
      </div>

      <div className="cart-item-qty" aria-label={`Quantidade de ${item.nome}`}>
        <button
          type="button"
          className="cart-item-qty-btn"
          onClick={() => onUpdateQuantity(item.id, Math.max(1, quantidade - 1))}
          disabled={quantidade <= 1}
          aria-label={`Diminuir quantidade de ${item.nome}`}
        >
          -
        </button>

        <input
          className="cart-item-qty-input"
          type="number"
          min="1"
          value={quantidade}
          onChange={(event) => {
            const digits = String(event.target.value || '').replace(/\D/g, '');
            const proximaQuantidade = Number.parseInt(digits || '1', 10);
            onUpdateQuantity(item.id, Math.max(1, Number.isFinite(proximaQuantidade) ? proximaQuantidade : 1));
          }}
          aria-label={`Quantidade de ${item.nome}`}
        />

        <button
          type="button"
          className="cart-item-qty-btn"
          onClick={() => onUpdateQuantity(item.id, quantidade + 1)}
          aria-label={`Aumentar quantidade de ${item.nome}`}
        >
          +
        </button>
      </div>

      <div className="cart-item-subtotal">
        <span>Subtotal</span>
        <strong>{formatarMoeda(subtotal)}</strong>
      </div>

      <button
        type="button"
        className="cart-item-remove-btn"
        onClick={() => onRemove(item.id)}
        aria-label={`Remover ${item.nome} do carrinho`}
      >
        Remover
      </button>
    </article>
  );
}

function CheckoutSummaryCard({
  itens,
  subtotal,
  onContinue,
  disabled
}) {
  return (
    <aside className="checkout-cart-summary-card" aria-label="Resumo da etapa de carrinho">
      <p className="checkout-cart-summary-kicker">Resumo do carrinho</p>
      <h3>Pedido parcial</h3>

      <div className="checkout-cart-summary-row">
        <span>Itens</span>
        <strong>{itens}</strong>
      </div>

      <div className="checkout-cart-summary-row">
        <span>Subtotal</span>
        <strong>{formatarMoeda(subtotal)}</strong>
      </div>

      <div className="checkout-cart-summary-divider" aria-hidden="true" />

      <div className="checkout-cart-summary-row is-total">
        <span>Total previsto</span>
        <strong>{formatarMoeda(subtotal)}</strong>
      </div>

      <button
        className="btn-primary checkout-cart-summary-btn"
        type="button"
        onClick={onContinue}
        disabled={disabled}
      >
        Continuar para entrega
      </button>

      <p className="checkout-cart-summary-note">Frete e prazo serão definidos na etapa de entrega.</p>
    </aside>
  );
}

function OrderSummaryCard({
  itens,
  subtotal,
  frete,
  total,
  veiculoLabel,
  className = ''
}) {
  return (
    <aside className={`checkout-order-summary ${className}`.trim()} aria-label="Resumo do pedido">
      <p className="checkout-order-summary-kicker">Resumo do pedido</p>
      <h3>Total da compra</h3>

      <div className="checkout-order-summary-row">
        <span>Itens</span>
        <strong>{itens}</strong>
      </div>

      <div className="checkout-order-summary-row">
        <span>Produtos</span>
        <strong>{formatarMoeda(subtotal)}</strong>
      </div>

      <div className="checkout-order-summary-row">
        <span>Frete</span>
        <strong>{frete === null ? 'A calcular' : formatarMoeda(frete)}</strong>
      </div>

      <div className="checkout-order-summary-row">
        <span>Tipo de entrega</span>
        <strong>{veiculoLabel}</strong>
      </div>

      <div className="checkout-order-summary-divider" aria-hidden="true" />

      <div className="checkout-order-summary-row is-total">
        <span>Total</span>
        <strong>{formatarMoeda(total)}</strong>
      </div>
    </aside>
  );
}

function PaymentMethodCard({
  icon,
  title,
  headline,
  details,
  selecionado,
  onSelect,
  disabled = false
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selecionado}
      className={`payment-method-card ${selecionado ? 'is-selected' : ''}`}
      onClick={onSelect}
      disabled={disabled}
    >
      <div className="payment-method-card-head">
        <p className="payment-method-title-row">
          <span className="payment-method-icon" aria-hidden="true">{icon}</span>
          <span className="payment-method-title">{title}</span>
          {selecionado ? <span className="payment-method-badge">Selecionado</span> : null}
        </p>
        {selecionado ? <span className="payment-method-check" aria-hidden="true">✓</span> : null}
      </div>

      <p className="payment-method-headline">{headline}</p>
      <ul className="payment-method-list">
        {details.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>
    </button>
  );
}

function PaymentSelectionSummary({ title, description }) {
  return (
    <article className="payment-selection-summary" aria-label="Resumo da forma de pagamento selecionada">
      <div className="payment-selection-summary-head">
        <p className="payment-selection-summary-kicker">Forma selecionada</p>
        <h3>{title}</h3>
      </div>

      {description.map((line) => (
        <p className="payment-selection-summary-line" key={line}>{line}</p>
      ))}
    </article>
  );
}

function PaymentOrderSummary({ itens, subtotal, frete, total, metodo }) {
  return (
    <aside className="payment-order-summary" aria-label="Resumo financeiro da etapa de pagamento">
      <p className="payment-order-summary-kicker">Resumo do pedido</p>
      <h3>Quanto você vai pagar</h3>

      <div className="payment-order-summary-row">
        <span>Itens</span>
        <strong>{itens}</strong>
      </div>

      <div className="payment-order-summary-row">
        <span>Produtos</span>
        <strong>{formatarMoeda(subtotal)}</strong>
      </div>

      <div className="payment-order-summary-row">
        <span>Frete</span>
        <strong>{frete === null ? 'A calcular' : formatarMoeda(frete)}</strong>
      </div>

      <div className="payment-order-summary-row">
        <span>Pagamento</span>
        <strong>{metodo}</strong>
      </div>

      <div className="payment-order-summary-divider" aria-hidden="true" />

      <div className="payment-order-summary-row is-total">
        <span>Total</span>
        <strong>{formatarMoeda(total)}</strong>
      </div>
    </aside>
  );
}

function TaxIdInput({ value, onChange, onBlur, requiredError, invalidError, validFeedback }) {
  const feedbackTone = requiredError || invalidError ? 'is-error' : validFeedback ? 'is-valid' : 'is-neutral';
  const feedbackText = requiredError
    ? 'Campo obrigatório para concluir o pagamento.'
    : invalidError
      ? 'Documento inválido. Digite CPF com 11 dígitos ou CNPJ com 14 dígitos.'
      : validFeedback
        ? 'Documento válido para processar o pagamento.'
        : 'Obrigatório para pagamentos via PIX e cartão no PagBank.';

  return (
    <div className={`payment-taxid ${feedbackTone}`.trim()}>
      <label htmlFor="documento-pagador" className="payment-taxid-label">
        CPF/CNPJ do pagador
      </label>

      <input
        id="documento-pagador"
        className="field-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="000.000.000-00 ou 00.000.000/0000-00"
        maxLength={18}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={requiredError || invalidError ? 'true' : undefined}
      />

      <p className={`payment-taxid-feedback ${feedbackTone}`.trim()} role={requiredError || invalidError ? 'alert' : 'status'}>
        {feedbackText}
      </p>
    </div>
  );
}

function PixStatusCard({ statusVisual }) {
  return (
    <article className={`pix-status-card is-${statusVisual.tone}`.trim()} aria-label="Status do pagamento PIX">
      <div className="pix-status-head">
        <p className="pix-status-kicker">Status do pagamento</p>
        <span className={`pix-status-badge is-${statusVisual.tone}`.trim()}>
          <span aria-hidden="true">{statusVisual.icon}</span>
          <strong>{statusVisual.label}</strong>
        </span>
      </div>
      <p className="pix-status-guidance">{statusVisual.guidance}</p>
    </article>
  );
}

function PixQrCodeCard({ qrCodeSrc, carregando }) {
  const estadoQr = carregando ? 'loading' : qrCodeSrc ? 'ready' : 'empty';

  return (
    <article className="pix-qr-card" aria-label="QR Code PIX">
      <p className="pix-card-title">QR Code PIX</p>

      <div className={`pix-qr-frame is-${estadoQr}`.trim()}>
        {carregando ? (
          <div className="pix-qr-placeholder-block" role="status" aria-live="polite">
            <span className="pix-qr-placeholder-icon" aria-hidden="true">⏳</span>
            <p className="pix-qr-placeholder-title">Gerando QR Code...</p>
            <p className="pix-qr-placeholder">Aguarde alguns segundos enquanto criamos o código PIX.</p>
          </div>
        ) : qrCodeSrc ? (
          <img className="pix-qr-image" src={qrCodeSrc} alt="QR Code para pagamento PIX" />
        ) : (
          <div className="pix-qr-placeholder-block">
            <span className="pix-qr-placeholder-icon" aria-hidden="true">◻</span>
            <p className="pix-qr-placeholder-title">QR Code ainda não gerado</p>
            <p className="pix-qr-placeholder">Clique em Gerar QR Code PIX para iniciar o pagamento no app do banco.</p>
          </div>
        )}
      </div>
    </article>
  );
}

function PixCopyCodeCard({ codigoPix, onCopy, feedbackCopia, disabled }) {
  return (
    <article className="pix-copy-card" aria-label="Código PIX copia e cola">
      <p className="pix-card-title">Código PIX copia e cola</p>

      <div className="pix-copy-code-field" role="textbox" aria-readonly="true" tabIndex={0}>
        {codigoPix || 'Gere o QR Code para exibir o código PIX.'}
      </div>

      <button
        className="btn-secondary pix-copy-btn"
        type="button"
        onClick={onCopy}
        disabled={disabled || !codigoPix}
      >
        Copiar código
      </button>

      {feedbackCopia ? (
        <p className="pix-copy-feedback" role="status">{feedbackCopia}</p>
      ) : null}
    </article>
  );
}

function PixInstructionsCard() {
  return (
    <article className="pix-instructions-card" aria-label="Como pagar com PIX">
      <p className="pix-card-title">Como pagar com PIX</p>
      <ol className="pix-instructions-list">
        <li>Abra o app do seu banco.</li>
        <li>Escaneie o QR Code ou copie o código PIX.</li>
        <li>Após o pagamento, clique em verificar para atualizar o status.</li>
      </ol>
    </article>
  );
}

export default function PagamentoPage() {
  const { itens, resumo, updateItemQuantity, removeItem, clearCart } = useCart();
  const [resultadoPedido, setResultadoPedido] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [dadosUsuarioCheckout, setDadosUsuarioCheckout] = useState(null);
  const [resultadoPix, setResultadoPix] = useState(null);
  const [qrCodePixDataUrl, setQrCodePixDataUrl] = useState('');
  const [feedbackCopiaPix, setFeedbackCopiaPix] = useState('');
  const [verificandoStatusPix, setVerificandoStatusPix] = useState(false);
  const [resumoPedidoSnapshot, setResumoPedidoSnapshot] = useState(null);
  const [etapaAtual, setEtapaAtual] = useState(ETAPAS.CARRINHO);
  const [statusPedidoAtual, setStatusPedidoAtual] = useState('');
  const [pagamentoConfirmado, setPagamentoConfirmado] = useState(false);
  const [autenticado, setAutenticado] = useState(null);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [cepEntrega, setCepEntrega] = useState('');
  const [veiculoEntrega, setVeiculoEntrega] = useState('moto');
  const [simulacaoFrete, setSimulacaoFrete] = useState(null);
  const [simulandoFrete, setSimulandoFrete] = useState(false);
  const [erroEntrega, setErroEntrega] = useState('');
  const [enderecoCepEntrega, setEnderecoCepEntrega] = useState(null);
  const [buscandoEnderecoCepEntrega, setBuscandoEnderecoCepEntrega] = useState(false);
  const [erroEnderecoCepEntrega, setErroEnderecoCepEntrega] = useState('');
  const [cepEnderecoConsultado, setCepEnderecoConsultado] = useState('');
  const [documentoPagador, setDocumentoPagador] = useState('');
  const [documentoTocado, setDocumentoTocado] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState('pix');
  const [pagBankPublicKey, setPagBankPublicKey] = useState('');
  const [buscandoChavePublica, setBuscandoChavePublica] = useState(false);
  const [tokenCartao, setTokenCartao] = useState('');
  const [criptografandoCartao, setCriptografandoCartao] = useState(false);
  const [nomeTitularCartao, setNomeTitularCartao] = useState('');
  const [numeroCartao, setNumeroCartao] = useState('');
  const [mesExpiracaoCartao, setMesExpiracaoCartao] = useState('');
  const [anoExpiracaoCartao, setAnoExpiracaoCartao] = useState('');
  const [cvvCartao, setCvvCartao] = useState('');
  const [parcelasCartao, setParcelasCartao] = useState('1');
  const [resultadoCartao, setResultadoCartao] = useState(null);
  const [sessao3DS, setSessao3DS] = useState('');
  const [sessao3DSEnv, setSessao3DSEnv] = useState('SANDBOX');
  const [sessao3DSGeradaEm, setSessao3DSGeradaEm] = useState(0);
  const [status3DS, setStatus3DS] = useState('idle');
  const [resultado3DS, setResultado3DS] = useState(null);
  const [idAutenticacao3DS, setIdAutenticacao3DS] = useState('');
  const [recaptchaCheckoutToken, setRecaptchaCheckoutToken] = useState('');
  const [recaptchaCheckoutErroCarregamento, setRecaptchaCheckoutErroCarregamento] = useState('');
  const recaptchaCheckoutRef = useRef(null);
  const pagandoCartaoRef = useRef(false);
  const buscaEnderecoRef = useRef(0);

  const itensPedido = useMemo(
    () =>
      itens.map((item) => ({
        produto_id: item.id,
        nome: item.nome,
        preco: Number(item.preco || 0),
        quantidade: Number(item.quantidade || 1)
      })),
    [itens]
  );

  const freteAtual = Number(simulacaoFrete?.frete || 0);

  const totalComFreteAtual = useMemo(
    () => Number((Number(resumo.total || 0) + freteAtual).toFixed(2)),
    [resumo.total, freteAtual]
  );

  const freteSelecionado = Number(resultadoPedido?.frete_entrega ?? simulacaoFrete?.frete ?? 0);
  const distanciaSelecionada = Number(resultadoPedido?.distancia_entrega_km ?? simulacaoFrete?.distancia_km ?? 0);
  const distanciaSelecionadaTexto = distanciaSelecionada > 0 ? `${distanciaSelecionada.toFixed(2)} km` : '-';
  const veiculoSelecionadoResumo = VEICULOS_ENTREGA[resultadoPedido?.veiculo_entrega] || VEICULOS_ENTREGA[simulacaoFrete?.veiculo] || VEICULOS_ENTREGA[veiculoEntrega] || VEICULOS_ENTREGA.moto;
  const cepDestinoSelecionado = String(resultadoPedido?.cep_destino_entrega || simulacaoFrete?.cep_destino || formatarCep(cepEntrega) || '-');
  const cepOrigemSelecionado = String(resultadoPedido?.cep_origem_entrega || simulacaoFrete?.cep_origem || CEP_MERCADO);
  const numeroOrigemSelecionado = String(resultadoPedido?.numero_origem_entrega || simulacaoFrete?.numero_origem || NUMERO_MERCADO);
  const totalProdutosPedido = Number(resultadoPedido?.total_produtos ?? resumo.total ?? 0);
  const totalComEntregaPedido = Number(resultadoPedido?.total ?? Number((totalProdutosPedido + freteSelecionado).toFixed(2)));
  const totalReferenciaParcelamento = Number(resultadoPedido?.total ?? totalComFreteAtual ?? 0);
  const parcelamentoCreditoDisponivel = totalReferenciaParcelamento >= PARCELAMENTO_MINIMO_CREDITO;
  const valorMinimoParcelamentoTexto = PARCELAMENTO_MINIMO_CREDITO.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const parcelasCartaoEfetivas = (() => {
    if (formaPagamento === 'debito') {
      return 1;
    }

    if (!parcelamentoCreditoDisponivel) {
      return 1;
    }

    const parcelasSelecionadas = Number.parseInt(parcelasCartao, 10);
    if (!Number.isFinite(parcelasSelecionadas) || parcelasSelecionadas < 1) {
      return 1;
    }

    return Math.min(PARCELAMENTO_MAXIMO_CREDITO, parcelasSelecionadas);
  })();
  const pagamentoCartaoSelecionado = formaPagamento === 'credito' || formaPagamento === 'debito';
  const debitoSelecionado = formaPagamento === 'debito';
  const recaptchaCheckoutEnabled = CHECKOUT_RECAPTCHA_ENABLED && Boolean(RECAPTCHA_SITE_KEY);
  const exibirRecaptchaCheckout = recaptchaCheckoutEnabled
    && autenticado === true
    && (etapaAtual === ETAPAS.PAGAMENTO || etapaAtual === ETAPAS.PIX);
  const tituloFormaPagamento = formaPagamento === 'pix'
    ? 'PIX'
    : formaPagamento === 'debito'
      ? 'Cartão de Débito'
      : 'Cartão de Crédito';
  const sessao3DSValida = Boolean(sessao3DS)
    && Number(sessao3DSGeradaEm) > 0
    && (Date.now() - Number(sessao3DSGeradaEm)) < SESSAO_3DS_TTL_MS;
  const status3DSLabel = STATUS_3DS_LABELS[status3DS] || STATUS_3DS_LABELS.idle;
  const status3DSTone = ['concluida', 'pagamento_aprovado'].includes(status3DS)
    ? 'is-success'
    : ['nao_suportado', 'trocar_metodo', 'erro'].includes(status3DS)
      ? 'is-warning'
      : ['iniciando', 'aguardando_validacao', 'desafio', 'processando_pagamento'].includes(status3DS)
        ? 'is-loading'
        : '';
  const cepEntregaNormalizado = normalizarCep(cepEntrega);
  const cepEntregaValido = cepEntregaNormalizado.length === 8;
  const cepEntregaIncompleto = cepEntregaNormalizado.length > 0 && cepEntregaNormalizado.length < 8;
  const freteCalculado = Boolean(simulacaoFrete);
  const semOpcaoEntregaDisponivel = !simulandoFrete && !simulacaoFrete && erroEntregaEhCobertura(erroEntrega);
  const podeAvancarParaPagamento = itens.length > 0 && freteCalculado && !simulandoFrete && !semOpcaoEntregaDisponivel;
  const veiculoSelecionadoEntrega = VEICULOS_ENTREGA[veiculoEntrega] || VEICULOS_ENTREGA.moto;
  const veiculoRecomendado = useMemo(() => {
    const distancia = Number(simulacaoFrete?.distancia_km || 0);
    if (distancia > 0 && distancia <= LIMITE_BIKE_KM) {
      return 'bike';
    }

    if (Number(resumo.itens || 0) >= 8 || Number(resumo.total || 0) >= 220) {
      return 'carro';
    }

    return 'moto';
  }, [resumo.itens, resumo.total, simulacaoFrete?.distancia_km]);

  // Consolida feedback da simulação para manter mensagens consistentes na UX da entrega.
  const mensagemFrete = useMemo(() => {
    if (simulandoFrete) {
      return { tone: 'loading', text: 'Calculando frete com base no CEP informado...' };
    }

    if (erroEntrega) {
      if (erroEntregaEhCobertura(erroEntrega)) {
        return { tone: 'warning', text: erroEntrega };
      }
      return { tone: 'error', text: erroEntrega };
    }

    if (simulacaoFrete) {
      const distancia = Number(simulacaoFrete.distancia_km || 0).toFixed(2);
      return {
        tone: 'success',
        text: `Frete calculado com sucesso: ${formatarMoeda(freteAtual)} para ${distancia} km.`
      };
    }

    return {
      tone: 'neutral',
      text: 'Digite um CEP válido e escolha o tipo de entrega para calcular o frete.'
    };
  }, [erroEntrega, freteAtual, simulacaoFrete, simulandoFrete]);

  const consultarEnderecoCepEntrega = useCallback(async (cep, { mostrarErro = true } = {}) => {
    const cepNormalizado = normalizarCep(cep);

    if (cepNormalizado.length !== 8) {
      setBuscandoEnderecoCepEntrega(false);
      setEnderecoCepEntrega(null);
      setCepEnderecoConsultado('');
      if (mostrarErro && cepNormalizado.length > 0) {
        setErroEnderecoCepEntrega('Informe um CEP válido com 8 dígitos.');
      } else {
        setErroEnderecoCepEntrega('');
      }
      return null;
    }

    if (cepEnderecoConsultado === cepNormalizado && enderecoCepEntrega) {
      return enderecoCepEntrega;
    }

    // Evita que uma resposta antiga sobrescreva o endereço de um CEP mais novo.
    const requestId = ++buscaEnderecoRef.current;
    setBuscandoEnderecoCepEntrega(true);
    setErroEnderecoCepEntrega('');

    try {
      const endereco = await buscarEnderecoViaCep(cepNormalizado);

      if (requestId !== buscaEnderecoRef.current) {
        return null;
      }

      setEnderecoCepEntrega(endereco);
      setCepEnderecoConsultado(cepNormalizado);
      return endereco;
    } catch (error) {
      if (requestId !== buscaEnderecoRef.current) {
        return null;
      }

      setEnderecoCepEntrega(null);
      setCepEnderecoConsultado('');

      if (mostrarErro) {
        const mensagem = String(error?.message || '').trim();
        if (mensagem === 'CEP não encontrado') {
          setErroEnderecoCepEntrega('Não encontramos endereço para este CEP.');
        } else if (mensagem === 'CEP inválido') {
          setErroEnderecoCepEntrega('Informe um CEP válido com 8 dígitos.');
        } else {
          setErroEnderecoCepEntrega(mensagem || 'Não foi possível consultar o endereço deste CEP.');
        }
      }

      return null;
    } finally {
      if (requestId === buscaEnderecoRef.current) {
        setBuscandoEnderecoCepEntrega(false);
      }
    }
  }, [cepEnderecoConsultado, enderecoCepEntrega]);

  useEffect(() => {
    const cepNormalizado = cepEntregaNormalizado;

    if (!cepNormalizado) {
      setEnderecoCepEntrega(null);
      setErroEnderecoCepEntrega('');
      setBuscandoEnderecoCepEntrega(false);
      setCepEnderecoConsultado('');
      return;
    }

    if (cepNormalizado.length !== 8) {
      setEnderecoCepEntrega(null);
      setErroEnderecoCepEntrega('');
      setBuscandoEnderecoCepEntrega(false);
      setCepEnderecoConsultado('');
      return;
    }

    const timer = setTimeout(() => {
      // Busca automática do endereço assim que o CEP fica completo.
      void consultarEnderecoCepEntrega(cepNormalizado, { mostrarErro: true });
    }, 260);

    return () => clearTimeout(timer);
  }, [cepEntregaNormalizado, consultarEnderecoCepEntrega]);

  useEffect(() => {
    if (formaPagamento !== 'credito') {
      return;
    }

    if (!parcelamentoCreditoDisponivel && parcelasCartao !== '1') {
      setParcelasCartao('1');
      return;
    }

    const parcelasSelecionadas = Number.parseInt(parcelasCartao, 10);
    if (Number.isFinite(parcelasSelecionadas) && parcelasSelecionadas > PARCELAMENTO_MAXIMO_CREDITO) {
      setParcelasCartao(String(PARCELAMENTO_MAXIMO_CREDITO));
    }
  }, [formaPagamento, parcelamentoCreditoDisponivel, parcelasCartao]);

  useEffect(() => {
    let ativo = true;
    setVerificandoSessao(true);

    getMe()
      .then((data) => {
        if (ativo) {
          setAutenticado(true);
          const usuario = data?.usuario || null;
          setDadosUsuarioCheckout(usuario);

          const nomeUsuario = String(usuario?.nome || '').trim();
          if (nomeUsuario) {
            setNomeTitularCartao((atual) => {
              const atualNormalizado = String(atual || '').trim();
              return atualNormalizado || nomeUsuario;
            });
          }
        }
      })
      .catch((error) => {
        if (!ativo) {
          return;
        }

        if (isAuthErrorMessage(error.message)) {
          setAutenticado(false);
        } else {
          setAutenticado(false);
          setErro(error.message || 'Não foi possível validar sua sessão.');
        }
      })
      .finally(() => {
        if (ativo) {
          setVerificandoSessao(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!resultadoPedido?.pedido_id || autenticado !== true) {
      return;
    }

    let ativo = true;

    async function atualizarStatus() {
      try {
        const data = await getPedidos();
        const pedido = (data.pedidos || []).find((item) => Number(item.id) === Number(resultadoPedido.pedido_id));
        if (ativo && pedido?.status) {
          const novoStatus = String(pedido.status);
          setStatusPedidoAtual(novoStatus);
          if (novoStatus === 'pago' || novoStatus === 'entregue') {
            setPagamentoConfirmado(true);
          }
        }
      } catch (error) {
        if (isAuthErrorMessage(error.message)) {
          setAutenticado(false);
        }
      }
    }

    atualizarStatus();
    const interval = setInterval(atualizarStatus, 15000);

    return () => {
      ativo = false;
      clearInterval(interval);
    };
  }, [resultadoPedido?.pedido_id, autenticado]);

  async function executarSimulacaoFrete({ mostrarErro = true } = {}) {
    const cepNormalizado = normalizarCep(cepEntrega);
    if (cepNormalizado.length !== 8) {
      const mensagem = 'Informe um CEP válido com 8 dígitos.';
      setSimulacaoFrete(null);
      if (mostrarErro) {
        setErroEntrega(mensagem);
      }
      return null;
    }

    if (!enderecoCepEntrega || cepEnderecoConsultado !== cepNormalizado) {
      void consultarEnderecoCepEntrega(cepNormalizado, { mostrarErro: false });
    }

    setErroEntrega('');
    setSimulandoFrete(true);

    try {
      const data = await simularFretePorCep({
        cep: cepNormalizado,
        veiculo: veiculoEntrega
      });
      setSimulacaoFrete(data);
      return data;
    } catch (error) {
      setSimulacaoFrete(null);
      if (mostrarErro) {
        setErroEntrega(error.message || 'Não foi possível calcular o frete pelo CEP.');
      }
      return null;
    } finally {
      setSimulandoFrete(false);
    }
  }

  function limparResultadoAutenticacao3DS() {
    setStatus3DS('idle');
    setResultado3DS(null);
    setIdAutenticacao3DS('');
  }

  function limparTokenCartaoGerado() {
    setTokenCartao('');
    setResultadoCartao(null);
    limparResultadoAutenticacao3DS();
  }

  function resetRecaptchaCheckout() {
    setRecaptchaCheckoutToken('');
    setRecaptchaCheckoutErroCarregamento('');

    if (recaptchaCheckoutRef.current && typeof recaptchaCheckoutRef.current.reset === 'function') {
      recaptchaCheckoutRef.current.reset();
    }
  }

  function obterRecaptchaCheckoutTokenObrigatorio() {
    if (!recaptchaCheckoutEnabled) {
      return '';
    }

    const token = String(recaptchaCheckoutToken || '').trim();
    if (token) {
      return token;
    }

    throw new Error(
      recaptchaCheckoutErroCarregamento
      || 'Confirme o reCAPTCHA de segurança antes de continuar.'
    );
  }

  function erroIndicaSessao3DSExpirada(error) {
    const detail = error?.detail || {};
    const statusCode = Number(detail?.httpStatus || error?.status || 0);
    const mensagem = String(detail?.message || error?.message || '').toLowerCase();

    if (statusCode === 401 || statusCode === 403) {
      return true;
    }

    return mensagem.includes('session')
      && (mensagem.includes('expir') || mensagem.includes('invalid') || mensagem.includes('unauthorized'));
  }

  async function obterSessao3DSComRenovacao({ forceRefresh = false, pedidoId } = {}) {
    if (!forceRefresh && sessao3DSValida) {
      return {
        session: sessao3DS,
        env: sessao3DSEnv
      };
    }

    const referencia = pedidoId ? `pedido_${pedidoId}` : '';
    const data = await criarSessao3DSPagBank({ referenceId: referencia });
    const session = String(data?.session || '').trim();
    const env = String(data?.env || 'SANDBOX').trim().toUpperCase() || 'SANDBOX';

    if (!session) {
      throw new Error('Nao foi possivel iniciar a sessao de autenticacao 3DS.');
    }

    setSessao3DS(session);
    setSessao3DSEnv(env);
    setSessao3DSGeradaEm(Date.now());

    return {
      session,
      env
    };
  }

  function montarRequestAutenticacao3DS() {
    const numeroCartaoLimpo = normalizarNumeroCartao(numeroCartao);
    const mes = formatarMesCartao(mesExpiracaoCartao);
    const ano = formatarAnoCartao(anoExpiracaoCartao);
    const nomeHolder = String(nomeTitularCartao || dadosUsuarioCheckout?.nome || 'Cliente').trim() || 'Cliente';
    const nomeCliente = String(dadosUsuarioCheckout?.nome || nomeHolder || 'Cliente').trim() || 'Cliente';
    const emailCliente = String(dadosUsuarioCheckout?.email || 'cliente@example.com').trim() || 'cliente@example.com';
    const telefoneCliente = normalizarTelefonePara3DS(dadosUsuarioCheckout?.telefone) || {
      country: '55',
      area: '11',
      number: '999999999',
      type: 'MOBILE'
    };
    const valorCentavos = Math.max(1, Math.round(Number(resultadoPedido?.total || totalComEntregaPedido || 0) * 100));
    const endereco3DS = construirEndereco3DS({
      endereco: enderecoCepEntrega,
      cepFallback: cepEntrega
    });

    return {
      data: {
        customer: {
          name: nomeCliente,
          email: emailCliente,
          phones: [telefoneCliente]
        },
        paymentMethod: {
          type: 'DEBIT_CARD',
          installments: 1,
          card: {
            number: numeroCartaoLimpo,
            expMonth: mes,
            expYear: ano,
            holder: {
              name: nomeHolder
            }
          }
        },
        amount: {
          value: valorCentavos,
          currency: 'BRL'
        },
        billingAddress: endereco3DS,
        shippingAddress: endereco3DS,
        dataOnly: false
      },
      beforeChallenge: ({ open, brand, issuer } = {}) => {
        setStatus3DS('desafio');

        if (IS_DEVELOPMENT) {
          console.info('[debit_3ds_auth.before_challenge]', {
            brand,
            issuer
          });
        }

        if (typeof open === 'function') {
          open();
        }
      }
    };
  }

  async function executarAutenticacao3DSDebito({ pedidoId, documentoDigits } = {}) {
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      const forceRefresh = tentativa > 0;

      try {
        setStatus3DS('iniciando');
        const sessaoAtual = await obterSessao3DSComRenovacao({
          forceRefresh,
          pedidoId
        });

        await configurarSessao3DSPagBank({
          session: sessaoAtual.session,
          env: sessaoAtual.env
        });

        setStatus3DS('aguardando_validacao');
        const request3DS = montarRequestAutenticacao3DS();
        const resultado = await autenticar3DSPagBank(request3DS);
        const status = String(resultado?.status || '').trim().toUpperCase();
        const authId = String(resultado?.id || '').trim();
        const traceId = String(
          resultado?.traceId
            || resultado?.trace_id
            || resultado?.detail?.traceId
            || resultado?.detail?.trace_id
            || ''
        ).trim() || null;

        if (IS_DEVELOPMENT) {
          console.info('[debit_3ds_auth.result]', {
            status,
            authId: authId || null,
            traceId
          });
        }

        setResultado3DS({
          status,
          id: authId || null,
          trace_id: traceId
        });

        if (status === 'AUTH_FLOW_COMPLETED') {
          if (!authId) {
            setStatus3DS('erro');
            throw new Error('A autenticacao 3DS foi concluida sem id valido. Tente novamente.');
          }

          setIdAutenticacao3DS(authId);
          setStatus3DS('concluida');

          return {
            status,
            authenticationMethod: {
              type: 'THREEDS',
              id: authId
            },
            traceId
          };
        }

        if (status === 'AUTH_NOT_SUPPORTED') {
          setStatus3DS('nao_suportado');
          throw new Error('Seu cartao de debito nao e elegivel para autenticacao 3DS. Escolha outro meio de pagamento.');
        }

        if (status === 'CHANGE_PAYMENT_METHOD') {
          setStatus3DS('trocar_metodo');
          throw new Error('A autenticacao 3DS foi negada. Escolha outro meio de pagamento.');
        }

        if (status === 'REQUIRE_CHALLENGE') {
          setStatus3DS('desafio');
          throw new Error('Conclua o desafio 3DS para continuar o pagamento no debito.');
        }

        setStatus3DS('erro');
        throw new Error('Nao foi possivel concluir a autenticacao 3DS. Tente novamente.');
      } catch (error) {
        if (IS_DEVELOPMENT) {
          console.error('[debit_3ds_auth.error]', {
            message: error?.message,
            detail: error?.detail || null
          });
        }

        if (tentativa === 0 && erroIndicaSessao3DSExpirada(error)) {
          setSessao3DS('');
          setSessao3DSGeradaEm(0);
          continue;
        }

        throw error;
      }
    }

    setStatus3DS('erro');
    throw new Error('Sessao 3DS expirada. Gere uma nova autenticacao e tente novamente.');
  }

  async function carregarChavePublicaPagBank() {
    if (pagBankPublicKey) {
      return pagBankPublicKey;
    }

    setBuscandoChavePublica(true);
    try {
      const data = await getPagBankPublicKey();
      const chave = String(data?.public_key || '').trim();
      if (!chave) {
        throw new Error('Não foi possível iniciar o pagamento com cartão no momento.');
      }

      setPagBankPublicKey(chave);
      return chave;
    } finally {
      setBuscandoChavePublica(false);
    }
  }

  async function handleCriptografarCartao() {
    setErro('');

    if (!pagamentoCartaoSelecionado) {
      return '';
    }

    const holder = String(nomeTitularCartao || '').trim();
    const number = normalizarNumeroCartao(numeroCartao);
    const expMonth = formatarMesCartao(mesExpiracaoCartao);
    const expYear = formatarAnoCartao(anoExpiracaoCartao);
    const securityCode = formatarCvvCartao(cvvCartao);

    if (holder.length < 3) {
      throw new Error('Informe o nome completo do titular do cartão.');
    }

    if (number.length < 13) {
      throw new Error('Número do cartão inválido.');
    }

    const mes = Number.parseInt(expMonth, 10);
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw new Error('Mês de expiração inválido.');
    }

    if (expYear.length !== 4) {
      throw new Error('Ano de expiração inválido.');
    }

    if (![3, 4].includes(securityCode.length)) {
      throw new Error('CVV inválido.');
    }

    setCriptografandoCartao(true);
    try {
      const publicKey = await carregarChavePublicaPagBank();
      const encryptedCard = await criptografarCartaoPagBank({
        publicKey,
        holder,
        number,
        expMonth,
        expYear,
        securityCode
      });

      setTokenCartao(encryptedCard);
      return encryptedCard;
    } finally {
      setCriptografandoCartao(false);
    }
  }

  async function handleCriarPedido() {
    setResultadoPix(null);
    setResultadoCartao(null);
    limparResultadoAutenticacao3DS();
    setSessao3DS('');
    setSessao3DSEnv('SANDBOX');
    setSessao3DSGeradaEm(0);
    setResultadoPedido(null);
    setResumoPedidoSnapshot(null);
    setQrCodePixDataUrl('');
    setFeedbackCopiaPix('');
    setErro('');

    if (autenticado !== true) {
      setAutenticado(false);
      setErro('Faça login para concluir o pedido.');
      return;
    }

    if (itensPedido.length === 0) {
      setErro('Adicione produtos ao carrinho para continuar.');
      return;
    }

    const cepNormalizado = normalizarCep(cepEntrega);
    if (cepNormalizado.length !== 8) {
      setErroEntrega('Informe um CEP válido com 8 dígitos para calcular a entrega.');
      setEtapaAtual(ETAPAS.ENTREGA);
      return;
    }

    let freteSimulado = simulacaoFrete;
    const cepSimulacaoAtual = normalizarCep(simulacaoFrete?.cep_destino);
    const veiculoSimulacaoAtual = String(simulacaoFrete?.veiculo || '').toLowerCase();
    const precisaNovaSimulacao = !freteSimulado || cepSimulacaoAtual !== cepNormalizado || veiculoSimulacaoAtual !== veiculoEntrega;

    if (precisaNovaSimulacao) {
      freteSimulado = await executarSimulacaoFrete();
      if (!freteSimulado) {
        setEtapaAtual(ETAPAS.ENTREGA);
        return;
      }
    }

    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    const documentoValido = documentoDigits.length === 11 || documentoDigits.length === 14;
    if (!documentoValido) {
      setErro(`Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para pagamento via ${formaPagamento === 'pix' ? 'PIX' : 'cartão'}.`);
      setEtapaAtual(ETAPAS.PAGAMENTO);
      return;
    }

    if (pagamentoCartaoSelecionado) {
      try {
        await carregarChavePublicaPagBank();
      } catch (error) {
        setErro(error.message || 'Não foi possível preparar o pagamento com cartão.');
        setEtapaAtual(ETAPAS.PAGAMENTO);
        return;
      }
    }

    let recaptchaTokenAcao = '';
    try {
      recaptchaTokenAcao = obterRecaptchaCheckoutTokenObrigatorio();
    } catch (error) {
      setErro(error.message || 'Confirme o reCAPTCHA de segurança para continuar.');
      return;
    }

    setCarregando(true);
    try {
      const data = await criarPedido({
        itens: itensPedido,
        formaPagamento,
        taxId: documentoDigits,
        recaptchaToken: recaptchaTokenAcao,
        entrega: {
          veiculo: veiculoEntrega,
          cep_destino: formatarCep(cepNormalizado),
          frete_estimado: Number(freteSimulado?.frete || 0),
          distancia_km: Number(freteSimulado?.distancia_km || 0),
          fator_reparo: VEICULOS_ENTREGA[veiculoEntrega]?.fatorReparo || 1
        }
      });

      setResultadoPedido(data);
      const itensSnapshot = itensPedido.reduce((accumulator, item) => {
        return accumulator + Number(item.quantidade || 0);
      }, 0);
      setResumoPedidoSnapshot({
        itens: itensSnapshot,
        subtotal: Number(data?.total_produtos ?? resumo.total ?? 0),
        frete: Number(data?.frete_entrega ?? freteSimulado?.frete ?? 0)
      });
      const formaRetornada = String(data?.forma_pagamento || formaPagamento || '').toLowerCase();
      if (formaRetornada === 'debito') {
        setFormaPagamento('debito');
      } else if (['cartao', 'credito'].includes(formaRetornada)) {
        setFormaPagamento('credito');
      } else {
        setFormaPagamento('pix');
      }
      setStatusPedidoAtual('pendente');
      clearCart();
      setEtapaAtual(ETAPAS.PIX);

      if (formaPagamento === 'pix' && (data?.pix_codigo || data?.pix_qrcode)) {
        setResultadoPix({
          status: data.pix_erro ? 'CANCELED' : 'WAITING',
          status_interno: data?.pix_erro ? 'cancelado' : 'pendente',
          qr_data: data?.pix_codigo || '',
          qr_code_base64: data?.qr_code_base64 || null,
          pix_codigo: data?.pix_codigo || '',
          pix_qrcode: data?.pix_qrcode || ''
        });
      }
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }
      setErro(error.message);
    } finally {
      setCarregando(false);
      if (recaptchaCheckoutEnabled) {
        resetRecaptchaCheckout();
      }
    }
  }

  async function handleIrParaPagamento() {
    if (resultadoPedido?.pedido_id) {
      setEtapaAtual(ETAPAS.PIX);
      return;
    }
    await handleCriarPedido();
  }

  async function handleContinuarPagamento() {
    setDocumentoTocado(true);

    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    if (!(documentoDigits.length === 11 || documentoDigits.length === 14)) {
      setErro(`Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para pagamento via ${formaPagamento === 'pix' ? 'PIX' : 'cartão'}.`);
      return;
    }

    setErro('');
    await handleIrParaPagamento();
  }

  async function handleGerarPix(pedidoId) {
    setResultadoPix(null);
    setFeedbackCopiaPix('');
    setErro('');

    let recaptchaTokenAcao = '';
    try {
      recaptchaTokenAcao = obterRecaptchaCheckoutTokenObrigatorio();
    } catch (error) {
      setErro(error.message || 'Confirme o reCAPTCHA de segurança para gerar o PIX.');
      return;
    }

    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    const documentoValido = documentoDigits.length === 11 || documentoDigits.length === 14;
    if (!documentoValido) {
      setErro('Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para gerar o PIX.');
      return;
    }

    setCarregando(true);
    try {
      const data = await gerarPix(pedidoId, documentoDigits, recaptchaTokenAcao);
      setResultadoPix({
        ...data,
        status: String(data?.status || 'WAITING').toUpperCase(),
        qr_data: String(data?.qr_data || data?.pix_codigo || '').trim(),
        pix_codigo: String(data?.pix_codigo || data?.qr_data || '').trim(),
        pix_qrcode: String(data?.pix_qrcode || '').trim()
      });
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }
      setErro(error.message);
    } finally {
      setCarregando(false);
      if (recaptchaCheckoutEnabled) {
        resetRecaptchaCheckout();
      }
    }
  }

  async function handleVerificarPagamentoPix() {
    if (!resultadoPedido?.pedido_id) {
      return;
    }

    setErro('');
    setVerificandoStatusPix(true);

    try {
      const data = await getPedidos();
      const pedidoAtual = (data?.pedidos || []).find((item) => Number(item.id) === Number(resultadoPedido.pedido_id));
      if (!pedidoAtual) {
        throw new Error('Não foi possível localizar o pedido para verificar o pagamento.');
      }

      const statusInterno = String(pedidoAtual.status || '').toLowerCase();
      setStatusPedidoAtual(statusInterno);

      const aprovado = statusInterno === 'pago' || statusInterno === 'entregue';
      setPagamentoConfirmado(aprovado);

      setResultadoPix((atual) => {
        if (!atual) {
          return atual;
        }

        return {
          ...atual,
          status: aprovado
            ? 'PAID'
            : statusInterno === 'cancelado'
              ? 'CANCELED'
              : String(atual.status || 'WAITING').toUpperCase(),
          status_interno: statusInterno
        };
      });
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }
      setErro(error.message || 'Não foi possível atualizar o status do pagamento PIX.');
    } finally {
      setVerificandoStatusPix(false);
    }
  }

  async function handleCopiarCodigoPix() {
    if (!codigoPixAtual) {
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(codigoPixAtual);
      } else {
        const campoTemporario = document.createElement('textarea');
        campoTemporario.value = codigoPixAtual;
        campoTemporario.setAttribute('readonly', '');
        campoTemporario.style.position = 'absolute';
        campoTemporario.style.left = '-9999px';
        document.body.appendChild(campoTemporario);
        campoTemporario.select();
        document.execCommand('copy');
        document.body.removeChild(campoTemporario);
      }

      setFeedbackCopiaPix('Código copiado com sucesso.');
    } catch {
      setFeedbackCopiaPix('Não foi possível copiar automaticamente. Selecione e copie manualmente.');
    }
  }

  async function handlePagarCartao(pedidoId) {
    if (pagandoCartaoRef.current || carregando || criptografandoCartao) {
      return;
    }

    setResultadoCartao(null);
    setErro('');

    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    const documentoValido = documentoDigits.length === 11 || documentoDigits.length === 14;
    if (!documentoValido) {
      setErro('Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para pagamento com cartão.');
      return;
    }

    let recaptchaTokenAcao = '';
    try {
      recaptchaTokenAcao = obterRecaptchaCheckoutTokenObrigatorio();
    } catch (error) {
      setErro(error.message || 'Confirme o reCAPTCHA de segurança para continuar no cartão.');
      return;
    }

    pagandoCartaoRef.current = true;

    let tokenNormalizado = String(tokenCartao || '').trim();
    if (!tokenNormalizado) {
      try {
        tokenNormalizado = await handleCriptografarCartao();
      } catch (error) {
        setErro(error.message || 'Não foi possível validar os dados do cartão.');
        pagandoCartaoRef.current = false;
        return;
      }
    }

    setCarregando(true);
    try {
      let authenticationMethod = null;
      let threeDSResultPayload = null;

      if (debitoSelecionado) {
        const resultadoAutenticacao = await executarAutenticacao3DSDebito({
          pedidoId,
          documentoDigits
        });

        authenticationMethod = resultadoAutenticacao?.authenticationMethod || null;
        threeDSResultPayload = {
          flow: 'debit_3ds_auth',
          status: resultadoAutenticacao?.status || null,
          id: authenticationMethod?.id || null,
          trace_id: resultadoAutenticacao?.traceId || null
        };
        setStatus3DS('processando_pagamento');
      }

      const data = await pagarCartao(pedidoId, {
        taxId: documentoDigits,
        tokenCartao: tokenNormalizado,
        parcelas: parcelasCartaoEfetivas,
        tipoCartao: formaPagamento,
        authenticationMethod,
        threeDSResult: threeDSResultPayload,
        recaptchaToken: recaptchaTokenAcao
      });

      setResultadoCartao(data);

      const statusPagBank = String(data?.status || '').toUpperCase();
      const statusInterno = String(data?.status_interno || '').toLowerCase();
      if (statusPagBank === 'PAID' || statusInterno === 'pago' || statusInterno === 'entregue') {
        setStatusPedidoAtual(statusInterno || 'pago');
        setPagamentoConfirmado(true);

        if (debitoSelecionado) {
          setStatus3DS('pagamento_aprovado');
        }
      }
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }

      if (debitoSelecionado) {
        setStatus3DS((atual) => (
          ['nao_suportado', 'trocar_metodo', 'pagamento_aprovado'].includes(atual)
            ? atual
            : 'erro'
        ));
      }

      setErro(error.message);
    } finally {
      setCarregando(false);
      pagandoCartaoRef.current = false;
      if (recaptchaCheckoutEnabled) {
        resetRecaptchaCheckout();
      }
    }
  }

  function getIndiceEtapa(etapa) {
    if (etapa === ETAPAS.CARRINHO) return 0;
    if (etapa === ETAPAS.ENTREGA) return 1;
    // PIX permanece dentro da etapa de Pagamento no stepper.
    if (etapa === ETAPAS.PAGAMENTO || etapa === ETAPAS.PIX) return 2;
    return 3;
  }

  const etapaIndex = getIndiceEtapa(etapaAtual);
  const labelStatus = formatarStatusPedido(statusPedidoAtual || resultadoPedido?.status || 'pendente');
  const carrinhoVazio = itens.length === 0;
  const statusCartaoAtual = String(resultadoCartao?.status || '').toUpperCase();
  const statusInternoCartaoAtual = String(resultadoCartao?.status_interno || '').toLowerCase();
  const cartaoRecusado = statusCartaoAtual === 'DECLINED' || statusCartaoAtual === 'CANCELED';
  const cartaoProcessado = Boolean(resultadoCartao) && !cartaoRecusado;
  const cartaoAprovado = statusCartaoAtual === 'PAID' || statusInternoCartaoAtual === 'pago' || statusInternoCartaoAtual === 'entregue';
  const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
  const documentoValidoPagamento = documentoDigits.length === 11 || documentoDigits.length === 14;
  const documentoObrigatorioNaoPreenchido = documentoTocado && documentoDigits.length === 0;
  const documentoInvalidoPagamento = documentoTocado && documentoDigits.length > 0 && !documentoValidoPagamento;
  const documentoValidoFeedback = documentoTocado && documentoValidoPagamento;
  const recaptchaCheckoutPronto = !recaptchaCheckoutEnabled || Boolean(String(recaptchaCheckoutToken || '').trim());
  const nomeTitularCartaoValido = String(nomeTitularCartao || '').trim().length >= 3;
  const numeroCartaoValido = normalizarNumeroCartao(numeroCartao).length >= 13;
  const mesCartaoNumero = Number.parseInt(formatarMesCartao(mesExpiracaoCartao), 10);
  const mesCartaoValido = Number.isInteger(mesCartaoNumero) && mesCartaoNumero >= 1 && mesCartaoNumero <= 12;
  const anoCartaoNormalizado = formatarAnoCartao(anoExpiracaoCartao);
  const anoCartaoNumero = Number.parseInt(anoCartaoNormalizado, 10);
  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;
  const anoCartaoValido = anoCartaoNormalizado.length === 4
    && Number.isInteger(anoCartaoNumero)
    && (anoCartaoNumero > anoAtual || (anoCartaoNumero === anoAtual && mesCartaoValido && mesCartaoNumero >= mesAtual));
  const cvvCartaoValido = [3, 4].includes(formatarCvvCartao(cvvCartao).length);
  const dadosCartaoCompletos = nomeTitularCartaoValido && numeroCartaoValido && mesCartaoValido && anoCartaoValido && cvvCartaoValido;
  const cartaoProntoParaContinuar = !pagamentoCartaoSelecionado || Boolean(tokenCartao) || dadosCartaoCompletos;
  const formaPagamentoAtual = FORMAS_PAGAMENTO_OPCOES[formaPagamento] || FORMAS_PAGAMENTO_OPCOES.pix;
  const resumoFretePagamento = resultadoPedido?.pedido_id ? freteSelecionado : simulacaoFrete ? freteAtual : null;
  const resumoTotalPagamento = resultadoPedido?.pedido_id ? totalComEntregaPedido : simulacaoFrete ? totalComFreteAtual : Number(resumo.total || 0);
  const resumoItensPagamento = Number(resultadoPedido?.itens_count || resumoPedidoSnapshot?.itens || resumo.itens || 0);
  const pagamentoSemFreteCalculado = !resultadoPedido?.pedido_id && !simulacaoFrete;
  const pagamentoSemItens = itens.length === 0 && !resultadoPedido?.pedido_id;
  const bloqueioPagamento = pagamentoSemItens
    || pagamentoSemFreteCalculado
    || carregando
    || simulandoFrete
    || buscandoChavePublica
    || !documentoValidoPagamento
    || !recaptchaCheckoutPronto
    || (pagamentoCartaoSelecionado && !cartaoProntoParaContinuar);
  const mensagemBloqueioPagamento = pagamentoSemItens
    ? 'Seu carrinho está vazio. Adicione produtos para seguir com o pagamento.'
    : pagamentoSemFreteCalculado
      ? 'Frete ainda não calculado. Volte para entrega e calcule o CEP para continuar.'
      : documentoDigits.length === 0
        ? 'Informe CPF/CNPJ para habilitar a continuação.'
        : !documentoValidoPagamento
          ? 'Documento inválido. Use CPF com 11 dígitos ou CNPJ com 14 dígitos.'
          : !recaptchaCheckoutPronto
            ? 'Confirme o reCAPTCHA de seguranca para habilitar a continuacao.'
          : pagamentoCartaoSelecionado && !cartaoProntoParaContinuar
            ? 'Complete os dados do cartão para habilitar a continuação.'
        : '';
  const codigoPixAtual = String(resultadoPix?.qr_data || resultadoPix?.pix_codigo || resultadoPedido?.pix_codigo || '').trim();
  const qrCodeBase64Atual = String(resultadoPix?.qr_code_base64 || '').trim();
  const qrCodeRemotoAtual = String(resultadoPix?.pix_qrcode || resultadoPedido?.pix_qrcode || '').trim();
  const qrCodePixSrc = qrCodeBase64Atual
    ? `data:image/png;base64,${qrCodeBase64Atual}`
    : qrCodeRemotoAtual || qrCodePixDataUrl;
  const statusPixVisual = obterStatusPixVisual({
    status: resultadoPix?.status,
    statusInterno: resultadoPix?.status_interno || statusPedidoAtual || resultadoPedido?.status,
    pagamentoConfirmado
  });
  const pixPagamentoAprovado = statusPixVisual.aprovado;
  const textoBotaoGerarPix = carregando
    ? 'Gerando QR Code PIX...'
    : codigoPixAtual || qrCodePixSrc
      ? 'Atualizar QR Code'
      : 'Gerar QR Code PIX';
  const checklistPagamento = [
    {
      id: 'itens',
      label: 'Itens do pedido prontos',
      ok: !pagamentoSemItens || Boolean(resultadoPedido?.pedido_id)
    },
    {
      id: 'frete',
      label: 'Frete calculado',
      ok: !pagamentoSemFreteCalculado
    },
    {
      id: 'documento',
      label: 'CPF/CNPJ válido',
      ok: documentoValidoPagamento
    },
    {
      id: 'recaptcha',
      label: 'Validacao reCAPTCHA concluida',
      ok: recaptchaCheckoutPronto
    },
    pagamentoCartaoSelecionado
      ? {
        id: 'cartao',
        label: tokenCartao ? 'Dados do cartão validados' : 'Dados do cartão preenchidos',
        ok: cartaoProntoParaContinuar
      }
      : null
  ].filter(Boolean);
  const itensResumoPix = Number(resultadoPedido?.itens_count || resumoPedidoSnapshot?.itens || 0);
  const itensResumoPixExibicao = itensResumoPix > 0
    ? itensResumoPix
    : resumoItensPagamento > 0
      ? resumoItensPagamento
      : '—';
  const podeContinuarConfirmacaoPix = pixPagamentoAprovado || pagamentoConfirmado;
  const bloqueioGeracaoPix = carregando || verificandoStatusPix || !resultadoPedido?.pedido_id || !recaptchaCheckoutPronto;
  const bloqueioVerificacaoPix = verificandoStatusPix || carregando || !resultadoPedido?.pedido_id;
  const pixDisponivelParaPagar = Boolean(codigoPixAtual || qrCodePixSrc);

  useEffect(() => {
    if (!feedbackCopiaPix) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setFeedbackCopiaPix('');
    }, 2200);

    return () => clearTimeout(timeout);
  }, [feedbackCopiaPix]);

  useEffect(() => {
    let ativo = true;

    if (qrCodeBase64Atual || qrCodeRemotoAtual || !codigoPixAtual) {
      setQrCodePixDataUrl('');
      return () => {
        ativo = false;
      };
    }

    QRCode.toDataURL(codigoPixAtual, {
      width: 360,
      margin: 1,
      errorCorrectionLevel: 'M'
    })
      .then((dataUrl) => {
        if (ativo) {
          setQrCodePixDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (ativo) {
          setQrCodePixDataUrl('');
        }
      });

    return () => {
      ativo = false;
    };
  }, [codigoPixAtual, qrCodeBase64Atual, qrCodeRemotoAtual]);

  if (verificandoSessao) {
    return (
      <section className="page">
        <h1>Finalizar pedido</h1>
        <p>Validando sua sessão...</p>
      </section>
    );
  }

  return (
    <section className="page checkout-page">
      <h1>Finalizar pedido</h1>
      <p>Revise seu carrinho, confirme a entrega, escolha o pagamento e acompanhe a confirmação do pedido.</p>

      <CheckoutStepper currentIndex={etapaIndex} />

      {erro ? <p className="error-text">{erro}</p> : null}

      {exibirRecaptchaCheckout ? (
        <section className="checkout-recaptcha-banner" aria-label="Validacao antiabuso">
          <p className="checkout-recaptcha-title">Validacao de seguranca</p>
          <p className="checkout-recaptcha-description">
            Confirme o reCAPTCHA antes de concluir pedido, gerar PIX ou pagar com cartao.
          </p>

          <ReCAPTCHA
            ref={recaptchaCheckoutRef}
            sitekey={RECAPTCHA_SITE_KEY}
            hl="pt-BR"
            onChange={(token) => {
              setRecaptchaCheckoutToken(String(token || '').trim());
              if (token) {
                setRecaptchaCheckoutErroCarregamento('');
              }
            }}
            onExpired={() => setRecaptchaCheckoutToken('')}
            onErrored={() => {
              setRecaptchaCheckoutToken('');
              setRecaptchaCheckoutErroCarregamento(
                'Nao foi possivel validar o reCAPTCHA neste dominio. Confira os dominios permitidos na chave do Google.'
              );
            }}
          />

          {recaptchaCheckoutErroCarregamento ? (
            <p className="error-text">{recaptchaCheckoutErroCarregamento}</p>
          ) : (
            <p className="muted-text">A validacao pode expirar; refaca o reCAPTCHA se necessario.</p>
          )}
        </section>
      ) : null}

      {etapaAtual === ETAPAS.CARRINHO ? (
        <div className="checkout-cart-layout">
          <div className="card-box checkout-cart-main">
            <div className="checkout-cart-header">
              <p className="checkout-cart-kicker">Etapa 1</p>
              <h2>Carrinho</h2>
              <p className="muted-text">Revise os itens, ajuste quantidades e confirme o total antes de seguir para a entrega.</p>
            </div>

            {carrinhoVazio ? (
              <div className="checkout-cart-empty-state" role="status">
                <span className="checkout-cart-empty-icon" aria-hidden="true">🛒</span>
                <div>
                  <strong>Seu carrinho está vazio.</strong>
                  <p>Adicione produtos para continuar com a finalização do pedido.</p>
                </div>
              </div>
            ) : (
              <div className="checkout-cart-items-list">
                {itens.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onUpdateQuantity={updateItemQuantity}
                    onRemove={removeItem}
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="checkout-cart-side">
            <CheckoutSummaryCard
              itens={resumo.itens}
              subtotal={resumo.total}
              onContinue={() => setEtapaAtual(ETAPAS.ENTREGA)}
              disabled={carrinhoVazio}
            />

            <div className="card-box checkout-cart-side-card">
              <p className="checkout-cart-side-title">Precisa ajustar sua compra?</p>
              <p className="checkout-cart-side-copy">Volte para produtos para incluir novos itens ou comparar preços antes de finalizar.</p>
              <Link className="btn-secondary checkout-cart-shopping-btn" to="/produtos">
                Voltar para produtos
              </Link>
            </div>
          </aside>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.ENTREGA ? (
        <div className="checkout-delivery-layout">
          <div className="card-box checkout-delivery-main">
            <div className="checkout-delivery-header">
              <p className="checkout-delivery-kicker">Etapa 2</p>
              <h2>Entrega</h2>
              <p className="muted-text">
                Informe o CEP, calcule o frete e escolha a modalidade de entrega mais adequada para seu pedido.
              </p>
            </div>

            <section className="checkout-delivery-section" aria-label="Cálculo de frete por CEP">
              <label htmlFor="cep-entrega"><strong>CEP de entrega</strong></label>

              <div className="delivery-cep-row">
                <div className="delivery-cep-input-wrap">
                  <span className="delivery-cep-icon" aria-hidden="true">📍</span>
                  <input
                    id="cep-entrega"
                    className="field-input entrega-cep-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={9}
                    placeholder="00000-000"
                    value={cepEntrega}
                    onChange={(event) => {
                      const cepFormatado = formatarCep(event.target.value);
                      const cepNormalizado = normalizarCep(cepFormatado);

                      setCepEntrega(cepFormatado);
                      setSimulacaoFrete(null);
                      setErroEntrega('');

                      if (cepNormalizado !== cepEnderecoConsultado) {
                        setEnderecoCepEntrega(null);
                        setErroEnderecoCepEntrega('');
                        setCepEnderecoConsultado('');
                      }
                    }}
                  />
                </div>

                <button
                  className="btn-primary entrega-calcular-btn"
                  type="button"
                  onClick={() => {
                    void executarSimulacaoFrete();
                  }}
                  disabled={simulandoFrete || !cepEntregaValido}
                >
                  {simulandoFrete ? 'Calculando frete...' : 'Calcular frete'}
                </button>
              </div>

              {cepEntregaNormalizado ? (
                <DeliveryAddressLookupCard
                  cep={formatarCep(cepEntregaNormalizado)}
                  endereco={enderecoCepEntrega}
                  carregando={buscandoEnderecoCepEntrega}
                  erro={erroEnderecoCepEntrega}
                  cepIncompleto={cepEntregaIncompleto}
                />
              ) : null}

              <p className="delivery-cep-helper">
                Origem da loja: CEP {CEP_MERCADO}, nº {NUMERO_MERCADO}. Bike disponível até {LIMITE_BIKE_KM.toFixed(1)} km.
              </p>

              <p
                className={`delivery-feedback is-${mensagemFrete.tone}`}
                role={mensagemFrete.tone === 'error' || mensagemFrete.tone === 'warning' ? 'alert' : 'status'}
                aria-live="polite"
              >
                {mensagemFrete.text}
              </p>
            </section>

            <section className="checkout-delivery-section" aria-label="Opções de veículo de entrega">
              <div className="checkout-delivery-section-head">
                <h3>Escolha o tipo de entrega</h3>
                <p>Selecione o veículo para estimar prazo operacional e custo do frete.</p>
              </div>

              <div className="delivery-options-grid" role="radiogroup" aria-label="Seleção de veículo de entrega">
                {Object.entries(VEICULOS_ENTREGA).map(([key, veiculo]) => (
                  <DeliveryOptionCard
                    key={key}
                    veiculo={veiculo}
                    selecionado={veiculoEntrega === key}
                    recomendado={veiculoRecomendado === key}
                    onSelect={() => {
                      setVeiculoEntrega(key);
                      setSimulacaoFrete(null);
                      setErroEntrega('');
                    }}
                  />
                ))}
              </div>
            </section>

            {semOpcaoEntregaDisponivel ? (
              <div className="delivery-empty-state" role="alert">
                <span aria-hidden="true">⚠️</span>
                <div>
                  <strong>Sem opção de entrega disponível para este CEP.</strong>
                  <p>Verifique o CEP informado ou tente outro endereço para continuar.</p>
                </div>
              </div>
            ) : null}

            <DeliverySummaryCard
              veiculoLabel={veiculoSelecionadoEntrega.label}
              cepDestino={simulacaoFrete?.cep_destino || formatarCep(cepEntrega) || '-'}
              distanciaTexto={simulacaoFrete ? `${Number(simulacaoFrete.distancia_km || 0).toFixed(2)} km` : '-'}
              freteTexto={simulacaoFrete ? formatarMoeda(freteAtual) : 'A calcular'}
              totalTexto={simulacaoFrete ? formatarMoeda(totalComFreteAtual) : '-'}
              cepOrigem={CEP_MERCADO}
              numeroOrigem={NUMERO_MERCADO}
            />
          </div>

          <aside className="checkout-delivery-side">
            <OrderSummaryCard
              itens={resumo.itens}
              subtotal={resumo.total}
              frete={simulacaoFrete ? freteAtual : null}
              total={simulacaoFrete ? totalComFreteAtual : resumo.total}
              veiculoLabel={veiculoSelecionadoEntrega.label}
            />

            <div className="card-box checkout-delivery-actions-card">
              <div className="entrega-acoes-row checkout-delivery-actions-row">
                <BotaoVoltarSeta
                  onClick={() => setEtapaAtual(ETAPAS.CARRINHO)}
                  label="Voltar ao carrinho"
                  text="Voltar ao carrinho"
                />

                <button
                  className="btn-primary entrega-ir-pagamento-btn checkout-primary-cta"
                  type="button"
                  onClick={() => setEtapaAtual(ETAPAS.PAGAMENTO)}
                  disabled={!podeAvancarParaPagamento}
                >
                  {simulacaoFrete
                    ? `Continuar para pagamento • Total ${formatarMoeda(totalComFreteAtual)}`
                    : 'Continuar para pagamento'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.PAGAMENTO ? (
        <div className="checkout-payment-layout">
          <div className="card-box checkout-payment-main">
            <div className="checkout-payment-header">
              <p className="checkout-payment-kicker">Etapa 3</p>
              <h2>Pagamento</h2>
              <p className="muted-text">
                Escolha o método, confirme o CPF/CNPJ e avance com segurança para finalizar o pedido.
              </p>
            </div>

            <p className={`payment-frete-info ${(simulacaoFrete || resultadoPedido?.pedido_id) ? 'is-ready' : 'is-warning'}`}>
              {(simulacaoFrete || resultadoPedido?.pedido_id)
                ? `Frete ${veiculoSelecionadoResumo.label}: ${formatarMoeda(resumoFretePagamento)} • Distância ${distanciaSelecionadaTexto}`
                : 'Frete não calculado. Volte para entrega e simule o CEP antes de continuar.'}
            </p>

            {autenticado === true ? (
              <>
                {/* Cards de método com destaque explícito para a opção ativa. */}
                <section className="checkout-payment-section" aria-label="Métodos de pagamento disponíveis">
                  <div className="checkout-payment-section-head">
                    <h3>Forma de pagamento</h3>
                    <p>Selecione o método mais adequado para concluir seu pedido.</p>
                  </div>

                  <div className="payment-methods-grid" role="radiogroup" aria-label="Seleção da forma de pagamento">
                    <PaymentMethodCard
                      icon={FORMAS_PAGAMENTO_OPCOES.pix.icon}
                      title={FORMAS_PAGAMENTO_OPCOES.pix.title}
                      headline={FORMAS_PAGAMENTO_OPCOES.pix.headline}
                      details={FORMAS_PAGAMENTO_OPCOES.pix.details}
                      selecionado={formaPagamento === 'pix'}
                      onSelect={() => {
                        setFormaPagamento('pix');
                        setErro('');
                        limparTokenCartaoGerado();
                      }}
                    />

                    <PaymentMethodCard
                      icon={FORMAS_PAGAMENTO_OPCOES.credito.icon}
                      title={FORMAS_PAGAMENTO_OPCOES.credito.title}
                      headline={FORMAS_PAGAMENTO_OPCOES.credito.headline}
                      details={buscandoChavePublica
                        ? [...FORMAS_PAGAMENTO_OPCOES.credito.details, 'Temporariamente indisponível: preparando conexão segura.']
                        : FORMAS_PAGAMENTO_OPCOES.credito.details}
                      selecionado={formaPagamento === 'credito'}
                      disabled={buscandoChavePublica}
                      onSelect={() => {
                        setFormaPagamento('credito');
                        setErro('');
                        limparTokenCartaoGerado();
                      }}
                    />

                    <PaymentMethodCard
                      icon={FORMAS_PAGAMENTO_OPCOES.debito.icon}
                      title={FORMAS_PAGAMENTO_OPCOES.debito.title}
                      headline={FORMAS_PAGAMENTO_OPCOES.debito.headline}
                      details={buscandoChavePublica
                        ? [...FORMAS_PAGAMENTO_OPCOES.debito.details, 'Temporariamente indisponível: preparando conexão segura.']
                        : FORMAS_PAGAMENTO_OPCOES.debito.details}
                      selecionado={formaPagamento === 'debito'}
                      disabled={buscandoChavePublica}
                      onSelect={() => {
                        setFormaPagamento('debito');
                        setParcelasCartao('1');
                        setErro('');
                        limparTokenCartaoGerado();
                      }}
                    />
                  </div>

                  {buscandoChavePublica ? (
                    <p className="payment-method-unavailable" role="status">
                      Métodos no cartão temporariamente indisponíveis enquanto preparamos a conexão segura com o gateway.
                    </p>
                  ) : null}
                </section>

                <PaymentSelectionSummary
                  title={formaPagamentoAtual.summaryTitle}
                  description={formaPagamentoAtual.summaryDescription}
                />

                <TaxIdInput
                  value={documentoPagador}
                  onChange={(event) => {
                    setDocumentoPagador(formatarDocumentoFiscal(event.target.value));
                    if (erro) {
                      setErro('');
                    }
                  }}
                  onBlur={() => setDocumentoTocado(true)}
                  requiredError={documentoObrigatorioNaoPreenchido}
                  invalidError={documentoInvalidoPagamento}
                  validFeedback={documentoValidoFeedback}
                />

                {pagamentoCartaoSelecionado ? (
                  <section className="payment-card-panel" aria-label="Dados do cartão">
                    <div className="payment-card-panel-head">
                      <h3>{formaPagamento === 'credito' ? 'Dados do cartão de crédito' : 'Dados do cartão de débito'}</h3>
                      <p>Estrutura preparada para expansão de campos adicionais sem quebrar a experiência.</p>
                    </div>

                    <div className="payment-card-grid">
                      <div className="payment-card-field payment-card-field-span-2">
                        <label htmlFor="nome-titular-cartao">Nome impresso no cartão</label>
                        <input
                          id="nome-titular-cartao"
                          className="field-input"
                          type="text"
                          autoComplete="off"
                          placeholder="Nome igual ao cartão"
                          value={nomeTitularCartao}
                          onChange={(event) => {
                            setNomeTitularCartao(event.target.value);
                            limparTokenCartaoGerado();
                          }}
                        />
                      </div>

                      <div className="payment-card-field payment-card-field-span-2">
                        <label htmlFor="numero-cartao">Número do cartão</label>
                        <input
                          id="numero-cartao"
                          className="field-input"
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-number"
                          placeholder="0000 0000 0000 0000"
                          value={numeroCartao}
                          onChange={(event) => {
                            setNumeroCartao(formatarNumeroCartao(event.target.value));
                            limparTokenCartaoGerado();
                          }}
                        />
                      </div>

                      <div className="payment-card-field">
                        <label htmlFor="mes-expiracao-cartao">Mês</label>
                        <input
                          id="mes-expiracao-cartao"
                          className="field-input"
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-exp-month"
                          placeholder="MM"
                          maxLength={2}
                          value={mesExpiracaoCartao}
                          onChange={(event) => {
                            setMesExpiracaoCartao(formatarMesCartao(event.target.value));
                            limparTokenCartaoGerado();
                          }}
                        />
                      </div>

                      <div className="payment-card-field">
                        <label htmlFor="ano-expiracao-cartao">Ano</label>
                        <input
                          id="ano-expiracao-cartao"
                          className="field-input"
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-exp-year"
                          placeholder="AAAA"
                          maxLength={4}
                          value={anoExpiracaoCartao}
                          onChange={(event) => {
                            setAnoExpiracaoCartao(formatarAnoCartao(event.target.value));
                            limparTokenCartaoGerado();
                          }}
                        />
                      </div>

                      <div className="payment-card-field">
                        <label htmlFor="cvv-cartao">CVV</label>
                        <input
                          id="cvv-cartao"
                          className="field-input"
                          type="password"
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          placeholder="CVV"
                          maxLength={4}
                          value={cvvCartao}
                          onChange={(event) => {
                            setCvvCartao(formatarCvvCartao(event.target.value));
                            limparTokenCartaoGerado();
                          }}
                        />
                      </div>

                      {formaPagamento === 'credito' ? (
                        <div className="payment-card-field payment-card-field-span-2">
                          <label htmlFor="parcelas-cartao">Parcelas</label>
                          <select
                            id="parcelas-cartao"
                            className="field-input"
                            value={parcelasCartao}
                            onChange={(event) => setParcelasCartao(event.target.value)}
                          >
                            {Array.from({ length: parcelamentoCreditoDisponivel ? PARCELAMENTO_MAXIMO_CREDITO : 1 }, (_, idx) => idx + 1).map((parcela) => (
                              <option key={parcela} value={String(parcela)}>
                                {parcela}x
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>

                    {formaPagamento === 'credito' ? (
                      <p className="payment-card-note">
                        {parcelamentoCreditoDisponivel
                          ? `Parcelamento liberado para este pedido (até ${PARCELAMENTO_MAXIMO_CREDITO}x).`
                          : `Parcelamento disponível apenas para pedidos a partir de R$ ${valorMinimoParcelamentoTexto}.`}
                      </p>
                    ) : (
                      <p className="payment-card-note">No débito, o pagamento é sempre à vista (1x).</p>
                    )}

                    <div className="payment-card-actions">
                      <button
                        className="btn-secondary payment-validate-card-btn"
                        type="button"
                        disabled={criptografandoCartao || buscandoChavePublica}
                        onClick={() => {
                          void handleCriptografarCartao().catch((error) => {
                            setErro(error.message || 'Não foi possível validar os dados do cartão.');
                          });
                        }}
                      >
                        {criptografandoCartao ? 'Validando dados do cartão...' : 'Validar cartão com segurança'}
                      </button>

                      <p className={`payment-card-token-feedback ${tokenCartao ? 'is-success' : ''}`.trim()}>
                        {tokenCartao
                          ? 'Dados do cartão validados com sucesso.'
                          : 'Os dados do cartão são protegidos antes do envio para pagamento.'}
                      </p>

                      {debitoSelecionado ? (
                        <>
                          <p className={`payment-action-feedback ${status3DSTone}`.trim()} role="status">
                            {status3DSLabel}
                            {idAutenticacao3DS ? ` ID: ${idAutenticacao3DS}` : ''}
                          </p>

                          {IS_DEVELOPMENT && resultado3DS?.trace_id ? (
                            <p className="muted-text">Trace 3DS: {resultado3DS.trace_id}</p>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              <div className="payment-login-state">
                <p className="muted-text">Faça login para continuar para o pagamento.</p>
                <div className="checkout-payment-actions">
                  <BotaoVoltarSeta
                    onClick={() => setEtapaAtual(ETAPAS.ENTREGA)}
                    label="Voltar para entrega"
                    text="Voltar"
                    className="payment-back-btn"
                  />
                  <Link to="/conta" className="btn-primary entrega-ir-pagamento-btn checkout-payment-primary-btn">
                    Ir para Conta
                  </Link>
                </div>
              </div>
            )}
          </div>

          <aside className="checkout-payment-side">
            {/* Resumo financeiro com maior visibilidade antes da confirmação. */}
            <PaymentOrderSummary
              itens={resumoItensPagamento}
              subtotal={totalProdutosPedido}
              frete={resumoFretePagamento}
              total={resumoTotalPagamento}
              metodo={formaPagamentoAtual.title}
            />

            {autenticado === true ? (
              <div className="card-box checkout-payment-actions-card">
                <article className="payment-readiness-card" aria-label="Checklist para continuar">
                  <p className="payment-readiness-title">Checklist antes de continuar</p>

                  <ul className="payment-readiness-list">
                    {checklistPagamento.map((item) => (
                      <li key={item.id} className={item.ok ? 'is-ok' : 'is-pending'}>
                        <span className="payment-readiness-icon" aria-hidden="true">{item.ok ? '✓' : '•'}</span>
                        <span>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                </article>

                {mensagemBloqueioPagamento ? (
                  <p className="payment-action-feedback is-warning" role="status">{mensagemBloqueioPagamento}</p>
                ) : null}

                {buscandoChavePublica ? (
                  <p className="payment-action-feedback is-loading" role="status">Preparando conexão segura com o gateway de cartão...</p>
                ) : null}

                <div className="checkout-payment-actions">
                  <BotaoVoltarSeta
                    onClick={() => setEtapaAtual(ETAPAS.ENTREGA)}
                    label="Voltar para entrega"
                    text="Voltar para entrega"
                    className="payment-back-btn"
                  />

                  <button
                    className="btn-primary checkout-payment-primary-btn"
                    type="button"
                    onClick={() => {
                      void handleContinuarPagamento();
                    }}
                    disabled={bloqueioPagamento}
                  >
                    {carregando
                      ? 'Preparando pagamento...'
                      : `${formaPagamentoAtual.ctaText} • Total ${formatarMoeda(resumoTotalPagamento)}`}
                  </button>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.PIX ? (
        <div className="checkout-pix-layout">
          <div className="card-box checkout-pix-main">
            <div className="checkout-pix-header">
              <p className="checkout-pix-kicker">Etapa 3</p>
              <h2>{formaPagamento === 'pix' ? 'Pagamento via PIX' : `Pagamento com ${tituloFormaPagamento}`}</h2>
              <p className="muted-text">
                {formaPagamento === 'pix'
                  ? 'Escaneie o QR Code ou copie o código PIX para concluir o pagamento com segurança.'
                  : `Finalize o pagamento com ${tituloFormaPagamento.toLowerCase()} para seguir para a confirmação.`}
              </p>
            </div>

            {formaPagamento === 'pix' ? (
              <>
                {/* Estrutura principal do PIX com QR em destaque e código copia e cola. */}
                <section className="checkout-pix-payment-panel" aria-label="Pagamento PIX">
                  <div className="checkout-pix-payment-grid">
                    <PixQrCodeCard qrCodeSrc={qrCodePixSrc} carregando={carregando} />

                    <PixCopyCodeCard
                      codigoPix={codigoPixAtual}
                      onCopy={() => {
                        void handleCopiarCodigoPix();
                      }}
                      feedbackCopia={feedbackCopiaPix}
                      disabled={carregando}
                    />
                  </div>

                  <PixInstructionsCard />
                </section>

                <PixStatusCard statusVisual={statusPixVisual} />
              </>
            ) : (
              <section className="checkout-pix-payment-panel" aria-label="Pagamento com cartão">
                {debitoSelecionado ? (
                  <p className={`payment-action-feedback ${status3DSTone}`.trim()} role="status">
                    {status3DSLabel}
                  </p>
                ) : null}

                <button
                  className="btn-secondary"
                  type="button"
                  disabled={carregando || criptografandoCartao || !resultadoPedido?.pedido_id || !recaptchaCheckoutPronto}
                  onClick={() => handlePagarCartao(resultadoPedido.pedido_id)}
                >
                  {carregando
                    ? debitoSelecionado
                      ? status3DSLabel
                      : `Processando ${tituloFormaPagamento.toLowerCase()}...`
                    : `Pagar com ${tituloFormaPagamento}`}
                </button>

                {resultadoCartao ? (
                  <>
                    <p>Status do pagamento: {formatarStatusPagamento(resultadoCartao.status)}</p>
                    <p>Status do pedido: {formatarStatusPedido(resultadoCartao.status_interno || 'pendente')}</p>
                    <p>Referência do pedido no PagBank: {resultadoCartao.pagbank_order_id || '-'}</p>
                    <p>Referência da transação: {resultadoCartao.payment_id || '-'}</p>
                    <p>Método: {resultadoCartao.tipo_cartao === 'debito' ? 'Cartão de Débito' : 'Cartão de Crédito'}</p>
                    <p>Parcelas: {resultadoCartao.tipo_cartao === 'debito' ? '1x' : `${resultadoCartao.parcelas || parcelasCartaoEfetivas}x`}</p>
                    {cartaoRecusado ? (
                      <p className="error-text">Pagamento não aprovado. Revise os dados do cartão e tente novamente.</p>
                    ) : null}
                  </>
                ) : (
                  <p className="muted-text">Revise os dados e clique no botão para concluir o pagamento no cartão.</p>
                )}
              </section>
            )}
          </div>

          <aside className="checkout-pix-side">
            <PaymentOrderSummary
              itens={itensResumoPixExibicao}
              subtotal={Number(resultadoPedido?.total_produtos ?? resumoPedidoSnapshot?.subtotal ?? totalProdutosPedido)}
              frete={freteSelecionado}
              total={totalComEntregaPedido}
              metodo={formaPagamento === 'pix' ? 'PIX' : tituloFormaPagamento}
            />

            <div className="card-box checkout-pix-actions-card">
              <p className="pix-order-meta">Pedido #{resultadoPedido?.pedido_id || '-'}</p>

              {formaPagamento === 'pix' ? (
                <>
                  <button
                    className={`${pixDisponivelParaPagar ? 'btn-secondary' : 'btn-primary'} checkout-pix-generate-btn`.trim()}
                    type="button"
                    disabled={bloqueioGeracaoPix}
                    onClick={() => handleGerarPix(resultadoPedido.pedido_id)}
                  >
                    {textoBotaoGerarPix}
                  </button>

                  {podeContinuarConfirmacaoPix ? (
                    <button
                      className="btn-primary checkout-pix-primary-btn"
                      type="button"
                      onClick={() => {
                        setPagamentoConfirmado(true);
                        setEtapaAtual(ETAPAS.STATUS);
                      }}
                    >
                      Continuar para confirmação do pedido
                    </button>
                  ) : (
                    <button
                      className={`${pixDisponivelParaPagar ? 'btn-primary' : 'btn-secondary'} checkout-pix-primary-btn`.trim()}
                      type="button"
                      onClick={() => {
                        void handleVerificarPagamentoPix();
                      }}
                      disabled={bloqueioVerificacaoPix || !pixDisponivelParaPagar}
                    >
                      {verificandoStatusPix ? 'Verificando pagamento PIX...' : 'Verificar pagamento PIX'}
                    </button>
                  )}

                  {!podeContinuarConfirmacaoPix ? (
                    <p className="pix-action-helper">A confirmação só é liberada após aprovação do pagamento PIX.</p>
                  ) : null}
                </>
              ) : (
                <button
                  className="btn-primary checkout-pix-primary-btn"
                  type="button"
                  disabled={!cartaoProcessado}
                  onClick={() => {
                    setPagamentoConfirmado(cartaoAprovado);
                    setEtapaAtual(ETAPAS.STATUS);
                  }}
                >
                  Continuar para confirmação
                </button>
              )}

              <BotaoVoltarSeta
                onClick={() => setEtapaAtual(ETAPAS.PAGAMENTO)}
                label="Voltar para pagamento"
                text="Voltar para pagamento"
                className="payment-back-btn"
              />
            </div>
          </aside>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.STATUS ? (
        <div className="card-box">
          <p><strong>Etapa 4: Confirmação e acompanhamento</strong></p>
          {resultadoPedido ? (
            <>
              <p>Pedido: #{resultadoPedido.pedido_id}</p>
              <p>Total com entrega estimado: {formatarMoeda(totalComEntregaPedido)}</p>
              <p>
                Situação atual: <span className="pedido-status-badge">{labelStatus}</span>
              </p>
              {pagamentoConfirmado ? (
                <div className="pagamento-ok" aria-label="Pagamento confirmado com sucesso">
                  <span className="pagamento-ok-icon">✅</span>
                  <span>Pagamento confirmado com sucesso.</span>
                </div>
              ) : null}
              <p className="muted-text">Atualização automática a cada 15 segundos.</p>
            </>
          ) : (
            <p className="muted-text">Finalize um pedido para acompanhar o status.</p>
          )}

          <div className="card-box" style={{ marginTop: '0.4rem' }}>
            <p><strong>Precisa de ajuda?</strong></p>
            <p>
              {formaPagamento === 'pix'
                ? 'Se o QR Code não abrir no seu banco, copie o código PIX e cole manualmente no aplicativo.'
                : 'Se o pagamento não for aprovado, revise os dados do cartão e tente novamente.'}
            </p>
            <p>Após a confirmação do pagamento, iniciamos a preparação e o envio do pedido.</p>
          </div>

          <BotaoVoltarSeta
            onClick={() => setEtapaAtual(ETAPAS.PIX)}
            label="Voltar para pagamento"
            text="Voltar para pagamento"
          />
        </div>
      ) : null}
    </section>
  );
}

