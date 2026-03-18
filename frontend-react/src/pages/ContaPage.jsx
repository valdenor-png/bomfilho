import React from 'react';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import {
  atualizarPreferenciasWhatsapp,
  buscarEnderecoViaCep,
  cadastrar,
  getEndereco,
  getMe,
  isAuthErrorMessage,
  login,
  logout,
  salvarEndereco
} from '../lib/api';
import { useRecorrencia } from '../context/RecorrenciaContext';
import {
  FONT_SCALE_OPTIONS,
  getStoredFontScale,
  getStoredHighContrast,
  getStoredReducedMotion,
  setStoredFontScale,
  setStoredHighContrast,
  setStoredReducedMotion
} from '../lib/accessibility';

const PREFERENCIAS_STORAGE_KEY = 'bf_conta_preferencias';

const ENDERECO_FORM_INICIAL = {
  cep: '',
  rua: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  referencia: ''
};

function normalizarCepEndereco(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 8);
}

function formatarCepEndereco(valor) {
  const digits = normalizarCepEndereco(valor);
  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function lerPreferenciasLocais() {
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

function salvarPreferenciasLocais(preferencias) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(PREFERENCIAS_STORAGE_KEY, JSON.stringify(preferencias));
  } catch {
    // Ignora falhas de storage para não bloquear a tela.
  }
}

function formatarTelefone(valor) {
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

function normalizarTelefoneCadastro(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 11);
}

function formatarTelefoneCadastro(valor) {
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

function avaliarForcaSenha(valor) {
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
    return {
      checks,
      score,
      level: 'fraca',
      tone: 'weak'
    };
  }

  if (score <= 3) {
    return {
      checks,
      score,
      level: 'média',
      tone: 'medium'
    };
  }

  return {
    checks,
    score,
    level: 'forte',
    tone: 'strong'
  };
}

function obterIniciais(nome) {
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

function montarResumoEndereco(endereco) {
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

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="conta-icon-svg">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="conta-icon-svg">
      <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm8 6 8-5H4l8 5Z" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="conta-icon-svg">
      <path d="M6.62 10.79a15.46 15.46 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1-.24 11.7 11.7 0 0 0 3.69.59 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.47a1 1 0 0 1 1 1 11.7 11.7 0 0 0 .59 3.69 1 1 0 0 1-.25 1Z" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="conta-icon-svg">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 10a3 3 0 1 1 3-3 3 3 0 0 1-3 3Z" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="conta-icon-svg">
      <path d="M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3Zm-1 13-3-3 1.41-1.41L11 12.17l3.59-3.58L16 10l-5 5Z" />
    </svg>
  );
}

function IconPreferences() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="conta-icon-svg">
      <path d="M10.59 3.41 9.17 4.83l1.41 1.41 1.42-1.41 1.41 1.41 1.42-1.41-1.42-1.42a2 2 0 0 0-2.82 0ZM5 9h14v2H5Zm2 4h10v2H7Z" />
    </svg>
  );
}

function IconAccessibility() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="conta-icon-svg">
      <path d="M12 2a2 2 0 1 0 2 2 2 2 0 0 0-2-2Zm7 5H5v2h5v13h2V9h5Z" />
    </svg>
  );
}

function IconShortcut() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="conta-icon-svg">
      <path d="M4 4h7v7H4Zm9 0h7v7h-7ZM4 13h7v7H4Zm13 0h3v7h-7v-3h4Z" />
    </svg>
  );
}

function SwitchControl({ id, label, description, checked, onChange, disabled = false }) {
  return (
    <label className={`switch-item ${disabled ? 'is-disabled' : ''}`} htmlFor={id}>
      <span className="switch-item-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>

      <span className="switch-control" aria-hidden="true">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
        />
        <span className="switch-slider" />
      </span>
    </label>
  );
}

function ShortcutCard({ to, title, description, disabled = false, onClick }) {
  const body = (
    <>
      <span className="conta-shortcut-icon"><IconShortcut /></span>
      <span className="conta-shortcut-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </>
  );

  if (!disabled && to) {
    return (
      <Link className="conta-shortcut-card" to={to}>
        {body}
      </Link>
    );
  }

  return (
    <button className="conta-shortcut-card is-button" type="button" disabled={disabled} onClick={onClick}>
      {body}
    </button>
  );
}

