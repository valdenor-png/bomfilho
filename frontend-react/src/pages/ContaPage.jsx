import React from 'react';
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
import useDocumentHead from '../hooks/useDocumentHead';
import {
  getStoredFontScale,
  getStoredHighContrast,
  getStoredReducedMotion,
  setStoredFontScale,
  setStoredHighContrast,
  setStoredReducedMotion
} from '../lib/accessibility';
import {
  ENDERECO_FORM_INICIAL,
  normalizarCepEndereco,
  formatarCepEndereco,
  lerPreferenciasLocais,
  salvarPreferenciasLocais,
  formatarTelefone,
  normalizarTelefoneCadastro,
  avaliarForcaSenha,
  obterIniciais,
  montarResumoEndereco
} from '../lib/contaUtils';
import {
  ProfileSection,
  AddressSection,
  PreferencesSection,
  SecuritySection,
  AccessibilitySection,
  ShortcutsSection,
  AuthSection
} from '../components/conta';

export default function ContaPage() {
  useDocumentHead({ title: 'Minha Conta', description: 'Gerencie seu perfil, endereço e preferências na sua conta BomFilho.' });
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
  const [enderecoEmEdicao, setEnderecoEmEdicao] = useState(false);
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
      setEnderecoEmEdicao(false);
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

  function handleIniciarEdicaoEndereco() {
    resetarFormularioEndereco();
    setEnderecoEmEdicao(true);
  }

  function handleCancelarEdicaoEndereco() {
    resetarFormularioEndereco();
    setEnderecoEmEdicao(false);
  }

  function handleCepChange(valorCep) {
    setErroEnderecoForm('');
    setSucessoEnderecoForm('');
    setMensagemCepEndereco('');
    atualizarCampoEndereco('cep', formatarCepEndereco(valorCep));
  }

  function handleCepBlur() {
    const cepLimpo = normalizarCepEndereco(enderecoForm.cep);
    if (cepLimpo && cepLimpo.length !== 8) {
      setMensagemCepEndereco('CEP inválido');
    }
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
      setMensagemInfo('Endereço principal atualizado.');
      setEnderecoEmEdicao(false);
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

  function handleModoChange(novoModo) {
    setModo(novoModo);
    setSenha('');
    setConfirmacaoSenha('');
    setMostrarSenha(false);
    setErro('');
    setMensagemInfo('');
    resetRecaptcha();
  }

  function handleRecaptchaChange(token) {
    setRecaptchaToken(String(token || '').trim());
    if (token) {
      setRecaptchaErroCarregamento('');
    }
  }

  function handleRecaptchaExpired() {
    setRecaptchaToken('');
  }

  function handleRecaptchaError() {
    setRecaptchaToken('');
    setRecaptchaErroCarregamento('Não foi possível validar o reCAPTCHA neste domínio. Acesse o endereço oficial da loja ou atualize os domínios permitidos no Google reCAPTCHA.');
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
  const cidadeUfEndereco = [enderecoPrincipal?.cidade, enderecoPrincipal?.estado].filter(Boolean).join(' / ') || 'Não informado';
  const cepEnderecoExibicao = enderecoPrincipal?.cep
    ? formatarCepEndereco(enderecoPrincipal.cep)
    : 'Não informado';

  const textoStatusConta = usuario?.whatsapp_opt_in
    ? 'Conta verificada e com canal WhatsApp ativo'
    : 'Conta ativa, com notificações de WhatsApp desativadas';

  return (
    <section className="page conta-page">
      <header className="conta-header">
        <div>
          <h1>Minha conta</h1>
          <p className="muted-text conta-subtitle">Seu perfil, endereço e preferências em um só lugar.</p>
        </div>
      </header>

      {erro ? <p className="error-text" role="alert">{erro}</p> : null}
      {mensagemInfo ? <p className="conta-info-text">{mensagemInfo}</p> : null}

      {usuario ? (
        <>
          <ProfileSection
            nomeExibicao={nomeExibicao}
            emailExibicao={emailExibicao}
            telefoneExibicao={telefoneExibicao}
            iniciaisAvatar={iniciaisAvatar}
            textoStatusConta={textoStatusConta}
            carregando={carregando}
            onAcaoEmBreve={handleAcaoEmBreve}
          />

          <div className="conta-sections-grid">
            <AddressSection
              carregandoEndereco={carregandoEndereco}
              enderecoEmEdicao={enderecoEmEdicao}
              enderecoPrincipal={enderecoPrincipal}
              resumoEndereco={resumoEndereco}
              cidadeUfEndereco={cidadeUfEndereco}
              cepEnderecoExibicao={cepEnderecoExibicao}
              erroEnderecoForm={erroEnderecoForm}
              sucessoEnderecoForm={sucessoEnderecoForm}
              enderecoForm={enderecoForm}
              mensagemCepEndereco={mensagemCepEndereco}
              buscandoCepEndereco={buscandoCepEndereco}
              salvandoEndereco={salvandoEndereco}
              onIniciarEdicao={handleIniciarEdicaoEndereco}
              onCancelarEdicao={handleCancelarEdicaoEndereco}
              onSalvarEndereco={handleSalvarEndereco}
              onResetarFormulario={resetarFormularioEndereco}
              onAtualizarCampo={atualizarCampoEndereco}
              onCepChange={handleCepChange}
              onCepBlur={handleCepBlur}
            />

            <PreferencesSection
              preferencias={preferencias}
              onToggleWhatsapp={handleTogglePromocoesWhatsapp}
              onAtualizarPreferencia={atualizarPreferencia}
            />

            <SecuritySection
              carregando={carregando}
              onLogout={handleLogout}
              onAcaoEmBreve={handleAcaoEmBreve}
              onExcluirConta={handleExcluirContaPlaceholder}
            />

            <AccessibilitySection
              fontScale={fontScale}
              highContrast={highContrast}
              reducedMotion={reducedMotion}
              onFontScaleChange={handleFontScaleChange}
              onHighContrastChange={handleHighContrastChange}
              onReducedMotionChange={handleReducedMotionChange}
            />

            <ShortcutsSection recorrenciaStats={recorrenciaStats} />
          </div>
        </>
      ) : (
        <>
          <AuthSection
            modo={modo}
            nome={nome}
            email={email}
            senha={senha}
            confirmacaoSenha={confirmacaoSenha}
            mostrarSenha={mostrarSenha}
            telefone={telefone}
            whatsappOptIn={whatsappOptIn}
            carregando={carregando}
            recaptchaEnabled={recaptchaEnabled}
            recaptchaSiteKey={recaptchaSiteKey}
            recaptchaRef={recaptchaRef}
            recaptchaErroCarregamento={recaptchaErroCarregamento}
            senhaStrength={senhaStrength}
            senhaFracaCadastro={senhaFracaCadastro}
            confirmacaoSenhaInvalida={confirmacaoSenhaInvalida}
            telefoneCadastroNormalizado={telefoneCadastroNormalizado}
            onModoChange={handleModoChange}
            onNomeChange={setNome}
            onEmailChange={setEmail}
            onSenhaChange={setSenha}
            onConfirmacaoSenhaChange={setConfirmacaoSenha}
            onMostrarSenhaToggle={() => setMostrarSenha((current) => !current)}
            onTelefoneChange={setTelefone}
            onWhatsappOptInChange={setWhatsappOptIn}
            onRecaptchaChange={handleRecaptchaChange}
            onRecaptchaExpired={handleRecaptchaExpired}
            onRecaptchaError={handleRecaptchaError}
            onLogin={handleLogin}
            onCadastro={handleCadastro}
          />

          <AccessibilitySection
            fontScale={fontScale}
            highContrast={highContrast}
            reducedMotion={reducedMotion}
            onFontScaleChange={handleFontScaleChange}
            onHighContrastChange={handleHighContrastChange}
            onReducedMotionChange={handleReducedMotionChange}
            descricao="Ajustes rápidos para leitura antes de entrar."
          />
        </>
      )}
    </section>
  );
}
