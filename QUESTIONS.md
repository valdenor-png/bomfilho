# QUESTIONS.md — Revisão Técnica Completa do Projeto BomFilho

> **Autor da revisão:** Tech Lead / Code Reviewer  
> **Data:** 19/03/2026  
> **Escopo:** Arquitetura, segurança, performance, refatoração, bugs e melhorias  
>  
> Cada item é uma pergunta ou ponto de atenção independente.  
> Responda diretamente abaixo de cada pergunta com `> RESPOSTA:` para que eu possa então aplicar as melhorias.

---

## 🏗️ ARQUITETURA GERAL

### Q001 — server.js monolítico com 7.287 linhas
O arquivo `backend/server.js` concentra **toda** a lógica do backend: rotas, middlewares, helpers, geocodificação, cálculo de frete, autenticação, pagamentos, WhatsApp, admin, webhooks, etc.  
Isso dificulta manutenção, testes, code review e onboarding.

**Pergunta:** Posso refatorar o server.js em módulos separados (ex: `routes/auth.js`, `routes/pedidos.js`, `routes/admin.js`, `routes/pagbank.js`, `middleware/auth.js`, `middleware/csrf.js`, `utils/frete.js`, `utils/geocoding.js`, etc.)? Qual o nível de decomposição aceitável — mínimo (5-8 arquivos) ou granular (15-20 arquivos)?

> RESPOSTA:

---

### Q002 — Ausência de testes automatizados
Não existe nenhum framework de testes (Jest, Vitest, Mocha) configurado nem no backend nem no frontend. Nenhum arquivo de teste encontrado.

**Pergunta:** Devo configurar testes? Se sim, qual prioridade? Sugiro:
1. Testes unitários para helpers/services críticos (cálculo frete, validação barcode, helpers de pagamento)
2. Testes de integração para endpoints (auth, pedidos, webhook PagBank)
3. Testes de componentes React (PagamentoPage, CartContext)

> RESPOSTA:

---

### Q003 — Sem migration runner automatizado
As migrações SQL são arquivos soltos executados manualmente (`migrate_*.sql`). Não há ferramenta de migration (Knex, Sequelize, Flyway) nem controle de versão de schema aplicado.

**Pergunta:** Isso é intencional? Devo implementar um sistema de migrations com controle de versão (tabela `schema_migrations`) para garantir idempotência e rastreabilidade?

> RESPOSTA:

---

### Q004 — bot-whatsapp é um diretório vazio (sem código)
O diretório `bot-whatsapp/` contém apenas `package.json` com dependências (express 5, axios, dotenv) mas nenhum arquivo de código (`index.js` referenciado como main não existe). Tem `node_modules/` commitado.

**Pergunta:** Este diretório é um projeto abandonado/futuro? Devo removê-lo do repositório? E o `node_modules/` deveria ser removido do git (está sendo rastreado)?

> RESPOSTA:

---

### Q005 — Diretório `legacy/` com frontend HTML/JS antigo
Existe um frontend completo em HTML puro + JS vanilla (`legacy/`) com admin, checkout, cart, auth, etc. O projeto já migrou para React.

**Pergunta:** O diretório `legacy/` ainda serve algum propósito? Posso removê-lo ou mover para um branch separado? Se mantido, esses arquivos podem ser servidos acidentalmente?

> RESPOSTA:

---

### Q006 — Duplicação de lógica entre `lib/api.js` e `services/api.js` (frontend)
O frontend tem dois módulos de API:
- `src/services/api.js` — wrapper genérico de fetch com retry, timeout, log
- `src/lib/api.js` — funções específicas (login, criarPedido, gerarPix, etc.)

Ambos têm `mapMensagemHttp`/`mapHttpStatusMessage` duplicados e lógica de tratamento de erro redundante.

**Pergunta:** Posso consolidar o mapeamento de mensagens de erro em um só lugar e eliminar a duplicação?

> RESPOSTA:

---

### Q007 — Ausência de Error Boundaries no React
Não há `ErrorBoundary` em nenhum nível da aplicação. Se qualquer componente lançar um erro durante render, toda a app crasha com tela branca.

**Pergunta:** Devo implementar Error Boundaries ao menos no nível de rotas?

> RESPOSTA:

---

### Q008 — Sem variáveis de ambiente de exemplo (.env.example) no root
O backend tem referências a dezenas de variáveis de ambiente, mas não existe um `.env.example` **documentado** no root (o que está na pasta backend não foi verificado se está completo).

**Pergunta:** Devo criar/atualizar o `.env.example` com todas as variáveis necessárias, defaults e descrições?

> RESPOSTA:

---

## 🔒 SEGURANÇA

### Q009 — Admin login com senha em texto plano via env var
O admin login (`POST /api/admin/login`) compara a senha contra `ADMIN_PASSWORD` definida como variável de ambiente em plain text. Não há hash para a senha admin.

**Pergunta:** Isso é aceitável? Devo migrar para um hash bcrypt armazenado (ou uma tabela `admin_users` no BD)?

> RESPOSTA:

---

### Q010 — ADMIN_LOCAL_ONLY pode ser desligado por env var
A flag `ADMIN_LOCAL_ONLY` protege endpoints admin por IP local. Porém, se alguém definir `ADMIN_LOCAL_ONLY=false` no ambiente de produção, o painel admin fica exposto remotamente.

**Pergunta:** Isso é intencional para o deploy em Render (onde acesso "local" não existe)? Se sim, qual é a proteção alternativa? Apenas JWT + cookie?

