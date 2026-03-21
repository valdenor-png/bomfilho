# QUESTIONS_RESPONDIDO.md — Revisão Técnica Completa do Projeto BomFilho (v2)

> Respostas estratégicas e operacionais para implementação das melhorias.
> Baseadas no contexto do projeto BomFilho, no diagnóstico apresentado e nas prioridades já discutidas.

---

## 🔴 SEGURANÇA — CRÍTICO

### Q001 — JWT_SECRET aceita string vazia em produção
> RESPOSTA: Sim. Em produção não existe motivo legítimo para aceitar JWT vazio ou curto. Pode validar com fail-fast (`throw`) se tiver menos de 32 caracteres; idealmente 64+.

### Q002 — Webhook PagBank com cache de idempotência em memória
> RESPOSTA: Não considero suficiente para fluxo financeiro. Para o volume atual até “funciona”, mas o correto é mover a idempotência para banco com chave única por `notification_id` / evento.

### Q003 — Race condition no estoque durante criação de pedido
> RESPOSTA: Sim. A verificação precisa ir para dentro da transação, com lock pessimista (`SELECT ... FOR UPDATE`) ou update atômico condicionado. Do jeito atual há risco real de estoque virtual negativo.

### Q004 — Race condition no uso de cupons
> RESPOSTA: Sim. Validação e incremento de uso do cupom devem acontecer dentro da mesma transação com lock na linha do cupom.

### Q005 — ALLOW_PIX_MOCK pode chegar a produção
> RESPOSTA: Sim. Deve dar `throw` em produção se qualquer mock de pagamento estiver ativo. Não há cenário legítimo para mock em prod.

### Q006 — Sem rate limit em endpoints de pagamento
> RESPOSTA: Sim. O limiter global é amplo demais. Coloque limiter dedicado por usuário e IP nos endpoints de PIX e cartão; algo como 5/min por usuário já é mais adequado.

### Q007 — Endpoint de criação de pedido sem rate limit dedicado
> RESPOSTA: Sim. Vale aplicar limiter próprio no `POST /api/pedidos`, mais restritivo que o global, por exemplo 3/min por usuário e reforço por IP.

### Q008 — Admin password em texto plano aceita em produção com warning
> RESPOSTA: Sim. Em produção deve falhar se existir apenas `ADMIN_PASSWORD` sem hash. Force `ADMIN_PASSWORD_HASH` com bcrypt.

### Q009 — Importação de produtos sem limite de linhas
> RESPOSTA: Sim. Coloque limite de linhas. Para operação normal eu começaria com 5.000 por importação; acima disso, dividir em lotes.

### Q010 — Exportação de produtos sem LIMIT na query
> RESPOSTA: A exportação completa ainda é útil, então eu não colocaria só LIMIT seco. Prefira streaming/chunking. Se precisar proteção imediata, use teto alto configurável e avise quando truncar.

### Q011 — Resposta de erro na importação expõe detalhes internos
> RESPOSTA: Sim. Remova `erro.extra` da resposta pública e mantenha detalhes apenas em log interno.

### Q012 — Recaptcha desabilitado em checkout e pagamento
> RESPOSTA: Sim, vale preparar a ativação. Eu não ligaria “no escuro”, mas deixaria tudo pronto para ativar assim que as chaves estiverem configuradas e testadas.

### Q013 — `COOKIE_SAME_SITE=none` sem validação cruzada com SECURE
> RESPOSTA: Sim. Se `SameSite=None`, `Secure` deve ser obrigatório. Falha silenciosa de cookie é ruim demais para deixar sem validação.

### Q014 — Busca de admin sem limite de tamanho no termo
> RESPOSTA: Sim. Limite de 200 caracteres é razoável e já protege contra abuso de `LIKE`.

### Q015 — Helmet com `contentSecurityPolicy: false`
> RESPOSTA: Sim, mas com cuidado. Não deixaria CSP totalmente desligado. Dá para criar uma política permissiva controlada, com allowlist dos domínios do PagBank e restrições em `img-src`, `connect-src`, `style-src` etc.

---

## 🟠 SEGURANÇA — ALTA

### Q016 — Token JWT retornado no body do response
> RESPOSTA: Para web, prefiro não retornar no body. Use cookie httpOnly como padrão. Só manteria no body se existir dependência real de app móvel/webview já confirmada.

