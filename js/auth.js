// ============================================
// MÓDULO DE AUTENTICAÇÃO
// Login, Cadastro e Gerenciamento de Usuário
// ============================================

var usuarioLogado = null;
var tokenAuth = null;

async function inicializarSistemaUsuario() {
  // Verificar token salvo (localStorage ou sessionStorage)
  tokenAuth = localStorage.getItem('token') || sessionStorage.getItem('token');
  
  // Verificar se há token válido
  if (tokenAuth) {
    try {
      var resultado = await API.get('/auth/me', tokenAuth);
      if (resultado.usuario) {
        usuarioLogado = resultado.usuario;
        atualizarUIUsuario();
        
        // Carregar endereço
        var endResult = await API.get('/endereco', tokenAuth);
        if (endResult.endereco) {
          usuarioLogado.endereco = endResult.endereco;
        }
      }
    } catch (erro) {
      console.error('Token inválido:', erro);
      localStorage.removeItem('token');
      tokenAuth = null;
    }
  }

  // Criar modal de login/cadastro
  criarModalUsuario();

  // Botão de usuário no header
  document.getElementById('userBtn').addEventListener('click', function() {
    if (usuarioLogado) {
      document.getElementById('userModal').classList.add('show');
      mostrarPerfil();
    } else {
      document.getElementById('userModal').classList.add('show');
      mostrarLogin();
    }
  });
}

function criarModalUsuario() {
  var modal = document.createElement('div');
  modal.id = 'userModal';
  modal.className = 'user-modal';
  modal.innerHTML = '<div class="user-modal-content">' +
    '<div class="user-header">' +
      '<h3 id="userModalTitle">👤 Minha Conta</h3>' +
      '<button id="closeUser" class="close-user" aria-label="Fechar">✕</button>' +
    '</div>' +
    '<div id="userContent" class="user-content"></div>' +
  '</div>';
  document.body.appendChild(modal);

  document.getElementById('closeUser').addEventListener('click', function() {
    modal.classList.remove('show');
  });

  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.classList.remove('show');
  });
}

function mostrarLogin() {
  var content = document.getElementById('userContent');
  document.getElementById('userModalTitle').textContent = '👤 Entrar';
  content.innerHTML = 
    '<div class="auth-tabs">' +
      '<button class="auth-tab active" data-tab="login">Login</button>' +
      '<button class="auth-tab" data-tab="cadastro">Cadastrar</button>' +
    '</div>' +
    '<div id="loginForm" class="auth-form">' +
      '<input type="email" id="loginEmail" placeholder="E-mail" required />' +
      '<input type="password" id="loginSenha" placeholder="Senha" required />' +
      '<label style="display: flex; align-items: center; gap: 0.5rem; margin: 0.5rem 0; font-size: 0.9rem;">' +
        '<input type="checkbox" id="lembrarMe" checked /> Manter conectado' +
      '</label>' +
      '<button class="btn btn-primary" id="btnLogin">Entrar</button>' +
      '<p class="auth-message" id="loginMessage"></p>' +
    '</div>' +
    '<div id="cadastroForm" class="auth-form" style="display:none">' +
      '<input type="text" id="cadNome" placeholder="Nome completo" required />' +
      '<input type="email" id="cadEmail" placeholder="E-mail" required />' +
      '<input type="password" id="cadSenha" placeholder="Senha" required />' +
      '<input type="tel" id="cadTelefone" placeholder="Telefone" required />' +
      '<label style="display: flex; align-items: center; gap: 0.5rem; margin: 0.5rem 0; font-size: 0.9rem; line-height: 1.3;">' +
        '<input type="checkbox" id="cadWhatsappOptIn" checked /> Quero receber mensagens no WhatsApp sobre meu pedido' +
      '</label>' +
      '<button class="btn btn-primary" id="btnCadastro">Criar conta</button>' +
      '<p class="auth-message" id="cadastroMessage"></p>' +
    '</div>';

  // Tabs
  document.querySelectorAll('.auth-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.auth-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var tabName = tab.getAttribute('data-tab');
      document.getElementById('loginForm').style.display = tabName === 'login' ? 'block' : 'none';
      document.getElementById('cadastroForm').style.display = tabName === 'cadastro' ? 'block' : 'none';
    });
  });

  // Login
  document.getElementById('btnLogin').addEventListener('click', fazerLogin);
  document.getElementById('loginSenha').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') fazerLogin();
  });

  // Cadastro
  document.getElementById('btnCadastro').addEventListener('click', fazerCadastro);
}

