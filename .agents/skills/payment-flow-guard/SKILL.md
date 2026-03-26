---
name: payment-flow-guard
description: Auditoria e orientacao tecnica do fluxo de pagamentos do BomFilho (mercado delivery de bairro) com foco em PIX e cartao via PagBank, integridade entre estado do pedido e estado do pagamento, seguranca de webhook, idempotencia, prevencao de duplicidade e resiliencia a eventos fora de ordem/retry/timeout. Use quando houver pagamento duplicado, pedido pago com status errado, webhook inconsistente, recusas mal tratadas, divergencia entre frontend-backend-banco-gateway, ou risco de confirmar operacao comercial com evento incompleto. Entregar causa raiz com evidencias e correcoes incrementais de alto impacto e baixo risco para producao.
---

# Payment Flow Guard

## Objetivo
Revisar, auditar e orientar melhorias no fluxo de pagamentos do BomFilho para garantir consistencia de estados, seguranca operacional e robustez contra falhas reais de producao.

Focar em:
- integridade entre pedido, pagamento e gateway
- prevencao de duplicidade e reprocessamento indevido
- tratamento seguro de webhook e eventos assincronos
- feedback claro para cliente e administracao
- correcoes incrementais com baixo risco

## Principios obrigatorios
- pagamento nunca deve depender so do frontend
- webhook nao deve ser tratado como confiavel sem validacao
- estados de pagamento e pedido nao devem se confundir
- idempotencia deve ser tratada como requisito
- duplicidade deve ser prevenida e nao apenas remediada
- evento fora de ordem deve ser considerado cenario normal
- erro de gateway nao pode virar estado enganoso para o cliente
- feedback ao cliente deve ser claro e honesto
- mudancas devem priorizar seguranca e baixo risco
- confirmacao operacional deve ocorrer no ponto correto do fluxo

## Padroes desejados no BomFilho
- PIX e cartao com estados coerentes
- pedido nao deve avancar por evento inconsistente
- webhook com validacao e tratamento seguro
- logs uteis para auditoria
- mensagens claras para cliente em pendencia, sucesso e falha
- admin consegue entender rapidamente a situacao do pagamento
- reprocessamento seguro
- protecao contra acoes repetidas
- mudancas incrementais antes de refactor grande
- fluxo pronto para producao real

## Estados recomendados
Trabalhar com algo proximo de:
- pedido criado
- aguardando revisao
- aguardando pagamento
- pagamento pendente
- pagamento aprovado
- pagamento recusado
- pagamento expirado
- pagamento cancelado
- pedido aprovado para continuidade
- pedido concluido
- pedido cancelado
- reembolso ou estorno, quando existir

Ao analisar, avaliar sempre:
- se existem estados demais
- se faltam estados importantes
- se ha sobreposicao ou ambiguidade
- se as transicoes sao seguras
- se o cliente recebe feedback compativel com o estado real
- se o admin enxerga claramente a situacao do pagamento
- se ha risco de o pedido seguir com base em evento errado

## Arquivos-alvo provaveis
Procurar primeiro por:
- rotas de criacao de pedido
- rotas de pagamento PIX/cartao
- webhook do gateway
- servicos de integracao com PagBank
- logica de atualizacao de status
- componentes de checkout
- tela de retorno/pagamento
- logs dedicados de pagamento
- configuracao de ambiente relacionada a token, chave publica e webhook
- tabelas de pedidos e pagamentos

## Quando usar
Use esta skill quando o pedido envolver auditoria ou blindagem de pagamento no BomFilho, por exemplo:
- revise o fluxo de PIX
- veja se pode haver pagamento duplicado
- audite webhook e confirmacao de pagamento
- o pedido ficou pago mas o status ta errado
- o cliente pagou e o sistema nao refletiu
- quero blindar o fluxo de pagamento
- revise estados de pedido e pagamento
- veja se cartao e PIX estao consistentes
- audite integridade do checkout e retorno do gateway
- quero evitar cobranca duplicada ou confirmacao errada

## Quando NAO usar
Nao usar como skill principal para:
- redesign de interface sem foco em pagamento
- SEO
- modelagem de banco sem relacao com pagamentos
- contabilidade/financeiro do negocio
- catalogo, vitrine ou busca de produtos
- auditoria geral de performance sem relacao com pagamento
- painel admin de pedidos sem foco em pagamento
- seguranca geral de infraestrutura fora do contexto do fluxo de pagamento

## Entradas esperadas
Aceitar como insumo:
- arquivos de rota de pagamento
- arquivos de webhook
- handlers de criacao de pedido
- logica de atualizacao de status
- integracoes com PagBank
- arquivos de frontend do checkout
- prints de erro ou telas de pagamento
- logs de request/response
- logs de webhook
- estrutura de tabelas relacionadas a pedido e pagamento
- mensagens de erro exibidas ao cliente
- regras atuais de negocio
- exemplos reais de status retornados pelo gateway

Se faltar contexto, assumir o minimo seguro e explicitar suposicoes.

## Saida esperada
Entregar diagnostico tecnico, pratico e acionavel:
- causa raiz provavel com evidencia concreta
- riscos atuais de integridade e seguranca operacional
- correcoes priorizadas por impacto e risco
- plano incremental de implementacao e validacao
- melhoria clara na confiabilidade do fluxo de pagamento

