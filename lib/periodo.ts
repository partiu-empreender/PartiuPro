/**
 * Vendas do período: a aba que antes era "Vendas do Dia".
 *
 * Pedido das alunas (out/2026): listar as vendas de um intervalo qualquer —
 * uma semana, a quinzena da Páscoa, o mês — com a soma no fim e a cliente de
 * cada venda. Um dia só continua possível: é o período em que `de === ate`.
 *
 * A validação vive aqui, e não na rota, pelo mesmo motivo de
 * `motivoDataDeVendaInvalida`: a tela precisa da MESMA resposta para avisar
 * antes de pedir, senão o seletor aceita o que o servidor recusa.
 */

import { diasEntre, montarData, partesDaData, recorteDoMes, somarDias } from './datas';

/**
 * Até quantos dias um período pode ter.
 *
 * Um ano e pouco cobre "este ano" e "últimos 12 meses", que é o maior recorte
 * que alguém pede para LER venda por venda. Sem teto, um ano digitado errado
 * (2016 no lugar de 2026) viraria uma consulta de dez anos e uma lista que
 * ninguém rola.
 */
export const MAXIMO_DIAS_DO_PERIODO = 400;

const FORMATO_ISO = /^\d{4}-\d{2}-\d{2}$/;

function ehDataValida(iso: string): boolean {
  if (!FORMATO_ISO.test(iso || '')) return false;
  const { ano, mes, dia } = partesDaData(iso);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDate() === dia && mes >= 1 && mes <= 12;
}

/** Devolve o motivo da recusa, ou null quando o período serve. */
export function motivoPeriodoInvalido(de: string, ate: string): string | null {
  if (!ehDataValida(de) || !ehDataValida(ate)) return 'Período inválido.';
  if (de > ate) return 'A data inicial precisa vir antes da final.';
  if (diasEntre(de, ate) > MAXIMO_DIAS_DO_PERIODO) {
    return `Escolha um período de até ${MAXIMO_DIAS_DO_PERIODO} dias.`;
  }
  return null;
}

export interface Periodo {
  de: string;
  ate: string;
}

export interface AtalhoDePeriodo extends Periodo {
  rotulo: string;
}

/**
 * Os recortes que a aluna mais pede, prontos para um clique. Digitar duas
 * datas para ver "esta semana" é o tipo de atrito que faz o recurso não ser
 * usado.
 */
export function atalhosDePeriodo(hoje: string): AtalhoDePeriodo[] {
  const { ano, mes } = partesDaData(hoje);
  const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
  const mesPassado = recorteDoMes(anterior.ano, anterior.mes);

  const atalhos: AtalhoDePeriodo[] = [
    { rotulo: 'Hoje', de: hoje, ate: hoje },
    { rotulo: 'Ontem', de: somarDias(hoje, -1), ate: somarDias(hoje, -1) },
    { rotulo: 'Últimos 7 dias', de: somarDias(hoje, -6), ate: hoje },
    { rotulo: 'Este mês', de: montarData(ano, mes, 1), ate: hoje },
  ];
  if (mesPassado) {
    atalhos.push({ rotulo: 'Mês passado', de: mesPassado.inicio, ate: mesPassado.fim });
  }
  return atalhos;
}

export interface VendaDoPeriodo {
  faturamento_total: number;
  status: string;
}

export interface ResumoDoPeriodo {
  quantidade: number;
  total: number;
  ticketMedio: number;
  /** Parte do total que ainda não foi paga. */
  aReceber: number;
}

/**
 * A soma no fim da lista. Cancelada não entra — a rota já filtra na origem, e
 * a regra se repete aqui para quem tiver a lista em mãos por outro caminho.
 */
export function resumoDoPeriodo(vendas: VendaDoPeriodo[]): ResumoDoPeriodo {
  const valendo = vendas.filter((v) => v.status !== 'cancelada');
  const total = valendo.reduce((soma, v) => soma + (Number(v.faturamento_total) || 0), 0);
  const aReceber = valendo
    .filter((v) => v.status === 'pendente')
    .reduce((soma, v) => soma + (Number(v.faturamento_total) || 0), 0);
  const arredonda = (n: number) => Math.round(n * 100) / 100;

  return {
    quantidade: valendo.length,
    total: arredonda(total),
    ticketMedio: valendo.length > 0 ? arredonda(total / valendo.length) : 0,
    aReceber: arredonda(aReceber),
  };
}