### Q017 — Frete público sem autenticação
> RESPOSTA: Eu manteria público, porque simulação antes do login ajuda conversão. Em vez de exigir auth, coloque rate limit forte, cache e proteção anti-abuso.

### Q018 — Avaliações sem proteção anti-abuso
> RESPOSTA: Sim. Adicione rate limit e garanta constraint única por `usuario_id + produto_id` se ainda não estiver firme no banco.

### Q019 — `SELECT *` em queries com dados sensíveis
> RESPOSTA: Sim. Vale auditar e trocar por colunas explícitas nos endpoints que retornam dados ao cliente.

### Q020 — Enumeração de e-mail no register/login
> RESPOSTA: Sim. Padronize para “Credenciais inválidas” no login e mensagens neutras nos fluxos correlatos.

### Q021 — Validação de CEP pode crashar com valor null
> RESPOSTA: Sim. É correção crítica e simples. Valide tipo antes de acessar `.length`.

### Q022 — Bulk insert de produtos sem transação com rollback
> RESPOSTA: Sim. Coloque transação com rollback e limite de lote; 100 itens por request é um bom começo.

---

## 🏗️ ARQUITETURA

### Q023 — ProdutosPage com ~1900 linhas
> RESPOSTA: Sim. Pode decompor por responsabilidade sem medo. Eu dividiria em hooks de filtro, recorrência e prefetch, além de componentes de busca/filtros e blocos de vitrine.

### Q024 — PagamentoPage com ~2700 linhas
> RESPOSTA: Sim. Essa é uma das refatorações mais valiosas. Extraia fluxo do checkout, 3DS, frete e validação para hooks próprios, preservando o comportamento atual.

### Q025 — ContaPage com ~670 linhas
> RESPOSTA: Está aceitável por enquanto. Eu só continuaria extraindo se mexer na área de endereços/CRUD, que parece ser a parte mais densa.

### Q026 — AdminPage e AdminGerenciaPage
> RESPOSTA: Pelo que você descreveu, parecem em estado melhor que Produtos/Pagamento. Eu não trataria como prioridade de refatoração agora, a menos que apareçam bugs de manutenção nelas.

### Q027 — RecorrenciaContext com normalização excessiva
> RESPOSTA: Eu não removeria a defesa toda. Simplificaria, mas manteria proteção contra localStorage corrompido. O ideal é centralizar a normalização em utilitário e resetar quando o dado vier inválido.

### Q028 — CartContext — payloadEvento usa closure anti-pattern
> RESPOSTA: Sim. Vale refatorar. Eu evitaria depender desse padrão fora do `setState`; pode migrar para `useRef`, reducer ou efeito derivado com mais segurança.

### Q029 — 3 camadas de API no frontend
> RESPOSTA: Eu manteria as 3 camadas. Para o tamanho atual ainda agrega organização: config, transporte e domínio. Não simplificaria isso agora.

### Q030 — Sem Error Boundaries em seções críticas
> RESPOSTA: Sim. Coloque boundaries granulares em partes não essenciais da tela, como drawer, cross-sell, favoritos e blocos auxiliares. No formulário de pagamento, preserve estado sempre que possível.

### Q031 — styles.css com ~15800 linhas
> RESPOSTA: Eu não migraria de stack agora. O melhor é reorganizar por seções, documentar blocos, e fazer uma passada para CSS morto quando estiver mexendo nas telas.

---

## ⚡ PERFORMANCE

### Q032 — 21k produtos indexados no client
> RESPOSTA: Isso já está no limite do confortável. A abordagem que faz mais sentido é reduzir dependência de catálogo inteiro no client e caminhar para paginação/busca server-side. Worker pode vir depois.

### Q033 — Produtos enviados 100% do catálogo em uma request
> RESPOSTA: Eu não trataria isso como modelo final. Para o uso atual pode ter sido um atalho de UX, mas o caminho correto é paginação e busca no backend, com payload menor.

### Q034 — Image prefetch registry nunca limpa
> RESPOSTA: Sim. Adicione LRU/eviction. Eu manteria algo entre 200 e 300 entradas.

### Q035 — CEP lookup cache não cacheia erros
> RESPOSTA: Sim. Cachear erro por 30 segundos já reduz flood quando o provedor está instável.

### Q036 — N+1 queries no dashboard admin
> RESPOSTA: Sim. Vale consolidar para 2–4 queries maiores. Dashboard administrativo compensa esse ganho.

