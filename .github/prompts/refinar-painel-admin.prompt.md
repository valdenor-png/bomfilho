---
description: "Prompt reutilizável para evoluir e refinar o painel administrativo do BomFilho"
mode: "agent"
---

# Refinar Painel Admin — BomFilho

## Contexto

O painel admin do BomFilho é usado diariamente pelo time operacional do supermercado.
O operador gerencia pedidos em tempo real, o gerente monitora finanças e catálogo, o dono quer KPIs rápidos.
Stack: React 18.3, CSS global (`styles.css`), backend Express com rotas `admin-operacional.js` e `admin-catalogo.js`.

## Tarefa

Analise o componente/seção admin indicado e proponha melhorias que aumentem a produtividade operacional.

## Processo Obrigatório

### 1. Entender o Componente

Localizar e ler completamente os arquivos envolvidos:
- Componente principal em `frontend-react/src/components/admin/`
- Gerência em `frontend-react/src/components/admin/gerencia/`
- Rotas backend em `backend/routes/admin-operacional.js` ou `admin-catalogo.js`
- Hook `useAdmin` em `frontend-react/src/hooks/`
- UI compartilhada em `frontend-react/src/components/admin/ui/`

### 2. Avaliar pela Ótica do Operador

Pensar como quem usa isso 8h por dia sob pressão:

**Velocidade:**
- [ ] A informação mais importante aparece primeiro?
- [ ] Quantos cliques para a ação mais comum? (ideal: 1-2)
- [ ] Filtros e busca respondem rápido?
- [ ] Dados atualizam sem reload manual?

**Clareza:**
- [ ] Status usa cores consistentes? (amarelo=pendente, verde=feito, vermelho=problema)
- [ ] Badges e indicadores comunicam sem precisar ler texto?
- [ ] Informação está agrupada logicamente?
- [ ] Hierarquia visual está correta? (crítico > importante > informativo)

**Completude:**
- [ ] O operador tem toda informação necessária para decidir?
- [ ] Faltam dados que obrigam consultar outro lugar?
- [ ] Ações disponíveis cobrem o workflow real?

**Robustez:**
- [ ] Loading usa `LoadingSkeleton` de `admin/ui/`?
- [ ] Erro usa `ErrorState` com retry?
- [ ] Vazio usa `EmptyState` com orientação?
- [ ] Funciona em tablet (768px+)?

### 3. Avaliar o Backend

Para cada endpoint admin usado pelo componente:
- [ ] Retorna dados suficientes em uma chamada? (evitar N+1 requests)
- [ ] Paginação implementada para listas longas?
- [ ] Protegido por middleware `admin.js`?
- [ ] Erros retornam `{ error: 'mensagem' }` com status correto?
- [ ] Queries são eficientes? (índices corretos, sem SELECT *)

### 4. Propor Melhorias

Classificar por tipo:

**Quick Wins** (implementar agora, baixo risco):
- Ajustes de layout, cores, ordenação
- Adicionar badge ou indicador que faltava
- Melhorar texto de estado vazio

**Melhorias Estruturais** (planejar, risco médio):
- Novo filtro ou agrupamento
- Refatorar componente para usar componentes de `admin/ui/`
- Otimizar query backend

**Evolução** (discutir primeiro, risco maior):
- Novo sub-componente ou tab
- Novo endpoint backend
- Mudança de workflow operacional

### 5. Validar

```bash
cd frontend-react && npx vite build
cd backend && node --check server.js
```

Ambos devem passar sem erros.

## Formato de Saída

```
## Análise: [Nome do Componente]

### Estado Atual
- O que faz bem: [pontos positivos]
- O que pode melhorar: [lista priorizada]

### Quick Wins
1. [descrição] — Arquivo: [caminho] — Impacto: [benefício operacional]

### Melhorias Estruturais
1. [descrição] — Arquivos: [caminhos] — Impacto: [benefício] — Risco: [baixo/médio]

### Evolução Futura (Opcional)
1. [descrição] — Justificativa: [por que vale a pena]
```

## Componentes Admin Disponíveis

Para referência ao analisar:
- `AdminShell` — Shell: sidebar + header + content
- `DashboardExecutivo` — KPIs: vendas, pedidos, ticket médio
- `FilaOperacional` — Fila de pedidos em tempo real
- `FinanceiroAvancado` — Visão financeira detalhada
- `ClientesAdmin` — Gestão de clientes
- `CatalogoSaude` — Saúde do catálogo de produtos
- `CommandCenter` — Ações rápidas centralizadas
- `RelatoriosAdmin` — Relatórios exportáveis
- `AuditoriaAdmin` — Log de auditoria
- Gerência: Dashboard, Produtos, Enriquecimento, Importar, Exportar, Logs

## Restrições

- Não criar dashboards bonitos sem utilidade operacional.
- Não adicionar métricas que ninguém vai consultar.
- Não complicar workflows simples.
- Não duplicar componentes de `admin/ui/`.
- Não remover funcionalidade existente sem justificativa.
- Toda mudança visual em `styles.css` — entender cascata antes de alterar.
- Rotas backend admin sempre com middleware `admin.js`.
