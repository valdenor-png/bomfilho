# Instruções Globais — Projeto BomFilho Supermercado

## Sobre o Produto

O BomFilho é a plataforma digital de um supermercado de bairro com delivery.
Clientes navegam o catálogo (~21 mil produtos), montam o carrinho e pagam via PagBank (Pix ou cartão).
O time operacional usa o painel admin para gerenciar pedidos, catálogo, finanças e relatórios.

**Não é um projeto escolar. Não é template. É sistema em produção com pedidos, pagamentos e operação real.**

---

## Stack Técnica

| Camada | Tecnologia | Observações |
|--------|-----------|-------------|
| Frontend | React 18.3 + Vite 5.4 | SPA, sem SSR, sem Next.js |
| Estilo | CSS global (`frontend-react/src/styles.css`) | Variáveis `--ck-*`, ~15800 linhas, mobile-first |
| Roteamento | react-router-dom 6.30 | 12 páginas em `src/pages/` |
| Backend | Node 18+ / Express 4.18 | `server.js` como entry point |
| Banco | MySQL via mysql2 (pool) | `lib/db.js` exporta `{pool, queryWithRetry}` |
| Autenticação | JWT via middleware `auth.js` | Tokens no header Authorization |
| Pagamento | PagBank (9 services em `services/pagbank*.js`) | Pix + Cartão, webhooks |
| Deploy | Vercel (frontend) + Render (backend) | CI via `.github/workflows/ci.yml` |
| Enriquecimento | Scripts em `backend/scripts/` | Barcode lookup (4 provedores) + AI (Gemini) |

---

## Estrutura de Pastas Relevante

```
frontend-react/src/
  pages/           → 12 páginas (HomePage, ProdutosPage, PagamentoPage, AdminPage, etc.)
  components/
    admin/         → AdminShell, DashboardExecutivo, FilaOperacional, FinanceiroAvancado,
                     ClientesAdmin, CatalogoSaude, CommandCenter, RelatoriosAdmin, AuditoriaAdmin
    admin/gerencia/→ GerenciaDashboardTab, GerenciaProdutosTab, GerenciaEnriquecimentoTab, etc.
    admin/ui/      → LoadingSkeleton, ErrorState, EmptyState
    checkout/      → CheckoutCart, CheckoutPayment, CheckoutPix, CheckoutDelivery, CheckoutNav
    conta/         → AuthSection, AddressSection, ProfileSection, PreferencesSection, etc.
    produtos/      → ProdutoCard, VirtualizedProdutoGrid, RecorrenciaMiniCard, ProdutoHelpers
    ui/            → SmartImage
  contexts/        → CartContext, AuthContext, AccessibilityContext
  hooks/           → useCart, useAuth, usePedidos, useAdmin, usePagamento
  lib/             → api.js, produtosUtils.js, analytics.js

backend/
  routes/          → auth, produtos, pedidos, pedidos-criar, pagbank, webhooks, frete,
                     enderecos, cupons, avaliacoes, health, admin-operacional, admin-catalogo
  services/        → 9 pagbank services + produtosImportacao + pedidoPagamentoHelpers
  middleware/      → auth.js (JWT), admin.js
  lib/             → db.js, logger.js
  scripts/         → enrichment scripts (barcode + AI)
  migrations/      → 14 arquivos migrate_*.sql
```

---

## Prioridades de Qualidade

1. **Funcionar no celular** — 80%+ dos clientes acessam pelo celular. Touch targets ≥44px, scroll suave, teclado não quebrando layout.
2. **Não quebrar pagamento** — PagBank é área crítica. Conservadorismo total. Sem refatoração desnecessária.
3. **Admin produtivo** — Operador precisa de velocidade e clareza. Cada segundo conta em horário de pico.
4. **Performance percebida** — Skeleton loaders, otimistic updates quando seguro, lazy loading de componentes pesados.
5. **Dados íntegros** — Migrações idempotentes, validação na entrada, logs de auditoria.

---

## Convenções de Código

### Frontend
- Componentes funcionais com hooks. Sem classes.
- Estado local via `useState`/`useReducer`. Contextos para estado global (Cart, Auth, Accessibility).
- Nomes de componentes em PascalCase, hooks com `use` prefix.
- Importações de API via `lib/api.js` (instância axios configurada).
- Nomes de produtos: usar `getProdutoNome(produto)` de `lib/produtosUtils.js` (retorna `nome_externo` quando disponível).
- Virtualização de listas longas via `react-window`.
- Estilos globais em `styles.css` — não criar CSS modules sem motivo forte.
- Build: `cd frontend-react && npx vite build` deve passar sem erros.

### Backend
- Rotas em `routes/*.js`, registradas em `server.js`.
- Services encapsulam lógica de negócio e integrações externas.
- `queryWithRetry(sql, params)` para queries críticas, `pool.query(sql, params)` para leitura simples.
- Logging via `logger` (Winston). Logs estruturados com contexto.
- Middleware `auth.js` para rotas protegidas, `admin.js` para rotas administrativas.
- Erros retornados como `{ error: 'mensagem' }` com status HTTP correto.
- Testar sintaxe: `cd backend && node --check server.js`.

### Banco de Dados
- Coluna `nome` contém o nome do ERP (abreviado). `nome_externo` contém o nome legível gerado por IA.
- Todas as migrações em `backend/migrate_*.sql`. Executar via `npm run migrate`.
- Usar `IF NOT EXISTS` / `IF EXISTS` para idempotência quando possível.
- Tabelas principais: `produtos`, `usuarios`, `pedidos`, `itens_pedido`, `enderecos`, `cupons`, `barcode_lookup_cache`, `admin_audit_log`.

---

## Regras de Segurança

- Nunca expor credenciais, tokens ou chaves de API em código commitado.
- Validar e sanitizar toda entrada de usuário — SQL injection e XSS são vetores reais.
- Rotas admin devem exigir middleware `admin.js`. Nunca tornar rota admin pública.
- PagBank webhook deve validar assinatura/origem antes de processar.
- CORS configurado em `server.js` — não abrir `*` em produção.

---

## Padrões de UX

- Loading: mostrar skeleton ou spinner. Nunca tela em branco.
- Erro: mostrar mensagem amigável e opção de retry. Nunca `undefined` ou stack trace.
- Vazio: mostrar estado vazio com orientação (ex: "Nenhum produto encontrado. Tente outro filtro.").
- Responsive: testar em 320px (mínimo), 375px (iPhone), 768px (tablet).
- Acessibilidade: labels em inputs, contraste adequado, foco visível. `AccessibilityContext` gerencia preferências.

---

## O que Não Fazer

- Não adicionar dependências npm sem justificativa clara e impacto no bundle.
- Não usar `any` ou ignorar erros silenciosamente.
- Não criar rotas ou componentes "para o futuro" — resolver o problema presente.
- Não propor migração para Next.js, TypeScript, Tailwind, Prisma ou qualquer stack diferente.
- Não fazer deploy sem build limpo (`vite build` + `node --check server.js`).
- Não mexer em `styles.css` sem entender impacto cascata — são 15800+ linhas.
