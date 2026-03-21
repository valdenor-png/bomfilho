const PAGBANK_SDK_URL = 'https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js';

let pagBankSdkPromise = null;
let ultimaSessao3DSConfigurada = null;

function normalizarEnvSdkPagBank(env) {
  const value = String(env || '').trim().toUpperCase();
  if (['PROD', 'PRODUCTION'].includes(value)) {
    return 'PROD';
  }

  return 'SANDBOX';
}

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
    function aguardarPagSeguro(tentativas) {
      if (win.PagSeguro?.encryptCard) {
        resolve(win.PagSeguro);
        return;
      }
      if (tentativas <= 0) {
        reject(new Error('SDK do PagBank carregado, mas PagSeguro não disponível no window.'));
        return;
      }
      setTimeout(() => aguardarPagSeguro(tentativas - 1), 100);
    }

    const existente = win.document.querySelector(`script[src="${PAGBANK_SDK_URL}"]`);
    if (existente) {
      if (win.PagSeguro?.encryptCard) {
        resolve(win.PagSeguro);
        return;
      }

      existente.addEventListener('load', () => aguardarPagSeguro(30), { once: true });
      existente.addEventListener('error', () => reject(new Error('Falha ao carregar SDK do PagBank.')), { once: true });
      return;
    }

    const script = win.document.createElement('script');
    script.src = PAGBANK_SDK_URL;
    script.async = true;
    script.onload = () => aguardarPagSeguro(30);
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

export async function configurarSessao3DSPagBank({ session, env } = {}) {
  const pagSeguro = await carregarSdkPagBank();

  if (typeof pagSeguro?.setUp !== 'function') {
    throw new Error('SDK do PagBank não disponibilizou o método setUp para 3DS.');
  }

  const sessionNormalizada = String(session || '').trim();
  if (!sessionNormalizada) {
    throw new Error('Sessão 3DS inválida ou ausente. Atualize a página e tente novamente.');
  }

  const envNormalizado = normalizarEnvSdkPagBank(env);
  if (
    ultimaSessao3DSConfigurada
    && ultimaSessao3DSConfigurada.session === sessionNormalizada
    && ultimaSessao3DSConfigurada.env === envNormalizado
  ) {
    return {
      session: sessionNormalizada,
      env: envNormalizado
    };
  }

  pagSeguro.setUp({
    session: sessionNormalizada,
    env: envNormalizado
  });

  ultimaSessao3DSConfigurada = {
    session: sessionNormalizada,
    env: envNormalizado
  };

  return {
    session: sessionNormalizada,
    env: envNormalizado
  };
}

export async function autenticar3DSPagBank(request = {}) {
  const pagSeguro = await carregarSdkPagBank();

  if (typeof pagSeguro?.authenticate3DS !== 'function') {
    throw new Error('SDK do PagBank não disponibilizou o método authenticate3DS.');
  }

  return pagSeguro.authenticate3DS(request);
}
