import { describe, expect, it } from 'vitest';
import { ancoraVigente, calcularSaldoDoMes } from './saldo';

const entradas = [
  { data: '2026-08-10', valor: 500 },
  { data: '2026-09-05', valor: 300 },
  { data: '2026-10-02', valor: 200 },
];
const saidas = [
  { data: '2026-08-20', valor: 100 },
  { data: '2026-09-15', valor: 50 },
];

describe('ancoraVigente', () => {
  it('pega a mais recente que não passa do mês pedido', () => {
    const ancoras = [
      { ano: 2026, mes: 8, valor: 1 },
      { ano: 2026, mes: 10, valor: 2 },
    ];
    expect(ancoraVigente(ancoras, { ano: 2026, mes: 9 })?.valor).toBe(1);
    expect(ancoraVigente(ancoras, { ano: 2026, mes: 10 })?.valor).toBe(2);
    expect(ancoraVigente(ancoras, { ano: 2026, mes: 7 })).toBeNull();
  });
});

describe('calcularSaldoDoMes', () => {
  it('sem saldo informado não há saldo a mostrar', () => {
    expect(calcularSaldoDoMes([], entradas, saidas, { ano: 2026, mes: 9 })).toBeNull();
  });

  it('no mês informado, parte do valor digitado', () => {
    const saldo = calcularSaldoDoMes([{ ano: 2026, mes: 8, valor: 1000 }], entradas, saidas, {
      ano: 2026,
      mes: 8,
    });
    expect(saldo).toMatchObject({
      saldoInicial: 1000,
      origem: 'informado',
      entradas: 500,
      saidas: 100,
      saldoFinal: 1400,
    });
  });

  it('o saldo final de um mês vira o inicial do seguinte', () => {
    const saldo = calcularSaldoDoMes([{ ano: 2026, mes: 8, valor: 1000 }], entradas, saidas, {
      ano: 2026,
      mes: 10,
    });
    // ago: 1000 + 500 - 100 = 1400; set: 1400 + 300 - 50 = 1650
    expect(saldo).toMatchObject({
      saldoInicial: 1650,
      origem: 'calculado',
      ancora: { ano: 2026, mes: 8 },
      saldoFinal: 1850,
    });
  });

  it('um saldo informado depois recalibra dali em diante', () => {
    const ancoras = [
      { ano: 2026, mes: 8, valor: 1000 },
      { ano: 2026, mes: 9, valor: 2000 },
    ];
    expect(calcularSaldoDoMes(ancoras, entradas, saidas, { ano: 2026, mes: 10 })?.saldoInicial).toBe(
      2250,
    );
  });

  it('atravessa a virada do ano', () => {
    const saldo = calcularSaldoDoMes(
      [{ ano: 2026, mes: 12, valor: 100 }],
      [{ data: '2026-12-31', valor: 50 }],
      [],
      { ano: 2027, mes: 1 },
    );
    expect(saldo?.saldoInicial).toBe(150);
  });

  it('ignora movimento anterior à âncora: o saldo informado já o contém', () => {
    const saldo = calcularSaldoDoMes([{ ano: 2026, mes: 9, valor: 0 }], entradas, saidas, {
      ano: 2026,
      mes: 9,
    });
    expect(saldo?.saldoFinal).toBe(250);
  });

  it('aceita saldo inicial negativo (conta no vermelho)', () => {
    const saldo = calcularSaldoDoMes([{ ano: 2026, mes: 9, valor: -400 }], entradas, saidas, {
      ano: 2026,
      mes: 9,
    });
    expect(saldo?.saldoFinal).toBe(-150);
  });
});
