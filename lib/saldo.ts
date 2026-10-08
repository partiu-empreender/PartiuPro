/**
 * Saldo em caixa: quanto a aluna tem em conta no fim de cada mês.
 *
 * Pedido das alunas (out/2026): "comecei a alimentar o app em agosto e já
 * tinha um saldo em conta. Se tivesse como informar esse saldo, as contas iam
 * fechar". O DRE responde quanto o negócio LUCROU; isto responde quanto
 * DINHEIRO ela tem — perguntas diferentes, e o DRE sozinho nunca bate com o
 * extrato porque não sabe de onde ela partiu.
 *
 * COMO FUNCIONA
 *
 * Ela informa o saldo do INÍCIO de um mês (a "âncora"). Dali em diante o
 * sistema anda sozinho:
 *
 *   saldo inicial do mês
 * + entradas   vendas PAGAS do mês
 * − saídas     despesas registradas + frete das vendas
 * = saldo final, que vira o saldo inicial do mês seguinte
 *
 * Pode haver mais de uma âncora. Informar o saldo de um mês posterior
 * "recalibra" a conta dali em diante — é como a aluna corrige a diferença
 * quando confere o extrato e o número não bate (uma despesa esquecida, um
 * dinheiro pessoal que entrou). Os meses anteriores continuam como estavam.
 *
 * POR QUE SÓ VENDA PAGA
 *
 * Venda "a receber" é dinheiro que ainda não está na conta. Somá-la faria o
 * saldo mostrar um valor que ela não tem — o contrário do que foi pedido
 * ("ficar real com o valor que tem em conta"). A limitação conhecida: não se
 * guarda a DATA do recebimento, então quando a venda é marcada como paga ela
 * entra no mês da venda, e não no mês em que o dinheiro chegou.
 *
 * Lógica pura, sem banco: a rota busca, esta função conta.
 */

export interface Mes {
  ano: number;
  mes: number;
}

export interface Ancora extends Mes {
  valor: number;
}

export interface EntradaDeCaixa {
  data: string;
  valor: number;
}

export interface SaldoDoMes {
  /** Saldo no primeiro dia do mês. */
  saldoInicial: number;
  /** 'informado' = ela digitou para este mês; 'calculado' = veio de uma âncora anterior. */
  origem: 'informado' | 'calculado';
  /** De qual mês veio o saldo que serviu de ponto de partida. */
  ancora: Mes;
  entradas: number;
  saidas: number;
  saldoFinal: number;
}

/** Chave ordenável de um mês: 2026-08 vira 202608. */
export function chaveDoMes({ ano, mes }: Mes): number {
  return ano * 100 + mes;
}

/** Prefixo 'AAAA-MM' que as datas daquele mês têm. */
function prefixoDoMes({ ano, mes }: Mes): string {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

/**
 * A âncora que vale para o mês pedido: a mais recente que não passa dele.
 * Null quando ela nunca informou saldo até ali — e aí não há saldo a mostrar,
 * só o convite para informar.
 */
export function ancoraVigente(ancoras: Ancora[], alvo: Mes): Ancora | null {
  let melhor: Ancora | null = null;
  for (const a of ancoras) {
    if (chaveDoMes(a) > chaveDoMes(alvo)) continue;
    if (!melhor || chaveDoMes(a) > chaveDoMes(melhor)) melhor = a;
  }
  return melhor;
}

function emCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function somaDoMes(movimentos: EntradaDeCaixa[], mes: Mes): number {
  const prefixo = prefixoDoMes(mes);
  return movimentos
    .filter((m) => (m.data || '').startsWith(prefixo))
    .reduce((soma, m) => soma + (Number(m.valor) || 0), 0);
}

/**
 * O saldo do mês pedido.
 *
 * `entradas` e `saidas` precisam cobrir do início do mês da âncora até o fim
 * do mês pedido; o que vier antes da âncora é ignorado, porque o saldo
 * informado já o contém.
 */
export function calcularSaldoDoMes(
  ancoras: Ancora[],
  entradas: EntradaDeCaixa[],
  saidas: EntradaDeCaixa[],
  alvo: Mes,
): SaldoDoMes | null {
  const ancora = ancoraVigente(ancoras, alvo);
  if (!ancora) return null;

  // Anda mês a mês da âncora até o alvo. Poucos meses, então a clareza de
  // repetir a mesma conta de cada mês vale mais que qualquer atalho.
  let saldo = Number(ancora.valor) || 0;
  let atual: Mes = { ano: ancora.ano, mes: ancora.mes };
  while (chaveDoMes(atual) < chaveDoMes(alvo)) {
    saldo += somaDoMes(entradas, atual) - somaDoMes(saidas, atual);
    atual = atual.mes === 12 ? { ano: atual.ano + 1, mes: 1 } : { ano: atual.ano, mes: atual.mes + 1 };
  }

  const entradasDoMes = emCentavos(somaDoMes(entradas, alvo));
  const saidasDoMes = emCentavos(somaDoMes(saidas, alvo));
  const saldoInicial = emCentavos(saldo);

  return {
    saldoInicial,
    origem: chaveDoMes(ancora) === chaveDoMes(alvo) ? 'informado' : 'calculado',
    ancora: { ano: ancora.ano, mes: ancora.mes },
    entradas: entradasDoMes,
    saidas: saidasDoMes,
    saldoFinal: emCentavos(saldoInicial + entradasDoMes - saidasDoMes),
  };
}
