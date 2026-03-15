# Release Final - Admin/Gerencia

Data: 2026-03-14

## 1) Escopo Validado

- Rotas backend de catalogo admin, importacao, exportacao, enriquecimento e logs.
- Servico de catalogo administrativo e lookup de codigo de barras.
- Integracao de importacao de planilha com simulacao e persistencia.
- Tela frontend Admin/Gerencia com tabs, filtros, paginacao, edicao, importacao, exportacao, enriquecimento e logs.
- Integracao de autenticacao admin por cookie/token com API client.
- Build frontend e checagem de sintaxe backend.

## 2) Hardening Aplicado

### Backend

- `backend/services/admin/catalogoAdminService.js`
  - Atualizacao de produto agora retorna erro quando `id` nao existe (evita falso sucesso com produto nulo).
  - Registro de log de enriquecimento passou a ser tolerante a falha (nao quebra operacao principal).

- `backend/server.js`
  - Importacao admin agora nao falha se houver erro apenas no log administrativo (retorna `aviso_log`).
  - Atualizacao de produto admin retorna `404` quando produto nao existe.

- `backend/services/produtosImportacao.js`
  - Falha de historico apos commit nao invalida importacao concluida (retorna `aviso_historico`).

### Frontend

- `frontend-react/src/services/api.js`
  - Cliente HTTP passou a suportar `responseType` (`json`, `raw`, `blob`, `arrayBuffer`).

- `frontend-react/src/lib/api.js`
  - Adicionado `requestArquivo` para download autenticado.
  - Novas funcoes:
    - `adminBaixarCatalogModeloImportacao()`
    - `adminBaixarCatalogoExportacao(params)`
  - Melhoria na deteccao de erro de autenticacao.

- `frontend-react/src/pages/AdminGerenciaPage.jsx`
  - Modelo CSV e exportacao XLSX agora usam download autenticado (fetch + blob), evitando falha quando auth estiver em Bearer.
  - Melhoria de estados de loading/empty em dashboard, produtos e logs.
  - Tratamento de erro admin mais robusto, sem silenciar erros operacionais.
  - Evitado flicker inicial de login durante validacao de sessao.

### Migration

- `backend/migrate_admin_catalogo_gerencia.sql`
  - Incluido indice `idx_produtos_nome_admin` (alinhado ao servico).
  - Branches idempotentes alteradas para `SELECT 1` (maior compatibilidade entre modos SQL).

## 3) Migrations Necessarias

Ordem minima para este release:

1. `backend/migrate_admin_catalogo_gerencia.sql`

Observacao:
- O backend tambem tem guard-rails runtime (`ensureAdminCatalogSchema` e `ensureCacheSchema`), mas **nao substituem** execucao controlada da migration em producao.

## 4) Checklist de Banco (Pre-Deploy)

- Confirmar backup/snapshot antes de alterar schema.
- Executar migration em homologacao.
- Validar existencia de colunas em `produtos`:
  - `codigo_barras`, `imagem_url`, `preco_tabela`,
  - `enrichment_status`, `enrichment_provider`,
  - `enrichment_last_attempt_at`, `enrichment_updated_at`, `enrichment_last_error`.
- Validar indices em `produtos`:
  - `idx_produtos_codigo_barras`, `idx_produtos_preco_tabela`,
  - `idx_produtos_enrichment_status`, `idx_produtos_nome_admin`.
- Validar tabelas:
  - `product_import_logs`
  - `product_enrichment_logs`
  - `barcode_lookup_cache`
- Validar usuario de banco com permissao de leitura/escrita nas tabelas novas.

## 5) Checklist de Ambiente (Pre-Deploy)

Obrigatorias:
- `DATABASE_URL`
- `JWT_SECRET` (>= 32 caracteres)
- `ADMIN_PASSWORD`
- `CORS_ORIGINS` alinhado com frontend publicado
- `VITE_API_URL` no frontend

Importantes para operacao admin:
- `ADMIN_USER` (opcional, default `admin`)
- `ADMIN_LOCAL_ONLY`
  - `true` (default): admin apenas local
  - `false`: permite admin remoto
- `VITE_ENABLE_TOKEN_STORAGE=true` (recomendado para cenarios cross-site)

