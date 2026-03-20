---
description: "Prompt reutilizável para revisar o fluxo de pagamento PagBank do BomFilho"
mode: "agent"
---

# Revisar Fluxo PagBank — BomFilho

## Contexto

O BomFilho usa PagBank para processar pagamentos (Pix e cartão de crédito).
São 9 services em `backend/services/pagbank*.js` + rotas em `routes/pagbank.js`, `routes/webhooks.js` e `routes/pedidos-criar.js`.
Dinheiro real. Clientes reais. Qualquer falha gera problema operacional imediato.

## Tarefa

Revise o fluxo de pagamento de ponta a ponta. Identifique vulnerabilidades, inconsistências, pontos de falha e oportunidades de melhoria.

## Processo Obrigatório

### 1. Mapear o Fluxo Completo

Ler e entender cada etapa na ordem:

**Criação do pedido:**
- `backend/routes/pedidos-criar.js` — Rota POST que inicia tudo
- `backend/services/pedidoPagamentoHelpers.js` — Lógica de criar pedido + pagamento
- Verificar: validação de entrada, cálculo de valores (subtotal + frete + taxa - desconto), inserção no banco

**Comunicação com PagBank:**
- `backend/services/pagbankConfigService.js` — Configuração (sandbox vs production)
- `backend/services/pagbankClientService.js` — HTTP client (auth, headers, timeout, retry)
- `backend/services/pagbankOrdersService.js` — Criação da order na API PagBank
- `backend/services/pagbankPaymentHelpers.js` — Montagem do payload de pagamento
- `backend/services/pagbankHelpersService.js` — Utilitários gerais
- Verificar: payloads corretos, tratamento de erro adequado, timeouts, retry logic

**Webhook de retorno:**
- `backend/routes/webhooks.js` — Rota que recebe notificação do PagBank
- `backend/services/pagbankWebhookService.js` — Processamento da notificação
- Verificar: validação de origem, idempotência, atualização de status, logs

**Frontend do checkout:**
- `frontend-react/src/pages/PagamentoPage.jsx` — Página de pagamento
- `frontend-react/src/components/checkout/CheckoutPayment.jsx` — Seleção de método
- `frontend-react/src/components/checkout/CheckoutPix.jsx` — QR code + polling
- Verificar: polling de status, feedback visual, tratamento de timeout

### 2. Checklist de Segurança

- [ ] Valores são recalculados no backend (não confia no frontend)?
- [ ] Webhook valida origem/assinatura antes de processar?
- [ ] Dados sensíveis (cartão, CPF) não são logados?
- [ ] SQL queries usam parâmetros (nunca concatenação)?
- [ ] Rotas de pagamento exigem autenticação?
- [ ] Webhook é idempotente (mesmo evento 2x não causa problema)?
- [ ] Erros não expõem detalhes internos ao cliente?

### 3. Checklist de Confiabilidade

- [ ] Timeout configurado para chamadas à API PagBank?
- [ ] Retry logic para falhas transitórias?
- [ ] Fallback se PagBank estiver indisponível temporariamente?
- [ ] Status do pedido fica consistente em caso de falha parcial?
- [ ] Logs suficientes para diagnosticar problemas sem acesso ao servidor?
- [ ] Taxa de serviço (3%) calculada corretamente e incluída no total PagBank?

### 4. Checklist de Rastreabilidade

- [ ] Cada transação tem reference_id rastreável entre BomFilho e PagBank?
- [ ] Logs de PagBank registram request e response completos?
- [ ] Admin pode consultar status de pagamento de qualquer pedido?
- [ ] Webhook logs permitem replay/debug em caso de problema?

### 5. Checklist de UX

- [ ] Cliente vê feedback claro enquanto pagamento é processado?
- [ ] Pix: QR code visível e copiável no mobile?
- [ ] Polling de status tem timeout com mensagem clara?
- [ ] Erro de pagamento mostra mensagem amigável (não código técnico)?
- [ ] Cliente consegue tentar novamente se pagamento falhar?

## Formato de Saída

```
## Resumo da Revisão
- Status geral: [saudável / atenção / crítico]
- Problemas encontrados: [número]
- Classificação: [X críticos, Y importantes, Z menores]

## Problemas Encontrados
### [CRÍTICO/IMPORTANTE/MENOR] — [descrição]
- Arquivo(s): [caminho]
- Risco: [o que pode acontecer]
- Fix sugerido: [código ou instrução]
- Prioridade: [imediata / próximo deploy / quando possível]

## Pontos Positivos
- [o que está bem implementado]
```

## Restrições

- Não propor reescrita da integração PagBank — melhorias incrementais.
- Não sugerir trocar PagBank por outro gateway.
- Não alterar flow de checkout sem entender impacto completo.
- Conservadorismo total: melhor pecar por cautela do que quebrar pagamento.
- Qualquer mudança deve ser testável: `cd backend && node --check server.js`.
