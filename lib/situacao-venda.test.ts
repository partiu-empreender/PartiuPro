import { describe, expect, it } from 'vitest';
import {
  contaComoFaturamento,
  ehEntrega,
  ehPagamento,
  pendenciasDaVenda,
  resumoDaSituacao,
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
