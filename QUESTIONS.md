# QUESTIONS.md — Revisão Técnica Completa do Projeto BomFilho (v2)

> **Autor da revisão:** Tech Lead / Code Reviewer
> **Data:** 21/03/2026
> **Escopo:** Arquitetura, segurança, performance, refatoração, bugs e melhorias
> **Base:** Leitura completa de todos os arquivos do projeto (backend, frontend, infra, DB)
>
> Cada item é uma pergunta ou ponto de atenção independente.
> Responda diretamente abaixo de cada pergunta com `> RESPOSTA:` para que eu possa então aplicar as melhorias.

---

## 🔴 SEGURANÇA — CRÍTICO

### Q001 — JWT_SECRET aceita string vazia em produção
Em `backend/lib/config.js` linha ~119: `const JWT_SECRET = String(process.env.JWT_SECRET || '');`
Diferente de `PAGBANK_TOKEN`, `BASE_URL`, etc., **não existe `throw` em produção se JWT_SECRET estiver vazio ou curto**. Uma string vazia significa que qualquer pessoa pode forjar tokens JWT válidos — bypass total de autenticação.

**Pergunta:** Posso adicionar validação obrigatória em produção (`if (IS_PRODUCTION && JWT_SECRET.length < 32) throw Error(...)`)? Existe alguma razão para aceitar JWT vazio?

> RESPOSTA:

---

### Q002 — Webhook PagBank com cache de idempotência em memória
Em `backend/routes/webhooks.js`: a deduplicação de webhooks usa `BoundedCache` (in-memory Map com TTL de 10min). Se o processo reinicia (deploy, crash, OOM), o cache é perdido e o mesmo webhook pode ser processado duas vezes — marcando pedidos como pagos duplicadamente.

**Pergunta:** Isso é um risco aceitável dado o volume atual? Ou devo mover a deduplicação para o banco (tabela `webhook_events` com UNIQUE KEY no `notification_id`)?

> RESPOSTA:

---

### Q003 — Race condition no estoque durante criação de pedido
Em `backend/routes/pedidos-criar.js`: o estoque é verificado antes de `beginTransaction()`, mas atualizado dentro da transação. Entre a verificação e o UPDATE, outra requisição concorrente pode decrementar o mesmo estoque, resultando em **estoque negativo**.

**Pergunta:** Posso mover a verificação de estoque para dentro da transação usando `SELECT ... FOR UPDATE` (lock pessimista na linha do produto)?

> RESPOSTA:

---

### Q004 — Race condition no uso de cupons
Ao aplicar cupom no pedido, a contagem de uso (`uso_atual`) é verificada fora da transação e incrementada dentro. Duas requisições simultâneas podem ambas passar na validação e ultrapassar o `uso_maximo`.

**Pergunta:** Posso mover a validação + incremento do cupom para dentro da transação com lock (`SELECT ... FOR UPDATE` na tabela cupons)?

> RESPOSTA:

---

### Q005 — ALLOW_PIX_MOCK pode chegar a produção
Se a variável `ALLOW_PIX_MOCK=true` for acidentalmente configurada em produção (ex: cópia de .env), usuários podem gerar QR codes PIX falsos e criar pedidos sem pagamento real. O mesmo se aplica a `ALLOW_DEBIT_3DS_MOCK`.

**Pergunta:** Posso adicionar um guard em `config.js` que faz `throw` se mock está ativo em produção (`if (IS_PRODUCTION && ALLOW_PIX_MOCK) throw Error(...)`)? Ou existe cenário legítimo para mock em prod?

> RESPOSTA:

---

### Q006 — Sem rate limit em endpoints de pagamento
Os endpoints `POST /api/pagamentos/cartao` e `POST /api/pagamentos/pix` não têm rate limiter específico. Um atacante autenticado pode gerar centenas de requisições de pagamento por minuto, sobrecarregando a API do PagBank e potencialmente gerando cobranças abusivas.

**Pergunta:** Posso adicionar rate limiter específico (ex: 5 req/min por `usuario_id`) nesses endpoints? O `checkoutLimiter` (10/min) do server.js já cobre isso ou precisa de um limiter mais fino?

> RESPOSTA:

---

### Q007 — Endpoint de criação de pedido sem rate limit dedicado
`POST /api/pedidos` depende apenas do rate limiter global (100 req/15min por IP). Dado que cria registros no banco + reserva estoque, deveria ter limiter mais restritivo.

**Pergunta:** Posso aplicar o `checkoutLimiter` (ou criar um dedicado ~3 req/min por user) nesse endpoint?

> RESPOSTA:

---

### Q008 — Admin password em texto plano aceita em produção com warning
Em `config.js` linha ~155: se `ADMIN_PASSWORD` está definido (texto plano) sem `ADMIN_PASSWORD_HASH`, o sistema emite `console.warn` mas **continua funcionando**. Em produção, isso permite que a senha admin trafegue em logs ou seja exposta se `.env` vazar.

**Pergunta:** Posso tornar isso um `throw` em produção (forçar uso de bcrypt hash)?

> RESPOSTA:

---

### Q009 — Importação de produtos sem limite de linhas
Em `POST /api/admin/catalogo/produtos/importar`: o upload via multer tem limite de tamanho (`TAMANHO_MAXIMO_IMPORTACAO_BYTES`), mas **não valida o número de linhas** da planilha. Uma planilha de 8MB pode ter 100k+ linhas, causando OOM ou timeout no processamento.

**Pergunta:** Posso adicionar validação de máximo de linhas (ex: 5000)? Qual o tamanho típico de importação?

> RESPOSTA:

---

### Q010 — Exportação de produtos sem LIMIT na query
Em `GET /api/admin/catalogo/produtos/exportar.xlsx`: executa `SELECT * FROM produtos` sem LIMIT. Com 21k+ produtos, isso pode gerar OOM ao montar o workbook em memória.

**Pergunta:** Posso adicionar LIMIT (ex: 25000) e/ou streaming da resposta? Ou a exportação completa é necessária?

> RESPOSTA:

---

