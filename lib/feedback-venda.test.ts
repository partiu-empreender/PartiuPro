import { describe, expect, it } from 'vitest';
import {
  coerenteAoMarcarFeito,
  coerenteAoMarcarPedido,
  feedbacksACobrar,
  resumoDoFeedback,
  type FeedbackDaVenda,
} from '@/lib/feedback-venda';

const zerado: FeedbackDaVenda = {
  feedback_google_pedido: false,
  feedback_google_feito: false,
  feedback_presenteado_pedido: false,
  feedback_presenteado_feito: false,
};

describe('feedbacksACobrar', () => {
  it('não cobra nada quando nada foi pedido', () => {
    expect(feedbacksACobrar(zerado)).toEqual([]);
  });

  // O caso que dá sentido aos quatro campos: pedido e sem resposta é a lista
  // de quem cobrar.
  it('cobra o que foi pedido e não veio', () => {
    expect(feedbacksACobrar({ ...zerado, feedback_google_pedido: true })).toEqual(['google']);
  });

  it('não cobra o que já veio', () => {
    expect(
      feedbacksACobrar({
        ...zerado,
        feedback_google_pedido: true,
        feedback_google_feito: true,
      }),
    ).toEqual([]);
  });

  it('acumula os dois canais', () => {
    expect(
      feedbacksACobrar({
        ...zerado,
        feedback_google_pedido: true,
        feedback_presenteado_pedido: true,
      }),
    ).toEqual(['google', 'presenteado']);
  });
});

describe('resumoDoFeedback', () => {
  // Null é o ponto: sem ele toda venda ganharia selo e as que pedem ação
  // sumiriam no meio das resolvidas.
  it('não devolve rótulo quando não há o que cobrar', () => {
    expect(resumoDoFeedback(zerado)).toBeNull();
    expect(
      resumoDoFeedback({
        ...zerado,
        feedback_google_pedido: true,
        feedback_google_feito: true,
      }),
    ).toBeNull();
  });

  it('diz o que está faltando, em português', () => {
    expect(resumoDoFeedback({ ...zerado, feedback_google_pedido: true })).toBe(
      'Aguardando: Avaliação no Google',
    );
    expect(
      resumoDoFeedback({
        ...zerado,
        feedback_google_pedido: true,
        feedback_presenteado_pedido: true,
      }),
    ).toBe('Aguardando: Avaliação no Google · Retorno de quem recebeu');
  });
});

describe('coerência entre pedido e feito', () => {
  // "Feito" sem "pedido" é impossível: ninguém avalia sem ser convidado. A
  // venda apareceria resolvida sem ter entrado na conta de pedidos.
  it('marcar feito liga pedido junto', () => {
    expect(coerenteAoMarcarFeito(zerado, 'google', true)).toEqual({
      feedback_google_feito: true,
      feedback_google_pedido: true,
    });
  });

  it('desmarcar feito não mexe em pedido', () => {
    expect(coerenteAoMarcarFeito(zerado, 'presenteado', false)).toEqual({
      feedback_presenteado_feito: false,
    });
  });

  // O espelho da regra: desmarcar pedido tem que derrubar feito, senão sobra
  // um feedback feito que nunca foi pedido.
  it('desmarcar pedido derruba feito junto', () => {
    expect(coerenteAoMarcarPedido(zerado, 'google', false)).toEqual({
      feedback_google_pedido: false,
      feedback_google_feito: false,
    });
  });

  it('marcar pedido não presume que já foi feito', () => {
    expect(coerenteAoMarcarPedido(zerado, 'presenteado', true)).toEqual({
      feedback_presenteado_pedido: true,
    });
  });
});
