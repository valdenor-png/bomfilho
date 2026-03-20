// ─── Constantes da ContaPage ─────────────────────────────────────────

export const PREFERENCIAS_STORAGE_KEY = 'bf_conta_preferencias';

export const ENDERECO_FORM_INICIAL = {
  cep: '',
  rua: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  referencia: ''
};

// ─── Formatadores e normalizadores de CEP ────────────────────────────

export function normalizarCepEndereco(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 8);
}

export function formatarCepEndereco(valor) {
  const digits = normalizarCepEndereco(valor);
  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

// ─── Preferências locais (localStorage) ──────────────────────────────

export function lerPreferenciasLocais() {
  if (typeof window === 'undefined') {
    return {
      promocoesWhatsapp: true,
      promocoesEmail: true,
      notificacoesPedidos: true,
      temaEscuro: false
    };
  }

  try {
    const raw = window.localStorage.getItem(PREFERENCIAS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      promocoesWhatsapp: parsed?.promocoesWhatsapp !== false,
      promocoesEmail: parsed?.promocoesEmail !== false,
      notificacoesPedidos: parsed?.notificacoesPedidos !== false,
      temaEscuro: parsed?.temaEscuro === true
    };
  } catch {
    return {
      promocoesWhatsapp: true,
      promocoesEmail: true,
      notificacoesPedidos: true,
      temaEscuro: false
    };
  }
}

export function salvarPreferenciasLocais(preferencias) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(PREFERENCIAS_STORAGE_KEY, JSON.stringify(preferencias));
  } catch {
    // Ignora falhas de storage para não bloquear a tela.
  }
}

// ─── Formatadores de telefone ────────────────────────────────────────

export function formatarTelefone(valor) {
  const digits = String(valor || '').replace(/\D/g, '');

  if (!digits) {
    return 'Não informado';
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return String(valor || '').trim();
}

export function normalizarTelefoneCadastro(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 11);
}

export function formatarTelefoneCadastro(valor) {
  const digits = normalizarTelefoneCadastro(valor);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// ─── Força de senha ──────────────────────────────────────────────────

export function avaliarForcaSenha(valor) {
  const senhaAtual = String(valor || '');
  const checks = [
    {
      id: 'length',
      label: 'Pelo menos 8 caracteres',
      ok: senhaAtual.length >= 8
    },
    {
      id: 'letters',
      label: 'Letras maiúsculas e minúsculas',
      ok: /[A-Z]/.test(senhaAtual) && /[a-z]/.test(senhaAtual)
    },
    {
      id: 'number',
      label: 'Ao menos 1 número',
      ok: /\d/.test(senhaAtual)
    },
    {
      id: 'symbol',
      label: 'Ao menos 1 símbolo',
      ok: /[^A-Za-z0-9]/.test(senhaAtual)
    }
  ];

  const score = checks.reduce((accumulator, check) => accumulator + (check.ok ? 1 : 0), 0);

  if (score <= 1) {
    return { checks, score, level: 'fraca', tone: 'weak' };
  }

  if (score <= 3) {
    return { checks, score, level: 'média', tone: 'medium' };
  }

  return { checks, score, level: 'forte', tone: 'strong' };
}

// ─── Helpers de perfil e endereço ────────────────────────────────────

export function obterIniciais(nome) {
  const normalizado = String(nome || '').trim();
  if (!normalizado) {
    return 'CL';
  }

  const partes = normalizado.split(/\s+/).filter(Boolean);
  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase();
  }

  return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
}

export function montarResumoEndereco(endereco) {
  if (!endereco) {
    return {
      titulo: 'Endereço principal',
      linha1: 'Você ainda não cadastrou um endereço.',
      linha2: 'Adicione seu endereço para agilizar o checkout e o cálculo de entrega.'
    };
  }

  const ruaNumero = [endereco.rua, endereco.numero].filter(Boolean).join(', ');
  const cidadeEstado = [endereco.cidade, endereco.estado].filter(Boolean).join(' - ');
  const linha2 = [endereco.bairro, cidadeEstado, endereco.cep].filter(Boolean).join(' • ');

  return {
    titulo: 'Endereço principal',
    linha1: ruaNumero || 'Endereço cadastrado sem rua e número.',
    linha2: linha2 || 'Complete bairro, cidade, estado e CEP para facilitar a entrega.'
  };
}
