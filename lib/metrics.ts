// Cálculo de métricas de vendas — compartilhado entre o dashboard da
// própria aluna (app/api/vendas/route.ts) e o detalhe por aluna do painel
// admin (app/api/admin/alunas/[id]/route.ts). PA e Conversão usam
// "atendimentos" (pessoas abordadas, mesmo sem compra) como denominador,
// não o número de vendas.

export type TipoItem = 'produto' | 'adicional';

// Só `quantidade` é obrigatória: o painel admin consulta menos colunas que o
// dashboard da aluna, e o ranking simplesmente não aparece quando os dados
// extras não vêm.
interface VendaItemMetrica {
  quantidade: number;
  produto_id?: string | null;
  produto_nome?: string;
  subtotal?: number;
  preco_unitario?: number;
  tipo?: TipoItem;
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

/**
 * As faixas de preço do catálogo.
 *
 * São FIXAS de propósito, e essa é a correção principal aqui. Antes as faixas
 * eram tercis — a lista era ordenada e cortada em três partes iguais —, então
 * as fronteiras mudavam todo mês: em setembro o corte ficava em R$ 180, em
 * outubro em R$ 310. A Tania não conseguia comparar um mês com o outro nem
 * dizer a frase que ela queria dizer, que é "a maior parte das minhas vendas
 * está abaixo de R$ 200".
 *
 * Com fronteira fixa a pergunta passa a ser respondível: a faixa 100–200 é a
 * mesma em janeiro e em dezembro, e a resposta vira decisão de catálogo
 * ("preciso de mais produto acima de R$ 300").
 *
 * `max: null` na última = "daqui pra cima".
 */
export const FAIXAS_DE_PRECO: { min: number; max: number | null }[] = [
  { min: 0, max: 100 },
  { min: 100, max: 200 },
  { min: 200, max: 300 },
  { min: 300, max: 500 },
  { min: 500, max: null },
];

export interface FaixaValor {
  min: number;
  /** null na última faixa: "acima de X". */
  max: number | null;
  rotulo: string;
  /** Quantos ITENS foram vendidos nesta faixa (2 cestas contam 2). */
  quantidade: number;
  /** % dos itens vendidos no mês. */
  percentualVendas: number;
  faturamento: number;
  percentualFaturamento: number;
}

export interface ProjecaoMeta {
  cestasNecessarias: number;
  faltam: number;
}

export interface ItemRanking {
  posicao: number;
  nome: string;
  quantidade: number;
  faturamento: number;
  /** % do faturamento de itens do mês (produtos + adicionais, sem frete). */
  percentualFaturamento: number;
  /** % dentro da própria categoria — é sobre isto que a curva ABC é calculada. */
  percentualNaCategoria: number;
  /** % acumulado na categoria, descendo o ranking. Define a classe ABC. */
  percentualAcumulado: number;
  classe: 'A' | 'B' | 'C';
}

export interface ResumoCategoria {
  tipo: TipoItem;
  itens: ItemRanking[];
  quantidade: number;
  faturamento: number;
  /** Peso da categoria no faturamento de itens do mês. */
  percentualFaturamento: number;
}

// Curva ABC clássica, aplicada ao faturamento do mês:
//   A = itens que somam os primeiros 80% do faturamento (o que sustenta o negócio)
//   B = os seguintes, até 95%
//   C = a cauda
//
// O parâmetro é o acumulado ANTES deste item, de propósito: assim o item que
// atravessa a linha dos 80% ainda entra em A. Usando o acumulado depois, um
// único produto que sozinho fizesse 90% do faturamento cairia em B, e o grupo
// A ficaria vazio.
function classificarABC(percentualAcumuladoAntes: number): 'A' | 'B' | 'C' {
  if (percentualAcumuladoAntes < 80) return 'A';
  if (percentualAcumuladoAntes < 95) return 'B';
  return 'C';
}

function faturamentoDoItem(item: VendaItemMetrica): number {
  if (typeof item.subtotal === 'number') return item.subtotal;
  if (typeof item.preco_unitario === 'number') return item.preco_unitario * item.quantidade;
  return 0;
}

/**
 * Agrupa os itens vendidos por produto e ordena por faturamento.
 *
 * A chave de agrupamento é o produto_id quando existe, com o nome como
 * reserva pros itens avulsos (digitados na hora, fora do catálogo). Assim,
 * renomear um produto cadastrado não parte o histórico dele em dois.
 */
function montarRanking(
  itens: VendaItemMetrica[],
  faturamentoTotalItens: number,
  faturamentoDaCategoria: number,
): ItemRanking[] {
  const grupos = new Map<string, { nome: string; quantidade: number; faturamento: number }>();

  for (const item of itens) {
    const nome = (item.produto_nome || '').trim() || 'Sem nome';
    const chave = item.produto_id || `nome:${nome.toLowerCase()}`;
    const atual = grupos.get(chave);
    if (atual) {
      atual.quantidade += item.quantidade;
      atual.faturamento += faturamentoDoItem(item);
      atual.nome = nome; // o nome mais recente vence, se o produto foi renomeado
    } else {
      grupos.set(chave, { nome, quantidade: item.quantidade, faturamento: faturamentoDoItem(item) });
    }
  }

  const ordenados = [...grupos.values()].sort(
    (a, b) => b.faturamento - a.faturamento || b.quantidade - a.quantidade,
  );

  let acumuladoNaCategoria = 0;
  return ordenados.map((grupo, i) => {
    // Dois denominadores, de propósito. O percentual exibido é sobre o mês
    // inteiro, que é a leitura que a aluna quer ("quanto isso representa do
    // que eu faturei"). Já a curva ABC roda sobre a própria categoria: como o
    // ranking é apresentado separado, classificar adicionais contra o total
    // rotularia todos como C só por serem uma fatia pequena do negócio.
    const percentualGlobal =
      faturamentoTotalItens > 0 ? (grupo.faturamento / faturamentoTotalItens) * 100 : 0;
    const percentualCategoria =
      faturamentoDaCategoria > 0 ? (grupo.faturamento / faturamentoDaCategoria) * 100 : 0;
    const acumuladoAntes = acumuladoNaCategoria;
    acumuladoNaCategoria += percentualCategoria;

    return {
      posicao: i + 1,
      nome: grupo.nome,
      quantidade: grupo.quantidade,
      faturamento: parseFloat(grupo.faturamento.toFixed(2)),
      percentualFaturamento: parseFloat(percentualGlobal.toFixed(1)),
      percentualNaCategoria: parseFloat(percentualCategoria.toFixed(1)),
      percentualAcumulado: parseFloat(Math.min(100, acumuladoNaCategoria).toFixed(1)),
      classe: classificarABC(acumuladoAntes),
    };
  });
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
  /**
   * Faturamento somando só os itens vendidos. Difere de `faturamento_mes`
   * porque este último inclui o frete, que não pertence a nenhum produto.
   * É a base dos percentuais do ranking — usar o outro faria os percentuais
   * não fecharem em 100%.
   */
  faturamento_itens: number;
  ranking_produtos: ResumoCategoria;
  ranking_adicionais: ResumoCategoria;
}

function rotuloDaFaixa(min: number, max: number | null): string {
  if (max === null) return `Acima de ${brl(min)}`;
  if (min === 0) return `Até ${brl(max)}`;
  return `${brl(min)} a ${brl(max)}`;
}

/**
 * Distribuição das vendas por faixa de PREÇO DO PRODUTO.
 *
 * A pergunta que a Tania faz é sobre o catálogo — "em que faixa de preço meus
 * produtos estão concentrando a venda?" — e a resposta anterior não respondia
 * isso, por dois motivos:
 *
 *  1. Classificava pela VENDA inteira (`faturamento_total`), que soma vários
 *     produtos e ainda inclui o frete. Três cestas de R$ 150 numa venda só
 *     entravam como uma venda de R$ 450, na faixa alta — quando o catálogo
 *     dela é de R$ 150. O número dizia o contrário do que ela precisava ler.
 *  2. Cortava em tercis, então a fronteira mudava todo mês (ver FAIXAS_DE_PRECO).
 *
 * Agora a unidade é o item: classifica pelo `preco_unitario` (o preço do
 * produto) e pesa pela `quantidade`. Duas cestas de R$ 150 contam 2 na faixa
 * 100–200, que é como ela conta de cabeça.
 *
 * Só entram itens do tipo 'produto'. Adicional tem ranking próprio e
 * distorceria a faixa baixa: um cartão de R$ 15 não é "venda abaixo de R$ 200",
 * é complemento de uma venda que já foi contada.
 */
function calcularFaixasValor(itens: VendaItemMetrica[]): FaixaValor[] {
  const produtos = itens.filter((item) => (item.tipo ?? 'produto') === 'produto');
  if (produtos.length === 0) return [];

  const precoDoItem = (item: VendaItemMetrica): number => {
    if (typeof item.preco_unitario === 'number') return item.preco_unitario;
    // Sem preço unitário, deduz do subtotal — vale pro histórico antigo e pro
    // painel admin, que consulta menos colunas.
    if (typeof item.subtotal === 'number' && item.quantidade > 0) {
      return item.subtotal / item.quantidade;
    }
    return 0;
  };

  const totalItens = produtos.reduce((s, i) => s + i.quantidade, 0);
  const totalFaturado = produtos.reduce((s, i) => s + faturamentoDoItem(i), 0);

  return FAIXAS_DE_PRECO.map(({ min, max }) => {
    // Intervalo fechado embaixo e aberto em cima: um produto de exatamente
    // R$ 200 é "de 200 a 300", e não cai nas duas faixas nem em nenhuma.
    const daFaixa = produtos.filter((item) => {
      const preco = precoDoItem(item);
      return preco >= min && (max === null || preco < max);
    });

    const quantidade = daFaixa.reduce((s, i) => s + i.quantidade, 0);
    const faturamento = daFaixa.reduce((s, i) => s + faturamentoDoItem(i), 0);

    return {
      min,
      max,
      rotulo: rotuloDaFaixa(min, max),
      quantidade,
      percentualVendas: parseFloat(
        (totalItens > 0 ? (quantidade / totalItens) * 100 : 0).toFixed(1),
      ),
      faturamento: parseFloat(faturamento.toFixed(2)),
      percentualFaturamento: parseFloat(
        (totalFaturado > 0 ? (faturamento / totalFaturado) * 100 : 0).toFixed(1),
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

  // ---- Ranking / curva ABC, por categoria ----
  const todosItens = vendasMes.flatMap((v) => v.venda_itens || []);
  const faturamento_itens = todosItens.reduce((sum, item) => sum + faturamentoDoItem(item), 0);

  const montarCategoria = (tipo: TipoItem): ResumoCategoria => {
    // Item sem tipo é anterior à migration 006, quando tudo era produto.
    const itensDaCategoria = todosItens.filter((item) => (item.tipo ?? 'produto') === tipo);
    const faturamentoCategoria = itensDaCategoria.reduce((s, i) => s + faturamentoDoItem(i), 0);
    return {
      tipo,
      itens: montarRanking(itensDaCategoria, faturamento_itens, faturamentoCategoria),
      quantidade: itensDaCategoria.reduce((s, i) => s + i.quantidade, 0),
      faturamento: parseFloat(faturamentoCategoria.toFixed(2)),
      percentualFaturamento: parseFloat(
        (faturamento_itens > 0 ? (faturamentoCategoria / faturamento_itens) * 100 : 0).toFixed(1),
      ),
    };
  };

  const ranking_produtos = montarCategoria('produto');
  const ranking_adicionais = montarCategoria('adicional');

  const valores = vendasMes.map((v) => v.faturamento_total);
  const faixas = calcularFaixasValor(todosItens);
  // A faixa mais cara que teve venda — é ela que mostra até onde o catálogo
  // dela chega hoje, e serve de referência pra projeção lá embaixo.
  const faixaAlta = [...faixas].reverse().find((f) => f.quantidade > 0);
  const faixasComVenda = faixas.filter((f) => f.quantidade > 0);

  const insights: string[] = [];
  if (vendas_realizadas > 0 && faixaAlta) {
    // O insight que a Tania pediu: onde o volume se concentra. É a leitura
    // de catálogo ("preciso trabalhar as faixas de cima"), não de transação.
    const faixaCampea = [...faixasComVenda].sort((a, b) => b.quantidade - a.quantidade)[0];
    if (faixaCampea) {
      insights.push(
        `${faixaCampea.percentualVendas.toFixed(0)}% dos produtos que você vendeu este mês estão na faixa "${faixaCampea.rotulo.toLowerCase()}" — é onde seu catálogo mais gira.`,
      );
    }

    insights.push(
      `Os produtos da faixa mais alta com venda (${faixaAlta.rotulo.toLowerCase()}) responderam por ${faixaAlta.percentualFaturamento.toFixed(0)}% do faturamento em produtos.`,
    );
    if (faixaAlta.percentualVendas < faixaAlta.percentualFaturamento) {
      insights.push(
        `Mesmo sendo só ${faixaAlta.percentualVendas.toFixed(0)}% dos produtos vendidos, são eles que puxam seu ticket médio pra cima.`,
      );
    }

    // Faixa sem nenhuma venda é espaço de catálogo vazio — a decisão que ela
    // disse querer tomar com esse relatório.
    const vazias = faixas.filter((f) => f.quantidade === 0 && f.min < (faixaAlta.max ?? Infinity));
    if (vazias.length > 0) {
      insights.push(
        `Você não vendeu nada na faixa ${vazias.map((f) => f.rotulo.toLowerCase()).join(' nem ')}. Vale olhar se falta produto nesse preço ou se falta oferecer.`,
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

    const campeao = ranking_produtos.itens[0];
    if (campeao) {
      insights.push(
        `Seu produto mais forte foi ${campeao.nome}: ${campeao.quantidade} vendido(s), ${brl(campeao.faturamento)} — ${campeao.percentualFaturamento.toFixed(0)}% do faturamento.`,
      );
    }

    const classeA = ranking_produtos.itens.filter((i) => i.classe === 'A').length;
    if (classeA > 0 && ranking_produtos.itens.length > classeA) {
      insights.push(
        `${classeA} de ${ranking_produtos.itens.length} produtos respondem pela maior parte do que você fatura. São eles que merecem seu estoque e sua divulgação.`,
      );
    }

    // O ponto que a Tania levanta: adicional é margem que costuma ficar na mesa.
    if (ranking_adicionais.itens.length === 0) {
      insights.push(
        'Você não registrou nenhum adicional este mês. Buquê, arranjo ou cartão vendidos junto da cesta aumentam o ticket sem exigir um cliente novo.',
      );
    } else if (ranking_adicionais.percentualFaturamento < 10) {
      insights.push(
        `Os adicionais foram só ${ranking_adicionais.percentualFaturamento.toFixed(0)}% do seu faturamento (${brl(ranking_adicionais.faturamento)}). Oferecer um adicional em cada venda é o jeito mais barato de subir o ticket médio.`,
      );
    } else {
      insights.push(
        `Os adicionais trouxeram ${brl(ranking_adicionais.faturamento)}, ${ranking_adicionais.percentualFaturamento.toFixed(0)}% do faturamento. Está funcionando — vale insistir nisso.`,
      );
    }
  }

  const projecao_ticket_atual = calcularProjecao(metaMensal, ticket_medio_mes, vendas_realizadas);

  // Projeção "e se eu vendesse mais do caro?": usa como referência a mediana
  // das VENDAS que ficaram acima do ticket médio. Antes saía da faixa de
  // valor, mas agora a faixa fala de preço de produto e a projeção fala de
  // quantas vendas faltam — misturar as duas responderia à pergunta errada.
  let projecao_ticket_referencia: RelatorioMensal['projecao_ticket_referencia'] = null;
  const vendasAcimaDaMedia = valores.filter((v) => v > ticket_medio_mes);
  if (vendasAcimaDaMedia.length > 0) {
    const valorReferencia = mediana(vendasAcimaDaMedia);
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
    faturamento_itens: parseFloat(faturamento_itens.toFixed(2)),
    ranking_produtos,
    ranking_adicionais,
  };
}
