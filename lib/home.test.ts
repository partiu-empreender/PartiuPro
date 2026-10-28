import { describe, expect, it } from 'vitest';
import { horaBrasil, proximaDataComercial, resumoDoMes, saudacao } from '@/lib/home';

describe('saudacao', () => {
  it('troca nas viradas de 5h, 12h e 18h', () => {
    expect(saudacao(4)).toBe('Boa noite');
    expect(saudacao(5)).toBe('Bom dia');
    expect(saudacao(11)).toBe('Bom dia');
    expect(saudacao(12)).toBe('Boa tarde');
    expect(saudacao(17)).toBe('Boa tarde');
    expect(saudacao(18)).toBe('Boa noite');
    expect(saudacao(0)).toBe('Boa noite');
  });
});

describe('horaBrasil', () => {
  it('usa o fuso de São Paulo, não o do computador', () => {
    // 01:30 UTC é 22:30 do dia anterior em Brasília.
    expect(horaBrasil(new Date('2026-10-28T01:30:00Z'))).toBe(22);
    expect(horaBrasil(new Date('2026-10-28T15:00:00Z'))).toBe(12);
  });
});

describe('resumoDoMes', () => {
  it('compara com o mesmo período do mês passado, não com o mês inteiro', () => {
    const resumo = resumoDoMes(
      [
        { data: '2026-10-02', faturamento_total: 100 },
        { data: '2026-10-10', faturamento_total: '50.5' },
        { data: '2026-09-05', faturamento_total: 100 },
        // Depois do dia 10 de setembro: fora da comparação.
        { data: '2026-09-20', faturamento_total: 900 },
      ],
      '2026-10-10',
    );

    expect(resumo.vendido).toBe(150.5);
    expect(resumo.quantidade).toBe(2);
    expect(resumo.vendidoAntes).toBe(100);
    expect(resumo.variacao).toBeCloseTo(50.5);
    expect(resumo.porDia).toHaveLength(10);
    expect(resumo.porDia[1]).toBe(100);
    expect(resumo.porDia[9]).toBe(50.5);
    expect(resumo.mes).toBe('Outubro');
    expect(resumo.mesAnterior).toBe('Setembro');
  });

  it('sem venda no mês passado, não inventa percentual', () => {
    const resumo = resumoDoMes([{ data: '2026-10-01', faturamento_total: 80 }], '2026-10-01');
    expect(resumo.variacao).toBeNull();
  });

  it('em 31 de março, compara com fevereiro inteiro', () => {
    const resumo = resumoDoMes(
      [
        { data: '2026-02-28', faturamento_total: 200 },
        { data: '2026-03-31', faturamento_total: 100 },
      ],
      '2026-03-31',
    );
    expect(resumo.vendidoAntes).toBe(200);
    expect(resumo.variacao).toBe(-50);
  });

  it('em janeiro, o mês anterior é dezembro do ano passado', () => {
    const resumo = resumoDoMes([{ data: '2025-12-03', faturamento_total: 40 }], '2026-01-05');
    expect(resumo.vendidoAntes).toBe(40);
    expect(resumo.mesAnterior).toBe('Dezembro');
  });
});

describe('proximaDataComercial', () => {
  it('acha o Natal a 58 dias', () => {
    expect(proximaDataComercial('2026-10-28')).toEqual({
      id: 'natal',
      nome: 'Natal',
      data: '2026-12-25',
      dias: 58,
    });
  });

  it('em dezembro, depois do Natal, enxerga o Ano Novo do ano seguinte', () => {
    expect(proximaDataComercial('2026-12-27')?.id).toBe('ano-novo');
  });

  it('não avisa o que está longe demais', () => {
    // De 13/10 até o Natal são 73 dias; nada antes disso.
    expect(proximaDataComercial('2026-10-13')).toBeNull();
  });
});
