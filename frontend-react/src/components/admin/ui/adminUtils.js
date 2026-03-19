// ============================================
// Admin Shared Utilities — Design System
// ============================================

export const R$ = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatarMoeda = (v) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

export const formatarNum = (v) => Number(v || 0).toLocaleString('pt-BR');

export function tempoRelativo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return 'agora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

export const LABELS_PAGAMENTO = { pix: 'PIX', credito: 'Crédito', debito: 'Débito', dinheiro: 'Dinheiro', cartao: 'Cartão' };
export const LABELS_STATUS = {
  pendente: 'Pendente', pago: 'Pago', preparando: 'Preparando',
  pronto_para_retirada: 'Pronto', enviado: 'Em rota',
  entregue: 'Entregue', retirado: 'Retirado', cancelado: 'Cancelado'
};

export const COR_STATUS = {
  pendente: '#94a3b8', pago: '#3b82f6', preparando: '#f59e0b',
  pronto_para_retirada: '#8b5cf6', enviado: '#06b6d4',
  entregue: '#22c55e', retirado: '#10b981', cancelado: '#ef4444'
};

export const LABELS_ACAO = {
  alterar_status_pedido: '📦 Status Pedido',
  exportar_relatorio: '📊 Exportação',
  login: '🔐 Login',
  logout: '🚪 Logout',
  cadastrar_produto: '📦 Cadastro Produto',
  importar_produtos: '📥 Importação',
  excluir_produto: '🗑️ Exclusão Produto',
  atualizar_produto: '✏️ Atualizar Produto'
};

export const LABELS_ENTIDADE = {
  pedido: 'Pedido',
  produto: 'Produto',
  pedidos: 'Pedidos',
  usuario: 'Usuário',
  produtos: 'Produtos',
  importacao: 'Importação'
};

export const LABELS_CANAL = { entrega: '🚗 Entrega', retirada: '🏪 Retirada' };
