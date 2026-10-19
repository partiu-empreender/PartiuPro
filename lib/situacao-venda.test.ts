import { describe, expect, it } from 'vitest';
import {
  contaComoFaturamento,
  ehEntrega,
  ehFormaDePagamento,
  ehPagamento,
  entraNaBaixaDeEntregas,
  ordenarPendencias,
  pendenciasDaVenda,
  resumoDaSituacao,
  rotuloDaForma,
} from '@/lib/situacao-venda';

/**
 * Pagamento e entrega são dois eixos independentes. O que se testa aqui é
 * justamente a combinação deles — é onde um campo só perderia informação.
 */

describe('contaComoFaturamento', () => {
  // Esta é a regra que mexe em dinheiro: se furar, o Raio-X mente.
  it('cancelada não soma; pago e a receber somam', () => {
    expect(contaComoFaturamento('cancelada')).toBe(false);
    expect(contaComoFaturamento('pago')).toBe(true);
    // "A receber" continua sendo faturamento do mês: a venda aconteceu, o
    // dinheiro é dela. O que falta é entrar na conta, não existir.
    expect(contaComoFaturamento('pendente')).toBe(true);
  });
});

describe('pendenciasDaVenda', () => {
  it('não pende nada quando está pago e entregue', () => {
    expect(pendenciasDaVenda('pago', 'entregue')).toEqual([]);
  });

  it('não pende nada quando a cliente levou na hora', () => {
    expect(pendenciasDaVenda('pago', 'nao_aplica')).toEqual([]);
  });

  it('separa receber de entregar', () => {
    expect(pendenciasDaVenda('pendente', 'entregue')).toEqual(['receber']);
    expect(pendenciasDaVenda('pago', 'pendente')).toEqual(['entregar']);
  });

  // O caso que um campo só não conseguiria representar.
  it('acumula as duas quando falta receber E entregar', () => {
    expect(pendenciasDaVenda('pendente', 'pendente')).toEqual(['receber', 'entregar']);
  });

  // Toda venda nasce com entrega 'pendente'. Sem esta saída, uma cancelada
  // ficaria pra sempre na agenda de entregas de uma cesta que ninguém vai levar.
  it('cancelada não pende nada, mesmo com entrega pendente', () => {
    expect(pendenciasDaVenda('cancelada', 'pendente')).toEqual([]);
  });
});

describe('resumoDaSituacao', () => {
  // Null é o ponto: sem ele, toda venda ganharia selo e as que pedem ação
  // sumiriam no meio das resolvidas.
  it('não devolve rótulo quando não há nada a fazer', () => {
    expect(resumoDaSituacao('pago', 'entregue')).toBeNull();
    expect(resumoDaSituacao('pago', 'nao_aplica')).toBeNull();
  });

  it('mostra o que falta, em português', () => {
    expect(resumoDaSituacao('pendente', 'entregue')).toBe('A receber');
    expect(resumoDaSituacao('pago', 'pendente')).toBe('A entregar');
    expect(resumoDaSituacao('pendente', 'pendente')).toBe('A receber · A entregar');
  });

  it('cancelada aparece como cancelada, e não como pendência', () => {
    expect(resumoDaSituacao('cancelada', 'pendente')).toBe('Cancelada');
  });
});

describe('validação do que vem de fora', () => {
  // A rota confia nestas duas pra não deixar passar valor que o CHECK do
  // banco recusaria — o erro do Postgres não diz nada útil pra aluna.
  it('aceita só os valores que o banco aceita', () => {
    expect(ehPagamento('pago')).toBe(true);
    expect(ehEntrega('nao_aplica')).toBe(true);
  });

  it('recusa lixo, valor do esquema antigo e tipo errado', () => {
    expect(ehPagamento('draft')).toBe(false);
    expect(ehPagamento('confirmed')).toBe(false);
    expect(ehPagamento('')).toBe(false);
    expect(ehPagamento(null)).toBe(false);
    expect(ehPagamento(3)).toBe(false);
    // Os eixos não se misturam: 'entregue' não é forma de pagamento.
    expect(ehPagamento('entregue')).toBe(false);
    expect(ehEntrega('pago')).toBe(false);
  });
});

