import { describe, expect, it } from 'vitest';
import {
  ehDesafioNovo,
  limparTarefas,
  prazoDoDesafio,
  progressoDoDesafio,
  situacaoDoDesafio,
} from '@/lib/desafios';

const tarefas = [
  { id: 'a', ordem: 0, texto: 'Postar' },
  { id: 'b', ordem: 1, texto: 'Vender' },
];

describe('progressoDoDesafio', () => {
  it('conta as feitas e só conclui com todas', () => {
    expect(progressoDoDesafio({ tarefas }, new Set(['a']))).toEqual({
      feitas: 1,
      total: 2,
      percentual: 50,
      concluido: false,
    });
    expect(progressoDoDesafio({ tarefas }, new Set(['a', 'b', 'x'])).concluido).toBe(true);
  });

  it('desafio sem tarefa não conta como concluído', () => {
    expect(progressoDoDesafio({ tarefas: [] }, new Set()).concluido).toBe(false);
  });
});

describe('situação e prazo', () => {
  it('aberto até o fim do dia do prazo', () => {
    const d = { inicio: '2026-11-04', fim: '2026-11-10' };
    expect(situacaoDoDesafio(d, '2026-11-03')).toBe('em-breve');
    expect(situacaoDoDesafio(d, '2026-11-10')).toBe('aberto');
    expect(situacaoDoDesafio(d, '2026-11-11')).toBe('encerrado');
    expect(situacaoDoDesafio({ inicio: '2026-11-04', fim: null }, '2027-05-01')).toBe('aberto');
  });

  it('fala o prazo', () => {
    expect(prazoDoDesafio(null, '2026-11-04')).toBeNull();
    expect(prazoDoDesafio('2026-11-04', '2026-11-04')).toBe('último dia hoje');
    expect(prazoDoDesafio('2026-11-05', '2026-11-04')).toBe('falta 1 dia');
    expect(prazoDoDesafio('2026-11-10', '2026-11-04')).toBe('faltam 6 dias');
  });

  it('novo é aberto há até 7 dias', () => {
    expect(ehDesafioNovo({ inicio: '2026-11-04', fim: null }, '2026-11-11')).toBe(true);
    expect(ehDesafioNovo({ inicio: '2026-11-04', fim: null }, '2026-11-12')).toBe(false);
  });
});

describe('limparTarefas', () => {
  it('tira vazias e espaços', () => {
    expect(limparTarefas([' Postar ', '', '  ', 'Vender', 3])).toEqual(['Postar', 'Vender']);
    expect(limparTarefas('nada')).toEqual([]);
  });
});
