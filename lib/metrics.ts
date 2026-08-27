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

// ============================================
// RELATÓRIO MENSAL — "Raio-X do Mês"
// ============================================
// Função separada de calcularMetricasVendas (que fica só com o dia+mês do
// dashboard de hoje) porque aqui a unidade de análise é sempre o mês
// inteiro: faixas de valor, insights e projeção de meta não fazem sentido
// no recorte diário.

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface FaixaValor {
  tipo: 'unica' | 'baixa' | 'media' | 'alta';
  min: number;
  max: number;
  quantidade: number;
  percentualVendas: number;
  faturamento: number;
  percentualFaturamento: number;
}

export interface ProjecaoMeta {
  cestasNecessarias: number;
  faltam: number;
}

export interface RelatorioMensal {
  faturamento_mes: number;
  /** Nº de transações no mês — uma por cliente/venda, independente da quantidade. */
  vendas_realizadas: number;
  /** Soma das QUANTIDADES de todos os itens: 2 cestas numa venda contam 2. */
  produtos_vendidos: number;
  ticket_medio_mes: number;
  atendimentos_mes: number;
  conversao_mes: number;
  pa_mes: number;
  meta_mensal: number;
  falta_para_meta: number;
  percentual_meta: number;
  faixas: FaixaValor[];
  insights: string[];
  projecao_ticket_atual: ProjecaoMeta | null;
  projecao_ticket_referencia: (ProjecaoMeta & { valorReferencia: number }) | null;
}

function calcularFaixasValor(valores: number[], faturamentoTotal: number): FaixaValor[] {
  if (valores.length === 0) return [];

  const ordenados = [...valores].sort((a, b) => a - b);

  if (ordenados.length < 3) {
    return [
      {
        tipo: 'unica',
        min: ordenados[0] ?? 0,
        max: ordenados[ordenados.length - 1] ?? 0,
        quantidade: ordenados.length,
        percentualVendas: 100,
        faturamento: faturamentoTotal,
        percentualFaturamento: 100,
      },
    ];
  }

  const tamanhoBase = Math.floor(ordenados.length / 3);
  const resto = ordenados.length % 3;
  const tamanhos = [tamanhoBase, tamanhoBase, tamanhoBase + resto];
  const tipos: FaixaValor['tipo'][] = ['baixa', 'media', 'alta'];

  let indice = 0;
  return tamanhos.map((tamanho, i) => {
    const grupo = ordenados.slice(indice, indice + tamanho);
    indice += tamanho;
    const faturamentoGrupo = grupo.reduce((sum, v) => sum + v, 0);
    return {
      tipo: tipos[i] ?? 'unica',
      min: grupo[0] ?? 0,
      max: grupo[grupo.length - 1] ?? 0,
      quantidade: grupo.length,
      percentualVendas: parseFloat(((grupo.length / ordenados.length) * 100).toFixed(1)),
      faturamento: faturamentoGrupo,
      percentualFaturamento: parseFloat(
        (faturamentoTotal > 0 ? (faturamentoGrupo / faturamentoTotal) * 100 : 0).toFixed(1),
      ),
    };
  });
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 !== 0) return ordenados[meio] ?? 0;
  return ((ordenados[meio - 1] ?? 0) + (ordenados[meio] ?? 0)) / 2;
}

function calcularProjecao(meta: number, ticket: number, cestasVendidas: number): ProjecaoMeta | null {
  if (meta <= 0 || ticket <= 0) return null;
  const cestasNecessarias = Math.ceil(meta / ticket);
  return { cestasNecessarias, faltam: Math.max(0, cestasNecessarias - cestasVendidas) };
}