### Q011 — Resposta de erro na importação expõe detalhes internos
Na rota de importação de catálogo, se ocorre erro, `erro.extra` (detalhes internos do stack) é retornado ao client via JSON. Isso pode revelar informações de estrutura interna.

**Pergunta:** Posso remover `erro.extra` da resposta e manter apenas a mensagem genérica?

> RESPOSTA:

---

### Q012 — Recaptcha desabilitado em checkout e pagamento
Em `render.yaml`: `RECAPTCHA_CHECKOUT_ENABLED=false`, `RECAPTCHA_PAYMENT_ENABLED=false`. O checkout fica totalmente exposto a bots e abuse automatizado.

**Pergunta:** Há plano para ativar reCAPTCHA? Se sim, as keys do Google já estão configuradas? Posso preparar a ativação?

> RESPOSTA:

---

### Q013 — `COOKIE_SAME_SITE=none` sem validação cruzada com SECURE
Em `render.yaml` usa `COOKIE_SAME_SITE=none` (necessário para cross-origin). Porém, se `COOKIE_SECURE=false` for configurado por engano, os cookies param de funcionar silenciosamente (browsers rejeitam SameSite=None sem Secure).

**Pergunta:** Posso adicionar validação em `config.js`: `if (COOKIE_SAME_SITE === 'none' && !COOKIE_SECURE) throw Error(...)`?

> RESPOSTA:

---

### Q014 — Busca de admin (clientes/produtos) sem limite de tamanho no termo
Em `GET /api/admin/clientes` e `GET /api/admin/catalogo/produtos`: o parâmetro `busca` é usado em `LIKE %...%` sem limite de tamanho. Um atacante pode enviar string de 10KB causando query lenta.

**Pergunta:** Posso limitar `busca.length` a 200 caracteres nesses endpoints?

> RESPOSTA:

---

### Q015 — Helmet com `contentSecurityPolicy: false`
O Helmet está configurado com CSP desabilitado. Isso permite que scripts injetados (via XSS) executem livremente.

**Pergunta:** É intencional por causa do SDK do PagBank (que injeta scripts externos)? Posso configurar um CSP permissivo que cubra ao menos styles/images, mesmo deixando scripts como `unsafe-inline` para o SDK?

> RESPOSTA:

---

---

## 🟠 SEGURANÇA — ALTA

### Q016 — Token JWT retornado no body do response
No login (`POST /api/auth/login`), o token JWT é retornado tanto no cookie httpOnly quanto no body da resposta (`{ accessToken: '...' }`). O body é acessível via JavaScript, o que anula parte da proteção do httpOnly cookie.

**Pergunta:** O body é necessário para o frontend funcionar (mobile, webview)? Posso remover o token do body e usar apenas cookies?

> RESPOSTA:

---

### Q017 — Frete público sem autenticação
`GET /api/frete/simular` é público, sem auth. Permite que qualquer pessoa faça requisições de simulação de frete em massa, o que chama geocodificação (Nominatim/BrasilAPI).

**Pergunta:** Posso exigir autenticação nesse endpoint, ou há caso de uso legítimo para visitantes não logados?

> RESPOSTA:

---

### Q018 — Avaliações sem proteção anti-abuso
`POST /api/avaliacoes` exige autenticação, mas não tem rate limit. Um usuário pode postar centenas de avaliações por minuto.

**Pergunta:** Posso adicionar rate limit (ex: 5 avaliações/min por user)? Existe constraint UNIQUE no banco que previne duplicatas?

> RESPOSTA:

---

### Q019 — `SELECT *` em queries com dados sensíveis
Algumas queries usam `SELECT *` (ex: `SELECT * FROM usuarios`, `SELECT * FROM pedidos`), o que pode expor colunas como `senha_hash` no response se não filtrado adequadamente.

**Pergunta:** Posso auditar e substituir todos os `SELECT *` por colunas explícitas nos endpoints que retornam dados ao client?

> RESPOSTA:

---

### Q020 — Enumeração de e-mail no register/login
As mensagens de erro de login diferenciam "e-mail não encontrado" vs "senha incorreta", permitindo que atacantes descubram quais e-mails estão cadastrados.

**Pergunta:** Posso unificar a mensagem de erro para "Credenciais inválidas" em ambos os casos?

> RESPOSTA:

---

### Q021 — Validação de CEP pode crashar com valor null
Em `pedidos-criar.js`: `if (cepDestinoEntrega.length !== 8)` — se `cepDestinoEntrega` for `null` ou `undefined`, `.length` causa TypeError e retorna 500 em vez de 400.

**Pergunta:** Posso adicionar check `typeof === 'string'` antes de acessar `.length`?

> RESPOSTA:

---

### Q022 — Bulk insert de produtos sem transação com rollback
Em `POST /api/admin/produtos/bulk`: insere itens em loop individual. Se item N falha, itens 1..N-1 já foram commitados (sem rollback). Também sem validação de tamanho do array.

**Pergunta:** Posso envolver em transação com rollback e limitar array a 100 itens?

> RESPOSTA:

---

---

## 🏗️ ARQUITETURA

### Q023 — ProdutosPage com ~1900 linhas (God Component)
`ProdutosPage.jsx` tem ~1900 linhas, 50+ `useState`, 40+ `useMemo`, 15+ `useEffect`. É o componente mais complexo do sistema, responsável por: catálogo, filtros, busca, favoritos, recorrência, cross-sell, drawer de detalhe, virtualização, prefetch.

**Pergunta:** Posso extrair sub-responsabilidades em hooks e componentes menores? Sugiro:
1. `useProdutosFiltro()` — busca, categoria, ordenação, filtros
2. `useProdutosRecorrencia()` — favoritos, recompra, cross-sell
3. `useProdutosPrefetch()` — prefetch e cache
4. `<ProdutoDecisionDrawer />` — já é componente separado, confirmar
5. `<ProdutosBusca />` — barra de busca + filtros

Qual nível de decomposição é aceitável?

> RESPOSTA:

---

### Q024 — PagamentoPage com ~2700 linhas (God Component)
`PagamentoPage.jsx` tem ~2700 linhas, 50+ `useState`, controlando 5 etapas do checkout: carrinho → entrega → pagamento → PIX/cartão → confirmação. Toda a lógica 3DS, CEP, frete e validação está em um único componente.

