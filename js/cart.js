// ============================================
// MÓDULO DE CARRINHO DE COMPRAS
// Gerenciamento do carrinho e finalização de pedidos
// ============================================

var cart = { items: [], total: 0 };

function inicializarCarrinho() {
  var cartCountEl = document.getElementById('cartCount');
  var cartBtn = document.getElementById('cartBtn');
  
  // Criar modal do carrinho
  criarModalCarrinho();
  
  function updateCartUI() {
    if (cartCountEl) cartCountEl.textContent = cart.items.length;
    atualizarModalCarrinho();
  }

  function criarModalCarrinho() {
    var modal = document.createElement('div');
    modal.id = 'cartModal';
    modal.className = 'cart-modal';
    modal.innerHTML = '<div class="cart-modal-content">' +
      '<div class="cart-header">' +
        '<h3>🛒 Meu Carrinho</h3>' +
        '<button id="closeCart" class="close-cart" aria-label="Fechar">✕</button>' +
      '</div>' +
      '<div id="cartItems" class="cart-items"></div>' +
      '<div class="cart-footer">' +
        '<div class="cart-total">' +
          '<strong>Total:</strong> <span id="cartTotal">R$ 0,00</span>' +
        '</div>' +
        '<button id="clearCart" class="btn btn-secondary">Limpar Carrinho</button>' +
        '<button id="checkoutBtn" class="btn btn-primary">Finalizar Pedido</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(modal);

    // Event listeners do modal
    cartBtn.addEventListener('click', function() {
      modal.classList.add('show');
    });

    document.getElementById('closeCart').addEventListener('click', function() {
      modal.classList.remove('show');
    });

    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.classList.remove('show');
    });

    document.getElementById('clearCart').addEventListener('click', function() {
      if (confirm('Deseja realmente limpar o carrinho?')) {
        cart.items = [];
        cart.total = 0;
        updateCartUI();
      }
    });

    document.getElementById('checkoutBtn').addEventListener('click', function() {
      // Usar novo sistema de checkout em etapas
      abrirCheckout();
      // Fechar modal de carrinho ao abrir o checkout
      modal.classList.remove('show');
    });
  }

  function finalizarPedido() {
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

    // Criar modal de checkout
    mostrarModalCheckout();
  }

  function mostrarModalCheckout() {
    var checkoutModal = document.getElementById('checkoutModal');
    if (!checkoutModal) {
      checkoutModal = document.createElement('div');
      checkoutModal.id = 'checkoutModal';
      checkoutModal.className = 'cart-modal';
      checkoutModal.innerHTML = '<div class="cart-modal-content checkout-content">' +
        '<div class="cart-header">' +
          '<h3>💳 Finalizar Pedido</h3>' +
          '<button class="close-checkout" aria-label="Fechar">✕</button>' +
        '</div>' +
        '<div class="checkout-body">' +
          '<div class="checkout-section">' +
            '<h4>📦 Resumo do Pedido</h4>' +
            '<div id="checkoutItems" class="checkout-items"></div>' +
            '<div class="checkout-total">' +
              '<strong>Total:</strong> <span id="checkoutTotal">R$ 0,00</span>' +
            '</div>' +
          '</div>' +
          '<div class="checkout-section">' +
            '<h4>💰 Forma de Pagamento</h4>' +
            '<div class="payment-methods">' +
              '<label class="payment-option">' +
                '<input type="radio" name="payment" value="pix" checked>' +
                '<div class="payment-card">' +
                  '<span class="payment-icon">📱</span>' +
                  '<div>' +
                    '<strong>PIX</strong>' +
                    '<small>Pagamento instantâneo</small>' +
                  '</div>' +
                '</div>' +
              '</label>' +
              '<label class="payment-option">' +
                '<input type="radio" name="payment" value="entrega">' +
                '<div class="payment-card">' +
                  '<span class="payment-icon">🏠</span>' +
                  '<div>' +
                    '<strong>Pagar na Entrega</strong>' +
                    '<small>Dinheiro ou cartão</small>' +
                  '</div>' +
                '</div>' +
              '</label>' +
            '</div>' +
          '</div>' +
          '<div id="pixInfo" class="pix-info" style="display: block;">' +
            '<p>🔑 Após confirmar, você receberá o código PIX para pagamento</p>' +
          '</div>' +
          '<div id="entregaInfo" class="entrega-info" style="display: none;">' +
            '<p>💵 Prepare o valor exato ou informe ao entregador sua preferência</p>' +
          '</div>' +
          '<div class="checkout-section">' +
            '<h4>🎟️ Cupom de Desconto</h4>' +
            '<div class="cupom-input-group">' +
              '<input type="text" id="cupomInput" placeholder="Digite o código do cupom" />' +
              '<button id="aplicarCupom" class="btn btn-small">Aplicar</button>' +
            '</div>' +
            '<div id="cupomMensagem" class="cupom-mensagem"></div>' +
            '<button class="btn-link" onclick="mostrarCuponsDisponiveis()">Ver cupons disponíveis</button>' +
          '</div>' +
        '</div>' +
        '<div class="checkout-footer">' +
          '<button class="btn btn-secondary cancel-checkout">Voltar</button>' +
          '<button id="confirmarPedido" class="btn btn-success">Confirmar Pedido</button>' +
        '</div>' +
      '</div>';
      document.body.appendChild(checkoutModal);

      // Event listeners
      checkoutModal.querySelector('.close-checkout').addEventListener('click', function() {
        checkoutModal.classList.remove('show');
        limparCupom();
      });

      checkoutModal.querySelector('.cancel-checkout').addEventListener('click', function() {
        checkoutModal.classList.remove('show');
        limparCupom();
      });

      checkoutModal.addEventListener('click', function(e) {
        if (e.target === checkoutModal) {
          checkoutModal.classList.remove('show');
          limparCupom();
        }
      });

      // Alternar informações de pagamento
      document.querySelectorAll('input[name="payment"]').forEach(function(radio) {
        radio.addEventListener('click', function() {
          document.getElementById('pixInfo').style.display = this.value === 'pix' ? 'block' : 'none';
          document.getElementById('entregaInfo').style.display = this.value === 'entrega' ? 'block' : 'none';
        });
      });

      // Aplicar cupom
      document.getElementById('aplicarCupom').addEventListener('click', async function() {
        var codigo = document.getElementById('cupomInput').value;
        if (!codigo) {
          alert('Digite um código de cupom');
          return;
        }
        
        var totalAtual = cart.total;
        var cupomValido = await validarCupom(codigo, totalAtual);
        
        if (cupomValido) {
          var mensagemEl = document.getElementById('cupomMensagem');
          mensagemEl.textContent = '✅ Cupom aplicado! Desconto: R$ ' + cupomValido.desconto.toFixed(2);
          mensagemEl.className = 'cupom-mensagem cupom-sucesso';
          
          // Atualizar total
          document.getElementById('checkoutTotal').textContent = 'R$ ' + cupomValido.total_com_desconto.toFixed(2).replace('.', ',');
          document.getElementById('cupomInput').disabled = true;
          document.getElementById('aplicarCupom').disabled = true;
        }
      });

      document.getElementById('confirmarPedido').addEventListener('click', enviarPedido);
    }

    // Atualizar conteúdo do checkout
    var checkoutItemsEl = document.getElementById('checkoutItems');
    checkoutItemsEl.innerHTML = '';
    
    cart.items.forEach(function(item) {
      var itemDiv = document.createElement('div');
      itemDiv.className = 'checkout-item';
      itemDiv.innerHTML = 
        '<span>' + item.name + '</span>' +
        '<span>R$ ' + item.price.toFixed(2).replace('.', ',') + '</span>';
      checkoutItemsEl.appendChild(itemDiv);
    });

    document.getElementById('checkoutTotal').textContent = 'R$ ' + cart.total.toFixed(2).replace('.', ',');
    checkoutModal.classList.add('show');
  }

  async function enviarPedido() {
    var metodoPagamento = document.querySelector('input[name="payment"]:checked').value;
    var btnConfirmar = document.getElementById('confirmarPedido');
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Processando...';

    try {
      var itens = cart.items.map(function(item) {
        return {
          produto_id: item.produto_id,
          nome: item.name,
          preco: item.price,
          quantidade: 1
        };
      });

      var dadosPedido = { 
        itens: itens,
        forma_pagamento: metodoPagamento
      };

      // Adicionar cupom se houver
      if (cupomAtual) {
        dadosPedido.cupom_id = cupomAtual.cupom_id;
        dadosPedido.desconto = cupomAtual.desconto;
      }

      var resultado = await API.post('/pedidos', dadosPedido, tokenAuth);

      if (resultado.erro) {
        alert('Erro: ' + resultado.erro);
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar Pedido';
        return;
      }

      // Fechar modais
      document.getElementById('checkoutModal').classList.remove('show');
      document.getElementById('cartModal').classList.remove('show');

      // Mostrar sucesso com informações de pagamento
      var mensagem = '🎉 Pedido realizado com sucesso!\n\n';
      mensagem += 'Pedido #' + resultado.pedido_id + '\n';
      mensagem += 'Total: R$ ' + resultado.total.toFixed(2).replace('.', ',') + '\n';
      mensagem += 'Pagamento: ' + (metodoPagamento === 'pix' ? 'PIX' : 'Na Entrega') + '\n\n';
      
      if (metodoPagamento === 'pix') {
        mensagem += '📱 Código PIX:\n';
        mensagem += resultado.pix_codigo || 'PIX será enviado por email';
      } else {
        mensagem += '🚚 Prepare o valor para pagamento na entrega';
      }
      
      mensagem += '\n\nObrigado pela preferência!';
      alert(mensagem);
      
      cart.items = [];
      cart.total = 0;
      updateCartUI();
    } catch (erro) {
      console.error('Erro ao finalizar pedido:', erro);
      alert('Erro ao finalizar pedido. Tente novamente.');
    } finally {
      btnConfirmar.disabled = false;
      btnConfirmar.textContent = 'Confirmar Pedido';
    }
  }

  function atualizarModalCarrinho() {
    var cartItemsEl = document.getElementById('cartItems');
    var cartTotalEl = document.getElementById('cartTotal');
    
    if (!cartItemsEl || !cartTotalEl) return;

    if (cart.items.length === 0) {
      cartItemsEl.innerHTML = '<p class="cart-empty">Seu carrinho está vazio</p>';
    } else {
      cartItemsEl.innerHTML = '';
      cart.items.forEach(function(item, index) {
        var itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        itemDiv.innerHTML = 
          '<div class="cart-item-info">' +
            '<strong>' + item.name + '</strong>' +
            '<span class="cart-item-price">R$ ' + item.price.toFixed(2).replace('.', ',') + '</span>' +
          '</div>' +
          '<button class="remove-item" data-index="' + index + '" aria-label="Remover">🗑️</button>';
        cartItemsEl.appendChild(itemDiv);
      });

      // Event listeners para remover itens
      document.querySelectorAll('.remove-item').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var index = parseInt(btn.getAttribute('data-index'));
          cart.total -= cart.items[index].price;
          cart.items.splice(index, 1);
          updateCartUI();
        });
      });
    }

    cartTotalEl.textContent = 'R$ ' + cart.total.toFixed(2).replace('.', ',');
    
    // Não mostrar calculadora de frete no carrinho; frete será calculado apenas no checkout (etapa 2)
  }

  // Expor funções globais necessárias
  window.updateCartUI = updateCartUI;
  
  window.adicionarAoCarrinho = function(produto) {
    cart.items.push(produto);
    cart.total += produto.price;
    updateCartUI();
  };
  
  window.removerDoCarrinho = function(produtoId) {
    var index = cart.items.findIndex(function(item) {
      return item.produto_id === produtoId;
    });
    
    if (index !== -1) {
      cart.total -= cart.items[index].price;
      cart.items.splice(index, 1);
      updateCartUI();
    }
  };

  updateCartUI();
}
