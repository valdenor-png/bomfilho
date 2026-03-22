const MERCADO_PAGO_SDK_URL = 'https://sdk.mercadopago.com/js/v2';

let mercadoPagoSdkPromise = null;

function getBrowserWindow() {
  if (typeof window === 'undefined') {
    throw new Error('Ambiente do navegador não disponível para tokenização do cartão.');
  }

  return window;
}

function normalizarIdentificacao(numero) {
  const digits = String(numero || '').replace(/\D/g, '');
  if (digits.length === 14) {
    return { type: 'CNPJ', number: digits };
  }

  return { type: 'CPF', number: digits };
}

export async function loadPaymentSdk() {
  const win = getBrowserWindow();

  if (typeof win.MercadoPago === 'function') {
    return win.MercadoPago;
  }

  if (mercadoPagoSdkPromise) {
    return mercadoPagoSdkPromise;
  }

  mercadoPagoSdkPromise = new Promise((resolve, reject) => {
    const existente = win.document.querySelector(`script[src="${MERCADO_PAGO_SDK_URL}"]`);

    function finalizarComSdk() {
      if (typeof win.MercadoPago === 'function') {
        resolve(win.MercadoPago);
      } else {
        reject(new Error('SDK do Mercado Pago carregado sem construtor MercadoPago.'));
      }
    }

    if (existente) {
      existente.addEventListener('load', finalizarComSdk, { once: true });
      existente.addEventListener('error', () => reject(new Error('Falha ao carregar SDK do Mercado Pago.')), { once: true });
      if (typeof win.MercadoPago === 'function') {
        resolve(win.MercadoPago);
      }
      return;
    }

    const script = win.document.createElement('script');
    script.src = MERCADO_PAGO_SDK_URL;
    script.async = true;
    script.onload = finalizarComSdk;
    script.onerror = () => reject(new Error('Falha ao carregar SDK do Mercado Pago.'));
    win.document.body.appendChild(script);
  }).catch((erro) => {
    mercadoPagoSdkPromise = null;
    throw erro;
  });

  return mercadoPagoSdkPromise;
}

export async function tokenizeCard({
  publicKey,
  holder,
  number,
  expMonth,
  expYear,
  securityCode,
  identificationNumber
}) {
  const MercadoPago = await loadPaymentSdk();
  const key = String(publicKey || '').trim();
  if (!key) {
    throw new Error('Chave pública do Mercado Pago ausente.');
  }

  const mp = new MercadoPago(key, { locale: 'pt-BR' });
  const identification = normalizarIdentificacao(identificationNumber);

  const payload = {
    cardNumber: String(number || '').replace(/\D/g, ''),
    cardholderName: String(holder || '').trim(),
    cardExpirationMonth: String(expMonth || '').replace(/\D/g, ''),
    cardExpirationYear: String(expYear || '').replace(/\D/g, ''),
    securityCode: String(securityCode || '').replace(/\D/g, ''),
    identificationType: identification.type,
    identificationNumber: identification.number
  };

  const resultado = await mp.createCardToken(payload);
  const token = String(resultado?.id || '').trim();
  if (!token) {
    throw new Error('Não foi possível tokenizar o cartão no Mercado Pago.');
  }

  return token;
}

export async function configure3DSSession() {
  throw new Error('Fluxo 3DS indisponível no gateway atual.');
}

export async function authenticate3DS() {
  throw new Error('Fluxo 3DS indisponível no gateway atual.');
}