### Q037 — Pedido cria itens em loop com queries individuais
> RESPOSTA: Sim. Pode usar bulk insert para os itens do pedido.

### Q038 — Pool MySQL com connectionLimit=10
> RESPOSTA: Para o volume atual pode ser suficiente, mas eu não subiria no escuro. Primeiro instrumente fila/latência. Se houver gargalo real e o plano suportar, suba para 15–20.

### Q039 — Geocodificação sequencial com múltiplas chamadas
> RESPOSTA: O cache atual ajuda no curto prazo. Eu não pré-geocodificaria tudo agora; primeiro reforçaria cache e observabilidade. CEPs populares podem virar otimização futura.

### Q040 — `obterColunasProdutos` cacheado indefinidamente
> RESPOSTA: Sim. TTL de 1 hora já resolve bem sem complicar.

### Q041 — Sem compressão Brotli no build Vite
> RESPOSTA: Para frontend em Vercel e backend em Render, eu não adicionaria plugin agora. Normalmente a camada de entrega já lida com compressão.

---

## 🐛 BUGS E INCONSISTÊNCIAS

### Q042 — Estoque não é restaurado quando pedido é cancelado
> RESPOSTA: Sim. Se o sistema reserva/decrementa estoque no pedido, precisa restaurar em cancelamento, rejeição e expiração de PIX. Isso deve ser idempotente.

### Q043 — Carrinho vazio pode chegar ao checkout
> RESPOSTA: Sim. Adicione guard no frontend e redirecione para `/produtos` com feedback ao usuário.

### Q044 — Colunas PIX legado ainda no schema
> RESPOSTA: Sim. Primeiro audite leitura/escrita. Se estiverem realmente mortas, marque como deprecated e remova em migration controlada.

### Q045 — Desconto pode resultar em total negativo
> RESPOSTA: Sim, mas eu faria um pouco melhor: total nunca pode ser negativo. Se zerar, trate como pedido 100% descontado sem cobrar gateway. Só use piso 0,01 se o fluxo exigir cobrança mínima.

### Q046 — Sessão 3DS expira sem aviso ao usuário
> RESPOSTA: Sim. Vale adicionar feedback explícito e, se possível, contador visual.

### Q047 — `toNumber` não trata múltiplos decimais
> RESPOSTA: Sim. Rejeite valores inválidos com múltiplos separadores decimais em vez de “corrigir” silenciosamente.

### Q048 — QR Code lazy import cacheia Promise rejeitada
> RESPOSTA: Sim. Limpe a referência no catch para permitir retry.

### Q049 — Toast ID counter overflow teórico
> RESPOSTA: Não é prioridade real. Se for tocar no arquivo, pode melhorar por higiene usando UUID ou reset seguro, mas eu não colocaria isso na frente de outros itens.

### Q050 — PagBank SDK script — race condition no loading
> RESPOSTA: Sim. Adicione fallback por polling curto de `window.PagSeguro` até timeout.

---

## 🗄️ BANCO DE DADOS

### Q051 — Índice faltante em `avaliacoes.produto_id`
> RESPOSTA: Sim. Pode criar esse índice.

### Q052 — Índices faltantes em `produtos` para busca LIKE
> RESPOSTA: Sim, mas eu ligaria isso à reestruturação da busca server-side. Para 21k produtos não é absurdo hoje, porém FULLTEXT passa a fazer sentido na próxima etapa.

### Q053 — `DROP DATABASE IF EXISTS railway` no schema base
> RESPOSTA: Sim. Remova. Mesmo que não seja usado no fluxo normal, é perigoso demais para continuar no repositório.

### Q054 — Sem índice composto em `pedido_itens (pedido_id, produto_id)`
> RESPOSTA: Sim. Vale adicionar.

### Q055 — `preco DECIMAL(10,2)`
> RESPOSTA: Eu manteria 2 casas para valores monetários cobrados do cliente. Não mudaria para 4 casas no preço principal agora. Se precisar precisão intermediária, trate no cálculo e arredonde antes de persistir/cobrar.

### Q056 — Tabelas `banners` e `admin_audit_log` podem não existir
> RESPOSTA: Eu prefiro depender de migration completa e falhar cedo se faltar schema, em vez de criar tabelas em runtime sem controle. Pode adicionar check de saúde/startup.

