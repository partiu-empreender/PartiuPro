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

/**
 * FORMA DE PAGAMENTO — o TERCEIRO eixo (migration 020).
 *
 * `status` diz SE pagou. Isto diz COMO pagou. São independentes: dá para estar
 * pendente num Pix combinado, e pago em dinheiro. Se alguém propuser juntar os
 * dois num campo só, o que se perde é o "pendente" — que é justamente o que
 * faz a aluna cobrar.
 *
 * Lista FECHADA, ao contrário de `how_knew` e das categorias do financeiro.
 * A diferença é o uso: aquelas são livres porque servem para ler uma a uma;
 * esta existe para AGRUPAR ("quanto entrou por Pix este mês"), e campo livre
 * viraria 'pix', 'PIX', 'Pix ' e 'pics' na mesma coluna.
 */
export type FormaDePagamento =
  | 'pix'
  | 'dinheiro'
  | 'credito'
  | 'debito'
  | 'transferencia'
  | 'outro';

export const FORMAS_DE_PAGAMENTO: FormaDePagamento[] = [
  'pix',
  'dinheiro',
  'credito',
  'debito',
  'transferencia',
  'outro',
];

export const ROTULO_FORMA_PAGAMENTO: Record<FormaDePagamento, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  credito: 'Crédito',
  debito: 'Débito',
  transferencia: 'Transferência',
  outro: 'Outro',
};

/**
 * A rota confia nisto para não deixar passar valor que o CHECK do banco
 * recusaria — o erro do Postgres não diz nada que a aluna possa entender.
 */
export function ehFormaDePagamento(valor: unknown): valor is FormaDePagamento {
  return typeof valor === 'string' && FORMAS_DE_PAGAMENTO.includes(valor as FormaDePagamento);
}

/**
 * Rótulo para exibir. Null quando não foi informada — e é assim que ficam
 * TODAS as vendas anteriores a 11/09/2026, porque não dá para saber como foram
 * pagas. Inventar 'dinheiro' faria um relatório de formas nascer mentindo.
 */
export function rotuloDaForma(forma: unknown): string | null {
  return ehFormaDePagamento(forma) ? ROTULO_FORMA_PAGAMENTO[forma] : null;
}

/**
 * Ordem da lista "Falta resolver": o que tem entrega marcada vem primeiro, da
 * mais próxima para a mais distante; depois as sem data de entrega, da venda
 * mais antiga para a mais nova.
 *
 * A lista deixou de ser do mês (pedido de out/2026: a venda fechada em
 * setembro para entregar em 06/10 sumia na virada do mês). Com meses
 * misturados, a data da VENDA deixou de ser a ordem útil: o que ela precisa
 * ver no topo é o que tem de sair primeiro.
 */
export function ordenarPendencias<
  T extends { data: string; delivery_date?: string | null },
>(vendas: T[]): T[] {
  return [...vendas].sort((a, b) => {
    const ea = a.delivery_date || '';
    const eb = b.delivery_date || '';
    if (ea && eb && ea !== eb) return ea < eb ? -1 : 1;
    if (ea && !eb) return -1;
    if (!ea && eb) return 1;
    return a.data < b.data ? -1 : a.data > b.data ? 1 : 0;
  });
}

/**
 * BAIXA DE ENTREGAS ANTIGAS — quais vendas podem ser marcadas como entregues
 * de uma vez.
 *
 * Existe por causa da migration 013: TODA venda nasceu "a entregar", inclusive
 * as que foram levadas na hora. Quando a lista de pendências passou a juntar
 * todos os meses (out/2026), essas vendas antigas apareceram aos montes, e
 * resolver uma por uma seria inviável.
 *
 * A regra é conservadora de propósito, porque marcar como entregue o que
 * ainda não saiu é perder uma entrega de vista:
 *
 * - só a ENTREGA muda; pagamento, valores e itens não são tocados;
 * - cancelada não entra (já não pende nada);
 * - venda com entrega agendada para HOJE ou depois nunca entra, por mais
 *   antiga que seja — é o caso da cesta fechada em setembro para 06/10;
 * - só entram vendas feitas até a data que a aluna escolher.
 *
 * A rota aplica o MESMO filtro na consulta; esta função é a mesma regra para
 * a tela contar antes de confirmar.
 */
export function entraNaBaixaDeEntregas(
  venda: {
    data: string;
    status: string;
    entrega: string;
    delivery_date?: string | null;
  },
  ate: string,
  hoje: string,
): boolean {
  if (venda.status === 'cancelada') return false;
  if (venda.entrega !== 'pendente') return false;
  if (venda.data > ate) return false;
  if (venda.delivery_date && venda.delivery_date >= hoje) return false;
  return true;
}