**Pergunta:** Posso extrair em componentes/hooks menores? Sugiro:
1. `useCheckoutFlow()` — máquina de estados do checkout
2. `use3DSAuthentication()` — toda lógica 3DS
3. `useFreteSimulacao()` — cálculo e simulação de frete
4. `useCheckoutValidation()` — validações de documento, endereço, etc.
5. Mover cada etapa para componente próprio (já existem `CheckoutCart`, `CheckoutPayment`, etc.)

> RESPOSTA:

---

### Q025 — ContaPage com ~670 linhas
`ContaPage.jsx` é relativamente grande mas já tem componentes extraídos em `components/conta/`. A complexidade principal está no gerenciamento de múltiplas sections (perfil, endereços, preferências, atalhos).

**Pergunta:** Está em tamanho aceitável ou devo continuar extraindo? A lógica de endereços (CRUD) parece ser a mais pesada.

> RESPOSTA:

---

### Q026 — AdminPage e AdminGerenciaPage — split funcional
`AdminPage.jsx` (~?) e `AdminGerenciaPage.jsx` (~?) são os painéis administrativos. Já têm componentes em `admin/` e `admin/gerencia/`.

**Pergunta:** Estas páginas estão suficientemente decompostas ou há God Component symptoms?

> RESPOSTA:

---

### Q027 — RecorrenciaContext com normalização excessiva (150+ linhas)
`RecorrenciaContext.jsx` dedica ~150 linhas à normalização defensiva de dados do localStorage (protege contra corrupção). Isso é robusto mas aumenta o tamanho do bundle e a complexidade.

**Pergunta:** A normalização pesada é necessária pela experiência com dados corrompidos em produção? Ou posso simplificar com try/catch + reset?

> RESPOSTA:

---

### Q028 — CartContext — payloadEvento usa closure anti-pattern
Em `CartContext.jsx`, `addItem` define `let payloadEvento = null` fora de `setItens()` e atribui o valor dentro do setState callback. Depois lê `payloadEvento` fora do setState para disparar tracking. Funciona porque useState é síncrono em React 18, mas é anti-pattern que pode quebrar em React 19+ (transitions/concurrent mode).

**Pergunta:** Posso refatorar para usar `useRef` ou mover o tracking para dentro de um `useEffect` que observa `itens`?

> RESPOSTA:

---

### Q029 — 3 camadas de API no frontend — necessidade real?
Existem 3 arquivos de API:
- `config/api.js` — constantes (URL, timeout, flags)
- `services/api.js` — transporte (fetch wrapper com retry, timeout)
- `lib/api.js` — domínio (login, criarPedido, admin...)

A separação é limpa, mas para um projeto deste tamanho, `services/api.js` e `lib/api.js` poderiam ser um só.

**Pergunta:** A separação em 3 camadas agrega valor para o tamanho atual do projeto? Ou simplificar para 2 camadas (config + domain)?

> RESPOSTA:

---

### Q030 — Sem Error Boundaries em seções críticas
Existe `ErrorBoundary.jsx` e é usado em `App.jsx` ao redor de rotas. Mas se um componente dentro de `ProdutosPage` ou `PagamentoPage` falha, **todo o checkout ou catálogo cai**, não apenas a seção afetada.

**Pergunta:** Posso adicionar Error Boundaries granulares ao redor de: drawer de detalhe de produto, seção de cross-sell, seção de favoritos, formulário de pagamento?

> RESPOSTA:

---

### Q031 — styles.css com ~15800 linhas — arquivo monolítico
Todo o CSS do projeto está em um único arquivo `styles.css` com ~15800 linhas. Isso dificulta manutenção, causa conflitos de merge, e torna difícil identificar CSS morto.

**Pergunta:** Alguma estratégia de organização é desejada? Não sugiro migrar para Tailwind/modules, mas posso:
1. Dividir em seções claras com comentários de separação
2. Identificar e remover CSS morto
3. Manter assim se funciona e a equipe já está habituada

> RESPOSTA:

---

---

## ⚡ PERFORMANCE

### Q032 — 21k produtos indexados no client com O(n×15) por filtro
Em `ProdutosPage.jsx`, `produtosIndexados` executa `useMemo` que itera todos os 21k produtos computando ~15 campos derivados por produto. Roda a cada mudança em `growthTopProductsById` ou `produtos`.

**Pergunta:** Isso causa jank perceptível? Para 21k × 15 campos, são ~315k operações. Alternativas:
1. Mover indexação para Web Worker
2. Indexar incrementalmente (só produtos novos)
3. Paginar server-side (reduzir payload)
Qual abordagem faz mais sentido para o uso real?

> RESPOSTA:

---

### Q033 — Produtos enviados 100% do catálogo em uma request
`GET /api/produtos` retorna todos os produtos ativos (21k) em uma única resposta. O frontend filtra em memória.

**Pergunta:** Isso é intencional para UX offline-first? Ou devo implementar paginação server-side? O payload de 21k produtos é aproximadamente quantos MB?

> RESPOSTA:

---

### Q034 — Image prefetch registry nunca limpa
Em `produtosUtils.js`: `prefetchedProductImageSrc` (Set) e `prefetchedProductImageQueue` (Array) crescem indefinidamente. Após navegar 1000+ produtos, a memória acumula.

**Pergunta:** Posso adicionar LRU eviction (ex: manter max 200 entries)? SmartImage já tem LRU com 800 entries, mas o prefetch é separado.

> RESPOSTA:

---

### Q035 — CEP lookup cache não cacheia erros
Em `lib/api.js`: se a consulta de CEP falha (viaCEP offline, timeout), o erro é descartado e a próxima chamada faz nova requisição. Se viaCEP estiver fora, cada digitação gera nova requisição falhada.

**Pergunta:** Posso cachear erros com TTL curto (30s) para evitar flood de requests?

> RESPOSTA:

---