### Q057 — Migrations com UPDATE usando WHERE LIKE sem índice
> RESPOSTA: Para migration one-shot está aceitável. Para futuras migrations, evite padrão amplo e prefira critérios mais determinísticos.

---

## 📦 DEPENDÊNCIAS E INFRAESTRUTURA

### Q058 — `node-fetch` no backend quando Node 18+ tem fetch nativo
> RESPOSTA: Sim. Pode auditar e migrar para fetch nativo quando não houver diferença prática. Não é urgente, mas limpa dependência.

### Q059 — SheetJS (xlsx) — licença para uso comercial
> RESPOSTA: Para leitura/gravação básica eu trataria como aceitável no uso atual, mas manteria uma checagem jurídica/licença antes de ampliar muito a dependência ou usar recursos avançados.

### Q060 — Render free plan com cold start
> RESPOSTA: Para produção de mercado eu não aceitaria plano free. O mínimo saudável é plano pago/starter. Não vale depender de warm-up gambiarra para fluxo de pedido.

### Q061 — CI/CD — migration check superficial
> RESPOSTA: Sim. Vale adicionar job com MySQL de teste e dry-run/execução de migration em CI.

### Q062 — Sem lockfile no backend
> RESPOSTA: O lockfile deve estar commitado. Se estiver sendo ignorado, corrija isso.

### Q063 — Evolution API URL hardcoded como localhost
> RESPOSTA: Em produção isso não deve cair em localhost silenciosamente. A feature precisa ser explicitamente opcional, com flag clara, ou falhar de forma controlada se for exigida e não configurada.

---

## 🎨 FRONTEND — UX E ACESSIBILIDADE

### Q064 — Drawer de detalhe de produto sem focus trap
> RESPOSTA: Sim. Pode adicionar focus trap e atributos de modal acessível.

### Q065 — Sem skeleton loading em carregamento inicial de produtos
> RESPOSTA: Sim. Skeleton melhora percepção de performance.

### Q066 — Sem preflight de estoque antes do checkout
> RESPOSTA: Sim. Vale validar ao entrar no checkout e novamente antes de criar o pedido.

### Q067 — SmartImage sem responsive srcset
> RESPOSTA: O ideal é padronizar SmartImage para aceitar `srcSet`/`sizes` usando o helper responsivo já existente, em vez de deixar isso espalhado.

### Q068 — Canonical URL perde query params
> RESPOSTA: Para esse projeto, eu manteria canonical sem params. Filtros de categoria/busca não parecem ser a prioridade de SEO.

### Q069 — Sem Service Worker / PWA
> RESPOSTA: Há valor, mas eu deixaria isso depois das correções críticas, pagamento e performance principal. Não é prioridade imediata.

### Q070 — Sem meta tags de SEO dinâmicas
> RESPOSTA: Sim. Principalmente para páginas de produto e compartilhamento em WhatsApp.

### Q071 — Acessibilidade — contraste e labels incompletos
> RESPOSTA: Sim. Pode fazer uma passada de a11y com foco em labels, headings, foco visível e navegação por teclado.

---

## 💳 PAGBANK / PAGAMENTO

### Q072 — Dois endpoints de webhook PagBank
> RESPOSTA: Consolidar em um endpoint canônico é o certo. O outro pode virar alias temporário/compatibilidade até todo o painel estar apontando para a URL certa.

### Q073 — PIX mock em dev não simula confirmação via webhook
> RESPOSTA: Sim. Uma rota dev-only de simulação ajuda muito o fluxo local e a homologação.

### Q074 — 3DS fallback para mock sem guard explícito em prod
> RESPOSTA: Sim. Mesma decisão da Q005: mock de pagamento deve ser proibido em produção.

### Q075 — Sem retry automático para webhook PagBank
> RESPOSTA: Independentemente da janela exata de retry do PagBank, cache em memória de 10 minutos não é solução suficiente. A resposta estrutural continua sendo idempotência persistida em banco.

### Q076 — Logs de homologação 3DS em produção
> RESPOSTA: Sim. Restrinja por ambiente ou flag explícita.

### Q077 — PagBank SDK versão não fixada
> RESPOSTA: Se o provedor permitir fixação/controle de versão, vale fixar. Se não permitir, pelo menos centralize a URL, monitore regressões e tenha fallback controlado.

---

## 🧹 LIMPEZA E ORGANIZAÇÃO