> RESPOSTA:

---

### Q011 — Validação de webhook Evolution API com comparação não-constante
A função `validarWebhookEvolution` usa comparação direta (`===`) ao invés de `crypto.timingSafeEqual`, ficando potencialmente vulnerável a timing attacks.

**Pergunta:** Devo migrar para `compararTextoSegura` (que já existe no código e usa `timingSafeEqual`)?

> RESPOSTA:

---

### Q012 — JWT Secret sem rotação
O `JWT_SECRET` é estático. Não há mecanismo de rotação de chaves. Se comprometido, todos os tokens ficam vulneráveis até trocar manualmente o secret e reiniciar o servidor (o que invalida todas as sessões).

**Pergunta:** Devo implementar um sistema de rotação de JWT keys (ex: suporte a múltiplas chaves simultâneas com `kid` no JWT header)?

> RESPOSTA:

---

### Q013 — Token JWT retornado no body do response (accessToken)
Nas rotas de login e cadastro, o JWT é retornado no body do response (`accessToken`) além de ser setado como cookie HttpOnly. Se `VITE_ENABLE_TOKEN_STORAGE=true`, o token vai para localStorage, expondo-o a XSS.

**Pergunta:** Devo remover o `accessToken` do body e confiar exclusivamente nos cookies HttpOnly? Ou o token no body é necessário para algum cenário específico (mobile app, extensão)?

> RESPOSTA:

---

### Q014 — Frete público sem autenticação
O endpoint `GET /api/frete/simular` é público (sem `autenticarToken`). Alguém pode enumerar CEPs e mapear a área de entrega/preços da loja.

**Pergunta:** Isso é aceitável? Ou deveria exigir ao menos rate limiting mais agressivo ou autenticação?

> RESPOSTA:

---

### Q015 — Avaliações sem proteção anti-abuso
O endpoint `POST /api/avaliacoes` não tem reCAPTCHA, rate limiting específico, nem verificação se o usuário comprou o produto. Um usuário autenticado pode avaliar qualquer produto com nota arbitrária.

**Pergunta:** Devo adicionar validação de compra (só pode avaliar produtos que comprou) e/ou rate limiting específico?

> RESPOSTA:

---

### Q016 — Helmet com `contentSecurityPolicy: false`
O helmet está configurado com CSP desabilitado. Isso remove uma camada importante de proteção contra XSS.

**Pergunta:** Posso definir um CSP adequado? O motivo de estar desabilitado é por PagBank SDK ou recursos inline?

> RESPOSTA:

---

### Q017 — COOKIE_SAME_SITE=none no render.yaml
No deploy Render, `COOKIE_SAME_SITE` está como `none`. Isso é necessário para cross-origin (frontend Vercel ↔ backend Render), mas abre possibilidade de CSRF em navegadores que não suportam SameSite corretamente.

**Pergunta:** A proteção CSRF via header `x-csrf-token` + cookie é suficiente para compensar o `SameSite=None`? Ou deveria reconsiderar a arquitetura de deploy (same-origin)?

> RESPOSTA:

---

### Q018 — `SELECT *` em queries sensíveis
Algumas queries usam `SELECT *` (ex: login retorna `SELECT * FROM usuarios`, pedidos `SELECT * FROM pedidos`). Isso pode expor campos sensíveis como `senha` no response.

**Pergunta:** Devo substituir todos os `SELECT *` por campos explícitos para evitar vazamento acidental de dados?

> RESPOSTA:

---

### Q019 — Credenciais MySQL logadas no console
Na linha de inicialização, o hostname, port, user e database são impressos no console. Essa informação pode vazar em logs de produção.

**Pergunta:** Devo remover ou mascarar essas informações em produção?

> RESPOSTA:

---

### Q020 — Sem proteção de enumeração de e-mail
O endpoint de cadastro retorna `409 - Já existe uma conta com este e-mail` quando o e-mail já está registrado. Isso permite que um atacante enumere e-mails válidos.

**Pergunta:** Devo uniformizar a resposta para não revelar se o e-mail já existe?

> RESPOSTA:

---

## ⚡ PERFORMANCE

### Q021 — Cache em memória sem limite de tamanho (Map)
Os caches (`cepGeoCache`, `produtosQueryCache`, `readQueryCache`, `evolutionProcessedMessageIds`, `evolutionLastReplyByNumber`) são `Map` simples sem limite de entradas. Em cenários de alto tráfego, a memória pode crescer indefinidamente.

**Pergunta:** Devo implementar um LRU cache com tamanho máximo? Ou o tráfego atual é baixo o suficiente para não ser problema?

> RESPOSTA:

---

### Q022 — Geocodificação Nominatim com múltiplas chamadas sequenciais
A função `buscarCoordenadasNominatim` pode fazer até 5 chamadas HTTP sequenciais ao Nominatim (uma por consulta). Com a política de uso do Nominatim (1 req/s), uma simulação de frete pode levar >5s.

**Pergunta:** Isso é um gargalo real? Devo considerar: (a) paralelizar com Promise.all, (b) usar um serviço pago de geocoding, ou (c) o cache de 24h é suficiente?

> RESPOSTA:

---

### Q023 — Produtos listados sem paginação forçada
Se nenhum parâmetro de paginação é passado em `GET /api/produtos`, **todos** os produtos ativos são retornados. Com 120K+ produtos, isso pode gerar responses de vários MB.

