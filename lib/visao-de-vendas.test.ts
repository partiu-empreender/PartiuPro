import { describe, expect, it } from 'vitest';
import { resumirVendas, type VendaParaVisao } from '@/lib/visao-de-vendas';

const vendas: VendaParaVisao[] = [
  {
    data: '2026-09-10',
    faturamento_total: 300,
    venda_itens: [
      { produto_nome: 'Cesta Grande', quantidade: 1, subtotal: 250 },
      { produto_nome: 'Chaveiro', quantidade: 5, subtotal: 50 },
    ],
  },
  {
    data: '2026-09-10',
    faturamento_total: 100,
    venda_itens: [{ produto_nome: 'Cesta Pequena', quantidade: 1, subtotal: 100 }],
  },
  {
    data: '2026-09-08',
    faturamento_total: 200,
    venda_itens: [{ produto_nome: 'Cesta Grande', quantidade: 1, subtotal: 200 }],
  },
];

describe('resumirVendas', () => {
  it('soma o faturamento e conta as vendas', () => {
    const r = resumirVendas(vendas);
    expect(r.faturamento).toBe(600);
    expect(r.vendas).toBe(3);
    expect(r.ticketMedio).toBe(200);
  });

  it('agrupa por dia, do mais recente para o mais antigo', () => {
    const r = resumirVendas(vendas);
    expect(r.porDia).toEqual([
      { data: '2026-09-10', vendas: 2, faturamento: 400 },
      { data: '2026-09-08', vendas: 1, faturamento: 200 },
    ]);
  });

  it('encontra o melhor dia', () => {
    expect(resumirVendas(vendas).melhorDia?.data).toBe('2026-09-10');
  });

  // Somar o mesmo produto entre vendas diferentes é o ponto do agrupamento:
  // "Cesta Grande" aparece em dois dias e tem que virar uma linha só.
  it('junta o mesmo produto vendido em dias diferentes', () => {
    const cesta = resumirVendas(vendas).porProduto.find((p) => p.nome === 'Cesta Grande');
    expect(cesta).toEqual({ nome: 'Cesta Grande', quantidade: 2, faturamento: 450 });
  });

  // A ordem é por FATURAMENTO, não por quantidade: 5 chaveiros vendidos não
  // são mais relevantes que 2 cestas quando a pergunta é onde está o dinheiro.
  it('ordena os produtos por faturamento, não por quantidade', () => {
    const r = resumirVendas(vendas);
    expect(r.porProduto.map((p) => p.nome)).toEqual([
      'Cesta Grande',
      'Cesta Pequena',
      'Chaveiro',
    ]);
  });

  // Sem esta proteção o ticket vira NaN e aparece na tela como "R$ NaN".
  it('não divide por zero quando não houve venda', () => {
    const r = resumirVendas([]);
    expect(r.ticketMedio).toBe(0);
    expect(r.faturamento).toBe(0);
    expect(r.melhorDia).toBeNull();
    expect(r.porProduto).toEqual([]);
  });

  it('aguenta venda sem itens sem quebrar', () => {
    const r = resumirVendas([{ data: '2026-09-10', faturamento_total: 80, venda_itens: null }]);
    expect(r.faturamento).toBe(80);
    expect(r.porProduto).toEqual([]);
  });

  it('não perde item sem nome', () => {
    const r = resumirVendas([
      { data: '2026-09-10', faturamento_total: 50, venda_itens: [{ produto_nome: '  ', quantidade: 1, subtotal: 50 }] },
    ]);
    expect(r.porProduto[0]?.nome).toBe('Sem nome');
  });
});