export function calcularRelatorioMensal(
  vendasMes: VendaMetrica[],
  atendimentosMes: number,
  metaMensal: number,
): RelatorioMensal {
  // Duas contagens diferentes, que antes eram a mesma e por isso apareciam
  // iguais em dois cards do dashboard:
  //  - vendas_realizadas = quantas transações houve (denominador do ticket médio)
  //  - produtos_vendidos = quantos itens saíram (2 cestas numa venda = 2)
  const vendas_realizadas = vendasMes.length;
  const produtos_vendidos = vendasMes.reduce(
    (sum, v) => sum + (v.venda_itens?.reduce((s, item) => s + item.quantidade, 0) || 0),
    0,
  );
  const faturamento_mes = vendasMes.reduce((sum, v) => sum + v.faturamento_total, 0);
  const ticket_medio_mes = vendas_realizadas > 0 ? faturamento_mes / vendas_realizadas : 0;
  const pa_mes = atendimentosMes > 0 ? produtos_vendidos / atendimentosMes : 0;
  const conversao_mes = atendimentosMes > 0 ? (vendas_realizadas / atendimentosMes) * 100 : 0;
  const falta_para_meta = Math.max(0, metaMensal - faturamento_mes);
  const percentual_meta = metaMensal > 0 ? (faturamento_mes / metaMensal) * 100 : 0;

  const valores = vendasMes.map((v) => v.faturamento_total);
  const faixas = calcularFaixasValor(valores, faturamento_mes);
  const faixaAlta = faixas.find((f) => f.tipo === 'alta') ?? faixas.find((f) => f.tipo === 'unica');

  const insights: string[] = [];
  if (vendas_realizadas > 0 && faixaAlta) {
    insights.push(
      `As vendas da faixa mais alta (${brl(faixaAlta.min)} a ${brl(faixaAlta.max)}) foram responsáveis por ${faixaAlta.percentualFaturamento.toFixed(0)}% do faturamento do mês.`,
    );
    if (faixaAlta.percentualVendas < faixaAlta.percentualFaturamento) {
      insights.push(
        `Mesmo sendo apenas ${faixaAlta.percentualVendas.toFixed(0)}% das vendas, foram elas que puxaram o ticket médio pra cima.`,
      );
    }
    const maiorVenda = Math.max(...valores);
    if (maiorVenda > 0 && faturamento_mes > 0) {
      const pctMaiorVenda = (maiorVenda / faturamento_mes) * 100;
      insights.push(
        `Uma única venda de ${brl(maiorVenda)} representou ${pctMaiorVenda.toFixed(0)}% do faturamento total.`,
      );
    }
    // Sem atendimento registrado a conversão não é 0% — é incalculável.
    if (atendimentosMes > 0) {
      insights.push(`Sua conversão geral foi de ${conversao_mes.toFixed(1)}%.`);
    } else {
      insights.push(
        'Registre seus atendimentos do mês pra descobrir sua taxa de conversão (quantas pessoas abordadas viram venda).',
      );
    }
  }

  const projecao_ticket_atual = calcularProjecao(metaMensal, ticket_medio_mes, vendas_realizadas);

  let projecao_ticket_referencia: RelatorioMensal['projecao_ticket_referencia'] = null;
  const faixaAltaReal = faixas.find((f) => f.tipo === 'alta');
  if (faixaAltaReal) {
    const valoresFaixaAlta = [...valores].sort((a, b) => a - b).slice(-faixaAltaReal.quantidade);
    const valorReferencia = mediana(valoresFaixaAlta);
    const projecao = calcularProjecao(metaMensal, valorReferencia, vendas_realizadas);
    if (projecao) {
      projecao_ticket_referencia = { ...projecao, valorReferencia };
    }
  }

  return {
    faturamento_mes: parseFloat(faturamento_mes.toFixed(2)),
    vendas_realizadas,
    produtos_vendidos,
    ticket_medio_mes: parseFloat(ticket_medio_mes.toFixed(2)),
    atendimentos_mes: atendimentosMes,
    conversao_mes: parseFloat(conversao_mes.toFixed(2)),
    pa_mes: parseFloat(pa_mes.toFixed(2)),
    meta_mensal: metaMensal,
    falta_para_meta: parseFloat(falta_para_meta.toFixed(2)),
    percentual_meta: parseFloat(percentual_meta.toFixed(2)),
    faixas,
    insights,
    projecao_ticket_atual,
    projecao_ticket_referencia,
  };
}
