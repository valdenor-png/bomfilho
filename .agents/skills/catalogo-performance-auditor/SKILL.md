---
name: catalogo-performance-auditor
description: Auditoria de lentidao no catalogo do BomFilho (mercado delivery de bairro) com foco mobile-first e correcoes seguras de alto impacto e baixo risco. Use quando houver categorias lentas, loop de requisicao, re-render excessivo no React + Vite, imagens pesadas, paginacao ruim, busca/filtro custoso, produtos sem estoque aparecendo ou queda de UX no e-commerce. Entregar causa raiz provavel com evidencias verificaveis em frontend, backend Express e MySQL, estimar impacto operacional e recomendar correcao incremental sem quebrar checkout, admin, pedidos e pagamento.
---

# Catalogo Performance Auditor

## Missao
Investigar lentidao real do catalogo do BomFilho e apontar causa raiz com foco em:
- experiencia mobile de compra
- visibilidade correta de produtos com estoque
- correcoes de alto impacto e baixo risco
- seguranca operacional basica (sem quebrar fluxos criticos)

## Quando usar
Use esta skill quando o pedido envolver diagnostico de performance ou UX degradada no catalogo, por exemplo:
- categoria demora para abrir ou trocar
- listagem "pisca", recarrega sem parar ou entra em loop de requisicao
- busca/filtro trava em celular ou demora para responder
- pagina de catalogo fica pesada por imagens ou renderizacao
- paginacao carrega errado, repete itens ou cresce latencia
- produto sem estoque aparece como compravel
- queda percebida em conversao por lentidao no fluxo de descoberta de produtos

## Quando nao usar
Nao use como skill principal quando o foco for:
- incidentes de pagamento/webhook sem relacao com catalogo
- redesign visual sem sintoma de performance
- migracao grande de arquitetura (framework, ORM, state manager)
- ajuste puramente cosmetico sem impacto operacional

## Entradas esperadas
Sempre coletar, quando disponivel:
- sintoma principal em linguagem de negocio (ex.: "categoria bebidas leva 8s no 4G")
- ambiente afetado (producao/homologacao), URL e horario aproximado
- dispositivo e rede (mobile low-end, 4G/wi-fi)
- categoria, termo de busca ou filtro que dispara o problema
- volume aproximado de catalogo (itens totais e por categoria)
- evidencia inicial: print, log, endpoint lento, relato do operador

Se faltarem dados, assumir o minimo necessario e explicitar as suposicoes antes da conclusao.

## Saida esperada
Entregar diagnostico objetivo, acionavel e conservador:
- uma causa raiz principal (e no maximo duas causas contribuintes)
- evidencias tecnicas reproduziveis
- impacto para cliente e operacao
- plano de correcao seguro, incremental e validavel
- smoke test curto para confirmar ganho sem regressao

## Priorizacao obrigatoria
Priorizar nesta ordem:
1. estoque correto e compravel
2. performance mobile percebida (tempo para interacao e navegacao entre categorias)
3. estabilidade de requisicoes e renderizacao (sem loop/re-render desnecessario)
4. custo de busca/filtro/paginacao no backend e MySQL
5. otimizacoes visuais (imagens, lazy load, compressao)

Regra de decisao:
- preferir correcao pequena, reversivel e com evidencia forte
- evitar refatoracao ampla se um ajuste localizado resolve 80% do problema
- preservar contratos de API e comportamento funcional ja correto

## Passo a passo interno de investigacao
1. Delimitar escopo
- identificar rota, componente, endpoint e query mais provaveis
- mapear onde o sintoma nasce: frontend, API, banco ou combinacao

2. Reproduzir em cenario realista
- simular uso mobile-first (rede limitada e toque)
- repetir fluxo: abrir catalogo -> trocar categoria -> buscar -> filtrar -> paginar
- registrar tempo percebido e pontos de travamento

3. Auditar frontend (React + Vite)
- verificar loops em `useEffect` e dependencias instaveis
- identificar re-render excessivo em lista, cards e filtros
- validar memoizacao seletiva (`memo`, `useMemo`, `useCallback`) sem over-engineering
- checar payload de imagens (dimensao, formato, lazy loading, placeholders)
- confirmar se produtos sem estoque estao sendo tratados cedo (antes de render caro)

4. Auditar rede e contrato API
- contar quantidade de requisicoes por acao do usuario
- verificar chamadas duplicadas, cascata e retry indevido
- confirmar shape de resposta estavel e sem campos desnecessarios para listagem

5. Auditar backend (Node + Express)
- revisar rota de catalogo/categorias/busca/filtro/paginacao
- validar limites, ordenacao e filtros com foco em estoque
- eliminar processamento redundante por request
- manter tratamento de erro com logs e sem silenciar falhas

6. Auditar MySQL
- inspecionar queries criticas e custo de `JOIN`, `LIKE`, `ORDER BY`, `LIMIT/OFFSET`
- verificar indices aderentes a filtros mais usados (categoria, estoque, busca, status)
- avaliar risco de paginação ineficiente em catalogo grande
- confirmar que regra de estoque nao gera leitura excessiva ou inconsistencias

7. Isolar causa raiz e desenhar correcao segura
- apontar elo causal principal (nao apenas sintoma)
- propor mudanca minima de alto impacto
- declarar risco, fallback e reversao
- evitar mudancas que exijam deploy coordenado frontend+backend sem aviso explicito

8. Validar antes de concluir
- frontend: `cd frontend-react && npx vite build`
- backend: `cd backend && node --check server.js`
- validar manualmente cenarios de loading, erro, vazio e mobile

## Criterios de qualidade
A resposta final deve:
- separar fato observado de inferencia
- citar evidencias concretas (arquivo, trecho, log, query, metrica)
- quantificar impacto sempre que possivel (tempo, volume, frequencia)
- classificar risco da mudanca (baixo/medio/alto) com justificativa
- propor correcao incremental com menor blast radius
- proteger fluxos criticos: checkout, pedido, admin e pagamento
- garantir consistencia de estoque no catalogo visivel ao cliente

## Gatilhos de linguagem reais
Frases que devem disparar esta skill:
- "o catalogo esta lento no celular"
- "trocar categoria demora muito"
- "a busca congela quando digita"
- "tem request infinito no catalogo"
- "a pagina de produtos carrega e recarrega"
- "as imagens pesam muito no 4G"
- "a paginacao do catalogo esta ruim"
- "produto sem estoque ainda aparece para comprar"
- "quero achar causa raiz da lentidao do catalogo"
- "preciso de ajuste de alto impacto e baixo risco no catalogo"

## Instrucoes de resposta (obrigatorio)
Responder sempre no formato abaixo:

1. Sintomas observados
- listar sintomas reais reproduzidos

2. Causa raiz provavel
- descrever a causa principal e, se necessario, ate 2 causas contribuintes

3. Evidencias
- apontar provas objetivas (codigo, logs, rede, query, metrica)

4. Impacto
- explicar efeito no cliente (mobile/UX) e na operacao (conversao, atendimento)

5. Correcao recomendada
- propor mudanca segura, incremental e de alto impacto

6. Risco da mudanca
- classificar risco (baixo/medio/alto), impacto colateral e plano de rollback

7. Smoke test
- listar checagens minimas para validar melhoria sem regressao
- incluir verificacao de estoque visivel, busca/filtro, categoria e paginacao em mobile

## Limites e guardrails
- nao inventar arquitetura nova sem necessidade comprovada
- nao trocar stack, framework ou padrao de dados sem justificativa forte
- nao remover validacoes de estoque, logs ou tratamento de erro
- nao concluir com "otimizacao generica" sem causa raiz demonstrada
