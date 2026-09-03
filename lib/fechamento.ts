// Fechamento mensal: o mês encerrado preenchido à mão.
//
// Este arquivo é o ÚNICO lugar que decide, pra um mês qualquer, se o número
// que a tela mostra vem das vendas lançadas ou do que a aluna digitou. A regra
// está escrita uma vez só porque três telas fazem a mesma pergunta (o
// dashboard, o histórico e a de metas), e três cópias divergiriam — foi
// exatamente o que `motivoDataDeVendaInvalida` (lib/datas.ts) resolveu pro
// caso da data de venda.
//
// A regra, em duas frases:
//   1. Mês corrente e futuro: sempre as vendas. Fechamento manual nem existe.
//   2. Mês encerrado: o manual vence quando existe, e a tela avisa se as
//      vendas daquele mês somam outra coisa.

import { partesHojeBrasil } from './datas';

/** O que a aluna digita. Todo campo é opcional: NULL = "não sei". */
export interface FechamentoManual {
  mes: number;
  ano: number;
  faturamento: number | null;
  vendas: number | null;
  produtos_vendidos: number | null;
  atendimentos: number | null;
  /** Só quando ela sabe o ticket mas não o nº de vendas. */
  ticket_medio: number | null;
  /** Só quando ela sabe a conversão mas não os atendimentos. */
  conversao: number | null;
  observacao: string | null;
  updated_at?: string | null;
}

/** O que sai das vendas e atendimentos realmente lançados no mês. */
export interface ApuradoDasVendas {
  faturamento: number;
  vendas: number;
  produtos_vendidos: number;
  atendimentos: number;
}

export type FonteDoMes = 'manual' | 'vendas' | 'vazio';

export interface NumerosDoMes {
  mes: number;
  ano: number;
  /** De onde saiu cada número abaixo. */
  fonte: FonteDoMes;
  faturamento: number;
  vendas: number;
  produtos_vendidos: number;
  atendimentos: number;
  /** null = incalculável (sem vendas), e não zero. */
  ticket_medio: number | null;
  /** null = incalculável (sem atendimentos registrados), e não 0%. */
  conversao: number | null;
  /** Produtos por atendimento. null = incalculável. */
  pa: number | null;
  /**
   * Preenchido só quando há fechamento manual E vendas lançadas no mesmo mês
   * somando outro valor. É o aviso que impede o número digitado de esconder
   * dado real em silêncio.
   */
  divergencia: {
    faturamentoManual: number;
    faturamentoDasVendas: number;
    vendasLancadas: number;
  } | null;
  /** true quando o mês ainda não encerrou — a tela não oferece edição manual. */
  ehMesCorrenteOuFuturo: boolean;
}

/**
 * O mês já encerrou?
 *
 * Usa o fuso do Brasil pelo mesmo motivo que o resto do sistema: no dia 1º de
 * manhã, `new Date().getMonth()` num navegador a leste ainda devolve o mês
 * anterior — e o mês que acabou de virar apareceria como editável à mão.
 */
export function mesJaEncerrado(mes: number, ano: number, hoje = partesHojeBrasil()): boolean {
  if (ano < hoje.ano) return true;
  if (ano > hoje.ano) return false;
  return mes < hoje.mes;
}

/** Divisão que devolve null em vez de 0 quando o denominador não existe. */
function dividir(numerador: number, denominador: number): number | null {
  if (!denominador) return null;
  return numerador / denominador;
}

const duasCasas = (n: number | null): number | null =>
  n === null ? null : parseFloat(n.toFixed(2));

/**
 * Resolve os números de UM mês, escolhendo a fonte.
 *
 * `manual` pode vir preenchido mesmo pro mês corrente (um fechamento gravado
 * antes de o mês virar, por exemplo) — e é ignorado nesse caso, porque a regra
 * de que o mês em curso é sempre calculado não depende do que está no banco.
 */
