# Checklist Homologacao Cartao e Debito (PagBank)

Use este roteiro para gerar as evidencias de homologacao para cartao de credito e debito.

## 1) Pre-requisitos
- `PAGBANK_ENV=sandbox`
- `PAGBANK_TOKEN` valido no sandbox
- `PAGBANK_PUBLIC_KEY` configurada no backend
- Backend online e acessivel

## 2) Fluxo de cartao no frontend
1. Criar pedido com `forma_pagamento=credito` ou `forma_pagamento=debito`.
2. Preencher dados do cartao no checkout.
3. Criptografar no navegador com `PagSeguro.encryptCard`.
4. Pagar via `POST /api/pagamentos/cartao`.

## 3) Evidencias para anexar
- Request completo para `POST https://sandbox.api.pagseguro.com/orders` (mascarando `Authorization`).
- Response completo da mesma chamada.
- `id`, `reference_id`, `charges.status` e `charges.payment_response.message`.

## 4) Observacoes
- Nunca enviar token real ou dados sensiveis sem mascaramento.
- Para debito, enviar `tipo_cartao=debito` e `parcelas=1`.
- Para credito, enviar `tipo_cartao=credito` e parcelas conforme teste.