**Pergunta:** Devo forçar paginação com default (ex: 60 itens) e remover o modo "sem paginação"? Ou o frontend precisa de todos os produtos de uma vez para alguma funcionalidade?

> RESPOSTA:

---

### Q024 — ProdutosPage com 3.087 linhas (God Component)
O componente `ProdutosPage.jsx` tem ~3000 linhas com 20+ `useState`, 15+ `useMemo` encadeados, lógica de scoring comportamental, filtros, sorting, tracking de comércio e growth experiments misturados.

**Pergunta:** Posso decompor em sub-componentes e custom hooks? Sugestão:
- `useProductFiltering()` — filtros e busca
- `useProductSorting()` — ordenação
- `useBehavioralScoring()` — scoring de recorrência
- `ProductGrid`, `ProductFilters`, `QuickFilterBar` — componentes visuais

> RESPOSTA:

---

### Q025 — PagamentoPage com 3.992 linhas (God Component)
O checkout inteiro (5 etapas, 3 métodos de pagamento, CEP lookup, cálculo de frete, state machine 3DS) está em um único componente.

**Pergunta:** Posso decompor em componentes por etapa?
- `StageCarrinho`, `StageEntrega`, `StagePagamento`, `StagePix`, `StageStatus`
- Hooks: `use3DSFlow`, `useFreteCalculation`, `useAddressLookup`

> RESPOSTA:

---

### Q026 — AdminGerenciaPage com 2.155 linhas
Todo o admin (dashboard, catálogo, importação, enriquecimento, logs) vive em um componente.

**Pergunta:** Cada tab/seção deveria ser um componente independente? Os componentes em `components/admin/` já existem para algumas seções — estão todos sendo usados?

> RESPOSTA:

---

### Q027 — ContaPage com 1.408 linhas
Perfil, endereço, preferências de acessibilidade, configurações — tudo num arquivo.

**Pergunta:** Posso dividir em seções (`ProfileSection`, `AddressSection`, `PreferencesSection`)?

> RESPOSTA:

---

### Q028 — Sem compressão de assets (gzip/brotli) no build Vite
O `vite.config.js` não configura `vite-plugin-compression` para gerar `.gz` ou `.br`. Na Vercel isso pode ser feito automaticamente, mas vale confirmar.

**Pergunta:** A compressão está sendo feita pelo CDN/Vercel? Ou devo adicionar no build?

> RESPOSTA:

---

### Q029 — Pool MySQL com connectionLimit=10
O pool está com limite fixo de 10 conexões. No plano free do Render, o tráfego pode ser baixo, mas se escalar...

**Pergunta:** O `connectionLimit=10` é adequado? O provedor MySQL (Railway?) tem um limite específico de conexões?

> RESPOSTA:

---

### Q030 — Pedido cria itens em loop com queries individuais
Na criação de pedido, os itens são inseridos um a um (`INSERT INTO pedido_itens ... ` dentro de um `for`). Para pedidos com muitos itens, isso gera N queries dentro da transação.

**Pergunta:** Devo converter para um `INSERT ... VALUES (...), (...), (...)` batch único? Ou o número de itens por pedido é geralmente baixo?

> RESPOSTA:

---

### Q031 — Preload de dados no startup sem controle de tamanho
A função `preloadData()` carrega todos os produtos em memória no startup do servidor para popular o cache.

**Pergunta:** Com 120K+ produtos, isso consome quanta memória? Deveria haver um limite ou o preload deveria ser removido?

> RESPOSTA:

---

## 🐛 BUGS E PROBLEMAS POTENCIAIS

### Q032 — PIX update após connection.release()
Na criação de pedido, o `connection.commit()` e `connection.release()` são chamados no bloco try. Depois, o código tenta `connection.query('UPDATE pedidos SET pix_id = ... ')` para salvar dados do PIX, mas a conexão da transação já foi liberada. Isso pode causar erro silencioso.

**Pergunta:** Isso é um bug real? O `connection.query` após `connection.release()` deveria usar `pool.query` em vez disso?

> RESPOSTA:

---

### Q033 — Race condition em CEP lookup no PagamentoPage
O `useEffect` que busca dados de CEP não cancela requests anteriores. Se o usuário digita rápidamente, múltiplas requisições simultâneas podem causar resultados inconsistentes (a última request retornada pode não ser do último CEP digitado).

**Pergunta:** Devo implementar cancelamento via `AbortController` ou usar o `consultaCepIdRef` existente? Parece que `consultaCepIdRef` já tenta resolver isso — está funcionando corretamente?

> RESPOSTA:

---

### Q034 — `unhandledRejection` e `uncaughtException` fazem `process.exit(1)`
Os handlers de erro global fazem `process.exit(1)`, o que mata o servidor imediatamente. Em produção, isso pode causar requests em andamento serem perdidos.

**Pergunta:** Devo implementar graceful shutdown (parar de aceitar novas conexões, aguardar requests em andamento, drenar pool MySQL) antes de sair?

> RESPOSTA:

---

### Q035 — Sem validação de `produto_id` como inteiro na criação de pedido
Os `itensNormalizados` passam por `normalizarItensPedidoInput` e `itensPedidoSaoValidos`, mas o `produto_id` é usado diretamente na query SQL com placeholder (`IN (${placeholdersProdutos})`).

**Pergunta:** Os placeholders são seguros contra SQL injection? Sim, pois usam parameterized queries. Mas os IDs são validados como inteiros positivos antes de usar?

