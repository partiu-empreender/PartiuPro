import { describe, expect, it } from 'vitest';
import { atalhosDePeriodo, motivoPeriodoInvalido, resumoDoPeriodo } from './periodo';

describe('motivoPeriodoInvalido', () => {
  it('aceita um dia só', () => {
    expect(motivoPeriodoInvalido('2026-10-08', '2026-10-08')).toBeNull();
  });

  it('aceita um período que atravessa meses', () => {
    expect(motivoPeriodoInvalido('2026-09-20', '2026-10-08')).toBeNull();
  });

  it('recusa início depois do fim', () => {
    expect(motivoPeriodoInvalido('2026-10-08', '2026-10-01')).toMatch(/antes/);
  });

  it('recusa data que não existe', () => {
    expect(motivoPeriodoInvalido('2026-02-30', '2026-03-01')).toBe('Período inválido.');
    expect(motivoPeriodoInvalido('lixo', '2026-03-01')).toBe('Período inválido.');
  });

  it('recusa período longo demais', () => {
    expect(motivoPeriodoInvalido('2016-10-08', '2026-10-08')).toMatch(/até/);
  });
});

describe('atalhosDePeriodo', () => {
  it('monta os recortes a partir de hoje', () => {
    const atalhos = Object.fromEntries(
      atalhosDePeriodo('2026-10-08').map((a) => [a.rotulo, [a.de, a.ate]]),
    );
    expect(atalhos['Hoje']).toEqual(['2026-10-08', '2026-10-08']);
    expect(atalhos['Ontem']).toEqual(['2026-10-07', '2026-10-07']);
    expect(atalhos['Últimos 7 dias']).toEqual(['2026-10-02', '2026-10-08']);
    expect(atalhos['Este mês']).toEqual(['2026-10-01', '2026-10-08']);
    expect(atalhos['Mês passado']).toEqual(['2026-09-01', '2026-09-30']);
  });

  it('mês passado em janeiro é dezembro do ano anterior', () => {
    const passado = atalhosDePeriodo('2027-01-05').find((a) => a.rotulo === 'Mês passado');
    expect(passado).toMatchObject({ de: '2026-12-01', ate: '2026-12-31' });
  });
});

describe('resumoDoPeriodo', () => {
  it('soma, conta e tira o ticket médio, sem as canceladas', () => {
    expect(
      resumoDoPeriodo([
        { faturamento_total: 100, status: 'pago' },
        { faturamento_total: 50.5, status: 'pendente' },
        { faturamento_total: 999, status: 'cancelada' },
      ]),
    ).toEqual({ quantidade: 2, total: 150.5, ticketMedio: 75.25, aReceber: 50.5 });
  });

  it('período vazio não divide por zero', () => {
    expect(resumoDoPeriodo([])).toEqual({ quantidade: 0, total: 0, ticketMedio: 0, aReceber: 0 });
  });
});
