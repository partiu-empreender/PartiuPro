/**
 * Desconto na venda.
 *
 * Vive fora da rota porque mexe em dinheiro, e um erro aqui não levanta
 * exceção nenhuma: a venda simplesmente passa a valer outro número, e o
 * Raio-X repete o erro com ar de certeza.
 *
 * A REGRA QUE PARECE DETALHE E NÃO É: o desconto incide sobre os ITENS, não
 * sobre o frete. Quem entrega paga o mesmo ao entregador com ou sem promoção
 * — descontar o frete junto tiraria dinheiro do bolso da aluna sem ela pedir.
 */

/** Arredonda para centavos. Sem isto, 19.9 * 3 * 0.9 vira 53.730000000000004. */
function emCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * @param totalDosItens  Soma dos itens, SEM frete.
 * @param frete          Frete da venda.
 * @param percentual     0 a 100. Fora da faixa é tratado como 0 (sem desconto),
 *                       nunca como valor negativo — o CHECK do banco recusaria,
 *                       mas a tela não pode depender disso para não somar errado.
 */
export function calcularTotalComDesconto(
  totalDosItens: number,
  frete: number,
  percentual: number,
): number {
  const valido = Number.isFinite(percentual) && percentual > 0 && percentual <= 100;
  const desconto = valido ? emCentavos(totalDosItens * (percentual / 100)) : 0;
  return emCentavos(totalDosItens - desconto + frete);
}

/** Quanto se abriu mão, em reais. Para a aluna ver o custo da promoção. */
export function valorDoDesconto(totalDosItens: number, percentual: number): number {
  const valido = Number.isFinite(percentual) && percentual > 0 && percentual <= 100;
  return valido ? emCentavos(totalDosItens * (percentual / 100)) : 0;
}
