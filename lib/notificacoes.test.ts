import { describe, expect, it } from 'vitest';
import { montarAvisos, situacaoDasVendas } from '@/lib/notificacoes';

const HOJE = '2026-10-28';

describe('situacaoDasVendas', () => {
  it('só conta entrega que tem data', () => {
    const situacao = situacaoDasVendas(
      [
        { status: 'pago', entrega: 'pendente', delivery_date: HOJE, faturamento_total: 10 },
        { status: 'pago', entrega: 'pendente', delivery_date: '2026-10-20', faturamento_total: 10 },
        // Venda antiga sem data: não é entrega atrasada.
        { status: 'pago', entrega: 'pendente', delivery_date: null, faturamento_total: 10 },
        { status: 'pago', entrega: 'entregue', delivery_date: '2026-10-20', faturamento_total: 10 },
        { status: 'pago', entrega: 'pendente', delivery_date: '2026-11-02', faturamento_total: 10 },
      ],
      HOJE,
    );
    expect(situacao.entregasHoje).toBe(1);
    expect(situacao.entregasAtrasadas).toBe(1);
    expect(situacao.aReceber).toBe(0);
  });

  it('soma o que está a receber e ignora cancelada', () => {
    const situacao = situacaoDasVendas(
      [
        { status: 'pendente', entrega: 'entregue', delivery_date: null, faturamento_total: '35.5' },
        { status: 'pendente', entrega: 'nao_aplica', delivery_date: null, faturamento_total: 20 },
        { status: 'cancelada', entrega: 'pendente', delivery_date: HOJE, faturamento_total: 99 },
      ],
      HOJE,
    );
    expect(situacao.aReceber).toBe(2);
    expect(situacao.valorAReceber).toBe(55.5);
    expect(situacao.entregasHoje).toBe(0);
  });
});

describe('montarAvisos', () => {
  it('põe o urgente primeiro', () => {
    const avisos = montarAvisos({
      hoje: HOJE,
      lembretesHoje: 2,
      lembretesAtrasados: 1,
      vendas: { entregasHoje: 1, entregasAtrasadas: 0, aReceber: 3, valorAReceber: 150 },
    });
    expect(avisos[0]?.tom).toBe('urgente');
    expect(avisos.map((a) => a.titulo)).toEqual([
      '1 contato atrasado na agenda',
      '1 entrega pra hoje',
      '2 contatos pra fazer hoje',
      '3 vendas a receber',
      'Natal em 58 dias',
    ]);
  });

  it('sem nada pendente e longe de data comercial, a lista fica vazia', () => {
    expect(
      montarAvisos({ hoje: '2026-10-13', lembretesHoje: 0, lembretesAtrasados: 0, vendas: null }),
    ).toEqual([]);
  });

  it('o aviso da data volta a ser novo a cada marco, não todo dia', () => {
    const id = (hoje: string) =>
      montarAvisos({ hoje, lembretesHoje: 0, lembretesAtrasados: 0, vendas: null })[0]?.id;
    // 58 e 50 dias: mesmo marco (60).
    expect(id('2026-10-28')).toBe(id('2026-11-05'));
    // 44 dias: cruzou o marco de 45.
    expect(id('2026-11-11')).not.toBe(id('2026-10-28'));
  });

  it('a receber só volta a ser novo quando a quantidade muda', () => {
    const vendas = { entregasHoje: 0, entregasAtrasadas: 0, aReceber: 2, valorAReceber: 10 };
    const id = (hoje: string) =>
      montarAvisos({ hoje, lembretesHoje: 0, lembretesAtrasados: 0, vendas }).find((a) =>
        a.id.startsWith('a-receber'),
      )?.id;
    expect(id('2026-10-13')).toBe(id('2026-10-14'));
  });
});

describe('avisos de encontro e desafio', () => {
  const base = { hoje: '2026-11-04', lembretesHoje: 0, lembretesAtrasados: 0, vendas: null };
  const encontro = { id: 'e1', titulo: 'Precificação', inicio: '2026-11-04T19:00:00-03:00', duracao_minutos: 60 };

  it('encontro de hoje: avisa de manhã e de novo quando começa', () => {
    const manha = montarAvisos({ ...base, encontrosHoje: [encontro], agora: new Date('2026-11-04T12:00:00Z') });
    const hora = montarAvisos({ ...base, encontrosHoje: [encontro], agora: new Date('2026-11-04T21:50:00Z') });
    expect(manha[0]?.titulo).toBe('Encontro hoje às 19h');
    expect(hora[0]).toMatchObject({ titulo: 'Encontro começando agora: Precificação', tom: 'urgente' });
    expect(manha[0]?.id).not.toBe(hora[0]?.id);
  });

  it('encontro que já acabou não avisa', () => {
    const depois = montarAvisos({ ...base, encontrosHoje: [encontro], agora: new Date('2026-11-05T00:30:00Z') });
    expect(depois.some((a) => a.id.startsWith('encontro'))).toBe(false);
  });

  it('desafio novo', () => {
    const avisos = montarAvisos({ ...base, desafiosNovos: [{ id: 'd1', titulo: '7 dias de stories' }] });
    expect(avisos.find((a) => a.id === 'desafio:d1')?.titulo).toBe('Desafio novo: 7 dias de stories');
  });
});