> RESPOSTA:

---

### Q036 — desconto pode resultar em total negativo
Se um cupom de `valor_fixo` tem valor maior que o total do pedido, `descontoAplicado` é limitado a `total`. Porém, o `totalProdutos` pode ser zero, e `totalFinal = totalProdutos + freteEntrega` pode resultar em um pedido de "apenas frete".

**Pergunta:** Um pedido com total de produtos = R$ 0,00 + frete é válido? Deveria haver um valor mínimo de pedido?

> RESPOSTA:

---

### Q037 — Sessão 3DS expira sem aviso ao usuário
A sessão 3DS PagBank dura 29 minutos (`SESSAO_3DS_TTL_MS`). Se o usuário demorar mais de 29 min no checkout, o pagamento com débito/crédito falhará sem mensagem explicativa.

**Pergunta:** Devo adicionar um timer visível ou uma renovação automática de sessão 3DS?

> RESPOSTA:

---

### Q038 — Estoque não é restaurado quando pedido é cancelado
Na rota `PUT /api/admin/pedidos/:id/status`, quando o status muda para "cancelado", não vejo lógica para reverter a reserva de estoque feita na criação do pedido.

**Pergunta:** Isso é intencional (estoque manual) ou é um bug? Devo implementar restauração automática de estoque ao cancelar?

> RESPOSTA:

---

### Q039 — Carrinho vazio pode chegar ao checkout
O `PagamentoPage` não valida se o carrinho está vazio ao montar. O usuário pode acessar `/pagamento` diretamente com carrinho vazio e ver uma tela inconsistente.

**Pergunta:** Devo adicionar um redirect automático para `/produtos` se o carrinho estiver vazio?

> RESPOSTA:

---

### Q040 — Inconsistência de coluna `pix_qrcode` vs `pix_qr_base64`
O schema `database.sql` define `pix_qr_base64 LONGTEXT` e `pix_qrcode TEXT`, mas o código usa `pix_qrcode` para armazenar a URL do QR code. Parece haver confusão entre os campos `pix_qr_data`, `pix_qr_base64`, e `pix_qrcode`.

**Pergunta:** Qual campo é efetivamente usado? Devo limpar as colunas redundantes?

> RESPOSTA:

---

### Q041 — `obterColunasProdutos` cached indefinidamente
A função que detecta colunas da tabela `produtos` faz cache permanente (`produtosColumnsCache`). Se uma migration adicionar coluna nova, o servidor precisaria de restart.

**Pergunta:** Devo adicionar TTL a esse cache ou é aceitável precisar de restart após migration?

> RESPOSTA:

---

## 🗄️ BANCO DE DADOS

### Q042 — `DROP DATABASE IF EXISTS railway` no schema base
O arquivo `database.sql` começa com `DROP DATABASE IF EXISTS railway; CREATE DATABASE railway`. Isso é destrutivo — executar acidentalmente apaga tudo.

**Pergunta:** Devo remover o `DROP DATABASE` e usar `CREATE DATABASE IF NOT EXISTS`?

> RESPOSTA:

---

### Q043 — Tabela `avaliacoes` não existe no schema base
O endpoint `POST /api/avaliacoes` referencia a tabela `avaliacoes`, mas ela não está definida em `database.sql`. Está em alguma migration?

**Pergunta:** Devo adicionar a definição da tabela `avaliacoes` ao schema base ou confirmar em qual migration ela é criada?

> RESPOSTA:

---

### Q044 — Tabela `banners` não existe no schema base
O endpoint `GET /api/banners` tenta fazer um `SELECT FROM banners` com try/catch para `ER_NO_SUCH_TABLE`. A tabela não está no schema base.

**Pergunta:** A tabela `banners` deveria existir no schema? Está em alguma migration? Ou é feature futura?

> RESPOSTA:

---

### Q045 — Tabela `admin_audit_log` pode não existir
A função `registrarAuditoria` engole erros silenciosamente (`catch (_) { }`). Se a tabela não existir, toda auditoria é perdida sem aviso.

**Pergunta:** A tabela existe? Deveria ser criada no schema base? A perda silenciosa de auditoria é aceitável?

> RESPOSTA:

---

### Q046 — Campos de timestamp de etapas (`pago_em`, `pronto_em`, `saiu_entrega_em`)
Vários endpoints admin usam colunas como `pago_em`, `pronto_em`, `saiu_entrega_em` que não existem no schema base. Devem estar na migration `migrate_timestamps_etapas.sql`.

**Pergunta:** Essas migrations foram aplicadas? A documentação de quais migrations são obrigatórias está atualizada?

> RESPOSTA:

---

### Q047 — Sem soft delete para pedidos
Pedidos usam status "cancelado" mas não são soft-deleted. Pedidos cancelados ficam no banco permanentemente.

**Pergunta:** Isso é intencional para auditoria/histórico? Devo implementar archival de pedidos antigos?

> RESPOSTA:

---

### Q048 — Sem índice composto em `pedido_itens (pedido_id, produto_id)`
A tabela `pedido_itens` tem apenas índice em `pedido_id`. Queries que buscam por `produto_id` (ex: relatórios de vendas) farão full scan.

**Pergunta:** Devo adicionar índices em `produto_id` e/ou compostos?

> RESPOSTA:

---

### Q049 — `preco DECIMAL(10,2)` pode causar problemas de arredondamento
Para e-commerce, `DECIMAL(10,2)` é adequado, mas o código JavaScript faz cálculos com `Number` (float) antes de salvar, podendo introduzir erros de arredondamento de ponto flutuante.

