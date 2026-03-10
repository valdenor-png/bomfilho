const PAGBANK_SDK_URL = 'https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js';

let pagBankSdkPromise = null;

function getBrowserWindow() {
  if (typeof window === 'undefined') {
    throw new Error('Ambiente do navegador não disponível para tokenização do PagBank.');
  }

  return window;
}

export function carregarSdkPagBank() {
  const win = getBrowserWindow();

  if (win.PagSeguro?.encryptCard) {
    return Promise.resolve(win.PagSeguro);
  }

  if (pagBankSdkPromise) {
    return pagBankSdkPromise;
  }

  pagBankSdkPromise = new Promise((resolve, reject) => {
    const existente = win.document.querySelector(`script[src="${PAGBANK_SDK_URL}"]`);
    if (existente) {
      existente.addEventListener('load', () => resolve(win.PagSeguro), { once: true });
      existente.addEventListener('error', () => reject(new Error('Falha ao carregar SDK do PagBank.')), { once: true });
      return;
    }

    const script = win.document.createElement('script');
    script.src = PAGBANK_SDK_URL;
    script.async = true;
    script.onload = () => resolve(win.PagSeguro);
    script.onerror = () => reject(new Error('Falha ao carregar SDK do PagBank.'));
    win.document.body.appendChild(script);
  })
    .then((pagSeguro) => {
      if (!pagSeguro?.encryptCard) {
        throw new Error('SDK do PagBank carregado sem função encryptCard.');
      }
      return pagSeguro;
    })
    .catch((erro) => {
      pagBankSdkPromise = null;
      throw erro;
    });

  return pagBankSdkPromise;
}

export async function criptografarCartaoPagBank({
  publicKey,
  holder,
  number,
  expMonth,
  expYear,
  securityCode
}) {
  const pagSeguro = await carregarSdkPagBank();

  const resultado = pagSeguro.encryptCard({
    publicKey: String(publicKey || '').trim(),
    holder: String(holder || '').trim(),
    number: String(number || '').replace(/\D/g, ''),
    expMonth: String(expMonth || '').replace(/\D/g, ''),
    expYear: String(expYear || '').replace(/\D/g, ''),
    securityCode: String(securityCode || '').replace(/\D/g, '')
  });

  if (resultado?.hasErrors) {
    const erros = Array.isArray(resultado?.errors) ? resultado.errors : [];
    const detalhes = erros
      .map((erro) => `${erro?.code || 'ERRO'}: ${erro?.message || 'falha na criptografia'}`)
      .join(' | ');

    throw new Error(detalhes || 'Não foi possível criptografar o cartão com o PagBank.');
  }

  const encryptedCard = String(resultado?.encryptedCard || '').trim();
  if (!encryptedCard) {
    throw new Error('SDK do PagBank não retornou encryptedCard.');
  }

  return encryptedCard;
}