### Q078 — Diretório `legacy/`
> RESPOSTA: Sim, pode sair do fluxo principal. Eu arquivaria em branch/tag se quiser histórico e removeria do repositório ativo, desde que confirme que nada referencia isso.

### Q079 — `bot-whatsapp/` sem código funcional
> RESPOSTA: Se está abandonado, remova ou archive. Não faz sentido poluir o repositório principal.

### Q080 — `node_modules/` commitado no bot-whatsapp
> RESPOSTA: Sim. Adicione ao `.gitignore` e remova do tracking imediatamente.

### Q081 — Arquivos SQL avulsos no backend root
> RESPOSTA: Sim. Organize em `docs/sql/`, `scripts/sql/` ou remova se forem descartáveis.

### Q082 — Pastas de log vazias commitadas
> RESPOSTA: Sim. Ignore logs e mantenha só `.gitkeep` quando necessário.

### Q083 — Scripts PowerShell e .bat duplicados
> RESPOSTA: Eu só removeria `.bat` se você tiver certeza de que a equipe usa PowerShell sem fricção. Caso contrário, manteria wrappers simples para compatibilidade.

### Q084 — Múltiplos READMEs e docs redundantes
> RESPOSTA: Sim. Consolidar faz sentido: um README raiz forte e documentação complementar em `docs/`.

### Q085 — `whatsapp-qrcode.html` no backend
> RESPOSTA: Se não é ferramenta operacional ativa, pode mover para `docs/tools` ou remover.

### Q086 — `docker-compose-evolution.yml` no backend
> RESPOSTA: Se Evolution não é parte do fluxo atual, eu moveria para documentação/exemplos.

### Q087 — Diretório `img/ads/` no root
> RESPOSTA: Primeiro confirme referência. Se estiver em uso, centralize como asset público do frontend ou origem única de mídia; se não, remova.

---

## 🔄 NEGÓCIO E FUNCIONALIDADE

### Q088 — Sem soft delete para pedidos
> RESPOSTA: Para o cenário atual, status parece suficiente. Eu não colocaria soft delete de pedidos agora.

### Q089 — Sem internacionalização (i18n)
> RESPOSTA: Sem necessidade agora. Para mercado de bairro, i18n seria overhead.

### Q090 — Dados do mercado hardcoded
> RESPOSTA: Como é single-tenant, tudo bem estar centralizado; o problema é estar espalhado. Eu moveria para config única, preferencialmente com suporte a env/admin config.

### Q091 — Frete calculado por Haversine
> RESPOSTA: É aceitável no curto prazo se houver fator de correção e área de entrega pequena. Eu não integraria API de rotas antes de resolver as prioridades críticas.

### Q092 — Sem limite de distância máxima para entrega
> RESPOSTA: Sim. Precisa existir limite configurável. Eu começaria com raio operacional claro, por exemplo 8–15 km conforme a operação real.

### Q093 — Taxa de serviço como percentual fixo
> RESPOSTA: O ideal é deixar configurável por método de pagamento, mesmo que inicialmente os valores sejam iguais. Não deixaria isso preso em regra rígida de código.

### Q094 — Cupons sem restrição por categoria ou valor mínimo
> RESPOSTA: Eu ampliaria o mínimo útil: validade, valor mínimo, limite de uso e primeira compra. Categoria específica pode vir depois.

### Q095 — Sem notificação de status de pedido para o cliente
> RESPOSTA: Sim, há valor real. WhatsApp é um bom primeiro canal, mas isso vem depois de estabilizar pagamentos e operação.

---

## 🔍 MONITORAMENTO E OBSERVABILIDADE

### Q096 — Sentry integrado mas sem coverage completa
> RESPOSTA: Sim. Vale auditar `catch` importantes, porque erro engolido não chega no handler global.

### Q097 — Sem correlation IDs nos logs
> RESPOSTA: Sim. Adicione `X-Request-ID`/UUID e propague nos logs.

### Q098 — PostHog/Analytics não configurado
> RESPOSTA: Pode preparar a integração, mas só ativaria quando chave, consentimento e objetivo de medição estiverem definidos.

### Q099 — Web Vitals sem destino
> RESPOSTA: Sim. Verifique. Se não envia para lugar nenhum, ou conecta a analytics ou remove.

### Q100 — Console.log com emojis em produção
> RESPOSTA: Eu padronizaria logs com prefixos textuais. Emoji pode continuar em ambiente local, mas em produção prefiro logs mais fáceis de parsear.