**Pergunta:** Os cálculos monetários em JS (multiplicação, soma) deveriam usar uma library de precisão decimal? Ou o `toFixed(2)` é suficiente para o caso de uso?

> RESPOSTA:

---

## 💰 PAGAMENTOS (PagBank)

### Q050 — Dois endpoints de webhook PagBank
Existem dois endpoints para o mesmo webhook:
- `POST /api/webhooks/pagbank`
- `POST /api/pagbank/webhook`

Ambos chamam `processarWebhookPagBank()`.

**Pergunta:** Por que dois endpoints? É para compatibilidade com configurações diferentes? Posso remover um?

> RESPOSTA:

---

### Q051 — PIX mock em dev não simula webhook de confirmação
No modo dev com `ALLOW_PIX_MOCK=true`, o PIX mock gera um código falso mas não simula o webhook de confirmação. O pedido fica eternamente "pendente".

**Pergunta:** Devo adicionar um endpoint de simulação de webhook para dev/staging?

> RESPOSTA:

---

### Q052 — PagBank SDK versão não fixada
O `lib/pagbank.js` carrega o SDK PagBank via URL sem versão fixa. Se o PagBank atualizar o SDK com breaking changes, o checkout pode quebrar sem aviso.

**Pergunta:** Posso fixar a versão do SDK ou hospedar localmente? Ou o PagBank não oferece URLs versionadas?

> RESPOSTA:

---

### Q053 — 3DS fallback para mock sem enforcement em produção
A flag `ALLOW_DEBIT_3DS_MOCK` permite skippar autenticação 3DS. No render.yaml está como `false`, mas se alguém alterar para `true` em produção, pagamentos de débito sem 3DS seriam aceitos (o que é proibido por regulamentação).

**Pergunta:** Devo adicionar um hard check que impede mock 3DS em produção independente da env var?

> RESPOSTA:

---

### Q054 — Sem retry automático para webhook PagBank
Se o processamento do webhook falhar (ex: BD fora), o PagBank espera um HTTP 200. Retornar 500 faz o PagBank retentar, mas não há controle de idempotência — o mesmo webhook pode ser processado duas vezes.

**Pergunta:** Devo implementar idempotência no webhook (ex: tabela `webhook_events` com `order_id` + `charge_id` como chave única)?

> RESPOSTA:

---

### Q055 — Logs de homologação PagBank em produção
Os serviços de log de homologação (`pagbankHomologacaoLogService.js`) geram logs detalhados para fins de certificação.

**Pergunta:** Esses logs devem ser desabilitados em produção para não poluir stdout?

> RESPOSTA:

---

## 📦 FRONTEND REACT

### Q056 — Dados hardcoded (CNPJ, endereço, telefone, WhatsApp)
Em `App.jsx`, `HomePage.jsx`, `ContaPage.jsx` e `PagamentoPage.jsx`, informações da loja como CNPJ (09.175.211/0001-30), endereço, telefone, WhatsApp estão hardcoded no JSX.

**Pergunta:** Devo extrair para variáveis de ambiente (`VITE_STORE_*`) ou um arquivo de configuração centralizado?

> RESPOSTA:

---

### Q057 — RecorrenciaContext persiste em localStorage sem criptografia
Dados de favoritos, recentes e recompras são salvos em `localStorage` com versioning mas sem qualquer proteção. Qualquer script no domínio pode ler/modificar esses dados.

**Pergunta:** Isso é aceitável? Os dados de recorrência são sensíveis? Devo ao menos adicionar assinatura HMAC para detectar adulteração?

> RESPOSTA:

---

### Q058 — Sem preflight de estoque antes do checkout
O checkout não verifica estoque antes de chegar na etapa de pagamento. O usuário só descobre estoque insuficiente após tentar finalizar o pedido.

**Pergunta:** Devo adicionar verificação de estoque na etapa Carrinho ou no início da etapa Pagamento?

> RESPOSTA:

---

### Q059 — Sem internacionalização (i18n)
Todas as strings estão hardcoded em português no código. Não há framework de i18n.

**Pergunta:** Há planos de suporte multi-idioma? Ou o mercado é exclusivamente brasileiro e isso é desnecessário?

> RESPOSTA:

---

### Q060 — `react-window` como virtualização para grid de produtos
O componente `ProdutosPage` usa `react-window` para virtualização. A versão `2.2.7` é relativamente nova.

**Pergunta:** A virtualização está funcionando bem com o layout de grid responsivo? Existe algum problema de scroll ou rendering?

> RESPOSTA:

---

### Q061 — HomePage com 336 linhas — bem enxuta
A HomePage é consideravelmente menor que as outras pages. Parece ter seções de prateleira, favoritos e promoções.

**Pergunta:** A HomePage carrega produtos suficientes para ter uma boa experiência de primeiro acesso? Ou deveria ter mais seções (ex: banners, categorias em destaque)?

> RESPOSTA:

---

### Q062 — Sem Service Worker / PWA
Não há manifest.json nem service worker configurado. O app não funciona offline e não pode ser "instalado" como PWA.

**Pergunta:** Devo implementar PWA básico? Seria valioso para o público-alvo (supermercado delivery poderia se beneficiar de notificações push e cache offline do catálogo)?

> RESPOSTA:

---

