/**
 * Feedback pedido e feedback recebido, por venda.
 *
 * Dois canais (Google e presenteado), dois momentos cada: pedir é ação da
 * aluna; ser atendido é ação de outra pessoa, e chega depois — ou nunca.
 *
 * A regra que faz esses campos valerem alguma coisa: o que interessa não é
 * quantos feedbacks vieram, e sim QUAIS FORAM PEDIDOS E NÃO VIERAM. Essa é a
 * lista de quem cobrar, e é a única pergunta acionável aqui.
 */

export type CanalDeFeedback = 'google' | 'presenteado';

export interface FeedbackDaVenda {
  feedback_google_pedido: boolean;
  feedback_google_feito: boolean;
  feedback_presenteado_pedido: boolean;
  feedback_presenteado_feito: boolean;
}

/** Canais pedidos que ainda não foram atendidos. Vazio = nada a cobrar. */
export function feedbacksACobrar(venda: FeedbackDaVenda): CanalDeFeedback[] {
  const pendentes: CanalDeFeedback[] = [];
  if (venda.feedback_google_pedido && !venda.feedback_google_feito) {
    pendentes.push('google');
  }
  if (venda.feedback_presenteado_pedido && !venda.feedback_presenteado_feito) {
    pendentes.push('presenteado');
  }
  return pendentes;
}

/**
 * Rótulo curto para a ficha. `null` quando não há nada a dizer — sem isso,
 * toda venda ganharia um selo e as poucas que pedem ação sumiriam no meio.
 */
export function resumoDoFeedback(venda: FeedbackDaVenda): string | null {
  const aCobrar = feedbacksACobrar(venda);
  if (aCobrar.length === 0) return null;

  const nomes = aCobrar.map((canal) =>
    canal === 'google' ? 'Avaliação no Google' : 'Retorno de quem recebeu',
  );
  return `Aguardando: ${nomes.join(' · ')}`;
}

/**
 * "Feito" sem "pedido" é estado impossível: ninguém avalia sem ter sido
 * convidado, e deixar passar produziria uma venda que aparece como resolvida
 * sem nunca ter entrado na conta de pedidos.
 *
 * Em vez de recusar a alteração — o que faria a aluna brigar com a tela —
 * marcar "feito" liga "pedido" junto.
 */
export function coerenteAoMarcarFeito(
  atual: FeedbackDaVenda,
  canal: CanalDeFeedback,
  feito: boolean,
): Partial<FeedbackDaVenda> {
  if (canal === 'google') {
    return feito
      ? { feedback_google_feito: true, feedback_google_pedido: true }
      : { feedback_google_feito: false };
  }
  return feito
    ? { feedback_presenteado_feito: true, feedback_presenteado_pedido: true }
    : { feedback_presenteado_feito: false };
}

/**
 * Desmarcar "pedido" tem que desmarcar "feito" junto, pelo mesmo motivo: a
 * venda ficaria com um feedback feito que nunca foi pedido.
 */
export function coerenteAoMarcarPedido(
  atual: FeedbackDaVenda,
  canal: CanalDeFeedback,
  pedido: boolean,
): Partial<FeedbackDaVenda> {
  if (canal === 'google') {
    return pedido
      ? { feedback_google_pedido: true }
      : { feedback_google_pedido: false, feedback_google_feito: false };
  }
  return pedido
    ? { feedback_presenteado_pedido: true }
    : { feedback_presenteado_pedido: false, feedback_presenteado_feito: false };
}
