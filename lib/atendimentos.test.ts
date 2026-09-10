import { describe, expect, it } from 'vitest';
import { atendimentosDoDia, atendimentosDoPeriodo } from '@/lib/atendimentos';

/**
 * O que se testa aqui é a convivência entre a contagem digitada e o registro
 * nominal. Errar não quebra nada visivelmente — só faz a taxa de conversão
 * mentir com ar de precisão.
 */

describe('atendimentosDoDia', () => {
  it('usa a contagem digitada quando não há registro nominal', () => {
    expect(atendimentosDoDia('2026-09-10', [{ data: '2026-09-10', pessoas_atendidas: 12 }], [])).toBe(12);
  });

  it('usa o nominal quando não há contagem digitada', () => {
    expect(
      atendimentosDoDia('2026-09-10', [], [{ data: '2026-09-10' }, { data: '2026-09-10' }]),
    ).toBe(2);
  });

  // O caso que dá nome à regra. Somar daria 15 e inflaria a conversão; usar só
  // o nominal apagaria 9 atendimentos que aconteceram.
  it('vale o MAIOR dos dois, nunca a soma', () => {
    const total = atendimentosDoDia(
      '2026-09-10',
      [{ data: '2026-09-10', pessoas_atendidas: 12 }],
      [{ data: '2026-09-10' }, { data: '2026-09-10' }, { data: '2026-09-10' }],
    );
    expect(total).toBe(12);
  });

  it('o nominal ganha quando ela detalhou mais do que digitou', () => {
    const total = atendimentosDoDia(
      '2026-09-10',
      [{ data: '2026-09-10', pessoas_atendidas: 2 }],
      [{ data: '2026-09-10' }, { data: '2026-09-10' }, { data: '2026-09-10' }],
    );
    expect(total).toBe(3);
  });

  it('não mistura dias diferentes', () => {
    const total = atendimentosDoDia(
      '2026-09-10',
      [{ data: '2026-09-09', pessoas_atendidas: 99 }],
      [{ data: '2026-09-11' }],
    );
    expect(total).toBe(0);
  });
});

describe('atendimentosDoPeriodo', () => {
  // A armadilha: comparar os TOTAIS de cada fonte daria 12, perdendo o dia 2
  // inteiro. Tem que ser dia a dia.
  it('soma dia a dia em vez de comparar totais', () => {
    const total = atendimentosDoPeriodo(
      [{ data: '2026-09-01', pessoas_atendidas: 12 }],
      [{ data: '2026-09-02' }, { data: '2026-09-02' }, { data: '2026-09-02' }],
    );
    expect(total).toBe(15);
  });

  it('aplica o maior dentro de cada dia antes de somar', () => {
    const total = atendimentosDoPeriodo(
      [
        { data: '2026-09-01', pessoas_atendidas: 10 },
        { data: '2026-09-02', pessoas_atendidas: 1 },
      ],
      [
        { data: '2026-09-01' }, // 1 nominal contra 10 digitados → 10
        { data: '2026-09-02' },
        { data: '2026-09-02' }, // 2 nominais contra 1 digitado → 2
      ],
    );
    expect(total).toBe(12);
  });

  it('é zero quando não houve atendimento nenhum', () => {
    expect(atendimentosDoPeriodo([], [])).toBe(0);
  });
});