### Q063 — AdminPage acessível apenas em localhost
Em `App.jsx`, a rota `/admin` renderiza `AdminPage` apenas se `isLocalHost`, senão redireciona para `/admin/gerencia`.

**Pergunta:** Qual é a diferença entre `AdminPage` e `AdminGerenciaPage`? `AdminPage` é a versão dev/debug?

> RESPOSTA:

---

### Q064 — SmartImage sem srcset/responsive images
O `SmartImage` component tem fallback, lazy-load e blur placeholder, mas não gera `srcset` para diferentes resoluções de tela.

**Pergunta:** As imagens de produtos vêm de um CDN que suporta transformações (resize, webp)? Devo implementar responsive images?

> RESPOSTA:

---

### Q065 — Importação planilha no frontend (`lib/importacaoPlanilha.js`)
O parsing de XLSX/CSV é feito no frontend (browser) usando a lib `xlsx`. Arquivos grandes podem travar o browser.

**Pergunta:** O parsing deveria ser movido inteiramente para o backend? Ou o frontend faz apenas preview e o backend faz o import real?

> RESPOSTA:

---

## 🚚 FRETE E GEOCODIFICAÇÃO

### Q066 — Haversine (linha reta) vs distância real de rota
O cálculo de distância usa Haversine (linha reta), que pode subestimar significativamente a distância real de rota (ruas, trânsito, rios).

**Pergunta:** Isso é aceitável? Devo integrar um serviço de routing (OSRM, Google Directions) para distância real? O `fatorReparo` nos veículos tenta compensar isso?

> RESPOSTA:

---

### Q067 — Nominatim User-Agent fixo
O User-Agent usado para Nominatim é `BomFilhoFrete/1.0 (fallback-cep)`. Nominatim exige User-Agent identificável e rate limit de 1 req/s.

**Pergunta:** O rate limit está sendo respeitado? Em alto tráfego, múltiplas requisições simultâneas podem causar ban do IP.

> RESPOSTA:

---

### Q068 — CEP do mercado hardcoded (`68740-180`)
O CEP de origem do frete é configurável via env var `CEP_MERCADO`, mas o default `68740-180` está hardcoded no backend E replicado no frontend (`PagamentoPage.jsx`).

**Pergunta:** O frontend deveria receber o CEP do mercado via API ao invés de ter hardcoded? E se a loja mudar de endereço?

> RESPOSTA:

---

### Q069 — Sem limite de distância máxima de entrega
O frete é calculado para até 80km (`normalizarDistanciaEntregaKm` limita a 80). Mas não há validação de "área de entrega" — qualquer CEP do Brasil pode solicitar entrega.

**Pergunta:** Devo implementar um raio máximo de entrega configurável? A loja entrega apenas na cidade/região?

> RESPOSTA:

---

## 🔧 OPERACIONAL / DEPLOY

### Q070 — Render free plan com cold start
O deploy usa plano free do Render, que tem cold start de 30-60s. Isso pode causar timeouts no primeiro request após inatividade.

**Pergunta:** Isso é um problema para o negócio? Devo configurar um uptime monitor (UptimeRobot, health check cron) ou migrar para plano pago?

> RESPOSTA:

---

### Q071 — Sem CI/CD pipeline
Não há GitHub Actions, CircleCI, ou qualquer pipeline de CI/CD configurado. O deploy é feito diretamente pelo Render/Vercel via git push.

**Pergunta:** Devo configurar um pipeline mínimo (lint, type-check, tests) antes do deploy?

> RESPOSTA:

---

### Q072 — Sem linting/formatting configurado
Não há ESLint, Prettier, ou qualquer ferramenta de lint configurada no backend ou frontend.

**Pergunta:** Devo configurar ESLint + Prettier com regras padrão?

> RESPOSTA:

---

### Q073 — `connect-timeout` com 10s default
O timeout padrão de 10s para requests pode ser insuficiente para operações que dependem de APIs externas (BrasilAPI + Nominatim + PagBank encadeadas).

**Pergunta:** Devo aumentar o timeout para rotas que chamam APIs externas? Ou o 10s com 600s para importação é suficiente?

> RESPOSTA:

---

### Q074 — Sem monitoramento de erros (Sentry, etc.)
Erros são logados com `console.error` apenas. Não há serviço de monitoramento de erros em produção.

**Pergunta:** Devo implementar Sentry ou similar? O `trackWebVitals.js` sugere que há preocupação com observabilidade no frontend.

> RESPOSTA:

---

### Q075 — `process.exit(1)` em falha não capturada
Como mencionado em Q034, erros não tratados matam o processo. No Render, o serviço será reiniciado automaticamente, mas requests em andamento são perdidos.

**Pergunta:** Devo implementar graceful shutdown? Ou o behavior de restart do Render é adequado?

> RESPOSTA:

---

## 📊 TRACKING E ANALYTICS

### Q076 — PostHog não está configurado
O `commerceTracking.js` e `conversionGrowth.js` definem eventos de e-commerce, mas não vejo integração real com PostHog (não há PostHog nos package.json nem inicialização).

**Pergunta:** O tracking está sendo efetivamente enviado para algum serviço? Ou é apenas instrumentação preparatória?

> RESPOSTA:

---

### Q077 — Web Vitals sem destino
O `trackWebVitals.js` coleta CLS, LCP, INP mas não parece ter uma URL/API para enviar esses dados.

**Pergunta:** Os Web Vitals estão sendo enviados para algum backend de analytics? Ou só são logados no console?

> RESPOSTA:

---