## Regras de comportamento da skill
- responder em portugues
- ser pratica, objetiva e tecnica sem virar documentacao generica
- nao virar skill generica de pagamentos
- nao virar skill generica de seguranca
- focar no fluxo real de pagamento do BomFilho
- priorizar integridade, consistencia e baixo risco
- evitar refactor grande sem necessidade
- priorizar correcoes de alto impacto e baixo risco
- diferenciar claramente estado do pedido, estado do pagamento e estado do gateway
- buscar causa raiz, nao apenas sintoma
- considerar comportamento assincrono de webhooks e confirmacoes externas
- considerar eventos fora de ordem, repetidos ou atrasados
- considerar falhas de rede, timeout e reprocessamento
- considerar experiencia do cliente em sucesso, pendencia, recusa e erro tecnico
- considerar seguranca basica de webhook, autenticacao e protecao contra abuso
- nao sugerir mudanca arriscada sem apontar impacto, risco e plano de validacao

## Passo a passo interno de analise (ordem obrigatoria)
1. Objetivo do fluxo de pagamento
- definir resultado correto do fluxo do ponto de vista comercial e tecnico

2. Pontos de entrada do fluxo
- mapear checkout, criacao de cobranca, retorno de pagamento e webhook

3. Estados existentes do pedido
- listar estados atuais e papel de cada um no fluxo

4. Estados existentes do pagamento
- listar pendente/aprovado/recusado/expirado/cancelado/reembolsado ou equivalentes

5. Como frontend, backend, banco e gateway se comunicam
- mapear contratos, origem de verdade e momentos de sincronizacao

6. Onde a confirmacao de pagamento realmente acontece
- identificar ponto canonico de confirmacao e evitar decisao por sinal fraco

7. Como o sistema trata duplicidade e retry
- verificar chaves idempotentes, locks, unique constraints e reentrancia

8. Como o sistema trata webhook
- validar autenticacao, assinatura/token, origem, replay e validacao de payload

9. Como o sistema trata eventos fora de ordem
- verificar protecao contra regressao de estado e processamento tardio

10. Como o sistema trata falha, recusa, timeout e expiracao
- confirmar mensagens, retentativas e encerramento seguro do fluxo

11. Como o cliente recebe feedback
- avaliar clareza e honestidade dos status no checkout e pos-pagamento

12. Como o admin ve o pagamento
- avaliar leitura operacional do status e proximas acoes seguras

13. Riscos de inconsistencia
- apontar risco de cobrar sem atualizar pedido e atualizar pedido sem pagamento valido

14. Correcoes de baixo risco primeiro
- priorizar mudancas pequenas, reversiveis e de maior impacto

15. Smoke test do fluxo final
- definir testes minimos para validar consistencia de ponta a ponta

## Criterios de qualidade
Uma resposta so e considerada boa quando:
- diferencia claramente pedido, pagamento e gateway
- identifica riscos concretos
- aponta causa raiz provavel com evidencias
- prioriza correcoes praticaveis
- reduz risco de duplicidade e inconsistencia
- melhora confiabilidade operacional
- melhora feedback para cliente e admin
- explica o por que das mudancas
- entrega algo utilizavel por desenvolvedor
- evita sugestoes superficiais ou genericas

## Gatilhos de linguagem reais
Frases que devem ativar esta skill:
- "ve se esse fluxo de pagamento ta seguro"
- "quero evitar pagamento duplicado"
- "o PIX criou mas o pedido ficou estranho"
- "o webhook pode estar errado"
- "o cliente pagou e nao atualizou"
- "revisa esse fluxo de cartao e PIX"
- "quero blindar os estados do pagamento"
- "o pedido foi aprovado na hora errada"
- "esse pagamento pode quebrar em producao"
- "quero revisar a integridade do pagamento antes do go-live"

## Formato final de resposta (obrigatorio)
Responder sempre nesta estrutura:

1. Objetivo do fluxo analisado
- definir qual comportamento correto deve acontecer do inicio ao fim

2. Sintomas observados
- listar sinais concretos de falha ou fragilidade

3. Causa raiz provavel
- apontar causa principal e contribuintes

4. Evidencias
- citar codigo, logs, eventos, queries e contratos relevantes

5. Impacto no cliente e na operacao
- explicar risco comercial, operacional e de confianca

6. Riscos atuais
- listar riscos de duplicidade, inconsistencia, fraude ou retrabalho

7. Correcoes recomendadas por prioridade
- ordenar por impacto e viabilidade

8. Mudancas de baixo risco primeiro
- destacar ajustes incrementais com menor blast radius

9. Cuidados tecnicos
- indicar cuidados de idempotencia, webhook, transicao de estado e observabilidade

10. Risco da mudanca
- classificar risco (baixo/medio/alto), impacto colateral e rollback

11. Smoke test funcional
- definir testes curtos de PIX, cartao, recusa, timeout, webhook repetido e evento fora de ordem

12. Resultado esperado apos a correcao
- descrever estado final mais seguro, consistente e claro para cliente e admin

## Guardrails de implementacao
- preservar contratos atuais quando possivel
- evitar mudancas amplas sem evidencia de necessidade
- nao remover validacoes criticas de pagamento e logs de rastreabilidade
- evitar deploy coordenado frontend+backend sem aviso explicito
