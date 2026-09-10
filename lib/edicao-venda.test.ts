import { describe, expect, it } from 'vitest';
import { recalcularTotaisDaVenda } from '@/lib/edicao-venda';

/**
 * O risco que estes testes cobrem: `faturamento_total` guarda itens + frete.
 * Uma conta errada aqui não dá erro em lugar nenhum — a venda só passa a valer
 * outra coisa, e o Raio-X mente junto.
 */

describe('recalcularTotaisDaVenda', () => {
  it('troca os itens e mantém o frete que já existia', () => {
    // Venda de R$ 100 em itens + R$ 20 de frete = 120 gravados.
    const totais = recalcularTotaisDaVenda(
      [{ quantidade: 2, preco_unitario: 75 }],
      undefined,
      120,
      20,
    );
    expect(totais).toEqual({ faturamento_total: 170, shipping_cost: 20 });
  });

  // O caso que mais fácil se erraria: sem itens novos, o valor dos itens tem
  // que sair do frete ANTIGO. Descontando o frete novo, os itens mudariam
  // sozinhos só porque o frete foi corrigido.
  it('troca só o frete sem alterar o valor dos itens', () => {
    const totais = recalcularTotaisDaVenda(null, 35, 120, 20);
    expect(totais).toEqual({ faturamento_total: 135, shipping_cost: 35 });
  });

  it('troca itens e frete ao mesmo tempo', () => {
    const totais = recalcularTotaisDaVenda(
      [
        { quantidade: 1, preco_unitario: 50 },
        { quantidade: 3, preco_unitario: 10 },
      ],
      15,
      120,
      20,
    );
    expect(totais).toEqual({ faturamento_total: 95, shipping_cost: 15 });
  });

  it('aceita zerar o frete', () => {
    // `0` é um valor, não "não mexeu" — se virasse ausência, o frete antigo
    // voltaria e a correção da aluna seria silenciosamente desfeita.
    const totais = recalcularTotaisDaVenda(null, 0, 120, 20);
    expect(totais).toEqual({ faturamento_total: 100, shipping_cost: 0 });
  });

  it('venda sem frete nenhum continua sem frete', () => {
    const totais = recalcularTotaisDaVenda([{ quantidade: 1, preco_unitario: 80 }], undefined, 100, 0);
    expect(totais).toEqual({ faturamento_total: 80, shipping_cost: 0 });
  });

  it('lida com centavos sem arrastar erro de arredondamento visível', () => {
    const totais = recalcularTotaisDaVenda(
      [{ quantidade: 3, preco_unitario: 19.9 }],
      10.5,
      100,
      0,
    );
    expect(totais.faturamento_total).toBeCloseTo(70.2, 2);
    expect(totais.shipping_cost).toBe(10.5);
  });
});
