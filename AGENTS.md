# AGENTS.md — Protocolo de Trabalho do Agente no Projeto BomFilho

Este arquivo define **como** o agente (Copilot/Claude) deve pensar, decidir e agir dentro deste repositório.
Não é sobre o que o projeto faz — isso está em `copilot-instructions.md`.
Aqui está o **protocolo operacional** que garante qualidade, segurança e utilidade real.

---

## Princípio Central

> Antes de mudar, entenda. Antes de propor, avalie impacto. Antes de refatorar, justifique.

O BomFilho é um produto em operação real — mercado de bairro com delivery, pedidos reais, pagamentos reais, equipe usando o admin diariamente. Cada mudança tem consequência. O agente deve agir como um engenheiro sênior que trabalha no produto, não como um consultor genérico.

---

## Protocolo de Resposta Estruturada

Toda tarefa não-trivial deve seguir esta estrutura:

### 1. Entendimento Atual
- O que existe hoje no código relevante à tarefa
- Quais arquivos, rotas, componentes ou fluxos estão envolvidos
- Estado atual funcional (funciona? tem bugs? está incompleto?)

### 2. Objetivo da Tarefa
- O que precisa ser feito, de forma concreta
- Qual o resultado esperado pelo usuário/operador

### 3. Diagnóstico
- O que está certo e deve ser preservado
- O que está errado, frágil ou pode melhorar
- Contexto técnico relevante (dependências, contratos, efeitos colaterais)

### 4. Plano de Execução
- Passos concretos, em ordem
- Um passo = uma responsabilidade clara
- Não misturar frontend + backend + migração no mesmo passo sem necessidade

### 5. Arquivos Afetados
- Lista explícita de todos os arquivos que serão criados, editados ou removidos
- Indicar se a mudança é aditiva, destrutiva ou comportamental

### 6. Riscos
- O que pode quebrar
- Impacto em outros fluxos (checkout, admin, pedidos, pagamento)
- Necessidade de migração, cache bust ou deploy coordenado

### 7. Validação
- Como verificar que a mudança funcionou
- Comandos de build, sintaxe ou testes a rodar
- Cenários a verificar manualmente (loading, erro, vazio, mobile)

### 8. Resultado Esperado
- Descrição curta do que muda na experiência final
- Antes vs. depois, se aplicável

---

## Regras de Conduta

### Gerais
- **Inspecionar antes de agir.** Nunca assumir estrutura, nome de arquivo ou contrato de API sem verificar.
- **Preservar comportamento existente.** Se algo funciona, não quebrar. Se precisa mudar, explicar por quê.
- **Entregas incrementais.** Preferir várias mudanças pequenas e verificáveis a uma mudança gigante.
- **Informar trade-offs.** Se existem alternativas, apresentar prós e contras brevemente.
- **Não inventar arquitetura.** Resolver o problema atual. Não criar abstrações para cenários hipotéticos.
- **Não gerar conteúdo genérico.** Adaptar tudo ao contexto real do BomFilho.

### Frontend (React + Vite)
- Manter compatibilidade com React 18.3 + Vite 5.4
- Respeitar o CSS global (`styles.css`) — não criar CSS modules sem motivo forte
- Revisar: loading, erro, vazio, responsividade, toque mobile
- Não adicionar dependências npm sem justificativa clara
- Testar build: `cd frontend-react && npx vite build`

### Backend (Node + Express)
- Manter contratos de API existentes (não mudar shape de resposta sem necessidade)
- Tratar erros com try/catch e logs via `logger`
- Validar entrada em rotas públicas e admin
- Usar `queryWithRetry` ou `pool.query` conforme padrão existente
- Testar sintaxe: `cd backend && node --check server.js`

### Pagamento (PagBank)
- Área crítica. Toda mudança deve ser conservadora.
- Nunca remover validação ou log de pagamento
- Pensar em idempotência, rastreabilidade e falha parcial
- Considerar impacto em: checkout → pedido → webhook → admin

### Admin / Operação
- Pensar como operador sob pressão: clareza, velocidade, prioridade
- Melhorar visibilidade sem adicionar complexidade
- Filtros, badges, estados e ações rápidas são prioridade
- Cada informação na tela deve ter utilidade operacional

### Banco de Dados
- Migrações devem ser idempotentes quando possível
- Verificar se coluna/tabela já existe antes de ALTER
- Nunca DROP sem confirmação explícita do usuário
- Testar migrações via Node.js script, não via CLI MySQL direto

---

## Separação de Domínios

| Domínio | Responsável | Cuidados |
|---------|------------|----------|
| **Frontend/UI** | React + Vite + styles.css | Mobile-first, estados, performance percebida |
| **Backend/API** | Express + MySQL2 | Contratos, validação, logs, compatibilidade |
| **Pagamento** | PagBank services + rotas | Idempotência, rastreabilidade, segurança |
| **Admin/Operação** | AdminPage + componentes admin | Produtividade operacional, clareza, ações rápidas |
| **Catálogo/Enriquecimento** | Barcode services + scripts | Qualidade de dados, cache, integrações externas |
| **Infraestrutura** | Vercel + Render + CI | Deploy seguro, variáveis de ambiente, health checks |

---

## O que NÃO fazer

- Não propor reescrita de módulos inteiros sem necessidade real comprovada
- Não adicionar frameworks CSS, state managers ou ORMs novos
- Não mudar estrutura de pastas sem ganho concreto
- Não criar documentação markdown a cada mudança (só quando pedido)
- Não fazer "melhorias" cosméticas que não agregam valor operacional
- Não ignorar o contexto de mercado/delivery — este não é um SaaS genérico
- Não fazer mudanças que exijam deploy coordenado frontend+backend sem avisar
