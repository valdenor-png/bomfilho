# PagBank Homologacao - Requests e Responses

Este pacote contem exemplos dos requests e responses das chamadas PagBank usadas na integracao do projeto Bom Filho.

## APIs PagBank usadas
1. `POST /orders` (criacao de pedido PIX)
2. `POST /orders` (criacao e pagamento de pedido com cartao credito/debito)
3. `GET /orders/{order_id}` (consulta de status e dados do pedido)
4. `GET /orders` (checagem de credencial / diagnostico)

## Fluxos de pagamento suportados
- PIX: rota backend `POST /api/pagamentos/pix`
- Cartao credito/debito: rota backend `POST /api/pagamentos/cartao`

## Tokenizacao de cartao (requisito)
- O frontend usa o SDK oficial do PagBank:
	- `https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js`
- Criptografia no navegador com `PagSeguro.encryptCard()`.
- Chave publica fornecida por `GET /api/pagbank/public-key` (backend precisa de `PAGBANK_PUBLIC_KEY`).

## Evidencias recomendadas para homologacao
- Request e response completos do `POST /orders` para PIX.
- Request e response completos do `POST /orders` para cartao credito.
- Request e response completos do `POST /orders` para cartao debito.
- Request e response de consulta (`GET /orders/{order_id}`) para um pedido criado.
- Roteiro rapido: `docs/pagbank-homologacao/CHECKLIST_CARTAO_DEBITO.md`.
- Roteiro oficial de sucesso (Visa 2701): `docs/pagbank-homologacao/CHECKLIST_SANDBOX_OFICIAL_DEBITO_3DS_2026-03-17.md`.
- Pacote de evidencias sanitizadas 2026-03-17: `docs/pagbank-homologacao/sandbox-logs/2026-03-17/`.

## Observacoes
- Nao incluir token real nos anexos enviados ao PagBank.
- Substituir campos sensiveis por placeholders, se necessario.
- Endpoint de webhook usado pela integracao: `https://SEU_BACKEND/api/webhooks/pagbank`.
