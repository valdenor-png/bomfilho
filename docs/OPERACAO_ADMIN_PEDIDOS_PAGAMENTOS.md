# OPERACAO ADMIN - PEDIDOS E PAGAMENTOS

## 1) Escopo

Guia rapido para operacao diaria de pedidos e tratamento de incidentes de pagamento.

## 2) Acesso

- Painel de pedidos tradicional: `/admin` (uso local, quando permitido pela configuracao).
- Painel de gerencia/catalogo: `/admin/gerencia`.

## 3) Fluxo recomendado de status do pedido

Ordem operacional sugerida:

1. `pendente`
2. `preparando`
3. `enviado`
4. `entregue`

Cancelamento deve usar `cancelado` apenas quando nao houver possibilidade de entrega.

## 4) Regras de pagamento relevantes

- Pedido em status finalizado (`entregue` ou `cancelado`) nao aceita novo pagamento.
- Checkout com reCAPTCHA ativo exige token valido para criar pedido e/ou pagar.
- Pagamentos via PagBank dependem de token valido e conectividade com provedor.

## 5) Incidentes comuns e acao

### 5.1 Erro: pedido nao aceita novo pagamento

Sintoma:
- Mensagem tipo: "Este pedido ja esta ... e nao aceita novo pagamento."

Acao:
1. Confirmar status atual do pedido no painel.
2. Nao forcar nova cobranca no mesmo pedido finalizado.
3. Criar novo pedido apenas se houver alinhamento com cliente e operacao.

### 5.2 Erro no PIX indisponivel

Sintoma:
- Resposta `503` para `/api/pagamentos/pix`.

Acao:
1. Verificar `PAGBANK_TOKEN` e conectividade externa.
2. Checar logs de backend para operacao `api.pagamentos.pix`.
3. Orientar cliente a repetir tentativa apos estabilizacao.

### 5.3 Falha de 3DS no debito

Sintoma:
- Erro de autenticacao 3DS no pagamento de debito.

Acao:
1. Solicitar nova tentativa com autenticacao completa no banco emissor.
2. Se persistir, orientar PIX ou cartao de credito.
3. Registrar trace_id/transacao para suporte tecnico.

### 5.4 Erro de reCAPTCHA

Sintoma:
- Mensagem de validacao antiabuso no checkout.

Acao:
1. Confirmar se widget foi concluido pelo cliente.
2. Verificar configuracao de `VITE_RECAPTCHA_SITE_KEY` e `RECAPTCHA_SECRET_KEY`.
3. Revisar horario e dominio permitido no painel do provedor reCAPTCHA.

## 6) Observabilidade operacional

- Endpoint de saude: `/api`
- Endpoint tecnico de PagBank: `/api/pagbank/status`
- Metricas: `/metrics` (somente com politica definida por ambiente/token)

## 7) Rotina diaria sugerida

1. Abrir painel e verificar pedidos `pendente`.
2. Priorizar pedidos com janela de entrega curta.
3. Validar pedidos com pagamento pendente antes de separar itens.
4. Fechar ciclo de status ate `enviado` ou `entregue`.
5. Revisar cancelamentos e motivos no fim do turno.

## 8) Escalonamento

Quando escalar para time tecnico:

- mais de 3 falhas consecutivas no mesmo meio de pagamento;
- aumento anormal de `401/403/409/503` no checkout;
- webhook do PagBank sem atualizacao por janela superior a 30 minutos.
