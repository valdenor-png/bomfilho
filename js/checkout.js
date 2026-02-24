// ============================================
// MÓDULO DE CHECKOUT - Sistema de Finalização em Etapas
// Etapa 1: Revisar Carrinho
// Etapa 2: Confirmar Endereço e Pagamento (PIX)
// ============================================

var checkoutEtapaAtual = 1;
var dadosCheckout = {
  endereco: null,
  modoEntrega: 'entrega',
  formaPagamento: 'pix',
  taxId: '',
  cupom: null,
  frete: 0
};
var ultimoPedidoImpressao = null; // mantém dados do último pedido para imprimir nota

// ========== ABRIR CHECKOUT ==========
function abrirCheckout() {
  if (cart.items.length === 0) {
    alert('Seu carrinho está vazio!');
    return;
  }

  if (!tokenAuth) {
    alert('Faça login para finalizar o pedido!');
    document.getElementById('userModal').classList.add('show');
    mostrarLogin();
    return;
  }

  checkoutEtapaAtual = 1;
  mostrarModalCheckout();
  renderizarEtapaAtual();
}

// ========== CRIAR MODAL DE CHECKOUT ==========
function mostrarModalCheckout() {
  var modalExistente = document.getElementById('checkoutModal');
  if (modalExistente) {
    modalExistente.classList.add('show');
    document.body.style.overflow = 'hidden'; // Desabilitar scroll do body
    return;
  }

  var modal = document.createElement('div');
  modal.id = 'checkoutModal';
  modal.innerHTML = `
    <div class="checkout-modal-content">
      <div class="checkout-header">
        <h3>🛒 Finalizar Compra</h3>
        <button class="close-cart" onclick="fecharCheckout()">✕</button>
      </div>
      
      <!-- Indicador de Etapas -->
      <div class="checkout-steps">
        <div class="step" data-step="1">
          <div class="step-number">1</div>
          <span>Carrinho</span>
        </div>
        <div class="step-divider"></div>
        <div class="step" data-step="2">
          <div class="step-number">2</div>
          <span>Entrega</span>
        </div>
        <div class="step-divider"></div>
        <div class="step" data-step="3">
          <div class="step-number">3</div>
          <span>Pagamento</span>
        </div>
      </div>
      
      <!-- Conteúdo das Etapas -->
      <div class="checkout-body" id="checkoutBody">
        <!-- Conteúdo dinâmico aqui -->
      </div>
      
      <!-- Rodapé com Botões -->
      <div class="checkout-footer">
        <div class="checkout-footer-content" id="checkoutFooter">
          <!-- Botões dinâmicos aqui -->
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.classList.add('show');
  document.body.style.overflow = 'hidden'; // Desabilitar scroll do body
}

function fecharCheckout() {
  var modal = document.getElementById('checkoutModal');
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = ''; // Reabilitar scroll do body
  }
}

// ========== RENDERIZAR ETAPA ATUAL ==========
function renderizarEtapaAtual() {
  atualizarIndicadorEtapas();
  
  switch(checkoutEtapaAtual) {
    case 1:
      renderizarEtapa1_RevisarCarrinho();
      break;
    case 2:
      renderizarEtapa2_EnderecoEPagamento();
      break;
    case 3:
      renderizarEtapa3_Confirmacao();
      break;
  }
}

// ========== ATUALIZAR INDICADOR DE ETAPAS ==========
function atualizarIndicadorEtapas() {
  document.querySelectorAll('.checkout-steps .step').forEach(function(step) {
    var numEtapa = parseInt(step.dataset.step);
    step.classList.remove('active', 'completed');
    
    if (numEtapa < checkoutEtapaAtual) {
      step.classList.add('completed');
    } else if (numEtapa === checkoutEtapaAtual) {
      step.classList.add('active');
    }
  });
}

// ========== ETAPA 1: REVISAR CARRINHO ==========
// Apenas produtos e subtotal. Frete e pagamento ficam na etapa seguinte.
function renderizarEtapa1_RevisarCarrinho() {
  var body = document.getElementById('checkoutBody');
  var footer = document.getElementById('checkoutFooter');
  
  var subtotal = cart.items.reduce(function(sum, item) {
    var preco = item.preco || item.price || 0;
    var quantidade = item.quantidade || item.qty || 1;
    return sum + (preco * quantidade);
  }, 0);
  
  // Renderizar produtos do carrinho (suporta estruturas name/preco vs nome/price)
  var itensHTML = cart.items.map(function(item) {
    var nome = item.nome || item.name || 'Produto';
    var preco = item.preco || item.price || 0;
    var quantidade = item.quantidade || item.qty || 1;
    return `
      <div class="checkout-item">
        <div class="checkout-item-info">
          <strong>${nome}</strong>
          <div class="checkout-item-details">
            <span>Quantidade: ${quantidade}</span>
            <span>Preço unitário: R$ ${preco.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>
        <div class="checkout-item-total">
          R$ ${(preco * quantidade).toFixed(2).replace('.', ',')}
        </div>
      </div>
    `;
  }).join('');
  
  if (!cart.items.length) {
    itensHTML = '<p style="color:#718096;">Seu carrinho está vazio.</p>';
  }
  
  body.innerHTML = `
    <div class="checkout-grid">
      <div class="checkout-main">
        <div class="checkout-section" style="border-bottom:none;padding-bottom:0.5rem;">
          <h3 style="margin:0;font-size:1.4rem;color:var(--text);">Meu Carrinho</h3>
        </div>
        <div class="checkout-section">
          <h4>📦 Revisar Itens do Pedido</h4>
          <div class="checkout-items-list">
            ${itensHTML}
          </div>  
        </div>
      </div>
      
      <div class="checkout-sidebar">
        <div class="  checkout-resumo">
          <h4>💵 Resumo do Pedido</h4>
          <div class="resumo-linha">
            <span>Subtotal (${cart.items.length} ${cart.items.length === 1 ? 'item' : 'itens'}):</span>
            <strong>R$ ${subtotal.toFixed(2).replace('.', ',')}</strong>
          </div>
          <div class="resumo-linha resumo-total">
            <span>Total:</span>
            <strong>R$ ${subtotal.toFixed(2).replace('.', ',')}</strong>
          </div>
        </div>
        <div style="display:flex; gap:0.5rem; margin-top:1rem;">
          <button class="btn btn-secondary" style="flex:1;" onclick="fecharCheckout()">← Continuar Comprando</button>
          <button class="btn btn-success" style="flex:1;" onclick="proximaEtapa()">Continuar →</button>
        </div>
      </div>
    </div>
  `;
}

// ========== RENDERIZAR CALCULADORA DE FRETE NA ETAPA 1 ==========
function renderizarCalculadoraFrete() {
  if (!window.mostrarCalculoFrete) {
    return '<p>Calculadora de frete não disponível</p>';
  }
  
  return `
    <p class="frete-info-text">Digite seu CEP para calcular o frete</p>
    
    <div class="zonas-info">
      <p><strong>🗺️ Áreas de entrega:</strong></p>
      <span class="zona-tag">Até 3km: R$ 3.00</span>
      <span class="zona-tag">Até 5km: R$ 5.00</span>
      <span class="zona-tag">Até 8km: R$ 8.00</span>
      <span class="zona-tag">Até 12km: R$ 12.00</span>
    </div>
    
    <div class="frete-input-group">
      <input type="text" id="cepCheckout" placeholder="00000-000" maxlength="9" />
      <button class="btn btn-small" onclick="calcularFreteCheckout()">Calcular</button>
    </div>
    <div id="freteResultadoCheckout" class="frete-resultado"></div>
  `;
}

// ========== CALCULAR FRETE NO CHECKOUT ==========
async function calcularFreteCheckout() {
  var cep = document.getElementById('cepCheckout').value;
  var resultado = document.getElementById('freteResultadoCheckout');
  
  // Aplicar máscara
  cep = cep.replace(/\D/g, '');
  if (cep.length > 5) {
    document.getElementById('cepCheckout').value = cep.slice(0, 5) + '-' + cep.slice(5, 8);
  }
  
  resultado.innerHTML = '<p class="frete-loading">🔍 Calculando frete...</p>';
  
  var frete = await calcularFrete(cep);
  
  if (frete.erro) {
    resultado.innerHTML = `<p class="frete-erro">❌ ${frete.erro}</p>`;
    return;
  }
  
  // Salvar dados do frete (desabilitado para testes)
  cart.frete = 0; // frete.valor;
  dadosCheckout.endereco = {
    cep: cep,
    endereco: frete.endereco,
    distancia: frete.distancia,
    zona: frete.zona
  };
  
  resultado.innerHTML = `
    <div class="frete-info-box">
      <p class="frete-sucesso">
        ✅ Entregamos no seu endereço!
        <button class="fechar-mensagem" onclick="fecharMensagemFreteCheckout()" title="Fechar">✕</button>
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
        </div>
      </div>
    </div>
  `;
  
  // Atualizar interface na etapa atual (1 ou 2)
  renderizarEtapaAtual();
}

function fecharMensagemFreteCheckout() {
  document.getElementById('freteResultadoCheckout').innerHTML = '';
}

// ========== ETAPA 2: ENDEREÇO E PAGAMENTO ==========
function renderizarEtapa2_EnderecoEPagamento() {
  var body = document.getElementById('checkoutBody');
  var footer = document.getElementById('checkoutFooter');
  
  var subtotal = cart.items.reduce(function(sum, item) {
    var preco = item.preco || item.price || 0;
    var quantidade = item.quantidade || item.qty || 1;
    return sum + (preco * quantidade);
  }, 0);
  var total = subtotal + (cart.frete || 0);
  var modoEntrega = dadosCheckout.modoEntrega || 'entrega';
  var freteCalculado = modoEntrega === 'entrega' ? dadosCheckout.endereco : null;
  var podeConfirmar = (modoEntrega === 'retirada') || !!freteCalculado;
  
  body.innerHTML = `
    <div class="checkout-grid">
      <div class="checkout-main">
        <div class="checkout-section">
          <h4>🚚 Entrega / Retirada</h4>
          <div class="entrega-modo">
            <label class="entrega-opcao">
              <input type="radio" name="modoEntrega" value="entrega" ${modoEntrega === 'entrega' ? 'checked' : ''} onchange="atualizarModoEntrega('entrega')">
              <span>Entrega</span>
            </label>
            <label class="entrega-opcao">
              <input type="radio" name="modoEntrega" value="retirada" ${modoEntrega === 'retirada' ? 'checked' : ''} onchange="atualizarModoEntrega('retirada')">
              <span>Retirada na loja (sem taxa)</span>
            </label>
          </div>

          <div style="display: ${modoEntrega === 'entrega' ? 'block' : 'none'};">
            <h4 style="margin-top: 1.2rem;">📍 Calcular Frete</h4>
            ${renderizarCalculadoraFrete()}
            ${!freteCalculado ? `
              <div class="alerta-frete" style="margin-top: 1rem;">
                ⚠️ Calcule o frete para prosseguir para pagamento
              </div>
            ` : ''}
          </div>

          <div class="retirada-info" style="display: ${modoEntrega === 'retirada' ? 'block' : 'none'};">
            ✅ Você não paga taxa de entrega. O pedido fica separado e embalado para retirada.
          </div>
        </div>

        <div class="checkout-section" style="display: ${modoEntrega === 'entrega' && freteCalculado ? 'block' : 'none'};">
          <h4>📍 Endereço de Entrega</h4>
          <div class="endereco-resumo">
            <p><strong>CEP:</strong> ${freteCalculado ? dadosCheckout.endereco.cep : ''}</p>
            <p><strong>Endereço:</strong> ${freteCalculado ? dadosCheckout.endereco.endereco : ''}</p>
            <p><strong>Distância:</strong> ${freteCalculado ? dadosCheckout.endereco.distancia : ''} km</p>
            <p><strong>Frete:</strong> R$ ${(cart.frete || 0).toFixed(2).replace('.', ',')}</p>
          </div>
          
          <div class="form-group">
            <label for="numeroEndereco">Número da casa/apto *</label>
            <input type="text" id="numeroEndereco" placeholder="Ex: 123" ${freteCalculado ? '' : 'disabled'} />
          </div>
          
          <div class="form-group">
            <label for="complemento">Complemento (opcional)</label>
            <input type="text" id="complemento" placeholder="Ex: Apto 45, Bloco B" ${freteCalculado ? '' : 'disabled'} />
          </div>
          
          <div class="form-group">
            <label for="pontoReferencia">Ponto de referência (opcional)</label>
            <input type="text" id="pontoReferencia" placeholder="Ex: Próximo ao mercado" ${freteCalculado ? '' : 'disabled'} />
          </div>
        </div>
        
        <div class="checkout-section" style="display: ${podeConfirmar ? 'block' : 'none'};">
          <h4>💰 Forma de Pagamento</h4>
          <div class="payment-methods">
            <label class="payment-option">
              <input type="radio" name="payment" value="pix" checked onchange="atualizarFormaPagamento('pix')">
              <div class="payment-card">
                <span class="payment-icon">📱</span>
                <div>
                  <strong>PIX</strong>
                  <small>Pagamento instantâneo - Aprovação imediata</small>
                </div>
              </div>
            </label>
          </div>

          <div class="form-group" style="margin-top: 1rem;">
            <label for="cpfCheckout">CPF do pagador *</label>
            <input type="text" id="cpfCheckout" placeholder="000.000.000-00" value="${(dadosCheckout.taxId || '')}" oninput="mascaraCpfCheckout()" />
            <small style="color:#666; display:block; margin-top:0.35rem;">Obrigatório para gerar o QR Code PIX (PagBank).</small>
          </div>

          <div class="pix-info">
            <p>🔑 Você receberá o código PIX após confirmar o pedido</p>
            <p>⚡ Pagamento confirmado em até 5 minutos</p>
          </div>
        </div>
      </div>
      
      <div class="checkout-sidebar">
        <div class="checkout-resumo">
          <h4>💵 Resumo do Pagamento</h4>
          <div class="resumo-linha">
            <span>Subtotal:</span>
            <strong>R$ ${subtotal.toFixed(2).replace('.', ',')}</strong>
          </div>
          <div class="resumo-linha">
            <span>Entrega:</span>
            <strong>${modoEntrega === 'retirada' ? 'Retirada (R$ 0,00)' : ('R$ ' + (cart.frete || 0).toFixed(2).replace('.', ','))}</strong>
          </div>
          <div class="resumo-linha resumo-total">
            <span>Total a pagar:</span>
            <strong>R$ ${total.toFixed(2).replace('.', ',')}</strong>
          </div>
        </div>
        <div style="display:flex; gap:0.5rem; margin-top:1rem;">
          <button class="btn btn-secondary" style="flex:1;" onclick="voltarEtapa()">← Voltar</button>
          <button class="btn btn-success" style="flex:1;" onclick="confirmarPedidoFinal()" ${podeConfirmar ? '' : 'disabled'}>Confirmar 💳</button>
        </div>
      </div>
    </div>
  `;

  // Pré-preencher CEP com endereço salvo do usuário e calcular automaticamente uma vez
  if (modoEntrega === 'entrega' && !freteCalculado && usuarioLogado && usuarioLogado.endereco && usuarioLogado.endereco.cep) {
    var cepSalvo = usuarioLogado.endereco.cep;
    var cepInput = document.getElementById('cepCheckout');
    if (cepInput) {
      cepInput.value = cepSalvo;
      if (!window._freteAutoPreenchido) {
        window._freteAutoPreenchido = true;
        setTimeout(function() {
          calcularFreteCheckout();
        }, 200);
      }
    }
  }
}

function atualizarModoEntrega(modo) {
  dadosCheckout.modoEntrega = modo;

  if (modo === 'retirada') {
    cart.frete = 0;
    dadosCheckout.endereco = {
      cep: '',
      endereco: 'RETIRADA NA LOJA',
      distancia: 0,
      zona: 'retirada'
    };
  } else {
    // Para entrega, exige calcular frete novamente
    dadosCheckout.endereco = null;
  }

  renderizarEtapaAtual();
}

function atualizarFormaPagamento(tipo) {
  dadosCheckout.formaPagamento = tipo;
}

function mascaraCpfCheckout() {
  var el = document.getElementById('cpfCheckout');
  if (!el) return;

  var v = (el.value || '').replace(/\D/g, '').slice(0, 11);
  if (v.length <= 3) {
    el.value = v;
  } else if (v.length <= 6) {
    el.value = v.slice(0, 3) + '.' + v.slice(3);
  } else if (v.length <= 9) {
    el.value = v.slice(0, 3) + '.' + v.slice(3, 6) + '.' + v.slice(6);
  } else {
    el.value = v.slice(0, 3) + '.' + v.slice(3, 6) + '.' + v.slice(6, 9) + '-' + v.slice(9);
  }

  dadosCheckout.taxId = el.value;
}

// ========== CONFIRMAR PEDIDO FINAL ==========
async function confirmarPedidoFinal() {
  var modoEntrega = dadosCheckout.modoEntrega || 'entrega';

  if (modoEntrega === 'entrega') {
    if (!dadosCheckout.endereco) {
      alert('Calcule o frete antes de confirmar o pedido.');
      return;
    }
  }

  var numero = '';
  var complemento = '';
  var pontoReferencia = '';

  if (modoEntrega === 'entrega') {
    numero = document.getElementById('numeroEndereco').value;
    if (!numero) {
      alert('Por favor, informe o número do endereço');
      return;
    }

    complemento = document.getElementById('complemento').value || '';
    pontoReferencia = document.getElementById('pontoReferencia').value || '';
  }
  
  // Snapshot para impressão antes de limpar carrinho
  var itensSnapshot = cart.items.map(function(item) {
    return {
      nome: item.nome || item.name,
      quantidade: item.quantidade || item.qty || 1,
      preco: item.preco || item.price || 0
    };
  });

  // Montar objeto do pedido
  var cpfEl = document.getElementById('cpfCheckout');
  var cpfDigitado = cpfEl ? (cpfEl.value || '') : '';
  var taxIdDigits = cpfDigitado.replace(/\D/g, '');
  dadosCheckout.taxId = cpfDigitado;

  if ((dadosCheckout.formaPagamento || 'pix') === 'pix') {
    if (!taxIdDigits || taxIdDigits.length < 11) {
      alert('Informe um CPF válido para gerar o QR Code do PIX.');
      return;
    }
  }

  var subtotalPedido = cart.items.reduce(function(soma, item) {
    var precoItem = item.preco || item.price || 0;
    var quantidadeItem = item.quantidade || item.qty || 1;
    return soma + (precoItem * quantidadeItem);
  }, 0);

  var pedido = {
    itens: cart.items.map(function(item) {
      return {
        produto_id: item.produto_id || item.id,
        nome: item.nome || item.name,
        preco: item.preco || item.price,
        quantidade: item.quantidade || item.qty || 1
      };
    }),
    tax_id: taxIdDigits,
    endereco: {
      tipo: modoEntrega,
      cep: modoEntrega === 'entrega' ? dadosCheckout.endereco.cep : '',
      endereco_completo: modoEntrega === 'entrega' ? dadosCheckout.endereco.endereco : 'RETIRADA NA LOJA',
      numero: numero,
      complemento: complemento,
      ponto_referencia: pontoReferencia
    },
    frete: modoEntrega === 'retirada' ? 0 : cart.frete,
    forma_pagamento: dadosCheckout.formaPagamento,
    total: subtotalPedido + (modoEntrega === 'retirada' ? 0 : cart.frete)
  };
  
  try {
    var response = await fetch(API_CONFIG.baseURL + '/pedidos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + tokenAuth
      },
      body: JSON.stringify(pedido)
    });
    
    var data = await response.json();
    
    if (response.ok && data.pedido_id) {
      // Guardar dados para impressão
      var subtotal = itensSnapshot.reduce(function(s, i) { return s + (i.preco * i.quantidade); }, 0);
      ultimoPedidoImpressao = {
        pedidoId: data.pedido_id,
        itens: itensSnapshot,
        subtotal: subtotal,
        frete: modoEntrega === 'retirada' ? 0 : cart.frete,
        total: data.total,
        pixCodigo: data.pix_codigo,
        pixQrCode: data.pix_qrcode,
        endereco: modoEntrega === 'entrega' ? {
          cep: dadosCheckout.endereco.cep,
          logradouro: dadosCheckout.endereco.endereco,
          numero: numero,
          complemento: complemento,
          referencia: pontoReferencia
        } : {
          cep: '',
          logradouro: 'RETIRADA NA LOJA',
          numero: '',
          complemento: '',
          referencia: ''
        },
        cliente: {
          nome: usuarioLogado.nome,
          telefone: usuarioLogado.telefone || ''
        }
      };

      // Limpar carrinho
      cart.items = [];
      cart.total = 0;
      cart.frete = 0;
      if (window.updateCartUI) {
        window.updateCartUI();
      }
      
      // Mostrar tela de sucesso
      checkoutEtapaAtual = 3;
      renderizarEtapa3_Confirmacao(data.pedido_id, data.pix_codigo, data.pix_qrcode, data.pix_erro);
    } else {
      var mensagemErro = (data && (data.erro || data.mensagem)) || 'Falha ao criar pedido';
      alert('Erro ao criar pedido: ' + mensagemErro);
    }
  } catch (erro) {
    console.error('Erro ao confirmar pedido:', erro);
    alert('Erro ao processar pedido. Tente novamente.');
  }
}

// ========== ETAPA 3: CONFIRMAÇÃO ==========
function renderizarEtapa3_Confirmacao(pedidoId, codigoPix, qrCodeUrl, pixErro) {
  var body = document.getElementById('checkoutBody');
  var footer = document.getElementById('checkoutFooter');
  
  var qrCodeHtml = '';
  if (qrCodeUrl) {
    qrCodeHtml = `
      <div class="pix-qrcode">
        <img src="${qrCodeUrl}" alt="QR Code PIX" style="max-width: 250px; border: 2px solid #ccc; border-radius: 8px; padding: 10px; background: white;">
        <p style="font-size: 0.85rem; color: #666; margin-top: 0.5rem;">Escaneie com o app do banco</p>
      </div>
    `;
  }

  var erroPixHtml = '';
  if (!qrCodeUrl && pixErro) {
    erroPixHtml = `
      <div style="margin-top: 0.75rem; padding: 0.75rem; border: 1px solid #f5c2c7; background: #f8d7da; color: #842029; border-radius: 8px;">
        <strong>⚠️ Não foi possível gerar o QR Code agora.</strong><br>
        <span style="font-size: 0.9rem;">${pixErro}</span>
      </div>
    `;
  }
  
  body.innerHTML = `
    <div class="checkout-sucesso">
      <div class="sucesso-icon">✅</div>
      <h3>Pedido Confirmado!</h3>
      <p>Pedido #${pedidoId}</p>
      
      <div class="pix-payment">
        <h4>💳 Pagamento via PIX</h4>
        ${qrCodeHtml}
        ${erroPixHtml}
        <div class="pix-code" style="margin-top: 1rem;">
          <label style="font-size: 0.9rem; color: #666; display: block; margin-bottom: 0.5rem;">📋 Código Copia e Cola:</label>
          <code>${codigoPix || 'Aguardando geração...'}</code>
        </div>
        <button class="btn btn-secondary" onclick="copiarCodigoPix('${codigoPix}')" style="margin-top: 1rem;">
          📋 Copiar Código PIX
        </button>
        <p class="pix-instrucoes">
          Abra o app do seu banco, escolha PIX e ${qrCodeHtml ? 'escaneie o QR Code ou' : ''} cole o código acima
        </p>
      </div>
      
      <div class="proximos-passos">
        <h4>📦 Próximos Passos</h4>
        <ol>
          <li>Realize o pagamento via PIX</li>
          <li>Aguarde a confirmação (até 5 minutos)</li>
          <li>Seu pedido será preparado e entregue</li>
        </ol>
      </div>
    </div>
  `;
}

// Imprimir nota simples para o entregador
function imprimirNotaEntrega() {
  if (!ultimoPedidoImpressao) {
    alert('Nenhum pedido disponível para impressão.');
    return;
  }

  var p = ultimoPedidoImpressao;
  var itensHTML = p.itens.map(function(item) {
    var subtotal = (item.preco * item.quantidade).toFixed(2).replace('.', ',');
    return `<tr><td>${item.nome}</td><td style="text-align:center;">${item.quantidade}</td><td style="text-align:right;">R$ ${item.preco.toFixed(2).replace('.', ',')}</td><td style="text-align:right;">R$ ${subtotal}</td></tr>`;
  }).join('');

  var doc = `<!doctype html>
  <html><head><meta charset="utf-8"><title>Nota de Entrega</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 16px; color: #111; }
    h2 { margin: 0 0 8px; }
    .box { border: 1px solid #ddd; padding: 12px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border-bottom: 1px solid #eee; padding: 6px; font-size: 13px; }
    th { text-align: left; background: #f7f7f7; }
    .total { font-weight: bold; }
  </style></head><body>
  <h2>Nota de Entrega - Pedido #${p.pedidoId}</h2>
  <div class="box">
    <div><strong>Cliente:</strong> ${p.cliente.nome}</div>
    <div><strong>Telefone:</strong> ${p.cliente.telefone || '---'}</div>
  </div>
  <div class="box">
    <div><strong>Endereço:</strong> ${p.endereco.logradouro || ''}, ${p.endereco.numero || ''}</div>
    <div><strong>Complemento/Ref:</strong> ${p.endereco.complemento || ''} ${p.endereco.referencia ? ' | ' + p.endereco.referencia : ''}</div>
    <div><strong>CEP:</strong> ${p.endereco.cep || ''}</div>
  </div>
  <div class="box">
    <table>
      <thead><tr><th>Produto</th><th>Qtd</th><th>Unitário</th><th>Subtotal</th></tr></thead>
      <tbody>${itensHTML}</tbody>
      <tfoot>
        <tr><td colspan="3" class="total">Subtotal</td><td style="text-align:right;" class="total">R$ ${p.subtotal.toFixed(2).replace('.', ',')}</td></tr>
        <tr><td colspan="3" class="total">Frete</td><td style="text-align:right;" class="total">R$ ${(p.frete || 0).toFixed(2).replace('.', ',')}</td></tr>
        <tr><td colspan="3" class="total">Total</td><td style="text-align:right;" class="total">R$ ${(p.total || (p.subtotal + (p.frete||0))).toFixed(2).replace('.', ',')}</td></tr>
      </tfoot>
    </table>
  </div>
  <script>window.print();</script>
  </body></html>`;

  var win = window.open('', '_blank');
  win.document.write(doc);
  win.document.close();
}

function copiarCodigoPix(codigo) {
  navigator.clipboard.writeText(codigo);
  alert('Código PIX copiado!');
}

function fecharCheckoutESair() {
  fecharCheckout();
  checkoutEtapaAtual = 1;
}

// ========== NAVEGAÇÃO ENTRE ETAPAS ==========
function proximaEtapa() {
  if (checkoutEtapaAtual < 3) {
    checkoutEtapaAtual++;
    renderizarEtapaAtual();
  }
}

function voltarEtapa() {
  if (checkoutEtapaAtual > 1) {
    checkoutEtapaAtual--;
    renderizarEtapaAtual();
  }
}

// ========== EXPORTS ==========
window.abrirCheckout = abrirCheckout;
window.fecharCheckout = fecharCheckout;
window.proximaEtapa = proximaEtapa;
window.voltarEtapa = voltarEtapa;
window.calcularFreteCheckout = calcularFreteCheckout;
window.fecharMensagemFreteCheckout = fecharMensagemFreteCheckout;
window.atualizarFormaPagamento = atualizarFormaPagamento;
window.confirmarPedidoFinal = confirmarPedidoFinal;
window.copiarCodigoPix = copiarCodigoPix;
window.fecharCheckoutESair = fecharCheckoutESair;