export default function ContaPage() {
  const { stats: recorrenciaStats } = useRecorrencia();
  const recaptchaSiteKey = String(import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim();
  const recaptchaEnabled = recaptchaSiteKey.length > 0;
  const recaptchaRef = useRef(null);
  const consultaCepIdRef = useRef(0);
  const cepConsultadoRef = useRef('');
  const [modo, setModo] = useState('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacaoSenha, setConfirmacaoSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [telefone, setTelefone] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [recaptchaErroCarregamento, setRecaptchaErroCarregamento] = useState('');
  const [usuario, setUsuario] = useState(null);
  const [enderecoPrincipal, setEnderecoPrincipal] = useState(null);
  const [enderecoForm, setEnderecoForm] = useState(ENDERECO_FORM_INICIAL);
  const [carregandoEndereco, setCarregandoEndereco] = useState(false);
  const [salvandoEndereco, setSalvandoEndereco] = useState(false);
  const [buscandoCepEndereco, setBuscandoCepEndereco] = useState(false);
  const [mensagemCepEndereco, setMensagemCepEndereco] = useState('');
  const [erroEnderecoForm, setErroEnderecoForm] = useState('');
  const [sucessoEnderecoForm, setSucessoEnderecoForm] = useState('');
  const [erro, setErro] = useState('');
  const [mensagemInfo, setMensagemInfo] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [preferencias, setPreferencias] = useState(() => lerPreferenciasLocais());
  const [fontScale, setFontScale] = useState(() => getStoredFontScale());
  const [highContrast, setHighContrast] = useState(() => getStoredHighContrast());
  const [reducedMotion, setReducedMotion] = useState(() => getStoredReducedMotion());

  useEffect(() => {
    let ativo = true;

    setCarregando(true);
    getMe()
      .then((data) => {
        if (ativo) {
          const usuarioAtual = data.usuario || null;
          setUsuario(usuarioAtual);
          if (usuarioAtual) {
            setPreferencias((current) => ({
              ...current,
              promocoesWhatsapp: Boolean(usuarioAtual.whatsapp_opt_in ?? current.promocoesWhatsapp)
            }));
          }
        }
      })
      .catch((error) => {
        if (!ativo) {
          return;
        }

        if (!isAuthErrorMessage(error.message)) {
          setErro(error.message);
        }

        setUsuario(null);
      })
      .finally(() => {
        if (ativo) {
          setCarregando(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    salvarPreferenciasLocais(preferencias);
  }, [preferencias]);

  useEffect(() => {
    let ativo = true;

    if (!usuario) {
      setEnderecoPrincipal(null);
      setCarregandoEndereco(false);
      return () => {
        ativo = false;
      };
    }

    setCarregandoEndereco(true);

    getEndereco()
      .then((data) => {
        if (!ativo) {
          return;
        }

        setEnderecoPrincipal(data?.endereco || null);
      })
      .catch(() => {
        if (!ativo) {
          return;
        }

        setEnderecoPrincipal(null);
      })
      .finally(() => {
        if (ativo) {
          setCarregandoEndereco(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, [usuario]);

  useEffect(() => {
    if (!usuario) {
      setEnderecoForm({ ...ENDERECO_FORM_INICIAL });
      setMensagemCepEndereco('');
      setErroEnderecoForm('');
      setSucessoEnderecoForm('');
      cepConsultadoRef.current = '';
      return;
    }

    if (!enderecoPrincipal) {
      setEnderecoForm({ ...ENDERECO_FORM_INICIAL });
      setMensagemCepEndereco('');
      setErroEnderecoForm('');
      setSucessoEnderecoForm('');
      cepConsultadoRef.current = '';
      return;
    }

    setEnderecoForm({
      cep: formatarCepEndereco(enderecoPrincipal.cep || ''),
      rua: String(enderecoPrincipal.rua || '').trim(),
      numero: String(enderecoPrincipal.numero || '').trim(),
      complemento: '',
      bairro: String(enderecoPrincipal.bairro || '').trim(),
      cidade: String(enderecoPrincipal.cidade || '').trim(),
      estado: String(enderecoPrincipal.estado || '').trim().toUpperCase(),
      referencia: ''
    });

    setMensagemCepEndereco('');
    setErroEnderecoForm('');
    setSucessoEnderecoForm('');
    cepConsultadoRef.current = normalizarCepEndereco(enderecoPrincipal.cep || '');
  }, [enderecoPrincipal, usuario]);

  useEffect(() => {
    if (!usuario) {
      return;
    }

    const cepLimpo = normalizarCepEndereco(enderecoForm.cep);

    if (!cepLimpo) {
      cepConsultadoRef.current = '';
      setMensagemCepEndereco('');
      setBuscandoCepEndereco(false);
      setEnderecoForm((current) => ({
        ...current,
        rua: '',
        bairro: '',
        cidade: '',
        estado: '',
        complemento: ''
      }));
      return;
    }

    if (cepLimpo.length !== 8) {
      if (cepConsultadoRef.current && cepLimpo !== cepConsultadoRef.current) {
        cepConsultadoRef.current = '';
        setEnderecoForm((current) => ({
          ...current,
          rua: '',
          bairro: '',
          cidade: '',
          estado: '',
          complemento: ''
        }));
      }
      return;
    }

    if (cepLimpo === cepConsultadoRef.current) {
      return;
    }

    const consultaAtualId = ++consultaCepIdRef.current;
    setBuscandoCepEndereco(true);
    setMensagemCepEndereco('Buscando CEP...');

    (async () => {
      try {
        const enderecoViaCep = await buscarEnderecoViaCep(cepLimpo);

        if (consultaAtualId !== consultaCepIdRef.current) {
          return;
        }

        cepConsultadoRef.current = cepLimpo;
        setEnderecoForm((current) => {
          if (normalizarCepEndereco(current.cep) !== cepLimpo) {
            return current;
          }

          return {
            ...current,
            rua: enderecoViaCep.logradouro || current.rua,
            bairro: enderecoViaCep.bairro || current.bairro,
            cidade: enderecoViaCep.cidade || current.cidade,
            estado: enderecoViaCep.estado || current.estado,
            complemento: enderecoViaCep.complemento || current.complemento
          };
        });

        setMensagemCepEndereco('Endereço encontrado e preenchido automaticamente.');
      } catch (error) {
        if (consultaAtualId !== consultaCepIdRef.current) {
          return;
        }

        const mensagem = String(error?.message || '').trim();
        if (mensagem === 'CEP não encontrado') {
          setMensagemCepEndereco('CEP não encontrado');
          setEnderecoForm((current) => {
            if (normalizarCepEndereco(current.cep) !== cepLimpo) {
              return current;
            }

            return {
              ...current,
              rua: '',
              bairro: '',
              cidade: '',
              estado: '',
              complemento: ''
            };
          });
        } else {
          setMensagemCepEndereco('Não foi possível consultar o CEP. Verifique sua conexão e tente novamente.');
        }

        cepConsultadoRef.current = '';
      } finally {
        if (consultaAtualId === consultaCepIdRef.current) {
          setBuscandoCepEndereco(false);
        }
      }
    })();
  }, [enderecoForm.cep, usuario]);

  function atualizarCampoEndereco(campo, valor) {
    setEnderecoForm((current) => ({
      ...current,
      [campo]: valor
    }));
  }

  function resetarFormularioEndereco() {
    if (!enderecoPrincipal) {
      setEnderecoForm({ ...ENDERECO_FORM_INICIAL });
      setMensagemCepEndereco('');
      setErroEnderecoForm('');
      setSucessoEnderecoForm('');
      cepConsultadoRef.current = '';
      return;
    }

    setEnderecoForm({
      cep: formatarCepEndereco(enderecoPrincipal.cep || ''),
      rua: String(enderecoPrincipal.rua || '').trim(),
      numero: String(enderecoPrincipal.numero || '').trim(),
      complemento: '',
      bairro: String(enderecoPrincipal.bairro || '').trim(),
      cidade: String(enderecoPrincipal.cidade || '').trim(),
      estado: String(enderecoPrincipal.estado || '').trim().toUpperCase(),
      referencia: ''
    });

    setMensagemCepEndereco('');
    setErroEnderecoForm('');
    setSucessoEnderecoForm('');
    cepConsultadoRef.current = normalizarCepEndereco(enderecoPrincipal.cep || '');
  }

  async function handleSalvarEndereco(event) {
    event.preventDefault();
    setErroEnderecoForm('');
    setSucessoEnderecoForm('');

    const cepLimpo = normalizarCepEndereco(enderecoForm.cep);
    if (cepLimpo.length !== 8) {
      setErroEnderecoForm('CEP inválido. Informe um CEP com 8 dígitos.');
      return;
    }

    const payload = {
      rua: String(enderecoForm.rua || '').trim(),
      numero: String(enderecoForm.numero || '').trim(),
      complemento: String(enderecoForm.complemento || '').trim(),
      bairro: String(enderecoForm.bairro || '').trim(),
      cidade: String(enderecoForm.cidade || '').trim(),
      estado: String(enderecoForm.estado || '').trim().toUpperCase().slice(0, 2),
      cep: formatarCepEndereco(cepLimpo),
      referencia: String(enderecoForm.referencia || '').trim()
    };

    if (!payload.rua || !payload.numero || !payload.bairro || !payload.cidade || !payload.estado || normalizarCepEndereco(payload.cep).length !== 8) {
      setErroEnderecoForm('Preencha rua, número, bairro, cidade, estado e CEP para salvar o endereço.');
      return;
    }

    setSalvandoEndereco(true);
    try {
      await salvarEndereco(payload);

      setEnderecoPrincipal((current) => ({
        ...(current || {}),
        ...payload
      }));

      setSucessoEnderecoForm('Endereço salvo com sucesso.');
    } catch (error) {
      setErroEnderecoForm(error.message || 'Não foi possível salvar o endereço. Tente novamente.');
    } finally {
      setSalvandoEndereco(false);
    }
  }

  function resetRecaptcha() {
    setRecaptchaToken('');
    setRecaptchaErroCarregamento('');
    if (recaptchaRef.current && typeof recaptchaRef.current.reset === 'function') {
      recaptchaRef.current.reset();
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setErro('');
    setMensagemInfo('');

    if (recaptchaEnabled && !recaptchaToken) {
      setErro(recaptchaErroCarregamento || 'Confirme o reCAPTCHA para continuar.');
      return;
    }

    setCarregando(true);

    try {
      const data = await login(email.trim(), senha, recaptchaToken);
      setUsuario(data.usuario);
      setSenha('');
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
      resetRecaptcha();
    }
  }

  async function handleCadastro(event) {
    event.preventDefault();
    setErro('');
    setMensagemInfo('');

    const telefoneNormalizado = normalizarTelefoneCadastro(telefone);
    if (telefoneNormalizado.length < 10) {
      setErro('Informe um telefone com DDD para criar a conta.');
      return;
    }

    const scoreSenha = avaliarForcaSenha(senha).score;
    if (scoreSenha < 3) {
      setErro('Use uma senha mais forte para criar a conta.');
      return;
    }

    if (senha !== confirmacaoSenha) {
      setErro('A confirmação de senha não confere.');
      return;
    }

    if (recaptchaEnabled && !recaptchaToken) {
      setErro(recaptchaErroCarregamento || 'Confirme o reCAPTCHA para continuar.');
      return;
    }

    setCarregando(true);

    try {
      const data = await cadastrar({
        nome: nome.trim(),
        email: email.trim(),
        senha,
        telefone: telefoneNormalizado,
        whatsappOptIn,
        recaptchaToken
      });
      setUsuario(data.usuario);
      setPreferencias((current) => ({
        ...current,
        promocoesWhatsapp: Boolean(data?.usuario?.whatsapp_opt_in ?? whatsappOptIn)
      }));
      setSenha('');
      setConfirmacaoSenha('');
      setMostrarSenha(false);
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
      resetRecaptcha();
    }
  }

  async function handleLogout() {
    setCarregando(true);
    let mensagemErro = '';

    try {
      await logout();
    } catch (error) {
      if (!isAuthErrorMessage(error.message)) {
        mensagemErro = error.message;
      }
    }

    setUsuario(null);
    setNome('');
    setEmail('');
    setSenha('');
    setConfirmacaoSenha('');
    setMostrarSenha(false);
    setTelefone('');
    setWhatsappOptIn(true);
    setMensagemInfo('');
    setErro(mensagemErro);
    setCarregando(false);
  }

  function atualizarPreferencia(chave, valor) {
    setPreferencias((current) => ({
      ...current,
      [chave]: valor
    }));
  }

  async function handleTogglePromocoesWhatsapp(checked) {
    const valorAnterior = preferencias.promocoesWhatsapp;

    setErro('');
    atualizarPreferencia('promocoesWhatsapp', checked);

    if (!usuario?.telefone) {
      setMensagemInfo('Preferência salva localmente. Adicione um telefone para sincronizar com o servidor.');
      return;
    }

    try {
      await atualizarPreferenciasWhatsapp({
        telefone: usuario.telefone,
        whatsappOptIn: checked
      });

      setUsuario((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          whatsapp_opt_in: checked
        };
      });

      setMensagemInfo('Preferência de WhatsApp atualizada com sucesso.');
    } catch (error) {
      atualizarPreferencia('promocoesWhatsapp', valorAnterior);
      setErro(error.message || 'Não foi possível atualizar sua preferência de WhatsApp.');
    }
  }

  function handleAcaoEmBreve(rotulo) {
    setErro('');
    setMensagemInfo(`${rotulo} estará disponível em breve.`);
  }

  function handleExcluirContaPlaceholder() {
    const confirmou = window.confirm('Deseja iniciar a solicitação de exclusão da conta? Esta ação será liberada na próxima versão.');
    if (!confirmou) {
      return;
    }

    setErro('');
    setMensagemInfo('Fluxo de exclusão em implantação. Contate o suporte para concluir manualmente.');
  }

  function handleFontScaleChange(scaleValue) {
    const normalizedScale = setStoredFontScale(scaleValue);
    setFontScale(normalizedScale);
  }

  function handleHighContrastChange(enabled) {
    const normalizedEnabled = setStoredHighContrast(enabled);
    setHighContrast(normalizedEnabled);
  }

  function handleReducedMotionChange(enabled) {
    const normalizedEnabled = setStoredReducedMotion(enabled);
    setReducedMotion(normalizedEnabled);
  }

  const nomeExibicao = String(usuario?.nome || 'Cliente').trim() || 'Cliente';
  const emailExibicao = String(usuario?.email || 'Sem e-mail cadastrado').trim() || 'Sem e-mail cadastrado';
  const telefoneExibicao = formatarTelefone(usuario?.telefone);
  const telefoneCadastroNormalizado = normalizarTelefoneCadastro(telefone);
  const senhaStrength = useMemo(() => avaliarForcaSenha(senha), [senha]);
  const senhaFracaCadastro = modo === 'cadastro' && senha.length > 0 && senhaStrength.score < 3;
  const confirmacaoSenhaInvalida = modo === 'cadastro' && confirmacaoSenha.length > 0 && senha !== confirmacaoSenha;
  const iniciaisAvatar = obterIniciais(nomeExibicao);
  const resumoEndereco = useMemo(() => montarResumoEndereco(enderecoPrincipal), [enderecoPrincipal]);

  const textoStatusConta = usuario?.whatsapp_opt_in
    ? 'Conta verificada e com canal WhatsApp ativo'
    : 'Conta ativa, com notificações de WhatsApp desativadas';

  return (
    <section className="page conta-page">
      <header className="conta-header">
        <div>
          <h1>Minha conta</h1>
          <p className="muted-text conta-subtitle">Gerencie perfil, preferências, segurança e acessibilidade em um único lugar.</p>
        </div>

        {usuario ? (
          <Link to="/pedidos" className="btn-secondary conta-header-cta">
            Ver meus pedidos
          </Link>
        ) : null}
      </header>

      {erro ? <p className="error-text">{erro}</p> : null}
      {mensagemInfo ? <p className="conta-info-text">{mensagemInfo}</p> : null}

      {usuario ? (
        <>
          {/* Bloco principal com identidade da conta e dados essenciais */}
          <article className="card-box conta-profile-card">
            <div className="conta-profile-top">
              <div className="conta-avatar" aria-hidden="true">{iniciaisAvatar}</div>

              <div className="conta-profile-copy">
                <span className="conta-pill">Conta ativa</span>
                <h2>{nomeExibicao}</h2>
                <p className="muted-text conta-profile-subtitle">{textoStatusConta}</p>
              </div>

              <button
                className="btn-secondary conta-profile-edit"
                type="button"
                disabled={carregando}
                onClick={() => handleAcaoEmBreve('Edição de perfil')}
              >
                Editar perfil
              </button>
            </div>

            <div className="conta-profile-lines">
              <p className="conta-line-item">
                <span className="conta-line-icon"><IconMail /></span>
                <span>{emailExibicao}</span>
              </p>

              <p className="conta-line-item">
                <span className="conta-line-icon"><IconPhone /></span>
                <span>{telefoneExibicao}</span>
              </p>

              <p className="conta-line-item">
                <span className="conta-line-icon"><IconUser /></span>
                <span>Cliente desde {new Date().getFullYear()}</span>
              </p>
            </div>
          </article>

          <div className="conta-sections-grid">
            <article className="card-box conta-section-card">
              <div className="conta-section-head">
                <span className="conta-section-icon"><IconPin /></span>
                <div>
                  <h3>Endereços</h3>
                  <p>Organize seus locais de entrega para finalizar pedidos mais rápido.</p>
                </div>
              </div>

              <div className="conta-address-content">
                {carregandoEndereco ? (
                  <p className="muted-text">Carregando endereço principal...</p>
                ) : (
                  <form className="conta-endereco-form" onSubmit={handleSalvarEndereco}>
                    <div className="conta-address-preview">
                      <p className="conta-address-title">{resumoEndereco.titulo}</p>
                      <p>{resumoEndereco.linha1}</p>
                      <p className="muted-text conta-address-muted">{resumoEndereco.linha2}</p>
                    </div>

                    <div className="conta-endereco-grid">
                      <div className="conta-endereco-field">
                        <label className="field-label" htmlFor="conta-endereco-cep">CEP</label>
                        <input
                          id="conta-endereco-cep"
                          className="field-input"
                          type="text"
                          inputMode="numeric"
                          autoComplete="postal-code"
                          maxLength={9}
                          placeholder="00000-000"
                          value={enderecoForm.cep}
                          onChange={(event) => {
                            setErroEnderecoForm('');
                            setSucessoEnderecoForm('');
                            setMensagemCepEndereco('');
                            atualizarCampoEndereco('cep', formatarCepEndereco(event.target.value));
                          }}
                          onBlur={() => {
                            const cepLimpo = normalizarCepEndereco(enderecoForm.cep);
                            if (cepLimpo && cepLimpo.length !== 8) {
                              setMensagemCepEndereco('CEP inválido');
                            }
                          }}
                        />
                      </div>

                      <div className="conta-endereco-field conta-endereco-field-span-2">
                        <label className="field-label" htmlFor="conta-endereco-rua">Logradouro</label>
                        <input
                          id="conta-endereco-rua"
                          className="field-input"
                          type="text"
                          autoComplete="address-line1"
                          value={enderecoForm.rua}
                          onChange={(event) => atualizarCampoEndereco('rua', event.target.value)}
                        />
                      </div>

                      <div className="conta-endereco-field">
                        <label className="field-label" htmlFor="conta-endereco-numero">Número</label>
                        <input
                          id="conta-endereco-numero"
                          className="field-input"
                          type="text"
                          inputMode="numeric"
                          autoComplete="address-line2"
                          value={enderecoForm.numero}
                          onChange={(event) => atualizarCampoEndereco('numero', event.target.value)}
                        />
                      </div>

                      <div className="conta-endereco-field">
                        <label className="field-label" htmlFor="conta-endereco-complemento">Complemento</label>
                        <input
                          id="conta-endereco-complemento"
                          className="field-input"
                          type="text"
                          autoComplete="off"
                          value={enderecoForm.complemento}
                          onChange={(event) => atualizarCampoEndereco('complemento', event.target.value)}
                        />
                      </div>

                      <div className="conta-endereco-field">
                        <label className="field-label" htmlFor="conta-endereco-bairro">Bairro</label>
                        <input
                          id="conta-endereco-bairro"
                          className="field-input"
                          type="text"
                          autoComplete="address-level3"
                          value={enderecoForm.bairro}
                          onChange={(event) => atualizarCampoEndereco('bairro', event.target.value)}
                        />
                      </div>

                      <div className="conta-endereco-field">
                        <label className="field-label" htmlFor="conta-endereco-cidade">Cidade</label>
                        <input
                          id="conta-endereco-cidade"
                          className="field-input"
                          type="text"
                          autoComplete="address-level2"
                          value={enderecoForm.cidade}
                          onChange={(event) => atualizarCampoEndereco('cidade', event.target.value)}
                        />
                      </div>

                      <div className="conta-endereco-field">
                        <label className="field-label" htmlFor="conta-endereco-estado">UF</label>
                        <input
                          id="conta-endereco-estado"
                          className="field-input"
                          type="text"
                          autoComplete="address-level1"
                          maxLength={2}
                          value={enderecoForm.estado}
                          onChange={(event) => atualizarCampoEndereco('estado', String(event.target.value || '').toUpperCase())}
                        />
                      </div>

                      <div className="conta-endereco-field conta-endereco-field-span-2">
                        <label className="field-label" htmlFor="conta-endereco-referencia">Referência</label>
                        <input
                          id="conta-endereco-referencia"
                          className="field-input"
                          type="text"
                          autoComplete="off"
                          value={enderecoForm.referencia}
                          onChange={(event) => atualizarCampoEndereco('referencia', event.target.value)}
                        />
                      </div>
                    </div>

                    {mensagemCepEndereco ? (
                      <p
                        className={`conta-endereco-feedback ${
                          buscandoCepEndereco
                            ? 'is-loading'
                            : mensagemCepEndereco === 'CEP não encontrado' || mensagemCepEndereco === 'CEP inválido'
                              ? 'is-warning'
                              : mensagemCepEndereco.includes('Não foi possível')
                                ? 'is-error'
                                : 'is-success'
                        }`}
                        role={mensagemCepEndereco === 'CEP não encontrado' || mensagemCepEndereco === 'CEP inválido' || mensagemCepEndereco.includes('Não foi possível') ? 'alert' : 'status'}
                        aria-live="polite"
                      >
                        {mensagemCepEndereco}
                      </p>
                    ) : null}

                    {erroEnderecoForm ? <p className="error-text">{erroEnderecoForm}</p> : null}
                    {sucessoEnderecoForm ? <p className="conta-info-text">{sucessoEnderecoForm}</p> : null}

                    <div className="conta-inline-actions">
                      <button className="btn-secondary" type="button" onClick={resetarFormularioEndereco}>
                        Restaurar endereço salvo
                      </button>
                      <button className="btn-primary" type="submit" disabled={salvandoEndereco || buscandoCepEndereco}>
                        {salvandoEndereco ? 'Salvando endereço...' : 'Salvar endereço'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </article>

            <article className="card-box conta-section-card">
              <div className="conta-section-head">
                <span className="conta-section-icon"><IconShield /></span>
                <div>
                  <h3>Segurança</h3>
                  <p>Gerencie acesso e proteção da sua conta.</p>
                </div>
              </div>

              <div className="conta-stack-actions conta-security-actions">
                <button className="btn-secondary" type="button" onClick={() => handleAcaoEmBreve('Troca de senha')}>
                  Alterar senha
                </button>
                <button className="btn-secondary" type="button" onClick={() => handleAcaoEmBreve('Sessões ativas')}>
                  Sessões ativas
                </button>
                <button className="btn-secondary" type="button" onClick={handleLogout} disabled={carregando}>
                  Sair da conta
                </button>
                <button className="btn-danger" type="button" onClick={handleExcluirContaPlaceholder} disabled={carregando}>
                  Excluir conta
                </button>
              </div>
            </article>

            <article className="card-box conta-section-card">
              <div className="conta-section-head">
                <span className="conta-section-icon"><IconPreferences /></span>
                <div>
                  <h3>Preferências</h3>
                  <p>Personalize comunicações e notificações da sua conta.</p>
                </div>
              </div>

              <div className="switch-list" aria-label="Preferências da conta">
                <SwitchControl
                  id="pref-whatsapp-promocoes"
                  label="Receber promoções por WhatsApp"
                  description="Ofertas e novidades direto no seu número cadastrado."
                  checked={preferencias.promocoesWhatsapp}
                  onChange={(checked) => {
                    void handleTogglePromocoesWhatsapp(checked);
                  }}
                />

                <SwitchControl
                  id="pref-email-promocoes"
                  label="Receber promoções por e-mail"
                  description="Cupons e campanhas especiais na sua caixa de entrada."
                  checked={preferencias.promocoesEmail}
                  onChange={(checked) => atualizarPreferencia('promocoesEmail', checked)}
                />

                <SwitchControl
                  id="pref-notificacoes-pedidos"
                  label="Notificações de pedidos"
                  description="Atualizações de preparo e entrega em tempo real."
                  checked={preferencias.notificacoesPedidos}
                  onChange={(checked) => atualizarPreferencia('notificacoesPedidos', checked)}
                />

                <SwitchControl
                  id="pref-tema-escuro"
                  label="Tema escuro"
                  description="Ajuste visual em desenvolvimento (em breve)."
                  checked={preferencias.temaEscuro}
                  onChange={(checked) => atualizarPreferencia('temaEscuro', checked)}
                  disabled
                />
              </div>
            </article>

            {/* Acessibilidade mantida, porém com menor peso visual no layout */}
            <article className="card-box conta-section-card conta-accessibility-card">
              <div className="conta-section-head">
                <span className="conta-section-icon"><IconAccessibility /></span>
                <div>
                  <h3>Acessibilidade</h3>
                  <p>Ajuste leitura e conforto visual conforme sua necessidade.</p>
                </div>
              </div>

              <div className="conta-font-row" role="group" aria-label="Ajustar tamanho da fonte">
                {FONT_SCALE_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={`btn-secondary conta-font-btn ${fontScale === option.value ? 'active' : ''}`}
                    aria-pressed={fontScale === option.value}
                    onClick={() => handleFontScaleChange(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="switch-list" aria-label="Recursos de acessibilidade">
                <SwitchControl
                  id="toggle-high-contrast"
                  label="Alto contraste"
                  description="Melhora diferenciação de textos e elementos na tela."
                  checked={highContrast}
                  onChange={handleHighContrastChange}
                />

                <SwitchControl
                  id="toggle-reduced-motion"
                  label="Reduzir animações"
                  description="Diminui transições e efeitos de movimento da interface."
                  checked={reducedMotion}
                  onChange={handleReducedMotionChange}
                />
              </div>
            </article>

            <article className="card-box conta-section-card">
              <div className="conta-section-head">
                <span className="conta-section-icon"><IconShortcut /></span>
                <div>
                  <h3>Atalhos úteis</h3>
                  <p>Acesse rapidamente áreas importantes da sua conta e dos seus hábitos de compra.</p>
                </div>
              </div>

              <p className="muted-text" style={{ marginTop: '-0.1rem' }}>
                Favoritos: {recorrenciaStats.favoritos} • Recompra: {recorrenciaStats.recompra}
              </p>

              <div className="conta-shortcuts-grid">
                <ShortcutCard to="/pedidos" title="Meus pedidos" description="Acompanhar status e histórico." />
                <ShortcutCard to="/produtos?recorrencia=favoritos" title="Favoritos" description="Abrir seus produtos salvos." />
                <ShortcutCard to="/produtos?recorrencia=recompra" title="Comprar novamente" description="Atalho para recompra rapida." />
                <ShortcutCard disabled title="Cupons" description="Ver cupons disponíveis (em breve)." />
                <ShortcutCard
                  title="Ajuda / suporte"
                  description="Falar com atendimento da loja."
                  onClick={() => {
                    window.open('https://wa.me/5591999652790', '_blank', 'noopener,noreferrer');
                  }}
                />
              </div>
            </article>
          </div>
        </>
      ) : (
        <>
          <div className="conta-auth-layout">
            <form className="form-box conta-auth-card" onSubmit={modo === 'login' ? handleLogin : handleCadastro}>
              <div className="auth-switch">
                <button
                  type="button"
                  className={`auth-switch-btn ${modo === 'login' ? 'active' : ''}`}
                  onClick={() => {
                    setModo('login');
                    setSenha('');
                    setConfirmacaoSenha('');
                    setMostrarSenha(false);
                    setErro('');
                    setMensagemInfo('');
                    resetRecaptcha();
                  }}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  className={`auth-switch-btn ${modo === 'cadastro' ? 'active' : ''}`}
                  onClick={() => {
                    setModo('cadastro');
                    setSenha('');
                    setConfirmacaoSenha('');
                    setMostrarSenha(false);
                    setErro('');
                    setMensagemInfo('');
                    resetRecaptcha();
                  }}
                >
                  Criar conta
                </button>
              </div>

              <p className="conta-auth-description">
                {modo === 'login'
                  ? 'Entre para acompanhar pedidos e concluir pagamentos com segurança.'
                  : 'Crie sua conta para salvar dados e agilizar suas próximas compras.'}
              </p>

              {modo === 'cadastro' ? (
                <>
                  <label className="field-label" htmlFor="nome">Nome completo</label>
                  <input
                    id="nome"
                    className="field-input"
                    type="text"
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    required
                  />

                  <label className="field-label" htmlFor="telefone">Telefone</label>
                  <input
                    id="telefone"
                    className="field-input"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={15}
                    placeholder="(91) 99999-9999"
                    value={telefone}
                    onChange={(event) => setTelefone(formatarTelefoneCadastro(event.target.value))}
                    required
                  />

                  <p className="conta-auth-field-note">
                    Telefone com DDD para receber atualizações de entrega.
                  </p>
                </>
              ) : null}

              <label className="field-label" htmlFor="email">E-mail</label>
              <input
                id="email"
                className="field-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />

              <label className="field-label" htmlFor="senha">Senha</label>
              <div className="conta-password-field">
                <input
                  id="senha"
                  className="field-input"
                  type={mostrarSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  required
                />

                <button
                  className="conta-password-toggle"
                  type="button"
                  onClick={() => setMostrarSenha((current) => !current)}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              {modo === 'cadastro' ? (
                <>
                  <div className="conta-password-strength-box" aria-live="polite">
                    <div className="conta-password-meter" aria-hidden="true">
                      <span
                        className={`conta-password-meter-fill is-${senhaStrength.tone}`}
                        style={{ width: `${(senhaStrength.score / 4) * 100}%` }}
                      />
                    </div>

                    <p className={`conta-password-strength-label is-${senhaStrength.tone}`}>
                      Força da senha: {senhaStrength.level}
                    </p>

                    <ul className="conta-password-checklist">
                      {senhaStrength.checks.map((check) => (
                        <li key={check.id} className={check.ok ? 'is-ok' : ''}>
                          <span aria-hidden="true">{check.ok ? '✓' : '•'}</span>
                          <span>{check.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <label className="field-label" htmlFor="confirmacao-senha">Confirmar senha</label>
                  <input
                    id="confirmacao-senha"
                    className="field-input"
                    type={mostrarSenha ? 'text' : 'password'}
                    value={confirmacaoSenha}
                    onChange={(event) => setConfirmacaoSenha(event.target.value)}
                    required
                  />

                  {confirmacaoSenha ? (
                    <p className={`conta-auth-field-note ${confirmacaoSenhaInvalida ? 'is-error' : 'is-success'}`}>
                      {confirmacaoSenhaInvalida ? 'As senhas não coincidem.' : 'As senhas conferem.'}
                    </p>
                  ) : null}
                </>
              ) : null}

              {senhaFracaCadastro ? (
                <p className="conta-auth-field-note is-error">
                  Reforce sua senha para seguir com o cadastro.
                </p>
              ) : null}

              {modo === 'cadastro' && telefoneCadastroNormalizado.length > 0 && telefoneCadastroNormalizado.length < 10 ? (
                <p className="conta-auth-field-note is-error">
                  Telefone incompleto. Informe DDD e número.
                </p>
              ) : null}

              {modo === 'cadastro' ? (
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={whatsappOptIn}
                    onChange={(event) => setWhatsappOptIn(event.target.checked)}
                  />
                  Quero receber atualizações do pedido no WhatsApp
                </label>
              ) : null}

              {recaptchaEnabled ? (
                <div style={{ marginBottom: '12px' }}>
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={recaptchaSiteKey}
                    hl="pt-BR"
                    onChange={(token) => {
                      setRecaptchaToken(String(token || '').trim());
                      if (token) {
                        setRecaptchaErroCarregamento('');
                      }
                    }}
                    onExpired={() => setRecaptchaToken('')}
                    onErrored={() => {
                      setRecaptchaToken('');
                      setRecaptchaErroCarregamento('Não foi possível validar o reCAPTCHA neste domínio. Acesse o endereço oficial da loja ou atualize os domínios permitidos no Google reCAPTCHA.');
                    }}
                  />

                  {recaptchaErroCarregamento ? (
                    <p className="error-text" style={{ marginTop: '0.5rem' }}>
                      {recaptchaErroCarregamento}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <button className="btn-primary" type="submit" disabled={carregando}>
                {carregando
                  ? modo === 'login'
                    ? 'Entrando...'
                    : 'Criando conta...'
                  : modo === 'login'
                    ? 'Entrar na conta'
                    : 'Criar conta'}
              </button>
            </form>

            <aside className="card-box conta-auth-side">
              <p><strong>Vantagens da conta</strong></p>
              <ul className="conta-benefits-list">
                <li>Checkout mais rápido com dados salvos</li>
                <li>Histórico completo de pedidos</li>
                <li>Acompanhamento de status em tempo real</li>
                <li>Preferências personalizadas de contato</li>
              </ul>
              <p className="muted-text conta-auth-note">Seu cadastro é protegido e usado apenas para melhorar sua experiência de compra.</p>
            </aside>
          </div>

          <article className="card-box conta-section-card conta-accessibility-card">
            <div className="conta-section-head">
              <span className="conta-section-icon"><IconAccessibility /></span>
              <div>
                <h3>Acessibilidade</h3>
                <p>Defina o formato de leitura antes de entrar na sua conta.</p>
              </div>
            </div>

            <div className="conta-font-row" role="group" aria-label="Ajustar tamanho da fonte">
              {FONT_SCALE_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className={`btn-secondary conta-font-btn ${fontScale === option.value ? 'active' : ''}`}
                  aria-pressed={fontScale === option.value}
                  onClick={() => handleFontScaleChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="switch-list" aria-label="Recursos de acessibilidade">
              <SwitchControl
                id="toggle-high-contrast"
                label="Alto contraste"
                description="Melhora diferenciação de textos e elementos na tela."
                checked={highContrast}
                onChange={handleHighContrastChange}
              />

              <SwitchControl
                id="toggle-reduced-motion"
                label="Reduzir animações"
                description="Diminui transições e efeitos de movimento da interface."
                checked={reducedMotion}
                onChange={handleReducedMotionChange}
              />
            </div>
          </article>
        </>
      )}
    </section>
  );
}

