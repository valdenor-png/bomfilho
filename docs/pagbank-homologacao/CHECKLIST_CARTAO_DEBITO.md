# Checklist Homologacao Cartao e Debito (PagBank)

Use este roteiro para validar o fluxo completo de cartao com foco em debito + 3DS nativo do PagBank.

## 1) Pre-requisitos
- `PAGBANK_ENV=sandbox`
- `PAGBANK_TOKEN` valido no sandbox
- `PAGBANK_PUBLIC_KEY` configurada no backend
- `PAGBANK_TIMEOUT_MS=15000` (ou valor corporativo equivalente)
- `PAGBANK_DEBUG_LOGS=true` em homologacao
- `ALLOW_DEBIT_3DS_MOCK=false` para teste real de 3DS
- Backend online e acessivel
- Frontend online e acessivel

## 2) Testes funcionais obrigatorios

### 2.1 Geracao da sessao 3DS
1. No checkout, selecione cartao de debito.
2. Confirme que o frontend chama `POST /api/pagbank/3ds/session`.
3. Valide resposta com `session`, `env` e `expires_in_seconds`.

Esperado:
- HTTP 200
- `env` coerente com o ambiente (`SANDBOX` em homologacao)
- log backend `api.pagbank.3ds.session.response`

### 2.2 Setup do SDK + authenticate3DS
1. Preencha dados do cartao de debito e CPF/CNPJ.
2. Clique para pagar.
3. Verifique no frontend os estados:
	 - iniciando autenticacao
	 - aguardando validacao
	 - desafio (quando aplicavel)
	 - processando pagamento

Esperado:
- `PagSeguro.setUp` com `session` e `env` validos
- `PagSeguro.authenticate3DS` executado antes de `POST /api/pagamentos/cartao`

### 2.3 AUTH_FLOW_COMPLETED (sucesso)
1. Execute um cartao/cenario que finalize em `AUTH_FLOW_COMPLETED`.
2. Confirme que frontend envia `authentication_method` no pagamento.

Esperado:
- payload backend contem:
	- `tipo_cartao=debito`
	- `authentication_method.type=THREEDS`
	- `authentication_method.id` preenchido
- payload PagBank (`POST /orders`) contem `payment_method.type=DEBIT_CARD` e `capture=true`

### 2.4 AUTH_NOT_SUPPORTED (bloqueio no debito)
1. Rode cenario de cartao nao elegivel.

Esperado:
- frontend interrompe o fluxo
- mensagem clara pedindo outro meio de pagamento
- sem chamada final de pagamento no backend

### 2.5 CHANGE_PAYMENT_METHOD (bloqueio)
1. Rode cenario que retorne `CHANGE_PAYMENT_METHOD`.

Esperado:
- fluxo interrompido
- pedido de troca de meio de pagamento

### 2.6 REQUIRE_CHALLENGE
1. Rode cenario com desafio.
2. Conclua o challenge do emissor.

Esperado:
- challenge abre corretamente (iframe/script autorizado)
- pagamento so continua apos conclusao

### 2.7 Falta de authentication id
1. Forcar chamada de debito sem `authentication_method.id`.

Esperado:
- backend retorna 400 amigavel
- pagamento bloqueado

### 2.8 Nao regressao PIX e credito
1. Execute pedido PIX completo (gerar QR + verificar pagamento).
2. Execute pedido cartao credito completo.

Esperado:
- PIX sem regressao
- credito sem regressao

## 3) Evidencias para anexar
- Request/response de `POST /api/pagbank/3ds/session` (sanitizado)
- Request/response de `POST /api/pagamentos/cartao` no backend (sanitizado)
- Request/response de `POST https://sandbox.api.pagseguro.com/orders` no debito (sanitizado)
- `reference_id`, `charges.status`, `payment_response.code/message`, `trace_id`
- Logs com fluxo `debit_3ds_auth`

## 4) Logs obrigatorios para homologacao
- Sessao 3DS:
	- `operacao=api.pagbank.3ds.session.response`
	- `pagbank_env`, endpoint externo, `trace_id`
- Debito 3DS:
	- `operacao=orders.cartao.response` e/ou `orders.cartao.error`
	- `payment_method_type=DEBIT_CARD`
	- `authentication_method_type=THREEDS`
	- `authentication_method_id_present=true`
	- `capture=true`
	- `reference_id`

## 5) Observacoes de seguranca
- Nunca enviar token real em anexos.
- Nunca enviar CVV em logs.
- Mascarar numero do cartao, tax_id e e-mail.
- Se houver CSP/restricao de dominio, liberar `*.cardinalcommerce.com` para challenge 3DS.
