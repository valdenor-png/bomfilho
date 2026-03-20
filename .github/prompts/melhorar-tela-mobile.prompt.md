---
description: "Prompt reutilizável para revisar e melhorar qualquer tela do BomFilho para mobile"
mode: "agent"
---

# Melhorar Tela para Mobile — BomFilho

## Contexto

O BomFilho é um supermercado de bairro com delivery. 80%+ dos clientes acessam pelo celular.
Stack: React 18.3 + Vite 5.4, CSS global em `frontend-react/src/styles.css` (~15800 linhas).

## Tarefa

Analise a tela/componente indicado e proponha melhorias concretas para experiência mobile.

## Processo Obrigatório

### 1. Identificar o componente
- Localize o arquivo `.jsx` em `frontend-react/src/pages/` ou `frontend-react/src/components/`
- Leia o código completo. Entenda a estrutura, props, state e ciclo de vida.
- Identifique quais classes CSS estão sendo usadas (buscar em `styles.css`).

### 2. Auditar problemas mobile
Verificar cada um destes pontos:

**Layout:**
- [ ] Funciona em 320px de largura? (mínimo absoluto)
- [ ] Funciona em 375px? (iPhone SE — o mais comum)
- [ ] Elementos não transbordam horizontalmente?
- [ ] Flex/grid se adapta corretamente?

**Touch:**
- [ ] Botões e links têm touch target ≥ 44×44px?
- [ ] Espaçamento entre elementos tocáveis é suficiente? (sem toque acidental)
- [ ] Ações destrutivas (cancelar, deletar) têm confirmação?

**Teclado:**
- [ ] Inputs de valor usam `inputMode="decimal"`?
- [ ] Inputs de telefone usam `inputMode="tel"`?
- [ ] Inputs de email usam `inputMode="email"`?
- [ ] Teclado virtual não empurra botões para fora da tela?

**Performance:**
- [ ] Listas longas usam virtualização (`react-window`)?
- [ ] Imagens usam `SmartImage` (lazy load)?
- [ ] Componentes pesados são lazy loaded?

**Estados:**
- [ ] Loading: skeleton ou spinner visível (nunca tela em branco)
- [ ] Erro: mensagem amigável + retry
- [ ] Vazio: orientação para o usuário

**Conteúdo:**
- [ ] Nomes de produtos usam `getProdutoNome(produto)` de `produtosUtils.js`?
- [ ] Textos longos têm truncamento adequado?
- [ ] Preços formatados corretamente (`R$ X,XX`)?

### 3. Propor correções
- Para cada problema encontrado, propor a correção exata (código).
- Priorizar por impacto: o que afeta mais clientes primeiro.
- CSS vai em `styles.css`. Usar variáveis `--ck-*` existentes.
- Não adicionar dependências npm sem justificativa.

### 4. Validar
```bash
cd frontend-react && npx vite build
```
Build deve passar sem erros.

## Formato de Saída

Para cada problema encontrado:
```
### Problema: [descrição curta]
- Arquivo: [caminho]
- Impacto: [alto/médio/baixo]
- Fix: [código ou instrução concreta]
```

## Restrições

- Não propor migração para Tailwind, CSS modules ou styled-components.
- Não adicionar frameworks CSS (Bootstrap, Material UI, etc.).
- Não refatorar componentes que funcionam — focar em mobile.
- Não alterar lógica de negócio — apenas UX/layout.
- Testar mentalmente em: 320px, 375px, 390px, 768px.
