// ===================================================================
// MÓDULO DE OFERTAS + AVALIAÇÕES + FRETE
// (Favoritos e Fidelidade removidos do projeto)
// ===================================================================

// ===================================================================
// SEÇÃO 1: OFERTAS E PRODUTOS EM DESTAQUE
// ===================================================================

function calcularPrecoComDesconto(preco, desconto) {
  var precoOriginal = parseFloat(preco);
  var descontoPercent = parseFloat(desconto) || 0;
  var precoFinal = precoOriginal * (1 - descontoPercent / 100);
  return precoFinal;
}

async function mostrarSecaoOfertas() {
  try {
    var lista = [];
    if (typeof produtos !== 'undefined' && Array.isArray(produtos) && produtos.length > 0) {
      lista = produtos;
    } else {
      var data = await API.get('/produtos');
      lista = (data && data.produtos) ? data.produtos : [];
    }
    var ofertas = lista.filter(function (p) { return !!p.em_oferta; });

    if (ofertas.length > 0) {
      criarSecaoOfertas(ofertas);
    }
  } catch (error) {
    console.error('Erro ao carregar ofertas:', error);
  }
}

function criarSecaoOfertas(ofertas) {
  var secao = document.getElementById('secaoOfertas');
  if (!secao) {
    secao = document.createElement('section');
    secao.id = 'secaoOfertas';
    secao.className = 'container ofertas-section';

    var produtosSection = document.getElementById('produtos');
    if (produtosSection && produtosSection.parentNode) {
      produtosSection.parentNode.insertBefore(secao, produtosSection);
    }
  }

  var html = '<h2>🏷️ Ofertas Especiais</h2><div class="ofertas-grid">';

  ofertas.forEach(function (produto) {
    var precoOriginal = parseFloat(produto.preco);
    var precoComDesconto = calcularPrecoComDesconto(precoOriginal, produto.desconto_percentual);

    var nomeSeguro = JSON.stringify(produto.nome || '');
    var emojiSeguro = JSON.stringify(produto.emoji || '🛒');

    html += `
      <div class="oferta-card">
        <div class="oferta-badge">-${produto.desconto_percentual}%</div>
        <div class="oferta-emoji">${produto.emoji}</div>
        <h4>${produto.nome}</h4>
        <div class="oferta-precos">
          <span class="preco-antigo">R$ ${precoOriginal.toFixed(2).replace('.', ',')}</span>
          <span class="preco-oferta">R$ ${precoComDesconto.toFixed(2).replace('.', ',')}</span>
        </div>
        <button class="btn btn-primary" onclick="adicionarAoCarrinho({produto_id: ${produto.id}, name: ${nomeSeguro}, price: ${precoComDesconto}, emoji: ${emojiSeguro}})">
          🛒 Adicionar
        </button>
      </div>
    `;
  });

  html += '</div>';
  if (secao) {
    secao.innerHTML = html;
  }
}

// ===================================================================
// SEÇÃO 2: SISTEMA DE AVALIAÇÕES
// ===================================================================

var avaliacoesCache = {};

async function carregarAvaliacoes(produtoId) {
  try {
    var data = await API.get('/avaliacoes/' + produtoId);
    avaliacoesCache[produtoId] = (data && data.avaliacoes) ? data.avaliacoes : [];
    return avaliacoesCache[produtoId];
  } catch (error) {
    console.error('Erro ao carregar avaliações:', error);
    return [];
  }
}

async function mostrarAvaliacoesProduto(produtoId, nomeProduto) {
  var modal = document.getElementById('avaliacoesModal');
  if (!modal) {
    criarModalAvaliacoes();
    modal = document.getElementById('avaliacoesModal');
  }

  var avaliacoes = await carregarAvaliacoes(produtoId);
  renderizarAvaliacoes(produtoId, nomeProduto, avaliacoes);
  modal.classList.add('show');
}