async function fazerLogin() {
  var email = document.getElementById('loginEmail').value.trim();
  var senha = document.getElementById('loginSenha').value;
  var lembrarMe = document.getElementById('lembrarMe').checked;
  var message = document.getElementById('loginMessage');

  if (!email || !senha) {
    message.style.color = 'crimson';
    message.textContent = 'Preencha todos os campos';
    return;
  }

  try {
    var resultado = await API.post('/auth/login', { email: email, senha: senha });

    if (resultado.erro) {
      message.style.color = 'crimson';
      message.textContent = resultado.erro;
      return;
    }

    tokenAuth = resultado.token;
    usuarioLogado = resultado.usuario;
    
    // Salvar token apenas se "Manter conectado" estiver marcado
    if (lembrarMe) {
      localStorage.setItem('token', tokenAuth);
    } else {
      // Usar sessionStorage para manter apenas durante a sessão
      sessionStorage.setItem('token', tokenAuth);
    }
    
    // Carregar endereço
    var endResult = await API.get('/endereco', tokenAuth);
    if (endResult.endereco) {
      usuarioLogado.endereco = endResult.endereco;
    }
    
    atualizarUIUsuario();
    document.getElementById('userModal').classList.remove('show');
    message.textContent = '';
  } catch (erro) {
    message.style.color = 'crimson';
    message.textContent = 'Erro ao fazer login';
    console.error('Erro:', erro);
  }
}

async function fazerCadastro() {
  var nome = document.getElementById('cadNome').value.trim();
  var email = document.getElementById('cadEmail').value.trim();
  var senha = document.getElementById('cadSenha').value;
  var telefone = document.getElementById('cadTelefone').value.trim();
  var whatsappOptIn = document.getElementById('cadWhatsappOptIn').checked;
  var message = document.getElementById('cadastroMessage');

  if (!nome || !email || !senha || !telefone) {
    message.style.color = 'crimson';
    message.textContent = 'Preencha todos os campos';
    return;
  }

  try {
    var resultado = await API.post('/auth/cadastro', {
      nome: nome,
      email: email,
      senha: senha,
      telefone: telefone,
      whatsapp_opt_in: whatsappOptIn
    });

    if (resultado.erro) {
      message.style.color = 'crimson';
      message.textContent = resultado.erro;
      return;
    }

    tokenAuth = resultado.token;
    usuarioLogado = resultado.usuario;
    usuarioLogado.endereco = {};
    
    localStorage.setItem('token', tokenAuth);
    
    atualizarUIUsuario();
    document.getElementById('userModal').classList.remove('show');
    alert('🎉 Cadastro realizado com sucesso!');
  } catch (erro) {
    message.style.color = 'crimson';
    message.textContent = 'Erro ao fazer cadastro';
    console.error('Erro:', erro);
  }
}

