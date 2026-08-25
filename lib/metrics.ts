// Cálculo de métricas de vendas — compartilhado entre o dashboard da
// própria aluna (app/api/vendas/route.ts) e o detalhe por aluna do painel
// admin (app/api/admin/alunas/[id]/route.ts). PA e Conversão usam
// "atendimentos" (pessoas abordadas, mesmo sem compra) como denominador,
// não o número de vendas.

interface VendaItemMetrica {
  quantidade: number;
}

interface VendaMetrica {
  faturamento_total: number;
  venda_itens?: VendaItemMetrica[];
}

export interface Metricas {
  vendas: number;
  pa: number;
  conversao: number;
  atendimentos_hoje: number;
  faturamento_total: number;
  ticket_medio: number;
  faturamento_mes: number;
  total_itens: number;
}

export function calcularMetricasVendas(
  vendasHoje: VendaMetrica[],
  vendasMes: VendaMetrica[],
  atendimentosHoje: number,
): Metricas {
  const vendas_count = vendasHoje.length;

  const totalItens = vendasHoje.reduce((sum, venda) => {
    return sum + (venda.venda_itens?.reduce((itemSum, item) => itemSum + item.quantidade, 0) || 0);
  }, 0);

  const pa = atendimentosHoje > 0 ? totalItens / atendimentosHoje : 0;
  const conversao = atendimentosHoje > 0 ? (vendas_count / atendimentosHoje) * 100 : 0;
  const faturamento_total = vendasHoje.reduce((sum, venda) => sum + venda.faturamento_total, 0);
  const ticket_medio = vendas_count > 0 ? faturamento_total / vendas_count : 0;
  const faturamento_mes = vendasMes.reduce((sum, venda) => sum + venda.faturamento_total, 0);

  return {
    vendas: vendas_count,
    pa: parseFloat(pa.toFixed(2)),
    conversao: parseFloat(conversao.toFixed(2)),
    atendimentos_hoje: atendimentosHoje,
    faturamento_total,
    ticket_medio: parseFloat(ticket_medio.toFixed(2)),
    faturamento_mes: parseFloat(faturamento_mes.toFixed(2)),
    total_itens: totalItens,
  };
}