### Q036 — N+1 queries no dashboard admin
Em `GET /api/admin/operacional/dashboard/resumo`: executa ~13 queries separadas (contagem por status, faturamento, etc.) em vez de consolidar em UNION ou subqueries.

**Pergunta:** Posso consolidar em 2-3 queries para reduzir latência? O dashboard é acessado com que frequência?

> RESPOSTA:

---

### Q037 — Pedido cria itens em loop com queries individuais
Em `pedidos-criar.js`: os itens do pedido são inseridos um a um via loop. Para carrinho com 30 itens, isso gera 30 INSERTs separados.

**Pergunta:** Posso usar bulk INSERT (`INSERT INTO pedido_itens VALUES ?, ?, ?`) em uma query?

> RESPOSTA:

---

### Q038 — Pool MySQL com connectionLimit=10
Em `lib/db.js`: o pool tem apenas 10 conexões. Em pico de pedidos (horário comercial de mercado de bairro), isso pode causar enfileiramento com `queueLimit: 0` (fila infinita).

**Pergunta:** 10 conexões são suficientes para o volume atual? O que acontece em pico? O plano do banco suporta mais conexões?

> RESPOSTA:

---

### Q039 — Geocodificação sequencial com múltiplas chamadas
O cálculo de frete faz geocodificação via Nominatim/BrasilAPI de forma sequencial (endereço completo → CEP → parcial). Cada fallback adiciona ~500ms-1s de latência.

**Pergunta:** Os resultados de geocodificação têm cache (24h via `CEP_GEO_TTL_MS`). Isso é suficiente? Ou devo pré-geocodificar CEPs populares?

> RESPOSTA:

---

### Q040 — `obterColunasProdutos` cacheado indefinidamente
Em `admin-catalogo.js` (ou helper): a lista de colunas da tabela `produtos` é consultada uma vez e cacheada para sempre. Se o schema muda (via migration), o cache fica stale até restart.

**Pergunta:** Posso adicionar TTL (ex: 1 hora) ou invalidar após migration?

> RESPOSTA:

---

### Q041 — Sem compressão Brotli no build Vite
O `vite.config.js` não configura plugin de compressão (gzip/brotli). O Vercel faz isso automaticamente, mas assets servidos localmente ou via CDN custom não seriam comprimidos.

**Pergunta:** Vercel/Render já comprimem automaticamente? Se sim, não precisa de plugin. Se não, devo adicionar `vite-plugin-compression`?

> RESPOSTA:

---

---

## 🐛 BUGS E INCONSISTÊNCIAS

### Q042 — Estoque não é restaurado quando pedido é cancelado
Ao cancelar um pedido (mudar status para 'cancelado'), o estoque decrementado durante a criação **não é restaurado**. Isso causa "shrinkage virtual" — os produtos ficam permanentemente como indisponíveis.

**Pergunta:** Devo implementar restauração de estoque ao cancelar? Há lógica de cancelamento automático (ex: PIX expirado)?

> RESPOSTA:

---

### Q043 — Carrinho vazio pode chegar ao checkout
No frontend, não há guard que impeça navegação para `/pagamento` com carrinho vazio. No backend, `pedidos-criar.js` retorna 400, mas o flow de UX mostra tela de checkout vazia.

**Pergunta:** Posso adicionar guard no frontend (redirect para `/produtos` se carrinho vazio)?

> RESPOSTA:

---

### Q044 — Colunas PIX legado (`pix_qr_base64`, `pix_codigo`) ainda no schema
As migrations criam colunas `pix_qr_base64` e `pix_codigo` que são deprecated. Código pode estar escrevendo nelas desnecessariamente.

**Pergunta:** Posso verificar se algum código ainda escreve nessas colunas e criar migration para removê-las?

> RESPOSTA:

---

### Q045 — Desconto pode resultar em total negativo
Se um cupom concede desconto maior que o subtotal + frete, o total pode ficar negativo. O backend não tem guard floor de R$0,01.

**Pergunta:** Posso adicionar `Math.max(0.01, totalFinal)` na criação do pedido?

> RESPOSTA:

---

### Q046 — Sessão 3DS expira sem aviso ao usuário
A sessão 3DS tem timeout (configurável), mas quando expira, o frontend não mostra mensagem clara. O pagamento simplesmente falha com erro genérico.

**Pergunta:** Posso adicionar timer visual que avisa "Sessão de pagamento expirando em X minutos"?

> RESPOSTA:

---

### Q047 — `toNumber` em produtosUtils não trata múltiplos decimais
`toNumber("1.99.99")` retorna `1.9999` após `.replace(',', '.').replace(/[^\d.-]/g, '')`. Deveria retornar `NaN` ou `0`.

**Pergunta:** Posso melhorar a validação para rejeitar strings com múltiplos pontos decimais?

> RESPOSTA:

---

### Q048 — QR Code lazy import cacheia Promise rejeitada
Em `checkoutUtils.js`: se `import('qrcode')` falha, a Promise rejeitada fica cacheada em `qrcodeModulePromise`. Próxima chamada retorna a mesma Promise rejeitada para sempre.

**Pergunta:** Posso limpar `qrcodeModulePromise = null` no catch para permitir retry?

> RESPOSTA:

---

### Q049 — Toast ID counter overflow teórico
Em `ToastContext.jsx`: `let toastIdCounter = 0` é incrementado para cada toast. Após 2^53 toasts (Number.MAX_SAFE_INTEGER), os IDs ficam imprecisos.

**Pergunta:** Extremamente improvável, mas posso trocar por `crypto.randomUUID()` ou reset periódico para higiene de código?

> RESPOSTA:

---

### Q050 — PagBank SDK script — race condition no loading
Em `lib/pagbank.js`: se o script do PagBank SDK já está no DOM mas `window.PagSeguro` é undefined (script carregando), o código adiciona event listeners. Mas se entre o `querySelector` e `addEventListener` o script termina de carregar, o evento `load` já disparou e nunca será capturado.

**Pergunta:** Posso adicionar polling de `window.PagSeguro` como fallback (check a cada 100ms, max 10s)?

> RESPOSTA:

---

---

## 🗄️ BANCO DE DADOS