describe('forma de pagamento', () => {
  // O eixo novo (migration 020). O que se testa aqui é que ele NÃO se
  // confunde com `status`: um diz se pagou, o outro diz como.
  it('aceita só as formas que o banco aceita', () => {
    expect(ehFormaDePagamento('pix')).toBe(true);
    expect(ehFormaDePagamento('transferencia')).toBe(true);
    expect(ehFormaDePagamento('outro')).toBe(true);
  });

  it('recusa lixo, tipo errado e valores dos OUTROS eixos', () => {
    expect(ehFormaDePagamento('boleto')).toBe(false);
    expect(ehFormaDePagamento('')).toBe(false);
    expect(ehFormaDePagamento(null)).toBe(false);
    expect(ehFormaDePagamento(3)).toBe(false);
    // Os três eixos não se misturam: 'pago' é status, 'entregue' é entrega.
    expect(ehFormaDePagamento('pago')).toBe(false);
    expect(ehFormaDePagamento('entregue')).toBe(false);
  });

  // Case-sensitive de propósito: a coluna guarda o valor canônico, e aceitar
  // 'PIX' aqui deixaria passar para o banco algo que o CHECK recusaria.
  it('não aceita variação de caixa', () => {
    expect(ehFormaDePagamento('PIX')).toBe(false);
    expect(ehFormaDePagamento('Pix')).toBe(false);
  });

  it('mostra o rótulo em português', () => {
    expect(rotuloDaForma('pix')).toBe('Pix');
    expect(rotuloDaForma('credito')).toBe('Crédito');
  });

  // Null é o ponto: toda venda anterior a 11/09/2026 tem a forma em branco, e
  // não dá pra saber como foi paga. Um rótulo inventado faria o relatório de
  // formas nascer mentindo.
  it('não inventa rótulo quando a forma não foi informada', () => {
    expect(rotuloDaForma(null)).toBeNull();
    expect(rotuloDaForma(undefined)).toBeNull();
    expect(rotuloDaForma('boleto')).toBeNull();
  });
});

describe('ordenarPendencias', () => {
  it('entrega marcada primeiro, da mais próxima; depois as sem data, da venda mais antiga', () => {
    const ordem = ordenarPendencias([
      { id: 'a', data: '2026-10-01', delivery_date: null },
      { id: 'b', data: '2026-09-28', delivery_date: '2026-10-10' },
      { id: 'c', data: '2026-09-15', delivery_date: null },
      { id: 'd', data: '2026-10-02', delivery_date: '2026-10-06' },
    ]).map((v) => v.id);
    expect(ordem).toEqual(['d', 'b', 'c', 'a']);
  });
});

describe('entraNaBaixaDeEntregas', () => {
  const hoje = '2026-10-08';
  const ate = '2026-09-08';
  const base = { data: '2026-08-15', status: 'pago', entrega: 'pendente', delivery_date: null };

  it('venda antiga a entregar, sem entrega agendada, entra', () => {
    expect(entraNaBaixaDeEntregas(base, ate, hoje)).toBe(true);
  });

  it('entrega agendada para hoje ou depois nunca entra, mesmo venda antiga', () => {
    expect(entraNaBaixaDeEntregas({ ...base, delivery_date: '2026-10-08' }, ate, hoje)).toBe(false);
    expect(entraNaBaixaDeEntregas({ ...base, delivery_date: '2026-10-20' }, ate, hoje)).toBe(false);
  });

  it('entrega agendada que já passou entra', () => {
    expect(entraNaBaixaDeEntregas({ ...base, delivery_date: '2026-08-20' }, ate, hoje)).toBe(true);
  });

  it('venda depois da data escolhida não entra', () => {
    expect(entraNaBaixaDeEntregas({ ...base, data: '2026-09-09' }, ate, hoje)).toBe(false);
  });

  it('cancelada, já entregue ou levada na hora não entra', () => {
    expect(entraNaBaixaDeEntregas({ ...base, status: 'cancelada' }, ate, hoje)).toBe(false);
    expect(entraNaBaixaDeEntregas({ ...base, entrega: 'entregue' }, ate, hoje)).toBe(false);
    expect(entraNaBaixaDeEntregas({ ...base, entrega: 'nao_aplica' }, ate, hoje)).toBe(false);
  });

  it('a receber continua entrando: só a entrega muda, a cobrança fica', () => {
    expect(entraNaBaixaDeEntregas({ ...base, status: 'pendente' }, ate, hoje)).toBe(true);
  });
});
