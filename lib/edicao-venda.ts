/**
 * A conta do valor de uma venda quando ela é EDITADA.
 *
 * Vive fora da rota porque é a regra que mexe em dinheiro, e dentro do route
 * handler nenhum teste a alcança.
 *
 * O detalhe que faz toda a diferença: a coluna `faturamento_total` guarda
 * ITENS + FRETE (é assim que o POST grava), enquanto `total_spent` da cliente
 * guarda só os itens. Quem edita pode mexer nos itens, no frete, ou só num
 * deles — e cada combinação tem que preservar a parte que não foi tocada.
 */

export interface ItemParaTotal {
  quantidade: number;
  preco_unitario: number;
}

export interface TotaisDaVenda {
  /** O que vai para `vendas_diarias.faturamento_total`: itens + frete. */
  faturamento_total: number;
  /** O que vai para `vendas_diarias.shipping_cost`. */
  shipping_cost: number;
}

/**
 * @param itensNovos  `null` quando a edição não mexeu nos itens.
 * @param freteNovo   `undefined` quando a edição não mexeu no frete.
 * @param totalAntigo `faturamento_total` como está gravado hoje (itens + frete).
 * @param freteAntigo `shipping_cost` como está gravado hoje.
 */
export function recalcularTotaisDaVenda(
  itensNovos: ItemParaTotal[] | null,
  freteNovo: number | undefined,
  totalAntigo: number,
  freteAntigo: number,
): TotaisDaVenda {
  const freteFinal = freteNovo !== undefined ? freteNovo : freteAntigo;

  // Sem itens novos, o valor dos itens é o que já estava lá — e ele só pode
  // ser obtido descontando o frete ANTIGO do total antigo. Usar o frete novo
  // aqui faria o valor dos itens mudar sozinho quando só o frete foi alterado.
  const totalDosItens =
    itensNovos !== null
      ? itensNovos.reduce((soma, i) => soma + i.quantidade * i.preco_unitario, 0)
      : totalAntigo - freteAntigo;

  return {
    faturamento_total: totalDosItens + freteFinal,
    shipping_cost: freteFinal,
  };
}
