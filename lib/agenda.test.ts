import { describe, expect, it } from 'vitest';
import {
  datasComerciaisDoMes,
  ehDataISO,
  ehHora,
  faseDaData,
  horaCurta,
  inicioEmBrasilia,
  linkSeguro,
  momentoDoEncontro,
  partesEmBrasilia,
  proximasDatasComerciais,
  quandoEhOEncontro,
  semanasDoMes,
} from '@/lib/agenda';

describe('horário dos encontros', () => {
  it('ida e volta em Brasília', () => {
    const iso = inicioEmBrasilia('2026-11-04', '19:30');
    expect(new Date(iso).toISOString()).toBe('2026-11-04T22:30:00.000Z');
    expect(partesEmBrasilia(new Date(iso).toISOString())).toEqual({ data: '2026-11-04', hora: '19:30' });
    expect(horaCurta(iso)).toBe('19h30');
    expect(horaCurta(inicioEmBrasilia('2026-11-04', '19:00'))).toBe('19h');
  });

  it('um encontro às 22h de Brasília continua no mesmo dia, mesmo já sendo o dia seguinte em UTC', () => {
    expect(partesEmBrasilia('2026-11-05T01:00:00.000Z').data).toBe('2026-11-04');
  });
});

describe('momentoDoEncontro', () => {
  const inicio = inicioEmBrasilia('2026-11-04', '19:00');
  it('acende 15 minutos antes e apaga no fim', () => {
    expect(momentoDoEncontro(inicio, 60, new Date('2026-11-04T21:40:00Z'))).toBe('futuro');
    expect(momentoDoEncontro(inicio, 60, new Date('2026-11-04T21:46:00Z'))).toBe('agora');
    expect(momentoDoEncontro(inicio, 60, new Date('2026-11-04T22:59:00Z'))).toBe('agora');
    expect(momentoDoEncontro(inicio, 60, new Date('2026-11-04T23:01:00Z'))).toBe('passou');
  });

  it('fala como gente', () => {
    expect(quandoEhOEncontro(inicio, 60, new Date('2026-11-04T12:00:00Z'))).toBe('hoje às 19h');
    expect(quandoEhOEncontro(inicio, 60, new Date('2026-11-03T12:00:00Z'))).toBe('amanhã às 19h');
    expect(quandoEhOEncontro(inicio, 60, new Date('2026-10-28T12:00:00Z'))).toBe('em 7 dias');
  });
});

describe('semanasDoMes', () => {
  it('outubro de 2026 começa numa quinta e tem 5 semanas', () => {
    const semanas = semanasDoMes(2026, 10);
    expect(semanas).toHaveLength(5);
    expect(semanas[0]?.[0]).toEqual({ data: '2026-09-27', dia: 27, doMes: false });
    expect(semanas[0]?.[4]).toEqual({ data: '2026-10-01', dia: 1, doMes: true });
    expect(semanas[4]?.[6]).toEqual({ data: '2026-10-31', dia: 31, doMes: true });
  });

  it('virada de ano', () => {
    const semanas = semanasDoMes(2026, 12);
    expect(semanas.at(-1)?.at(-1)?.data).toBe('2027-01-02');
  });
});

describe('datas comerciais', () => {
  it('fases: planejar, divulgar, encomendas, hoje', () => {
    expect(faseDaData(61, 21)).toBeNull();
    expect(faseDaData(58, 21)).toBe('planejar');
    expect(faseDaData(45, 21)).toBe('divulgar');
    expect(faseDaData(21, 21)).toBe('encomendas');
    expect(faseDaData(0, 21)).toBe('hoje');
  });

  it('a lista dos próximos meses vem em ordem e com a fase', () => {
    const lista = proximasDatasComerciais('2026-10-28');
    expect(lista[0]).toMatchObject({ nome: 'Natal', dias: 58, fase: 'planejar' });
    expect(lista[1]).toMatchObject({ nome: 'Ano Novo', data: '2027-01-01' });
  });

  it('as do mês, pro calendário', () => {
    expect(datasComerciaisDoMes(2026, 10).map((d) => d.nome)).toEqual(['Dia das Crianças']);
    expect(datasComerciaisDoMes(2026, 5).map((d) => d.data)).toEqual(['2026-05-10']);
  });
});

describe('validação do cadastro', () => {
  it('datas e horas', () => {
    expect(ehDataISO('2026-11-04')).toBe(true);
    expect(ehDataISO('04/11/2026')).toBe(false);
    expect(ehHora('19:30')).toBe(true);
    expect(ehHora('24:00')).toBe(false);
  });

  it('o link só passa se for http(s)', () => {
    expect(linkSeguro('https://meet.google.com/abc')).toBe('https://meet.google.com/abc');
    expect(linkSeguro('  ')).toBeNull();
    expect(linkSeguro(null)).toBeNull();
    expect(linkSeguro('javascript:alert(1)')).toBeUndefined();
    expect(linkSeguro('meet.google.com/abc')).toBeUndefined();
  });
});
