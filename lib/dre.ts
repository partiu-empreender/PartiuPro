/**
 * DRE — o resultado do mês.
 *
 * A estrutura é a clássica, e cada linha responde uma pergunta diferente que a
 * aluna faz de verdade:
 *
 *   Faturamento          quanto entrou
 * − Custo dos produtos   quanto custou o que eu vendi
 * = Lucro bruto          quanto sobra de cada venda
 * − Despesas             quanto o negócio custa existindo
 * = Lucro líquido        quanto de fato sobrou
 *
 * POR QUE CUSTO DO PRODUTO E DESPESA SÃO LINHAS SEPARADAS
 *
 * Juntar as duas daria o mesmo lucro líquido e destruiria a informação mais
 * acionável: se o lucro bruto é bom e o líquido é ruim, o problema é despesa
 * fixa; se o próprio bruto é ruim, o problema é preço ou custo do produto. São
 * duas conversas completamente diferentes, e a segunda linha é a que diz qual
 * delas ter.
 *
 * O CUIDADO COM O FRETE: `faturamento_total` guarda itens + frete, mas o frete
 * não é lucro — é dinheiro que passa pela mão da aluna e vai para quem entrega.
 * Ele sai do faturamento e entra como despesa, senão o lucro bruto apareceria
 * inflado em toda venda com entrega.
 */

export interface ItemComCusto {
  quantidade: number;
  /** Custo unitário vindo do catálogo. Ausente = produto avulso, sem custo cadastrado. */
  custo_unitario?: number | null;
}

export interface VendaParaDRE {
  faturamento_total: number;
  shipping_cost?: number | null;
  venda_itens?: ItemComCusto[] | null;
}

export interface SaidaParaDRE {
  valor: number;
  categoria: string;
}

export interface LinhaDeCategoria {
  categoria: string;
  valor: number;
  /** Fatia sobre o total de despesas, 0 a 100. */
  percentual: number;
}

export interface DRE {
  faturamento: number;
  custoDosProdutos: number;
  lucroBruto: number;
  /** 0 a 100. Quanto sobra de cada real vendido, antes das despesas. */
  margemBruta: number;
  frete: number;
  despesas: number;
  totalDeSaidas: number;
  lucroLiquido: number;
  margemLiquida: number;
  porCategoria: LinhaDeCategoria[];
}

function emCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function calcularDRE(vendas: VendaParaDRE[], saidas: SaidaParaDRE[]): DRE {
  let faturamentoComFrete = 0;
  let frete = 0;
  let custoDosProdutos = 0;

  for (const venda of vendas) {
    faturamentoComFrete += Number(venda.faturamento_total) || 0;
    frete += Number(venda.shipping_cost) || 0;

    for (const item of venda.venda_itens || []) {
      // Produto sem custo cadastrado entra como zero, e não como estimativa:
      // chutar um custo faria o lucro parecer conhecido quando não é. A tela
      // avisa quantos itens estão nessa situação.
      custoDosProdutos += (Number(item.quantidade) || 0) * (Number(item.custo_unitario) || 0);
    }
  }

  // O frete sai do faturamento: ele não é receita da aluna, é repasse.
  const faturamento = emCentavos(faturamentoComFrete - frete);
  custoDosProdutos = emCentavos(custoDosProdutos);

  const lucroBruto = emCentavos(faturamento - custoDosProdutos);

  const despesas = emCentavos(saidas.reduce((soma, s) => soma + (Number(s.valor) || 0), 0));

  // O frete entra aqui: é saída de caixa real, mesmo não estando na tabela de
  // despesas. Sem isso o DRE mostraria lucro que não existe.
  const totalDeSaidas = emCentavos(despesas + frete);
  const lucroLiquido = emCentavos(lucroBruto - totalDeSaidas);

  const porCategoriaMapa = new Map<string, number>();
  for (const saida of saidas) {
    const categoria = saida.categoria?.trim() || 'Outros';
    porCategoriaMapa.set(categoria, (porCategoriaMapa.get(categoria) ?? 0) + (Number(saida.valor) || 0));
  }
  if (frete > 0) {
    porCategoriaMapa.set('Frete', (porCategoriaMapa.get('Frete') ?? 0) + frete);
  }

  const porCategoria: LinhaDeCategoria[] = [...porCategoriaMapa.entries()]
    .map(([categoria, valor]) => ({
      categoria,
      valor: emCentavos(valor),
      percentual: totalDeSaidas > 0 ? emCentavos((valor / totalDeSaidas) * 100) : 0,
    }))
    .sort((a, b) => b.valor - a.valor);

  return {
    faturamento,
    custoDosProdutos,
    lucroBruto,
    // Divisões protegidas: sem faturamento a margem é 0, e não NaN nem
    // Infinity — que apareceriam na tela como "NaN%".
    margemBruta: faturamento > 0 ? emCentavos((lucroBruto / faturamento) * 100) : 0,
    frete,
    despesas,
    totalDeSaidas,
    lucroLiquido,
    margemLiquida: faturamento > 0 ? emCentavos((lucroLiquido / faturamento) * 100) : 0,
    porCategoria,
  };
}