## 📋 QUALIDADE DE CÓDIGO

### Q078 — Funções duplicadas entre backend e frontend
Funções como `normalizarCep`, `formatarCep`, `parseBooleanInput`, `parsePositiveInt` existem tanto no backend quanto no frontend com implementações similares.

**Pergunta:** Posso extrair um pacote `shared/` com utils comuns? Ou a duplicação é aceitável pela simplicidade?

> RESPOSTA:

---

### Q079 — Console.log com emojis em produção
O backend usa extensivamente `console.log` com emojis (`✅`, `⚠️`, `❌`, `🚀`). Em produção, esses logs vão para stdout/stderr do container.

**Pergunta:** Devo implementar um logger estruturado (Winston, Pino) com níveis de log e formato JSON para produção?

> RESPOSTA:

---

### Q080 — Queries SQL inline extensas no server.js
Queries SQL de múltiplas linhas (10-20 linhas em `pool.query`) estão inline nos handlers. Especialmente nos endpoints admin, as queries são complexas.

**Pergunta:** Devo extrair as queries para arquivos/módulos separados? Ou manter inline pela proximidade com a lógica?

> RESPOSTA:

---

### Q081 — Sem TypeScript
Todo o projeto é JavaScript puro (tanto backend quanto frontend). Não há JSDoc types nem TypeScript.

**Pergunta:** Há interesse em migrar para TypeScript? Ao menos tipos JSDoc para as funções críticas?

> RESPOSTA:

---

### Q082 — `body-parser` redundante com Express 4.18
Express 4.18 já inclui `express.json()` e `express.urlencoded()`. A dependência `body-parser` separada é redundante.

**Pergunta:** Posso remover `body-parser` do package.json e usar `express.json()` diretamente?

> RESPOSTA:

---

### Q083 — `node-fetch` redundante com Node 18+
O projeto exige Node >= 18, que já tem `fetch` nativo. O código faz `const fetch = global.fetch || require('node-fetch')` como fallback.

**Pergunta:** Posso remover `node-fetch` e usar apenas `fetch` nativo?

> RESPOSTA:

---

## 📱 WHATSAPP / EVOLUTION API

### Q084 — Evolution API URL hardcoded como localhost
O default `EVOLUTION_API_URL` é `http://localhost:8080`. Em produção, precisa ser configurado. Mas se esquecido, o backend tenta conectar em localhost.

**Pergunta:** Devo adicionar validação para impedir tentativas de conexão Evolution API quando não configurada explicitamente?

> RESPOSTA:

---

### Q085 — Auto-reply sem personalização por contexto
A resposta automática do WhatsApp é uma mensagem fixa (`WHATSAPP_AUTO_REPLY_TEXT`). Não tem contexto do pedido ou do cliente.

**Pergunta:** Devo implementar respostas contextuais (ex: "Oi João, seu pedido #123 está sendo preparado")? Ou a auto-reply fixa é suficiente?

> RESPOSTA:

---

### Q086 — Sem verificação de opt-in antes de enviar WhatsApp
A função `enviarWhatsappPedido` verifica `whatsapp_opt_in` antes de enviar. Mas a auto-reply no webhook Evolution responde a qualquer mensagem, sem verificar opt-in.

**Pergunta:** A auto-reply deveria respeitar opt-in? Ou auto-reply para mensagens recebidas é diferente de mensagens proativas?

> RESPOSTA:

---

## 🗃️ DOCUMENTAÇÃO

### Q087 — Múltiplos READMEs e docs redundantes
Existem vários arquivos de documentação: `README.md`, `DEPLOY_VERCEL_RENDER.md`, `RELEASE_ADMIN_GERENCIA_FINAL.md`, e uma pasta `docs/` com 15+ arquivos.

**Pergunta:** Devo consolidar a documentação? Muito está desatualizado? Qual é o doc principal que deveria ser mantido?

> RESPOSTA:

---

### Q088 — Checklist de go-live (`GO_LIVE_TECNICO_CHECKLIST.md`)
Existe um checklist técnico de go-live na pasta docs.

**Pergunta:** O go-live já aconteceu? O checklist está atualizado? Itens pendentes?

> RESPOSTA:

---

## 🎨 UI/UX

### Q089 — Sem skeleton loading em produtos
O `ProdutosPage` mostra um "Carregando..." genérico enquanto os produtos carregam. Os componentes admin têm `LoadingSkeleton`, mas as páginas públicas não.

**Pergunta:** Devo implementar skeleton loading para a lista de produtos e o checkout?

> RESPOSTA:

---

### Q090 — Sem feedback visual para operações como adicionar ao carrinho
O `CartContext.addItem` atualiza o estado, mas não dispara nenhum feedback visual (toast, animação, badge bounce).

**Pergunta:** Devo implementar um sistema de toasts/notificações? Ou o indicador no carrinho flutuante é suficiente?

> RESPOSTA:

---

### Q091 — Acessibilidade (a11y) parcial
O `accessibility.js` implementa font scale e high contrast. Mas não há ARIA labels em vários componentes interativos, as avaliações por estrelas podem não ser acessíveis, e a navegação por teclado não é verificada.

**Pergunta:** Devo fazer um audit de acessibilidade mais completo?

> RESPOSTA:

---

### Q092 — Sem meta tags de SEO
O `index.html` tem um title genérico. Não há componente de Head/Helmet React para meta tags dinâmicas por rota.

**Pergunta:** SEO é importante para o projeto? Devo implementar meta tags dinâmicas por página (Open Graph, description, canonical)?