### Q051 — Índice faltante em `avaliacoes.produto_id`
A tabela `avaliacoes` tem UNIQUE em `(usuario_id, produto_id)`, mas não tem índice simples em `produto_id`. Queries "listar avaliações de um produto" fazem full scan na tabela.

**Pergunta:** Posso criar migration adicionando `INDEX idx_avaliacoes_produto_id (produto_id)`?

> RESPOSTA:

---

### Q052 — Índices faltantes em `produtos` para busca LIKE
Queries de busca usam `LIKE %termo%` em `nome`, `nome_externo`, `descricao`, `marca`. Sem índice FULLTEXT, cada busca é O(n) scan em 21k linhas.

**Pergunta:** Posso adicionar FULLTEXT INDEX em `(nome, nome_externo, descricao, marca)` e usar `MATCH ... AGAINST` no backend? Ou o volume atual não justifica?

> RESPOSTA:

---

### Q053 — `DROP DATABASE IF EXISTS railway` no schema base
Em `database.sql` linha 1: `DROP DATABASE IF EXISTS railway`. Se executado por engano contra banco de produção, **deleta tudo**.

**Pergunta:** Posso remover essa linha? O migration runner (`migrate.js`) não usa `database.sql` diretamente, correto?

> RESPOSTA:

---

### Q054 — Sem índice composto em `pedido_itens (pedido_id, produto_id)`
A tabela `pedido_itens` tem FK para `pedido_id`, mas não tem índice composto. Queries de join frequentes se beneficiariam.

**Pergunta:** Posso criar migration com `INDEX idx_pedido_itens_pedido_produto (pedido_id, produto_id)`?

> RESPOSTA:

---

### Q055 — `preco DECIMAL(10,2)` — arredondamento em centavos
`DECIMAL(10,2)` armazena até 2 casas decimais. Se um preço original tem 3+ casas (ex: divisão de frete), o banco arredonda silenciosamente. Isso pode causar discrepância de centavos.

**Pergunta:** Isso já causou problemas? Devo mudar para `DECIMAL(10,4)` com arredondamento explícito na aplicação?

> RESPOSTA:

---

### Q056 — Tabelas `banners` e `admin_audit_log` podem não existir
O código referencia estas tabelas, mas elas são criadas em migrations específicas. Se o migration runner não foi executado completamente, queries falham silenciosamente.

**Pergunta:** O código faz check defensivo (`CREATE TABLE IF NOT EXISTS`) antes de usar? Ou depende de migration completa?

> RESPOSTA:

---

### Q057 — Migrations com UPDATE usando WHERE LIKE sem índice
Migration 001 faz `UPDATE produtos SET ... WHERE nome LIKE '%Banana%' LIMIT 1` — full table scan em 21k produtos sem índice em `nome`.

**Pergunta:** Isso roda uma vez só, então performance é aceitável? Ou devo otimizar migrations futuras?

> RESPOSTA:

---

---

## 📦 DEPENDÊNCIAS E INFRAESTRUTURA

### Q058 — `node-fetch` no backend quando Node 18+ tem fetch nativo
`package.json` inclui `node-fetch@2.7`. Node 18+ tem `globalThis.fetch`. A dependência é redundante.

