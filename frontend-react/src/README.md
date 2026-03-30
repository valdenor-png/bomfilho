# BomFilho Admin — Dark Premium Theme

## Estrutura dos arquivos

```
src/
├── styles/
│   └── admin-theme.css          ← CSS global (variáveis + reset + animações)
│
└── components/
    └── admin/
        ├── AdminLayout.jsx      ← Layout wrapper (sidebar + topbar + content)
        ├── AdminSidebar.jsx     ← Sidebar com navegação
        ├── AdminTopbar.jsx      ← Barra superior com status e relógio
        └── ui/
            ├── adminTheme.js    ← Constantes de cores/fontes em JS
            ├── AdminComponents.jsx  ← Todos os componentes reutilizáveis
            └── index.js         ← Barrel exports
```

## Instalação

### 1. Copiar os arquivos

Extraia o ZIP e copie as pastas para dentro do seu `src/`:

- `styles/admin-theme.css` → `src/styles/admin-theme.css`
- `components/admin/AdminLayout.jsx` → `src/components/admin/AdminLayout.jsx`
- `components/admin/AdminSidebar.jsx` → `src/components/admin/AdminSidebar.jsx`
- `components/admin/AdminTopbar.jsx` → `src/components/admin/AdminTopbar.jsx`
- `components/admin/ui/*` → `src/components/admin/ui/`

> **ATENÇÃO:** Se já existem arquivos na pasta `src/components/admin/ui/`,
> estes arquivos NÃO sobrescrevem nada — são arquivos novos com nomes novos.
> Seus componentes existentes continuam funcionando.

### 2. Importar o CSS

No arquivo principal do admin (ex: `AdminPage.jsx` ou `App.jsx`), adicione:

```js
import '../styles/admin-theme.css';
// ou ajuste o path conforme necessário:
// import './styles/admin-theme.css';
```

### 3. Usar o AdminLayout

No seu router ou página admin, envolva o conteúdo com `AdminLayout`:

```jsx
import AdminLayout from '../components/admin/AdminLayout';
import { useNavigate } from 'react-router-dom';

function AdminPage() {
  const navigate = useNavigate();

  return (
    <AdminLayout
      title="Central de Comando"
      activeKey="comando"
      userName="Valdenor"
      badges={{ operacao: '1' }}
      onNavigate={(path) => navigate(path)}
    >
      {/* Seu conteúdo aqui */}
      <h1>Conteúdo da Central de Comando</h1>
    </AdminLayout>
  );
}
```

### 4. Usar os componentes UI

```jsx
import {
  MetricCard,
  StatusBadge,
  PipelineCard,
  AdminTable,
  OrderRow,
  LiveOrderCard,
  AdminAlert,
  AdminButton,
  AdminInput,
  AdminTabs,
  SectionHeader,
  EmptyState,
} from '../components/admin/ui';

// Exemplos:

// Métricas
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
  <MetricCard label="Faturamento" value="R$ 8,24" sub="Total" accent icon="💰" />
  <MetricCard label="Pedidos" value="12" sub="1 ativo" icon="📦" />
</div>

// Pipeline
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
  <PipelineCard number={0} label="Confirmar" />
  <PipelineCard number={1} label="Pagamento" active />
</div>

// Alerta
<AdminAlert
  type="danger"
  icon="🚨"
  title="Pedido travado há 62h"
  text="Pedido #18 está parado em Aguardando Pagamento."
/>

// Tabela
<AdminTable
  title="Últimos Pedidos"
  action="Ver todos →"
  columns={[
    { label: '#' },
    { label: 'Cliente' },
    { label: 'Status' },
    { label: 'Pgto', align: 'center' },
    { label: 'Valor', align: 'right' },
  ]}
>
  <OrderRow order={{ id: 18, client: 'Valdenor', status: 'Aguardando confirmacao', payment: 'PIX', value: '8,24' }} />
</AdminTable>

// Status badge (auto-detect)
<StatusBadge status="Cancelado" />        // → vermelho
<StatusBadge status="Aguardando confirmacao" />  // → amarelo
<StatusBadge status="Concluido" />         // → verde

// Botões
<AdminButton variant="primary">Salvar Produto</AdminButton>
<AdminButton variant="secondary">Ver Detalhes</AdminButton>
<AdminButton variant="ghost">Limpar Filtros</AdminButton>
<AdminButton variant="danger">Cancelar Pedido</AdminButton>

// Inputs
<AdminInput label="Nome do Produto" placeholder="Digite o nome..." />
<AdminInput as="select" label="Categoria">
  <option value="">Selecione...</option>
  <option value="agua">Água</option>
</AdminInput>
<AdminInput as="textarea" label="Descrição" />

// Tabs
<AdminTabs tabs={['Fechamento', 'Conciliação']} active={0} onChange={setTab} />

// Live Order Card
<LiveOrderCard
  id={18}
  client="Valdenor Diogenes"
  value="8,24"
  badges={[{ label: '🏠 Retirada', type: 'neutral' }, { label: '⏳ Aguardando', type: 'warning' }]}
  steps={['Pago', 'Separando', 'Preparado', 'Retirado']}
  currentStep={0}
  onDetails={() => navigate('/admin/pedido/18')}
/>

// Empty State
<EmptyState
  icon="🚚"
  title="Sem entregas"
  text="Sem pedidos de entrega para Uber no momento."
/>
```

## Sidebar — Ajustando as rotas

Abra `AdminSidebar.jsx` e edite o array `NAV_SECTIONS` no topo do arquivo
para ajustar os `path` conforme suas rotas reais do React Router.

## Fonts

O CSS já importa as fontes do Google Fonts. Se preferir self-hosted,
remova a linha `@import url(...)` do `admin-theme.css` e adicione
as fontes no seu `index.html` ou via Vite config.