---

## 🧪 TESTES

### Q101 — Cobertura de testes limitada
> RESPOSTA: Concordo com essa ordem de prioridade: 1) pagamento/webhook, 2) frete e cupons, 3) auth, 4) componentes críticos do checkout.

### Q102 — Sem TypeScript
> RESPOSTA: Sim. JSDoc em funções críticas já ajuda bastante sem migrar stack.

---

## 📊 MEMORY LEAKS E RUNTIME

### Q103 — Preload image registry cresce indefinidamente
> RESPOSTA: Sim. Adicione limite e eviction. Eu usaria algo na faixa de 300 entradas.

### Q104 — RecorrenciaContext `estado.produtos` nunca é limpo
> RESPOSTA: Sim. Pode adicionar pruning por tamanho e/ou TTL.

### Q105 — `crossSellAposAdicao` cria array slice em cada render
> RESPOSTA: Sim, mas isso é otimização menor. Ajuste dentro da refatoração da ProdutosPage, sem criar complexidade desnecessária.

### Q106 — Hooks de resize sem debounce
> RESPOSTA: Sim. Debounce/throttle curto de 100–150 ms faz sentido onde não for medição crítica em tempo real.

---

## 🔧 DEVELOPER EXPERIENCE

### Q107 — Sem .env.example documentado no root
> RESPOSTA: Sim. Vale criar um `.env.example` raiz explicando frontend e backend.

### Q108 — Funções duplicadas entre backend e frontend
> RESPOSTA: Eu não criaria pacote compartilhado complexo agora. Para utilitários puros e críticos, pode centralizar em pasta shared simples se isso não atrapalhar build/deploy.

### Q109 — `Consulta #2.sql` e `va.sql`
> RESPOSTA: Sim. Remova do root ou mova para documentação/scripts, se ainda tiver utilidade.

### Q110 — `process.exit(1)` em unhandled rejection/uncaught exception
> RESPOSTA: O processo deve continuar morrendo, mas com graceful shutdown antes: parar de aceitar tráfego, drenar conexões, fechar pool e então sair.

---

## Sequência sugerida de implementação

### Fase 1 — travar riscos críticos
1. `backend/lib/config.js`
2. `backend/routes/pedidos-criar.js`
3. `backend/routes/webhooks.js`
4. Arquivo dos endpoints de pagamento (`backend/server.js` ou rota equivalente)
5. Migrations para idempotência, índices e constraints críticas

### Fase 2 — bugs que afetam operação e conversão
6. `frontend/src/pages/PagamentoPage.jsx`
7. `frontend/src/contexts/CartContext.jsx`
8. `frontend/src/pages/ProdutosPage.jsx`
9. `frontend/src/utils/produtosUtils.js`
10. `frontend/src/lib/pagbank.js`

### Fase 3 — admin, importação, exportação e proteção
11. Rotas admin de import/export catálogo
12. Busca admin e queries com `SELECT *`
13. Rate limits dedicados e recaptcha

### Fase 4 — performance e arquitetura
14. Refatoração de `ProdutosPage.jsx`
15. Refatoração de `PagamentoPage.jsx`
16. Otimizações de cache, preload e geocoding
17. Consolidação parcial de queries do dashboard

### Fase 5 — UX, acessibilidade e observabilidade
18. Focus trap, skeleton, OG tags, preflight de estoque
19. Sentry coverage, request IDs, web vitals
20. Limpeza de docs, legacy e arquivos mortos

---

## Ordem prática de arquivos para você editar primeiro

1. `backend/lib/config.js`
2. `backend/routes/pedidos-criar.js`
3. `backend/routes/webhooks.js`
4. `backend/server.js` ou rotas de pagamento/rate limit
5. `backend/migrations/*`
6. `frontend/src/pages/PagamentoPage.jsx`
7. `frontend/src/pages/ProdutosPage.jsx`
8. `frontend/src/contexts/CartContext.jsx`
9. `frontend/src/lib/api.js`
10. `frontend/src/lib/pagbank.js`
11. `frontend/src/components/SmartImage.jsx`
12. `frontend/src/components/ErrorBoundary.jsx`
13. `frontend/src/context/ToastContext.jsx`
14. `frontend/src/context/RecorrenciaContext.jsx`
15. Rotas/admin helpers de importação/exportação