**Pergunta:** Posso auditar uso de `node-fetch` e migrar para fetch nativo? Algum service depende de features específicas do node-fetch (como `AbortController' handling)?

> RESPOSTA:

---

### Q059 — SheetJS (xlsx) — licença para uso comercial
`xlsx@0.18` está no frontend e backend. A licença SheetJS CE é Apache 2.0 mas com limitações no uso de certos features. Para e-commerce de produção, confirmar que todas as features usadas estão na versão open source.

**Pergunta:** As funcionalidades usadas (leitura CSV/XLSX, geração XLSX) estão cobertas pela licença CE? Ou preciso avaliar alternativas?

> RESPOSTA:

---

### Q060 — Render free plan com cold start
Se o backend está no plano free do Render, há cold start de ~30s quando inativo. Para mercado de bairro, isso significa que o primeiro cliente do dia espera 30s.

**Pergunta:** Qual o plano Render atual? Se free, há cron/health-check para manter warm?

> RESPOSTA:

---

### Q061 — CI/CD — migration check superficial
Em `.github/workflows/ci.yml`: o job de migration faz apenas regex check simples. Não valida SQL real nem roda `migrate --dry-run` contra DB de teste.

**Pergunta:** Posso adicionar um job que roda `npm run migrate -- --dry-run` em CI com MySQL de teste (Docker service)?

> RESPOSTA:

---

### Q062 — Sem lockfile no backend
Se `package-lock.json` não está commitado no backend, `npm install` pode instalar versões diferentes em cada deploy.

**Pergunta:** O `package-lock.json` está no `.gitignore`? Posso garantir que está commitado?

> RESPOSTA:

---

### Q063 — Evolution API URL hardcoded como localhost
Em `config.js`: `EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080'`. Em produção no Render, não há Evolution API rodando em localhost.

**Pergunta:** A Evolution API está ativa em produção? Se não, as rotas de WhatsApp (auto-reply, notificações) falham silenciosamente?

> RESPOSTA:

---

---

## 🎨 FRONTEND — UX E ACESSIBILIDADE

### Q064 — Drawer de detalhe de produto sem focus trap
Quando o drawer de detalhe abre, o foco (tab) pode sair do drawer e ir para elementos por trás. Isso viola WCAG 2.1 (focus management em modais).

**Pergunta:** Posso adicionar focus trap (`aria-modal="true"` + interceptar Tab/Shift+Tab)?

> RESPOSTA:

---

### Q065 — Sem skeleton loading em carregamento inicial de produtos
Quando a página de produtos carrega pela primeira vez, os produtos aparecem de uma vez. Não há skeleton placeholders durante o carregamento.

**Pergunta:** Posso adicionar skeleton cards enquanto `produtos.length === 0 && carregando`?

> RESPOSTA:

---

### Q066 — Sem preflight de estoque antes do checkout
O carrinho pode conter produtos que ficaram sem estoque entre a adição e o checkout. O usuário só descobre ao tentar finalizar o pedido (erro 400 do backend).

**Pergunta:** Posso adicionar verificação de estoque ao entrar no checkout (antes de mostrar a página de pagamento)?

> RESPOSTA:

---

### Q067 — SmartImage sem responsive srcset
`SmartImage.jsx` aceita `src` e `fallbackSrc` mas não gera `srcset` automaticamente. As imagens são carregadas em tamanho fixo independente da viewportwidth.

**Pergunta:** `produtosUtils.js` já tem `getProdutoImagemResponsiva` que gera `srcset`. SmartImage usa isso? Ou está hardcoded?

> RESPOSTA:

---

### Q068 — Canonical URL perde query params
Em `useDocumentHead.js`: `canonical.href = window.location.origin + pathname` — perde query params como `?categoria=bebidas&recorrencia=favoritos`. Impacta SEO para páginas filtradas.

**Pergunta:** As URLs filtradas são relevantes para SEO? Se não, canonical sem params está correto. Se sim, posso incluir params selecionados.

> RESPOSTA:

---

### Q069 — Sem Service Worker / PWA
O app não tem service worker. Para mercado de bairro com conexão instável (interior), PWA com cache offline básico seria grande diferencial.

**Pergunta:** Há interesse em PWA? Mesmo um service worker básico (cache de assets estáticos + fallback offline) melhoraria a experiência em conexão ruim.

> RESPOSTA:

---

### Q070 — Sem meta tags de SEO dinâmicas
`useDocumentHead` define `<title>` e `<meta description>`, mas sem Open Graph completo (og:image, og:type). Compartilhamentos em WhatsApp/Facebook não mostram preview rico.

**Pergunta:** Posso adicionar OG tags dinâmicas (especialmente para links de produto compartilhados)?

> RESPOSTA:

---

### Q071 — Acessibilidade — contraste e labels incompletos
Revisão parcial identificou:
- `<input>` sem `<label>` em alguns formulários (usa `aria-label` mas `<label>` é preferido)
- Heading levels nem sempre semânticos (h2 → h4 sem h3)
- Sem indicador visual de foco em alguns botões customizados

**Pergunta:** Posso fazer uma passada de a11y (audit com Lighthouse) e corrigir os itens críticos?

> RESPOSTA:

---

---

## 💳 PAGBANK / PAGAMENTO

### Q072 — Dois endpoints de webhook PagBank
O sistema registra webhooks em `/api/webhooks/pagbank` (Express route) e pode haver referência a `/api/pagbank/webhook` (legacy). Se PagBank envia para URL errada, notificação se perde.

**Pergunta:** Qual URL está configurada no painel PagBank? Posso consolidar em um único endpoint e criar redirect no outro?

> RESPOSTA:

---

### Q073 — PIX mock em dev não simula confirmação via webhook
Quando `ALLOW_PIX_MOCK=true`, o QR code é gerado localmente, mas não há simulação de webhook de confirmação. O pedido fica "aguardando pagamento" para sempre.

**Pergunta:** Posso criar rota dev-only (`POST /api/dev/simular-webhook-pix/:pedidoId`) para simular confirmação?

> RESPOSTA:

---

### Q074 — 3DS fallback para mock sem guard explícito em prod
Se 3DS falha, o código pode cair em fallback mock. Em produção, o guard `ALLOW_DEBIT_3DS_MOCK` deveria ser `false`, mas não há `throw` se estiver `true` em prod.

**Pergunta:** Mesmo fix que Q005 — adicionar guard em produção?

> RESPOSTA:

---

### Q075 — Sem retry automático para webhook PagBank
Se o backend falha ao processar um webhook (DB offline, timeout), o PagBank envia retry. Mas se o retry chega após o cache de idempotência expirar (10min), será processado novamente.

**Pergunta:** O PagBank faz retry em que janela de tempo? O cache de 10min é suficiente?

> RESPOSTA:

---

### Q076 — Logs de homologação 3DS em produção
`eventosHomologacao3DS` e sua lógica de registro existem independente do ambiente. Em produção, acumula dados desnecessários em memória.

**Pergunta:** Posso condicionar ao modo dev (`IS_DEVELOPMENT`) ou a uma flag `PAGBANK_HOMOLOGACAO_LOGS`?

> RESPOSTA:

---

### Q077 — PagBank SDK versão não fixada
Em `lib/pagbank.js`: a URL do SDK é construída dinamicamente (`https://stc.pagseguro.uol.com.br/...`). Se PagBank atualiza o SDK com breaking change, o checkout pode quebrar.

**Pergunta:** Posso fixar a versão do SDK ou adicionar fallback para versão conhecida?

> RESPOSTA:

---

---

## 🧹 LIMPEZA E ORGANIZAÇÃO

### Q078 — Diretório `legacy/` com frontend HTML/JS antigo
Existe frontend completo em HTML puro (`legacy/`) com admin, checkout, cart, auth. O projeto migrou para React.

**Pergunta:** Posso remover `legacy/` do repositório? Ou mover para branch separado? Algum código nele ainda é referenciado?

> RESPOSTA:

---

### Q079 — `bot-whatsapp/` sem código funcional
O diretório `bot-whatsapp/` tem apenas `package.json` (Express 5 beta + axios). Nenhum arquivo de código. `node_modules/` pode estar commitado.

**Pergunta:** Remover do repositório? É projeto futuro ou abandonado?

> RESPOSTA:

---

### Q080 — `node_modules/` commitado no bot-whatsapp
Se `bot-whatsapp/node_modules/` está no git, isso adiciona centenas de MB ao repositório.

**Pergunta:** Posso adicionar ao `.gitignore` e remover do tracking?

> RESPOSTA:

---

### Q081 — Arquivos SQL avulsos no backend root
`Consulta #2.sql`, `database.sql`, `update_produtos_existentes.sql`, `va.sql` estão no root do backend. Sem documentação de propósito.

**Pergunta:** Posso mover para `migrations/` ou `docs/sql/` para organização? Ou são scripts descartáveis que podem ser removidos?

> RESPOSTA:

---

### Q082 — Pastas de log vazias commitadas
`backend/logs/` contém múltiplas subpastas vazias trackadas pelo git (enrichment-barcode-*, enrichment-drain, etc.).

**Pergunta:** Posso adicionar `backend/logs/` ao `.gitignore` e manter apenas com `.gitkeep`?

> RESPOSTA:

---

### Q083 — Scripts PowerShell e .bat duplicados
`scripts/` tem `setup-git.bat` + `setup-git.ps1`, `start-servicos.bat` + `start-servicos.ps1`. Duplicação desnecessária.

**Pergunta:** Posso manter apenas os `.ps1` (ambiente Windows) e remover os `.bat`?

> RESPOSTA:

---

### Q084 — Múltiplos READMEs e docs redundantes
Existem: `README.md`, `backend/README.md`, `DEPLOY_VERCEL_RENDER.md`, `docs/DEPLOY_VERCEL_RENDER.md` (duplicado), `RELEASE_ADMIN_GERENCIA_FINAL.md`, `docs/RELEASE_ADMIN_GERENCIA_FINAL.md` (duplicado), além de ~15 docs em `docs/`.

**Pergunta:** Posso consolidar documentação redundante? Mover tudo de doc-related do root para `docs/` e remover duplicatas?

> RESPOSTA:

---

### Q085 — `whatsapp-qrcode.html` no backend
Arquivo HTML de debug para QR code WhatsApp está no root do backend.

**Pergunta:** Pode ser removido? Ou é ferramenta operacional utilizada?

> RESPOSTA:

---

### Q086 — `docker-compose-evolution.yml` no backend
Arquivo Docker Compose para Evolution API. Se Evolution não está em uso em produção, é arquivo morto.

**Pergunta:** Evolution API está ativa? Se não, posso mover para `docs/` como referência?

> RESPOSTA:

---

### Q087 — Diretório `img/ads/` no root
Diretório para imagens de banner/propaganda.

**Pergunta:** Está em uso pelo frontend? As imagens são servidas de onde (Vercel, CDN, backend)?

> RESPOSTA:

---

---

## 🔄 NEGÓCIO E FUNCIONALIDADE

### Q088 — Sem soft delete para pedidos
Pedidos cancelados mantêm status 'cancelado' mas não há flag `deleted_at` ou soft delete. Se admin quiser "limpar" pedidos antigos, não há mecanismo.

**Pergunta:** Soft delete é necessário? Ou o status 'cancelado' + 'entregue' é suficiente para filtro operacional?

> RESPOSTA:

---

### Q089 — Sem internacionalização (i18n)
Todos os textos estão hardcoded em português. Se houver expansão para região com outro idioma, é retrabalho total.

**Pergunta:** Há plano de expansão geográfica? Se não, i18n é overhead desnecessário para mercado de bairro.

> RESPOSTA:

---

### Q090 — Dados do mercado hardcoded (CNPJ, endereço, WhatsApp)
Em `config/store.js` (frontend) e possivelmente no backend: CNPJ, endereço, CEP, telefone WhatsApp estão hardcoded no código.

**Pergunta:** Posso mover para variáveis de ambiente ou config centralizzada? Ou é aceitável por ser single-tenant (um único mercado)?

> RESPOSTA:

---

### Q091 — Frete calculado por Haversine (linha reta) vs distância real
O cálculo de frete usa distância em linha reta (Haversine). Em áreas urbanas com ruas sinuosas, a distância real pode ser 1.5-2x maior.

**Pergunta:** Isso é aceitável? O fator de correção atual (se houver) compensa a diferença? Devo integrar com API de roteamento (OSRM, Google Directions)?

> RESPOSTA:

---

### Q092 — Sem limite de distância máxima para entrega
O cálculo de frete retorna valor para qualquer distância. Não há guard para rejeitar entregas impossíveis (ex: cliente a 100km do mercado).

**Pergunta:** Qual a distância máxima de entrega? Posso adicionar threshold (ex: 15km) que bloqueia pedido com mensagem "Fora da área de entrega"?

> RESPOSTA:

---

### Q093 — Taxa de serviço como percentual fixo
`TAXA_SERVICO_PERCENTUAL = 3%` é fixo. Não varia por faixa de preço, pagamento (PIX vs cartão), ou horário.

**Pergunta:** A taxa deve variar? Ex: 0% para PIX, 3% para cartão? Ou 3% fixo é a regra de negócio?

> RESPOSTA:

---

### Q094 — Cupons sem restrição por categoria ou valor mínimo
O sistema de cupons parece básico (desconto fixo ou percentual). Não suporta: valor mínimo de pedido, categoria específica, primeira compra, data de expiração.

**Pergunta:** Quais tipos de cupons são necessários? Posso revisar o schema e ampliar funcionalidades?

> RESPOSTA:

---

### Q095 — Sem notificação de status de pedido para o cliente
Quando o operador muda status do pedido (preparando → saiu para entrega → entregue), o cliente não recebe notificação (push, email, WhatsApp).

**Pergunta:** Há plano para notificações? O webhook WhatsApp (Evolution API) seria usado para isso?

> RESPOSTA:

---

---

## 🔍 MONITORAMENTO E OBSERVABILIDADE

### Q096 — Sentry integrado mas sem coverage completa
`lib/sentry.js` está configurado condicionalmente. Mas nem todos os handlers de erro chamam `captureException`.

**Pergunta:** Posso auditar e garantir que todos os `catch` em routes e services chamam Sentry? Ou o error handler global do Express já cobre?

> RESPOSTA:

---

### Q097 — Sem correlation IDs nos logs
Cada request não tem ID único para rastrear logs distribuídos. Se dois clientes fazem pedido simultâneo, os logs se misturam.

**Pergunta:** Posso adicionar middleware que gera `X-Request-ID` (UUID) e injeta no logger context?

> RESPOSTA:

---

### Q098 — PostHog/Analytics não configurado
O frontend tem código para PostHog (`commerceTracking.js`) mas a chave não está configurada. Analytics de comportamento do usuário estão inativas.

**Pergunta:** Há plano de ativar PostHog? Posso preparar a integração (evento de página, add-to-cart, checkout)?

> RESPOSTA:

---

### Q099 — Web Vitals sem destino
`trackWebVitals()` é chamado no `main.jsx`, mas os dados de Core Web Vitals podem estar indo para `console.log` apenas, sem envio para serviço de coleta.

**Pergunta:** Posso verificar para onde os Web Vitals são enviados? Se não vão para analytics, é código morto.

> RESPOSTA:

---

### Q100 — Console.log com emojis em produção
Muitos logs usam emojis (`⚠️`, `✅`, `🔄`, etc.) que funcionam no terminal local mas podem causar problemas em serviços de log que não suportam UTF-8 multibyte.

**Pergunta:** Os logs em produção (Render) suportam emojis? Devo substituir por prefixos textuais (`[WARN]`, `[OK]`, `[SYNC]`)?

> RESPOSTA:

---

---

## 🧪 TESTES

### Q101 — Cobertura de testes limitada
Os testes existentes cobrem: `config`, `helpers`, `logger`, `cache`, `sentry`, `pedido-pagamento` (smoke). **Faltam:**
- Testes de integração para endpoints (auth, pedidos, webhook)
- Testes do checkout flow (PIX + cartão)
- Testes de componentes React
- Testes de regressão para cálculo de frete e cupons

**Pergunta:** Qual a prioridade de testes? Sugiro ordem:
1. Endpoints de pagamento (critical path)
2. Cálculo de frete e cupons (business logic)
3. Auth flow (segurança)
4. Componentes React (PagamentoPage, CartContext)

> RESPOSTA:

---

### Q102 — Sem TypeScript — type safety ausente
Todo o código é JavaScript puro. Não há type checking, o que permite bugs como `undefined.length` ou tipos errados em props.

**Pergunta:** Migração para TypeScript está fora de escopo (conforme copilot-instructions.md). Mas posso adicionar JSDoc types em funções críticas para melhorar IDE support sem mudar a stack?

> RESPOSTA:

---

---

## 📊 MEMORY LEAKS E RUNTIME

### Q103 — Preload image registry (global Set) cresce indefinidamente
Em `usePreloadImage.js`: `preloadRegistry` (Map) nunca é limpo. Após milhares de imagens, acumula memória.

**Pergunta:** Posso adicionar max size e eviction? Qual número razoável (200? 500?)?

> RESPOSTA:

---

### Q104 — RecorrenciaContext `estado.produtos` nunca é limpo
O dicionário de produtos interagidos cresce indefinidamente. Limite de `LIMITE_INTERACOES` aplica-se a interações, mas o Map de produtos pode acumular dados antigos.

**Pergunta:** Posso adicionar TTL ou max size para `estado.produtos`?

> RESPOSTA:

---

### Q105 — `crossSellAposAdicao` cria array slice em cada render
Em `ProdutosPage.jsx`: `produtosIndexados.slice(0, 200)` dentro de `useMemo` cria nova alocação a cada execução do memo.

**Pergunta:** Posso mover `slice` para fora do memo ou cachear em `useRef`?

> RESPOSTA:

---

### Q106 — Hooks de resize sem debounce
`useElementWidth` e `useViewportHeight` usam `ResizeObserver` mas disparam re-render a cada pixel de resize.

**Pergunta:** Posso adicionar debounce (150ms) nesses hooks?

> RESPOSTA:

---

---

## 🔧 DEVELOPER EXPERIENCE

### Q107 — Sem .env.example documentado no root
Backend tem `.env.example`, mas não há documentação no root do projeto sobre todas as variáveis necessárias para setup local.

**Pergunta:** Posso criar `.env.example` no root que referencia backend e frontend?

> RESPOSTA:

---

### Q108 — Funções duplicadas entre backend e frontend
Funções como `escapeLike`, `normalizeText`, `toNumber`, `formatarPreco` existem em ambos os lados. Qualquer correção precisa ser aplicada em 2 lugares.

**Pergunta:** Alguma estratégia de compartilhamento é desejada (shared/utils package)? Ou manter duplicado é aceitável?

> RESPOSTA:

---

### Q109 — `Consulta #2.sql` e `va.sql` — arquivos de debug no repositório
Esses arquivos parecem consultas SQL ad-hoc usadas durante desenvolvimento. Estão poluindo o root do backend.

**Pergunta:** Posso remover ou mover para `docs/sql-queries/`?

> RESPOSTA:

---

### Q110 — `process.exit(1)` em unhandled rejection/uncaught exception
Em `server.js`: erros não capturados causam `process.exit(1)`. Isso é correto para Node.js em container (Render reinicia), mas causa perda de requests em andamento.

**Pergunta:** É o comportamento esperado? Posso adicionar graceful shutdown (fechar pool MySQL, esperar requests em andamento, depois exit)?

> RESPOSTA:

---

---

## RESUMO DE PRIORIDADES SUGERIDAS

| Prioridade | Questões | Tema |
|------------|----------|------|
| 🔴 Crítica (segurança) | Q001-Q007, Q021 | JWT, race conditions, rate limiting |
| 🔴 Crítica (bug) | Q042, Q043, Q045 | Estoque, carrinho, total negativo |
| 🟠 Alta (segurança) | Q008-Q015, Q016-Q022 | Admin, importação, CSP, enumeração |
| 🟠 Alta (arquitetura) | Q023-Q024, Q030-Q031 | God components, error boundaries |
| 🟡 Média (performance) | Q032-Q041 | Indexação, cache, queries |
| 🟡 Média (DB) | Q051-Q057 | Índices, schema, migrations |
| 🟢 Baixa (limpeza) | Q078-Q087 | Legacy, dead code, organização |
| 🟢 Baixa (UX) | Q064-Q071 | A11y, skeleton, SEO |
| 🔵 Info/Planejamento | Q088-Q100 | Negócio, monitoramento, futuro |
| 🔵 DX | Q101-Q110 | Testes, types, dev workflow |

---

> **Próximo passo:** Responda cada questão com `> RESPOSTA:` e me passe o arquivo novamente. Implementarei as melhorias com base nas suas respostas, começando pelas 🔴 Críticas.
