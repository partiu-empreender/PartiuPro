import { describe, expect, it } from 'vitest';
import { calcularDRE, type SaidaParaDRE, type VendaParaDRE } from '@/lib/dre';

/**
 * O DRE é a tela onde um erro de conta vira uma decisão errada de negócio: a
 * aluna olha o lucro e decide se baixa preço, corta despesa ou aumenta a meta.
 * Nada aqui levanta exceção quando erra — só mostra um lucro que não existe.
 */

describe('calcularDRE', () => {
  const vendas: VendaParaDRE[] = [
    {
      faturamento_total: 320, // 300 em itens + 20 de frete
      shipping_cost: 20,
      venda_itens: [{ quantidade: 2, custo_unitario: 50 }],
    },
    {
      faturamento_total: 200,
      shipping_cost: 0,
      venda_itens: [{ quantidade: 1, custo_unitario: 80 }],
    },
  ];

  const saidas: SaidaParaDRE[] = [
    { valor: 100, categoria: 'Insumos' },
    { valor: 60, categoria: 'Internet' },
    { valor: 40, categoria: 'Insumos' },
  ];

  // A regra que mais inflaria o lucro se estivesse errada: o frete não é
  // receita da aluna, é repasse para quem entrega.
  it('tira o frete do faturamento', () => {
    const dre = calcularDRE(vendas, []);
    expect(dre.faturamento).toBe(500); // 520 − 20 de frete
    expect(dre.frete).toBe(20);
  });

  it('calcula lucro bruto e margem bruta', () => {
    const dre = calcularDRE(vendas, []);
    expect(dre.custoDosProdutos).toBe(180); // 2×50 + 1×80
    expect(dre.lucroBruto).toBe(320); // 500 − 180
    expect(dre.margemBruta).toBe(64); // 320/500
  });

  it('desconta despesas e o frete do lucro líquido', () => {
    const dre = calcularDRE(vendas, saidas);
    expect(dre.despesas).toBe(200);
    expect(dre.totalDeSaidas).toBe(220); // 200 + 20 de frete
    expect(dre.lucroLiquido).toBe(100); // 320 − 220
  });

  it('agrupa despesas por categoria, da maior para a menor', () => {
    const dre = calcularDRE(vendas, saidas);
    expect(dre.porCategoria.map((c) => c.categoria)).toEqual(['Insumos', 'Internet', 'Frete']);
    expect(dre.porCategoria[0]).toEqual({ categoria: 'Insumos', valor: 140, percentual: 63.64 });
  });

  // Produto sem custo cadastrado entra como zero, não como estimativa: chutar
  // faria o lucro parecer conhecido quando não é.
  it('trata custo ausente como zero, sem estimar', () => {
    const dre = calcularDRE(
      [{ faturamento_total: 100, shipping_cost: 0, venda_itens: [{ quantidade: 1 }] }],
      [],
    );
    expect(dre.custoDosProdutos).toBe(0);
    expect(dre.lucroBruto).toBe(100);
  });

  // Sem estas proteções a tela mostraria "NaN%" ou "Infinity%".
  it('não divide por zero quando não houve faturamento', () => {
    const dre = calcularDRE([], [{ valor: 50, categoria: 'Internet' }]);
    expect(dre.faturamento).toBe(0);
    expect(dre.margemBruta).toBe(0);
    expect(dre.margemLiquida).toBe(0);
    expect(dre.lucroLiquido).toBe(-50);
  });

  it('mês sem nada é tudo zero', () => {
    const dre = calcularDRE([], []);
    expect(dre.lucroLiquido).toBe(0);
    expect(dre.porCategoria).toEqual([]);
  });

  it('categoria vazia vira Outros em vez de sumir', () => {
    const dre = calcularDRE([], [{ valor: 30, categoria: '   ' }]);
    expect(dre.porCategoria[0]?.categoria).toBe('Outros');
  });

  it('lucro negativo é reportado como negativo, não zerado', () => {
    const dre = calcularDRE(
      [{ faturamento_total: 100, shipping_cost: 0, venda_itens: [{ quantidade: 1, custo_unitario: 90 }] }],
      [{ valor: 200, categoria: 'Aluguel' }],
    );
    expect(dre.lucroLiquido).toBe(-190);
    expect(dre.margemLiquida).toBe(-190);
  });
});
