// ============================================
// CLASSE DE AUTENTICAÇÃO
// ============================================

class AuthManager {
  constructor(apiClient) {
    this.api = apiClient;
    this.usuario = null;
    this.token = null;
    this.modal = null;
  }

  async inicializar() {
    this.carregarToken();
    await this.verificarTokenValido();
    this.criarModal();
    this.configurarEventos();
  }

  carregarToken() {
    this.token = localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  salvarToken(token, lembrar = true) {
    this.token = token;
    if (lembrar) {
      localStorage.setItem('token', token);
    } else {
      sessionStorage.setItem('token', token);
    }
  }

  limparToken() {
    this.token = null;
    this.usuario = null;
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
  }

  async verificarTokenValido() {
    if (!this.token) return false;

    try {
      const resultado = await this.api.get('/auth/me', this.token);
      if (resultado.usuario) {
        this.usuario = resultado.usuario;
        await this.carregarEndereco();
        this.atualizarUI();
        return true;
      }
    } catch (erro) {
      console.error('Token inválido:', erro);
      this.limparToken();
    }
    return false;
  }

  async carregarEndereco() {
    try {
      const resultado = await this.api.get('/endereco', this.token);
      if (resultado.endereco) {
        this.usuario.endereco = resultado.endereco;
      }
    } catch (erro) {
      console.error('Erro ao carregar endereço:', erro);
    }
  }

  criarModal() {
    this.modal = document.createElement('div');
    this.modal.id = 'userModal';
    this.modal.className = 'user-modal';
    this.modal.innerHTML = `
      <div class="user-modal-content">
        <div class="user-header">
          <h3 id="userModalTitle">👤 Minha Conta</h3>
          <button id="closeUser" class="close-user" aria-label="Fechar">✕</button>
        </div>
        <div id="userContent" class="user-content"></div>
      </div>
    `;
    document.body.appendChild(this.modal);

    document.getElementById('closeUser').addEventListener('click', () => this.fecharModal());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.fecharModal();
    });
  }

  configurarEventos() {
    document.getElementById('userBtn').addEventListener('click', () => {
      if (this.usuario) {
        this.mostrarPerfil();
      } else {
        this.mostrarLogin();
      }
      this.abrirModal();
    });
  }

  abrirModal() {
    this.modal.classList.add('show');
  }

  fecharModal() {
    this.modal.classList.remove('show');
  }

  mostrarLogin() {
    const content = document.getElementById('userContent');
    document.getElementById('userModalTitle').textContent = '👤 Entrar';
    
    content.innerHTML = `
      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="login">Login</button>
        <button class="auth-tab" data-tab="cadastro">Cadastrar</button>
      </div>
      <div id="loginForm" class="auth-form">
        <input type="email" id="loginEmail" placeholder="E-mail" required />
        <input type="password" id="loginSenha" placeholder="Senha" required />
        <label style="display: flex; align-items: center; gap: 0.5rem; margin: 0.5rem 0; font-size: 0.9rem;">
          <input type="checkbox" id="lembrarMe" checked /> Manter conectado
        </label>
        <button class="btn btn-primary" id="btnLogin">Entrar</button>
        <p class="auth-message" id="loginMessage"></p>
      </div>
      <div id="cadastroForm" class="auth-form" style="display:none">
        <input type="text" id="cadNome" placeholder="Nome completo" required />
        <input type="email" id="cadEmail" placeholder="E-mail" required />
        <input type="password" id="cadSenha" placeholder="Senha" required />
        <input type="tel" id="cadTelefone" placeholder="Telefone" required />
        <button class="btn btn-primary" id="btnCadastro">Criar conta</button>
        <p class="auth-message" id="cadastroMessage"></p>
      </div>
    `;

    this.configurarTabs();
    document.getElementById('btnLogin').addEventListener('click', () => this.login());
    document.getElementById('loginSenha').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.login();
    });
    document.getElementById('btnCadastro').addEventListener('click', () => this.cadastrar());
  }

  configurarTabs() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabName = tab.getAttribute('data-tab');
        document.getElementById('loginForm').style.display = tabName === 'login' ? 'block' : 'none';
        document.getElementById('cadastroForm').style.display = tabName === 'cadastro' ? 'block' : 'none';
      });
    });
  }

  async login() {
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;
    const lembrarMe = document.getElementById('lembrarMe').checked;
    const message = document.getElementById('loginMessage');

    if (!email || !senha) {
      this.mostrarMensagem(message, 'Preencha todos os campos', 'erro');
      return;
    }

    try {
      const resultado = await this.api.post('/auth/login', { email, senha });

      if (resultado.erro) {
        this.mostrarMensagem(message, resultado.erro, 'erro');
        return;
      }

      this.usuario = resultado.usuario;
      this.salvarToken(resultado.token, lembrarMe);
      await this.carregarEndereco();
      this.atualizarUI();
      this.fecharModal();
      message.textContent = '';
    } catch (erro) {
      this.mostrarMensagem(message, 'Erro ao fazer login', 'erro');
      console.error('Erro:', erro);
    }
  }

  async cadastrar() {
    const nome = document.getElementById('cadNome').value.trim();
    const email = document.getElementById('cadEmail').value.trim();
    const senha = document.getElementById('cadSenha').value;
    const telefone = document.getElementById('cadTelefone').value.trim();
    const message = document.getElementById('cadastroMessage');

    if (!nome || !email || !senha || !telefone) {
      this.mostrarMensagem(message, 'Preencha todos os campos', 'erro');
      return;
    }

    try {
      const resultado = await this.api.post('/auth/cadastro', { nome, email, senha, telefone });

      if (resultado.erro) {
        this.mostrarMensagem(message, resultado.erro, 'erro');
        return;
      }

      this.usuario = resultado.usuario;
      this.usuario.endereco = {};
      this.salvarToken(resultado.token);
      this.atualizarUI();
      this.fecharModal();
      alert('🎉 Cadastro realizado com sucesso!');
    } catch (erro) {
      this.mostrarMensagem(message, 'Erro ao fazer cadastro', 'erro');
      console.error('Erro:', erro);
    }
  }

  mostrarPerfil() {
    const content = document.getElementById('userContent');
    document.getElementById('userModalTitle').textContent = '👤 Meu Perfil';
    const end = this.usuario.endereco || {};
    
    content.innerHTML = `
      <div class="profile-section">
        <h4>Informações Pessoais</h4>
        <p><strong>Nome:</strong> ${this.usuario.nome}</p>
        <p><strong>E-mail:</strong> ${this.usuario.email}</p>
        <p><strong>Telefone:</strong> ${this.usuario.telefone}</p>
      </div>
      <div class="profile-section">
        <h4>📍 Endereço de Entrega</h4>
        <div class="address-form">
          <input type="text" id="endRua" placeholder="Rua" value="${end.rua || ''}" />
          <div class="form-row">
            <input type="text" id="endNumero" placeholder="Número" value="${end.numero || ''}" />
            <input type="text" id="endBairro" placeholder="Bairro" value="${end.bairro || ''}" />
          </div>
          <div class="form-row">
            <input type="text" id="endCidade" placeholder="Cidade" value="${end.cidade || ''}" />
            <input type="text" id="endEstado" placeholder="Estado" value="${end.estado || ''}" />
          </div>
          <input type="text" id="endCep" placeholder="CEP" value="${end.cep || ''}" />
          <button class="btn btn-primary" id="btnSalvarEndereco">Salvar Endereço</button>
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
        <button class="btn btn-secondary" id="btnTrocarConta" style="flex: 1;">🔄 Trocar de Conta</button>
      </div>
    `;

    document.getElementById('btnSalvarEndereco').addEventListener('click', () => this.salvarEndereco());
    document.getElementById('btnTrocarConta').addEventListener('click', () => this.trocarConta());
  }

  async salvarEndereco() {
    const endereco = {
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
      const resultado = await this.api.post('/endereco', endereco, this.token);
      
      if (resultado.erro) {
        alert('Erro: ' + resultado.erro);
        return;
      }

      this.usuario.endereco = endereco;
      alert('✅ Endereço salvo com sucesso!');
    } catch (erro) {
      console.error('Erro ao salvar endereço:', erro);
      alert('Erro ao salvar endereço');
    }
  }

  trocarConta() {
    if (confirm('Deseja trocar de conta?\n\nVocê será desconectado e poderá entrar com outra conta.')) {
      this.limparToken();
      this.atualizarUI();
      this.fecharModal();
      
      setTimeout(() => {
        this.mostrarLogin();
        this.abrirModal();
      }, 300);
    }
  }

  atualizarUI() {
    const userNameEl = document.getElementById('userName');
    if (this.usuario) {
      const primeiroNome = this.usuario.nome.split(' ')[0];
      userNameEl.textContent = primeiroNome;
    } else {
      userNameEl.textContent = 'Entrar';
    }
  }

  mostrarMensagem(element, texto, tipo) {
    element.style.color = tipo === 'erro' ? 'crimson' : 'green';
    element.textContent = texto;
  }

  estaLogado() {
    return this.usuario !== null;
  }

  getToken() {
    return this.token;
  }

  getUsuario() {
    return this.usuario;
  }
}
