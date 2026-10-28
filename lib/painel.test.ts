import { describe, expect, it } from 'vitest';
import {
  formasDePagamento,
  maisVendidos,
  progressoDoMes,
  recebimentoDoMes,
  recorteDoMesAteHoje,
  semanaDe,
  ultimosMeses,
  type VendaDoMes,
} from '@/lib/painel';

const venda = (parcial: Partial<VendaDoMes>): VendaDoMes => ({
  id: Math.random().toString(),
  data: '2026-10-10',
  cliente_nome: 'Ana',
  faturamento_total: 100,
  status: 'pago',
  forma_pagamento: null,
  venda_itens: [],
  ...parcial,
});

describe('ultimosMeses', () => {
  it('termina no mês atual e atravessa a virada do ano', () => {
    expect(ultimosMeses('2026-02-10', 4).map((m) => `${m.rotulo}/${m.ano}`)).toEqual([
      'Nov/2025',
      'Dez/2025',
      'Jan/2026',
      'Fev/2026',
    ]);
  });
});

describe('recorteDoMesAteHoje', () => {
  it('o mês atual para em hoje; os anteriores vão até o último dia', () => {
    expect(recorteDoMesAteHoje({ ano: 2026, mes: 10, rotulo: 'Out' }, '2026-10-28')).toEqual({
      inicio: '2026-10-01',
      fim: '2026-10-28',
    });
    expect(recorteDoMesAteHoje({ ano: 2026, mes: 9, rotulo: 'Set' }, '2026-10-28').fim).toBe(
      '2026-09-30',
    );
  });
});

describe('progressoDoMes', () => {
  it('conta o dia sobre os dias do mês', () => {
    expect(progressoDoMes('2026-09-15')).toEqual({ dia: 15, diasNoMes: 30, percentual: 50 });
  });
});

describe('recebimentoDoMes', () => {
  it('separa pago de a receber', () => {
    const r = recebimentoDoMes([
      venda({ status: 'pago', faturamento_total: 300 }),
      venda({ status: 'pendente', faturamento_total: '100' }),
    ]);
    expect(r).toEqual({ pago: 300, aReceber: 100, percentualPago: 75 });
  });

  it('sem venda, não inventa percentual', () => {
    expect(recebimentoDoMes([]).percentualPago).toBeNull();
  });
});

describe('formasDePagamento', () => {
  it('agrupa, ordena pelo valor e deixa "Não informado" por último', () => {
    const formas = formasDePagamento([
      venda({ forma_pagamento: null, faturamento_total: 900 }),
      venda({ forma_pagamento: 'pix', faturamento_total: 100 }),
      venda({ forma_pagamento: 'pix', faturamento_total: 50 }),
      venda({ forma_pagamento: 'credito', faturamento_total: 200 }),
    ]);
    expect(formas.map((f) => [f.rotulo, f.total, f.quantidade])).toEqual([
      ['Crédito', 200, 1],
      ['Pix', 150, 2],
      ['Não informado', 900, 1],
    ]);
  });
});

describe('maisVendidos', () => {
  it('soma pelo nome sem ligar pra maiúscula e ignora adicional', () => {
    const lista = maisVendidos([
      venda({
        venda_itens: [
          { produto_nome: 'Cesta Amor', quantidade: 1, subtotal: 150 },
          { produto_nome: 'Balão', quantidade: 1, subtotal: 20, tipo: 'adicional' },
        ],
      }),
      venda({ venda_itens: [{ produto_nome: 'cesta amor ', quantidade: '2', subtotal: '300' }] }),
      venda({ venda_itens: [{ produto_nome: 'Box Café', quantidade: 1, subtotal: 90 }] }),
    ]);
    expect(lista).toEqual([
      { nome: 'Cesta Amor', quantidade: 3, total: 450 },
      { nome: 'Box Café', quantidade: 1, total: 90 },
    ]);
  });
});

describe('semanaDe', () => {
  it('vai de domingo a sábado e marca hoje', () => {
    // 28/10/2026 é uma quarta.
    const semana = semanaDe('2026-10-28');
    expect(semana[0]).toEqual({ data: '2026-10-25', rotulo: 'Dom', dia: 25, hoje: false });
    expect(semana[3]?.hoje).toBe(true);
    expect(semana[6]?.data).toBe('2026-10-31');
  });
});