> RESPOSTA:

---

## 🔄 CÓDIGO MORTO E REDUNDÂNCIA

### Q093 — Funções de barcode lookup duplicadas
Existem `buscarProdutoOpenFoodFacts` e `buscarProdutoUpcItemDb` inline no `server.js`, mas também há a service layer `services/barcode/BarcodeLookupService.js` com providers separados.

**Pergunta:** As funções inline no server.js ainda são usadas? Ou foram substituídas pelo BarcodeLookupService?

> RESPOSTA:

---

### Q094 — Endpoint duplicado de importação
Existem dois conjuntos de endpoints similares para importação de produtos:
- `/api/admin/catalogo/produtos/importar`
- `/api/admin/produtos/importar`

E dois modelos:
- `/api/admin/catalogo/produtos/importacao/modelo`
- `/api/admin/produtos/importacao/modelo`

**Pergunta:** Um deles é legado? Posso remover o duplicado?

> RESPOSTA:

---

### Q095 — Endpoint duplicado de barcode lookup admin
- `/api/admin/catalogo/produtos/barcode/:codigo`
- `/api/admin/produtos/barcode/:codigo`

Ambos usam `responderBuscaProdutoPorCodigoBarrasAdmin`.

**Pergunta:** Posso consolidar em um único endpoint?

> RESPOSTA:

---

### Q096 — Múltiplos arquivos SQL de migration sem ordem clara
Existem 13 arquivos de migration sem prefixo numérico de ordem. Não está claro em qual sequência devem ser executados.

**Pergunta:** Devo renumerar as migrations (ex: `001_initial.sql`, `002_produtos_detalhes.sql`) e documentar a ordem?

> RESPOSTA:

---

## 🔌 DEPENDÊNCIAS

### Q097 — `xlsx` (SheetJS) sem tipo de licença clara para uso comercial
O package `xlsx` (SheetJS community edition) teve mudanças de licença recentes. A versão 0.18.5 pode ter restrições.

**Pergunta:** A licença atual permite uso comercial? Devo verificar e considerar alternativas como `exceljs`?

> RESPOSTA:

---

### Q098 — Express 5 no bot-whatsapp
O `bot-whatsapp/package.json` referencia Express 5.2.1 (que é alpha/beta). O backend principal usa Express 4.18 (estável).

**Pergunta:** O Express 5 no bot é intencional? Ele é estável para uso?

> RESPOSTA:

---

### Q099 — Sem lockfile no backend
Não encontrei `package-lock.json` no backend (pode estar no .gitignore). Sem lockfile, instalações em ambientes diferentes podem gerar versões diferentes de dependências.

**Pergunta:** O `package-lock.json` está commitado? Deveria estar.

> RESPOSTA:

---

## 🧹 LIMPEZA GERAL

### Q100 — Arquivos SQL avulsos no backend root
Arquivos como `Consulta #2.sql`, `va.sql`, `update_produtos_existentes.sql` estão soltos no root do backend.

**Pergunta:** Esses são queries temporárias/debug? Devo mover para uma pasta `sql/` ou remover?

> RESPOSTA:

---

### Q101 — `whatsapp-qrcode.html` no backend
Um arquivo HTML para QR code do WhatsApp está no root do backend.

**Pergunta:** Isso é utilizado? É para exibir o QR de conexão da Evolution API? Deveria ser uma rota protegida?

> RESPOSTA:

---

### Q102 — `node_modules/` commitado no bot-whatsapp
O diretório `node_modules/` do bot-whatsapp parece estar rastreado pelo git.

**Pergunta:** Devo adicionar ao `.gitignore` e remover do git?

> RESPOSTA:

---

### Q103 — Scripts PowerShell e .bat redundantes
Existem scripts `.ps1` e `.bat` duplicados (`setup-git.bat` + `setup-git.ps1`, `start-servicos.bat` + `start-servicos.ps1`).

**Pergunta:** Posso manter apenas os `.ps1` (já que o ambiente é Windows) e remover os `.bat`?

> RESPOSTA:

---

### Q104 — Pastas de log vazias commitadas
O diretório `backend/logs/` contém múltiplas subpastas de log vazias rastreadas pelo git.

**Pergunta:** Logs deveriam estar no `.gitignore`? Ou os diretórios vazios são mantidos intencionalmente (com `.gitkeep`)?

> RESPOSTA:

---

### Q105 — Diretórios `img/ads/` sem conteúdo aparente
Existe um diretório `img/ads/` no root.

**Pergunta:** Há imagens de banner/propaganda neste diretório? Qual o propósito?

> RESPOSTA:

---

---

## RESUMO DE PRIORIDADES SUGERIDAS

| Prioridade | Questões | Tema |
|------------|----------|------|
| 🔴 Crítica | Q009, Q013, Q018, Q032, Q038, Q042 | Segurança + Bugs |
| 🟠 Alta | Q001, Q002, Q007, Q017, Q021, Q034, Q054 | Arquitetura + Estabilidade |
| 🟡 Média | Q024-Q027, Q030, Q039, Q056, Q079, Q093-Q095 | Refatoração + Código morto |
| 🟢 Baixa | Q059, Q062, Q072, Q081, Q087, Q089-Q092 | DX + UX + Docs |

---

> **Próximo passo:** Responda cada questão com `> RESPOSTA:` e me passe o arquivo novamente. Implementarei as melhorias com base nas suas respostas.