function criarModalAvaliacoes() {
  var modal = document.createElement('div');
  modal.id = 'avaliacoesModal';
  modal.className = 'cart-modal';
  modal.innerHTML = `
    <div class="cart-modal-content avaliacoes-content">
      <div class="cart-header">
        <h3>⭐ Avaliações</h3>
        <button id="closeAvaliacoes" class="close-cart">✕</button>
      </div>
      <div id="avaliacoesContainer"></div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('closeAvaliacoes').onclick = function () { modal.classList.remove('show'); };
  modal.onclick = function (e) { if (e.target === modal) modal.classList.remove('show'); };
}

function renderizarAvaliacoes(produtoId, nomeProduto, avaliacoes) {
  var container = document.getElementById('avaliacoesContainer');

  var media = avaliacoes.length > 0
    ? (avaliacoes.reduce(function (sum, a) { return sum + a.nota; }, 0) / avaliacoes.length).toFixed(1)
    : 0;

  var html = `
    <div class="avaliacoes-header-info">
      <h4>${nomeProduto}</h4>
      <div class="avaliacoes-resumo">
        <div class="media-estrelas">
          ${gerarEstrelas(media)}
          <span class="media-numero">${media}</span>
        </div>
        <span class="total-avaliacoes">${avaliacoes.length} ${avaliacoes.length === 1 ? 'avaliação' : 'avaliações'}</span>
      </div>
    </div>

    <div class="avaliar-produto">
      <button class="btn btn-primary" onclick="mostrarFormAvaliacao(${produtoId}, '${nomeProduto}')">
        ⭐ Avaliar Produto
      </button>
    </div>

    <div class="avaliacoes-lista">
  `;

  if (avaliacoes.length === 0) {
    html += '<p class="avaliacoes-vazio">Nenhuma avaliação ainda. Seja o primeiro!</p>';
  } else {
    avaliacoes.forEach(function (avaliacao) {
      html += `
        <div class="avaliacao-item">
          <div class="avaliacao-header">
            <strong>${avaliacao.usuario_nome || 'Usuário'}</strong>
            <div class="avaliacao-estrelas">${gerarEstrelas(avaliacao.nota)}</div>
          </div>
          ${avaliacao.comentario ? `<p class="avaliacao-comentario">${avaliacao.comentario}</p>` : ''}
          <small class="avaliacao-data">${new Date(avaliacao.criado_em).toLocaleDateString('pt-BR')}</small>
        </div>
      `;
    });
  }

  html += '</div>';
  container.innerHTML = html;
}

function gerarEstrelas(nota) {
  var notaArredondada = Math.round(nota);
  var estrelas = '';
  for (var i = 1; i <= 5; i++) {
    estrelas += i <= notaArredondada ? '⭐' : '☆';
  }
  return estrelas;
}

function mostrarFormAvaliacao(produtoId, nomeProduto) {
  var container = document.getElementById('avaliacoesContainer');

  container.innerHTML = `
    <div class="form-avaliacao">
      <h4>Avaliar: ${nomeProduto}</h4>

      <div class="form-group">
        <label>Sua nota *</label>
        <div class="estrelas-input">
          ${[1,2,3,4,5].map(function (n) { return `<span class="estrela-btn" data-nota="${n}" onclick="selecionarNota(${n})">☆</span>`; }).join('')}
        </div>
        <input type="hidden" id="notaSelecionada" value="0" />
      </div>

      <div class="form-group">
        <label>Comentário (opcional)</label>
        <textarea id="comentarioAvaliacao" rows="4" placeholder="Compartilhe sua experiência com este produto..."></textarea>
      </div>

      <div class="form-acoes">
        <button class="btn btn-secondary" onclick="mostrarAvaliacoesProduto(${produtoId}, '${nomeProduto}')">Cancelar</button>
        <button class="btn btn-primary" onclick="enviarAvaliacao(${produtoId}, '${nomeProduto}')">Publicar Avaliação</button>
      </div>
    </div>
  `;
}

function selecionarNota(nota) {
  document.getElementById('notaSelecionada').value = nota;

  var estrelas = document.querySelectorAll('.estrela-btn');
  Array.prototype.forEach.call(estrelas, function (estrela, index) {
    estrela.textContent = index < nota ? '⭐' : '☆';
    estrela.classList.toggle('ativa', index < nota);
  });
}

async function enviarAvaliacao(produtoId, nomeProduto) {
  var nota = parseInt(document.getElementById('notaSelecionada').value, 10);
  var comentario = document.getElementById('comentarioAvaliacao').value.trim();

  if (nota === 0) {
    alert('Selecione uma nota de 1 a 5 estrelas');
    return;
  }

  var token = (typeof tokenAuth !== 'undefined' && tokenAuth)
    ? tokenAuth
    : (localStorage.getItem('token') || sessionStorage.getItem('token'));

  if (!token) {
    alert('Faça login para avaliar produtos');
    return;
  }

  try {
    var data = await API.post('/avaliacoes', { produto_id: produtoId, nota: nota, comentario: comentario }, token);

    if (data && data.erro) {
      alert(data.erro || 'Erro ao enviar avaliação');
      return;
    }

    alert('Avaliação enviada com sucesso!');
    mostrarAvaliacoesProduto(produtoId, nomeProduto);
  } catch (error) {
    console.error('Erro:', error);
    alert('Erro ao enviar avaliação');
  }
}

// ===================================================================
// SEÇÃO 3: CÁLCULO DE FRETE POR RAIO DE DISTÂNCIA (COM COORDENADAS REAIS)
// ===================================================================

// CEP FIXO DO MERCADO "BOM FILHO"
var CEP_MERCADO = '68740-180';

// Configuração das zonas de entrega (tipo iFood)
var ZONAS_ENTREGA = [
  { raio: 3, valor: 3.00, tempo: '20-30 min', nome: 'Centro' },
  { raio: 5, valor: 5.00, tempo: '30-40 min', nome: 'Bairros próximos' },
  { raio: 8, valor: 8.00, tempo: '40-50 min', nome: 'Bairros distantes' },
  { raio: 12, valor: 12.00, tempo: '50-60 min', nome: 'Região metropolitana' }
];

// Cache de coordenadas para evitar múltiplas requisições
var cacheCoordenadasCEP = new Map();

// Coordenadas do mercado (serão buscadas na primeira vez)
var coordenadasMercado = null;

// ========== FÓRMULA DE HAVERSINE - Distância real entre 2 pontos ==========
function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  var R = 6371; // Raio da Terra em km
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;

  var a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);

  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var distancia = R * c;

  return distancia; // Retorna distância em km
}

// ========== BUSCAR COORDENADAS REAIS VIA NOMINATIM (OpenStreetMap - GRATUITO) ==========
async function buscarCoordenadasReais(cep) {
  // Verificar cache
  if (cacheCoordenadasCEP.has(cep)) {
    return cacheCoordenadasCEP.get(cep);
  }

  try {
    var cepLimpo = cep.replace(/\D/g, '');

    // 1. Buscar endereço via ViaCEP
    var responseVia = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    var dadosVia = await responseVia.json();

    if (dadosVia.erro) {
      throw new Error('CEP não encontrado');
    }

    // 2. Construir query de busca para Nominatim
    var query = dadosVia.logradouro + ', ' + dadosVia.bairro + ', ' + dadosVia.localidade + ', ' + dadosVia.uf + ', Brasil';
    var encodedQuery = encodeURIComponent(query);

    // 3. Buscar coordenadas via Nominatim (OpenStreetMap)
    var responseNominatim = await fetch(
      'https://nominatim.openstreetmap.org/search?q=' + encodedQuery + '&format=json&limit=1',
      {
        headers: {
          'User-Agent': 'BomFilhoMercado/1.0'
        }
      }
    );

    var dadosNominatim = await responseNominatim.json();

    if (dadosNominatim.length === 0) {
      throw new Error('Coordenadas não encontradas para este endereço');
    }

    var coordenadas = {
      lat: parseFloat(dadosNominatim[0].lat),
      lng: parseFloat(dadosNominatim[0].lon),
      endereco: dadosVia
    };

    // Salvar no cache
    cacheCoordenadasCEP.set(cep, coordenadas);

    return coordenadas;
  } catch (erro) {
    console.error('Erro ao buscar coordenadas:', erro);
    throw erro;
  }
}

// ========== FUNÇÃO PRINCIPAL - Calcula distância real entre mercado e cliente ==========
async function buscarCoordenadas(cep) {
  try {
    // Buscar coordenadas do mercado (primeira vez)
    if (!coordenadasMercado) {
      coordenadasMercado = await buscarCoordenadasReais(CEP_MERCADO);
      console.log('📍 Mercado Bom Filho localizado:', coordenadasMercado.endereco.logradouro + ', ' + coordenadasMercado.endereco.localidade);
    }

    // Buscar coordenadas do cliente
    var coordenadasCliente = await buscarCoordenadasReais(cep);

    // Calcular distância real usando Haversine
    var distanciaReal = calcularDistanciaHaversine(
      coordenadasMercado.lat,
      coordenadasMercado.lng,
      coordenadasCliente.lat,
      coordenadasCliente.lng
    );

    console.log('📏 Distância calculada:', distanciaReal.toFixed(2) + ' km');

    return {
      endereco: coordenadasCliente.endereco.logradouro + ', ' + coordenadasCliente.endereco.bairro + ' - ' + coordenadasCliente.endereco.localidade + '/' + coordenadasCliente.endereco.uf,
      distancia: distanciaReal,
      bairro: coordenadasCliente.endereco.bairro,
      cidade: coordenadasCliente.endereco.localidade
    };
  } catch (erro) {
    console.error('Erro ao buscar coordenadas:', erro);
    return null;
  }
}

async function calcularFrete(cep) {
  var cepLimpo = cep.replace(/\D/g, '');

  if (cepLimpo.length !== 8) {
    return { erro: 'CEP inválido. Digite 8 dígitos.' };
  }

  // Simular delay de busca
  await new Promise(function (resolve) { setTimeout(resolve, 1200); });

  // Buscar coordenadas e calcular distância
  var localizacao = await buscarCoordenadas(cep);

  if (!localizacao) {
    return { erro: 'CEP não encontrado. Verifique e tente novamente.' };
  }

  var distancia = localizacao.distancia;

  // Encontrar zona de entrega baseada na distância
  var zona = null;
  for (var i = 0; i < ZONAS_ENTREGA.length; i++) {
    if (distancia <= ZONAS_ENTREGA[i].raio) {
      zona = ZONAS_ENTREGA[i];
      break;
    }
  }

  // Se estiver fora de todas as zonas
  if (!zona) {
    return {
      erro: 'Endereço fora da área de entrega. Entregamos até ' +
            ZONAS_ENTREGA[ZONAS_ENTREGA.length - 1].raio + ' km.'
    };
  }

  return {
    valor: zona.valor,
    distancia: distancia.toFixed(1),
    tempo: zona.tempo,
    zona: zona.nome,
    endereco: localizacao.endereco,
    tipo: 'Entrega Local'
  };
}

function mostrarCalculoFrete() {
  var container = document.querySelector('.cart-footer');
  if (!container || document.getElementById('freteCalculator')) return;

  var freteHTML = `
    <div id="freteCalculator" class="frete-calculator">
      <h4>📦 Calcular Frete</h4>
      <p class="frete-info-text">Digite seu CEP para ver se entregamos na sua região</p>

      <div class="zonas-info">
        <p><strong>🗺️ Áreas de entrega:</strong></p>
        ${ZONAS_ENTREGA.map(function (z) { return `<span class="zona-tag">Até ${z.raio}km: R$ ${z.valor.toFixed(2)}</span>`; }).join('')}
      </div>

      <div class="frete-input-group">
        <input type="text" id="cepInput" placeholder="00000-000" maxlength="9" />
        <button class="btn btn-small" onclick="buscarFrete()">Calcular</button>
      </div>
      <div id="freteResultado" class="frete-resultado"></div>
    </div>
  `;

  var totalDiv = container.querySelector('.cart-total');
  if (totalDiv) {
    totalDiv.insertAdjacentHTML('beforebegin', freteHTML);
  }

  // Máscara de CEP
  var cepInput = document.getElementById('cepInput');
  if (cepInput) {
    cepInput.oninput = function (e) {
      var value = e.target.value.replace(/\D/g, '');
      if (value.length > 5) {
        e.target.value = value.slice(0, 5) + '-' + value.slice(5, 8);
      } else {
        e.target.value = value;
      }
    };
  }
}

async function buscarFrete() {
  var cep = document.getElementById('cepInput').value;
  var resultado = document.getElementById('freteResultado');

  resultado.innerHTML = '<p class="frete-loading">🔍 Buscando endereço e calculando distância...</p>';

  var frete = await calcularFrete(cep);

  if (frete.erro) {
    resultado.innerHTML = `<p class="frete-erro">❌ ${frete.erro}</p>`;
    return;
  }

  resultado.innerHTML = `
    <div class="frete-info-box">
      <p class="frete-sucesso">
        ✅ Entregamos no seu endereço!
        <button class="fechar-mensagem" onclick="fecharMensagemFrete()" title="Fechar">✕</button>
      </p>
      <div class="frete-detalhes">
        <p><strong>📍 ${frete.endereco}</strong></p>
        <div class="frete-valores">
          <div class="frete-item">
            <span class="frete-label">📏 Distância:</span>
            <span class="frete-valor">${frete.distancia} km</span>
          </div>
          <div class="frete-item">
            <span class="frete-label">💰 Valor:</span>
            <span class="frete-valor destaque">R$ ${frete.valor.toFixed(2).replace('.', ',')}</span>
          </div>
          <div class="frete-item">
            <span class="frete-label">⏱️ Tempo:</span>
            <span class="frete-valor">${frete.tempo}</span>
          </div>
          <div class="frete-item">
            <span class="frete-label">🗺️ Região:</span>
            <span class="frete-valor">${frete.zona}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Atualizar total do carrinho
  cart.frete = frete.valor;
  if (typeof renderizarCarrinho === 'function') {
    renderizarCarrinho();
  }
}

// Função para fechar a mensagem de frete (mantém o valor calculado)
function fecharMensagemFrete() {
  var resultado = document.getElementById('freteResultado');
  if (resultado) {
    resultado.innerHTML = '';
  }
}

// ===================================================================
// EXPORT GLOBAL
// ===================================================================
window.mostrarSecaoOfertas = mostrarSecaoOfertas;
window.mostrarAvaliacoesProduto = mostrarAvaliacoesProduto;
window.selecionarNota = selecionarNota;
window.enviarAvaliacao = enviarAvaliacao;
window.mostrarFormAvaliacao = mostrarFormAvaliacao;
window.calcularFrete = calcularFrete;
window.buscarFrete = buscarFrete;
window.mostrarCalculoFrete = mostrarCalculoFrete;
window.fecharMensagemFrete = fecharMensagemFrete;

console.log('✅ Módulo de Ofertas + Avaliações + Frete carregado');