Lookup barcode (opcionais, com defaults):
- `BARCODE_PROVIDER_ORDER`
- `BARCODE_PROVIDER_TIMEOUT_MS`
- `OPENFOODFACTS_API_URL`, `OPENFOODFACTS_USER_AGENT`
- `COSMOS_API_URL`, `COSMOS_LOOKUP_PATH_TEMPLATE`, `COSMOS_API_TOKEN`
- `UPCITEMDB_API_URL`, `UPCITEMDB_API_KEY`
- `BARCODE_CACHE_TTL_FOUND_SECONDS`
- `BARCODE_CACHE_TTL_NOT_FOUND_SECONDS`
- `BARCODE_CACHE_TTL_ERROR_SECONDS`

## 6) Smoke Test Manual (Homologacao)

### Acesso e sessao

- Acessar `/admin/gerencia`.
- Validar login admin com credencial valida.
- Validar mensagem de erro com credencial invalida.
- Validar comportamento com sessao expirada (401/403).
- Validar logout admin.

### Carregamento inicial

- Verificar estado de loading inicial da pagina.
- Verificar ausencia de quebra visual em telas mobile/desktop.

### Dashboard

- Abrir aba Dashboard.
- Validar indicadores carregando e atualizando com botao.
- Confirmar consistencia basica dos totais.

### Produtos

- Abrir aba Produtos.
- Validar listagem inicial e empty state.
- Validar paginacao (anterior/proxima).
- Validar busca por nome e codigo de barras.
- Validar filtros:
  - com imagem / sem imagem
  - status enriquecimento
  - com erro / sem erro
  - com preco / sem preco
- Validar ordenacoes.

### Edicao

- Editar nome, descricao, preco, imagem, codigo de barras.
- Salvar alteracoes e validar persistencia na recarga.
- Tentar editar `id` inexistente (deve retornar erro consistente).

### Importacao

- Baixar modelo CSV.
- Fazer simulacao (preview) com arquivo valido.
- Validar resumo (`total_linhas`, `total_validos`, atualizados, criados, erros).
- Executar importacao real.
- Validar persistencia em listagem e dashboard.
- Validar tratamento de arquivo invalido e mensagens de erro.

### Exportacao

- Exportar XLSX com filtros ativos.
- Confirmar que arquivo baixa corretamente com autenticacao.
- Confirmar que conteudo exportado respeita filtros.

### Enriquecimento

- Consulta manual por codigo de barras valido.
- Validar retorno para produto encontrado.
- Validar comportamento para nao encontrado.
- Reprocessar produto individual na lista.
- Reprocessar falhas em lote e validar resumo.

### Logs

- Validar logs de importacao apos simulacao/importacao real.
- Validar logs de enriquecimento apos consultas/reprocessamentos.
- Validar estados de loading e empty state.

### Erros e UX

- Forcar erro de API (ex.: parar backend) e validar mensagem amigavel.
- Forcar 401/403 e validar redirecionamento/logout de sessao quando apropriado.
- Confirmar que erros operacionais (ex.: admin local-only) aparecem sem serem silenciados.

## 7) Warning do react-window

Warning observado no build:
- `Module level directives cause errors when bundled, "use client" ... was ignored`

Conclusao:
- Nao bloqueia producao neste projeto (Vite + React SPA).
- O warning vem de diretiva de pacote pensada para ambiente RSC/Next.js.
- Resultado: build gera bundle normalmente e o comportamento no cliente permanece funcional.

## 8) Riscos Remanescentes

- Risco operacional de ambiente: sem migration aplicada, recursos do catalogo admin podem falhar.
- Risco de acesso admin em producao: com `ADMIN_LOCAL_ONLY=true`, acesso remoto sera bloqueado por design.
- Risco externo de enriquecimento: disponibilidade/limites de APIs de terceiros (OpenFoodFacts/Cosmos/UPCItemDB).

## 9) Publicacao Segura (Passo a Passo)

1. Aplicar migration em homologacao.
2. Subir backend com env vars revisadas.
3. Executar smoke test completo em homologacao.
4. Corrigir pendencias de homologacao (se houver).
5. Aplicar migration em producao.
6. Publicar backend.
7. Publicar frontend com `VITE_API_URL` correto.
8. Rodar smoke test rapido pos-deploy (foco em login admin, listagem, import/export, enriquecimento, logs).
9. Monitorar erros de API e logs de importacao/enriquecimento nas primeiras horas.

## 10) Status de Go/No-Go

- Status tecnico do codigo: pronto para homologacao.
- Status para producao: condicionado a migration + checklist de ambiente + homologacao aprovada.
