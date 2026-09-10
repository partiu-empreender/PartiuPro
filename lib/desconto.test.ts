import { describe, expect, it } from 'vitest';
import { calcularTotalComDesconto, valorDoDesconto } from '@/lib/desconto';

describe('calcularTotalComDesconto', () => {
  it('sem desconto, é a soma de sempre', () => {
    expect(calcularTotalComDesconto(100, 20, 0)).toBe(120);
  });

  // A regra que mais custaria dinheiro se estivesse errada: o frete fica fora
  // do desconto. Quem entrega paga o mesmo ao entregador com ou sem promoção.
  it('desconta os itens e NÃO o frete', () => {
    expect(calcularTotalComDesconto(100, 20, 10)).toBe(110); // 90 + 20, e não 108
  });

  it('desconto de 100% ainda cobra o frete', () => {
    expect(calcularTotalComDesconto(100, 20, 100)).toBe(20);
  });

  it('arredonda centavos em vez de arrastar dízima', () => {
    // 19.90 * 3 = 59.70; 10% = 5.97; sobra 53.73 + 10 de frete.
    expect(calcularTotalComDesconto(59.7, 10, 10)).toBe(63.73);
  });

  // Percentual fora da faixa vira "sem desconto", nunca desconto negativo —
  // que aumentaria o valor da venda em silêncio.
  it('ignora percentual inválido em vez de inverter a conta', () => {
    expect(calcularTotalComDesconto(100, 0, -10)).toBe(100);
    expect(calcularTotalComDesconto(100, 0, 150)).toBe(100);
    expect(calcularTotalComDesconto(100, 0, NaN)).toBe(100);
  });

  it('venda sem frete funciona', () => {
    expect(calcularTotalComDesconto(200, 0, 25)).toBe(150);
  });
});

describe('valorDoDesconto', () => {
  it('diz quanto se abriu mão', () => {
    expect(valorDoDesconto(100, 15)).toBe(15);
    expect(valorDoDesconto(59.7, 10)).toBe(5.97);
  });

  it('é zero quando não há desconto válido', () => {
    expect(valorDoDesconto(100, 0)).toBe(0);
    expect(valorDoDesconto(100, 200)).toBe(0);
  });
});