export function resolverNumerosDoMes(
  mes: number,
  ano: number,
  apurado: ApuradoDasVendas,
  manual: FechamentoManual | null,
  hoje = partesHojeBrasil(),
): NumerosDoMes {
  const encerrado = mesJaEncerrado(mes, ano, hoje);
  const usaManual = encerrado && manual !== null && temAlgumValor(manual);

  const base = { mes, ano, ehMesCorrenteOuFuturo: !encerrado };

  if (!usaManual) {
    const semVendas = apurado.vendas === 0 && apurado.faturamento === 0;
    return {
      ...base,
      fonte: semVendas && apurado.atendimentos === 0 ? 'vazio' : 'vendas',
      faturamento: apurado.faturamento,
      vendas: apurado.vendas,
      produtos_vendidos: apurado.produtos_vendidos,
      atendimentos: apurado.atendimentos,
      ticket_medio: duasCasas(dividir(apurado.faturamento, apurado.vendas)),
      conversao: duasCasas(
        dividir(apurado.vendas * 100, apurado.atendimentos),
      ),
      pa: duasCasas(dividir(apurado.produtos_vendidos, apurado.atendimentos)),
      divergencia: null,
    };
  }

  // A partir daqui: mês encerrado, com fechamento manual. O manual vence.
  const m = manual as FechamentoManual;
  const faturamento = m.faturamento ?? 0;
  const vendas = m.vendas ?? 0;
  const produtos = m.produtos_vendidos ?? 0;
  const atendimentos = m.atendimentos ?? 0;

  // Os dois derivados: o valor digitado vence quando existe; senão, calcula.
  // É o caso de quem anotou "ticket médio 620" sem saber o nº de vendas — por
  // divisão ela nunca chegaria lá.
  const ticket = m.ticket_medio ?? dividir(faturamento, vendas);
  const conversao = m.conversao ?? dividir(vendas * 100, atendimentos);

  // Divergência: só interessa quando há venda lançada de verdade no mês. Sem
  // vendas não há nada sendo escondido, e o aviso só faria barulho.
  const haVendasLancadas = apurado.vendas > 0 || apurado.faturamento > 0;
  const divergeNoValor = Math.abs(apurado.faturamento - faturamento) >= 0.01;

  return {
    ...base,
    fonte: 'manual',
    faturamento,
    vendas,
    produtos_vendidos: produtos,
    atendimentos,
    ticket_medio: duasCasas(ticket),
    conversao: duasCasas(conversao),
    pa: duasCasas(dividir(produtos, atendimentos)),
    divergencia:
      haVendasLancadas && divergeNoValor
        ? {
            faturamentoManual: faturamento,
            faturamentoDasVendas: parseFloat(apurado.faturamento.toFixed(2)),
            vendasLancadas: apurado.vendas,
          }
        : null,
  };
}

/**
 * Um fechamento com todos os campos vazios não é fechamento — é uma linha que
 * sobrou de quando ela abriu o formulário e salvou sem digitar nada. Tratá-lo
 * como preenchido zeraria o mês na tela, escondendo as vendas reais atrás de
 * "R$ 0,00 (preenchido à mão)".
 */
export function temAlgumValor(f: FechamentoManual): boolean {
  return (
    f.faturamento !== null ||
    f.vendas !== null ||
    f.produtos_vendidos !== null ||
    f.atendimentos !== null ||
    f.ticket_medio !== null ||
    f.conversao !== null
  );
}

/**
 * Valida o que veio do formulário. Devolve o motivo da recusa, ou null.
 *
 * Vive aqui pelo mesmo motivo de `motivoDataDeVendaInvalida`: a tela precisa
 * da MESMA resposta que a rota, senão o formulário aceita o que o servidor
 * recusa.
 */
export function motivoFechamentoInvalido(
  mes: number,
  ano: number,
  hoje = partesHojeBrasil(),
): string | null {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return 'Mês inválido.';
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return 'Ano inválido.';

  if (!mesJaEncerrado(mes, ano, hoje)) {
    // A frase diz o que fazer no lugar, porque a recusa aqui não é um erro
    // dela: o mês corrente já mostra tudo isso, calculado das vendas.
    return 'Só dá pra preencher à mão um mês que já encerrou. O mês atual é calculado automaticamente pelas vendas que você registra.';
  }

  return null;
}