function mostrarPerfil() {
  var content = document.getElementById('userContent');
  document.getElementById('userModalTitle').textContent = '👤 Meu Perfil';
  var end = usuarioLogado.endereco || {};
  var optIn = usuarioLogado.whatsapp_opt_in || false;
  
  content.innerHTML = 
    '<div class="profile-section">' +
      '<h4>Informações Pessoais</h4>' +
      '<p><strong>Nome:</strong> ' + usuarioLogado.nome + '</p>' +
      '<p><strong>E-mail:</strong> ' + usuarioLogado.email + '</p>' +
      '<div class="form-group">' +
        '<label for="perfilTelefone">Telefone / WhatsApp</label>' +
        '<input type="tel" id="perfilTelefone" placeholder="(DD) 99999-9999" value="' + (usuarioLogado.telefone || '') + '" />' +
      '</div>' +
      '<label style="display: flex; align-items: center; gap: 0.5rem; margin: 0.5rem 0; font-size: 0.9rem; line-height: 1.3;">' +
        '<input type="checkbox" id="perfilWhatsappOptIn" ' + (optIn ? 'checked' : '') + ' /> Desejo receber mensagens no WhatsApp sobre pedidos' +
      '</label>' +
      '<button class="btn btn-primary" id="btnSalvarWhatsapp">Salvar contato e WhatsApp</button>' +
    '</div>' +
    '<div class="profile-section">' +
      '<h4>📍 Endereço de Entrega</h4>' +
      '<div class="address-form">' +
        '<input type="text" id="endRua" placeholder="Rua" value="' + (end.rua || '') + '" />' +
        '<div class="form-row">' +
          '<input type="text" id="endNumero" placeholder="Número" value="' + (end.numero || '') + '" />' +
          '<input type="text" id="endBairro" placeholder="Bairro" value="' + (end.bairro || '') + '" />' +
        '</div>' +
        '<div class="form-row">' +
          '<input type="text" id="endCidade" placeholder="Cidade" value="' + (end.cidade || '') + '" />' +
          '<input type="text" id="endEstado" placeholder="Estado" value="' + (end.estado || '') + '" />' +
        '</div>' +
        '<input type="text" id="endCep" placeholder="CEP" value="' + (end.cep || '') + '" />' +
        '<button class="btn btn-primary" id="btnSalvarEndereco">Salvar Endereço</button>' +
      '</div>' +
    '</div>' +
      '<div style="display: flex; gap: 0.5rem; margin-top: 1rem;">' +
        '<button class="btn btn-secondary" id="btnTrocarConta" style="flex: 1;">🔄 Trocar de Conta</button>' +
      '</div>';

  document.getElementById('btnSalvarEndereco').addEventListener('click', salvarEndereco);
  document.getElementById('btnSalvarWhatsapp').addEventListener('click', salvarPreferenciasWhatsapp);
  document.getElementById('btnTrocarConta').addEventListener('click', trocarConta);
}

async function salvarPreferenciasWhatsapp() {
  var telefone = document.getElementById('perfilTelefone').value.trim();
  var optIn = document.getElementById('perfilWhatsappOptIn').checked;

  if (!telefone) {
    alert('Informe um telefone válido para contato/WhatsApp');
    return;
  }

  try {
    var resultado = await API.post('/usuario/whatsapp', {
      telefone: telefone,
      whatsapp_opt_in: optIn
    }, tokenAuth);

    if (resultado.erro) {
      alert('Erro: ' + resultado.erro);
      return;
    }

    usuarioLogado.telefone = telefone;
    usuarioLogado.whatsapp_opt_in = optIn;
    alert('Preferências de WhatsApp salvas!');
  } catch (erro) {
    console.error('Erro ao salvar preferências de WhatsApp:', erro);
    alert('Erro ao salvar preferências. Tente novamente.');
  }
}

async function salvarEndereco() {
  var endereco = {
    rua: document.getElementById('endRua').value.trim(),
    numero: document.getElementById('endNumero').value.trim(),
    bairro: document.getElementById('endBairro').value.trim(),
    cidade: document.getElementById('endCidade').value.trim(),
    estado: document.getElementById('endEstado').value.trim(),
    cep: document.getElementById('endCep').value.trim()
  };

  if (!endereco.rua || !endereco.numero || !endereco.bairro || !endereco.cidade || !endereco.estado || !endereco.cep) {
    alert('Preencha todos os campos do endereço');
    return;
  }

  try {
    var resultado = await API.post('/endereco', endereco, tokenAuth);
    
    if (resultado.erro) {
      alert('Erro: ' + resultado.erro);
      return;
    }

    usuarioLogado.endereco = endereco;
    alert('✅ Endereço salvo com sucesso!');
  } catch (erro) {
    console.error('Erro ao salvar endereço:', erro);
    alert('Erro ao salvar endereço');
  }
}

function trocarConta() {
  if (confirm('Deseja trocar de conta?\n\nVocê será desconectado e poderá entrar com outra conta.')) {
    // Limpar dados do usuário atual
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    tokenAuth = null;
    usuarioLogado = null;
    
    // Atualizar interface
    atualizarUIUsuario();
    
    // Fechar modal de perfil e abrir tela de login
    document.getElementById('userModal').classList.remove('show');
    
    // Pequeno delay para melhor experiência
    setTimeout(function() {
      document.getElementById('userModal').classList.add('show');
      mostrarLogin();
    }, 300);
  }
}

function atualizarUIUsuario() {
  var userNameEl = document.getElementById('userName');
  if (usuarioLogado) {
    var primeiroNome = usuarioLogado.nome.split(' ')[0];
    userNameEl.textContent = primeiroNome;
  } else {
    userNameEl.textContent = 'Entrar';
  }
}
