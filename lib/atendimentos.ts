/**
 * Quantas pessoas foram atendidas num dia.
 *
 * A pergunta parece trivial e não é, porque existem DUAS fontes desde a
 * migration 018:
 *
 *   - `atendimentos_diarios`: uma contagem digitada ("atendi 12 hoje")
 *   - `atendimentos_pessoas`: uma linha por pessoa, com nome e telefone
 *
 * Elas convivem de propósito: a contagem simples tem histórico — as alunas já
 * vinham registrando esse número, e a conversão dos meses passados depende
 * dele. Trocar uma pela outra deixaria esses registros órfãos.
 *
 * A REGRA: vale o MAIOR dos dois, nunca a soma.
 *
 * Quem digitou 12 e depois detalhou 3 pessoas atendeu 12 — as outras 9 ela só
 * não anotou nominalmente. Somar daria 15 e inflaria a conversão (vendas ÷
 * atendimentos), fazendo a aluna acreditar que converte pior do que converte.
 * Usar só o nominal apagaria 9 atendimentos que aconteceram.
 *
 * Este número alimenta a taxa de conversão e o PA. Errar aqui não quebra nada
 * visivelmente: só faz os dois indicadores mentirem com ar de precisão.
 */

export interface ContagemDoDia {
  data: string;
  /** O que foi digitado na contagem simples. */
  pessoas_atendidas: number;
}

export interface PessoaAtendida {
  data: string;
}

/** Total de atendimentos de um dia, considerando as duas fontes. */
export function atendimentosDoDia(
  data: string,
  contagens: ContagemDoDia[],
  pessoas: PessoaAtendida[],
): number {
  const digitado = contagens.find((c) => c.data === data)?.pessoas_atendidas ?? 0;
  const nominais = pessoas.filter((p) => p.data === data).length;
  return Math.max(digitado, nominais);
}

/**
 * O mesmo, para um período inteiro: soma dia a dia.
 *
 * Somar os totais de cada fonte e depois comparar daria outro número — e o
 * errado. Num mês em que ela digitou 12 no dia 1 e detalhou 3 pessoas no dia
 * 2, o certo é 12 + 3 = 15; comparar totais daria max(12, 3) = 12, perdendo o
 * dia 2 inteiro.
 */
export function atendimentosDoPeriodo(
  contagens: ContagemDoDia[],
  pessoas: PessoaAtendida[],
): number {
  const dias = new Set<string>([
    ...contagens.map((c) => c.data),
    ...pessoas.map((p) => p.data),
  ]);

  let total = 0;
  for (const dia of dias) {
    total += atendimentosDoDia(dia, contagens, pessoas);
  }
  return total;
}
