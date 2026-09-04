/**
 * Pagamento e entrega de uma venda.
 *
 * Dois eixos independentes, não um. A cliente pode ter pago e ainda não
 * recebido, ou recebido e ficado devendo — as duas coisas são verdade ao mesmo
 * tempo e pedem ações opostas (uma vira cobrança, a outra vira entrega). Um
 * campo só obrigaria escolher qual das duas contar, e a outra se perderia.
 *
 * Vive em lib/ e não na rota porque a tela precisa das MESMAS regras pra
 * pintar o rótulo e decidir o que oferecer. Duas cópias divergiriam, e a aluna
 * veria a tela dizer uma coisa e o servidor recusar outra — mesmo motivo de
 * `motivoDataDeVendaInvalida` e `resolverNumerosDoMes`.
 */

export type Pagamento = 'pago' | 'pendente' | 'cancelada';
export type Entrega = 'pendente' | 'entregue' | 'nao_aplica';

export const PAGAMENTOS: Pagamento[] = ['pago', 'pendente', 'cancelada'];
export const ENTREGAS: Entrega[] = ['pendente', 'entregue', 'nao_aplica'];

/**
 * Rótulos em português. O banco guarda em inglês/snake porque é chave, mas
 * nenhuma dessas strings deve chegar à tela: "nao_aplica" não quer dizer nada
 * pra quem vende cesta.
 */
export const ROTULO_PAGAMENTO: Record<Pagamento, string> = {
  pago: 'Pago',
  pendente: 'A receber',
  cancelada: 'Cancelada',
};

export const ROTULO_ENTREGA: Record<Entrega, string> = {
  pendente: 'A entregar',
  entregue: 'Entregue',
  nao_aplica: 'Levou na hora',
};

/** Verdadeiro quando o valor veio de fora e serve como pagamento. */
export function ehPagamento(valor: unknown): valor is Pagamento {
  return typeof valor === 'string' && (PAGAMENTOS as string[]).includes(valor);
}

/** Verdadeiro quando o valor veio de fora e serve como entrega. */
export function ehEntrega(valor: unknown): valor is Entrega {
  return typeof valor === 'string' && (ENTREGAS as string[]).includes(valor);
}

/**
 * Uma venda cancelada conta como faturamento? Não.
 *
 * A regra fica aqui, e não espalhada em `if`s, porque ela decide dinheiro: o
 * Raio-X, o histórico da cliente e o painel da mentora precisam concordar
 * sobre o que soma. As consultas filtram na origem (`.neq('status',
 * 'cancelada')`), e esta função é a mesma regra para quem já tem a venda em
 * mãos e não pode voltar ao banco.
 */
export function contaComoFaturamento(pagamento: Pagamento): boolean {
  return pagamento !== 'cancelada';
}

/**
 * O que ainda exige uma ação da aluna nesta venda.
 *
 * Devolve a lista do que está em aberto, na ordem em que ela agiria: receber
 * antes de entregar. Vazia quando não há nada a fazer.
 *
 * Cancelada não pende nada de propósito — a venda acabou. Sem essa saída, uma
 * cancelada com entrega 'pendente' (que é o default de toda venda) apareceria
 * pra sempre na agenda de entregas de uma cesta que ninguém vai levar.
 */
export function pendenciasDaVenda(
  pagamento: Pagamento,
  entrega: Entrega,
): ('receber' | 'entregar')[] {
  if (pagamento === 'cancelada') return [];

  const pendencias: ('receber' | 'entregar')[] = [];
  if (pagamento === 'pendente') pendencias.push('receber');
  if (entrega === 'pendente') pendencias.push('entregar');
  return pendencias;
}

/**
 * A frase curta que resume a situação numa linha da lista.
 *
 * Devolve null quando está tudo resolvido: nesse caso a linha não ganha
 * etiqueta nenhuma. Marcar "Pago · Entregue" em toda venda encheria a tela de
 * selo verde e faria as duas ou três que pedem ação desaparecerem no meio —
 * o oposto do que a etiqueta existe pra fazer.
 */
export function resumoDaSituacao(pagamento: Pagamento, entrega: Entrega): string | null {
  if (pagamento === 'cancelada') return ROTULO_PAGAMENTO.cancelada;

  const pendencias = pendenciasDaVenda(pagamento, entrega);
  if (pendencias.length === 0) return null;

  return pendencias
    .map((p) => (p === 'receber' ? ROTULO_PAGAMENTO.pendente : ROTULO_ENTREGA.pendente))
    .join(' · ');
}
