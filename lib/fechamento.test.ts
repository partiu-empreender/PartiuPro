import { describe, expect, it } from 'vitest';
import {
  mesJaEncerrado,
  motivoFechamentoInvalido,
  resolverNumerosDoMes,
  temAlgumValor,
  type ApuradoDasVendas,
  type FechamentoManual,
} from '@/lib/fechamento';

// "Hoje" fixo em todos os testes: setembro de 2026. Sem isto a suíte passaria
// hoje e quebraria na virada do mês, que é o tipo de teste que ninguém confia.
const HOJE = { ano: 2026, mes: 9, dia: 3 };

const semVendas: ApuradoDasVendas = {
  faturamento: 0,
  vendas: 0,
  produtos_vendidos: 0,
  atendimentos: 0,
};

const manual = (campos: Partial<FechamentoManual>): FechamentoManual => ({
  mes: 7,
  ano: 2026,
  faturamento: null,
  vendas: null,
  produtos_vendidos: null,
  atendimentos: null,
  ticket_medio: null,
  conversao: null,
  observacao: null,
  ...campos,
});

describe('mesJaEncerrado', () => {
  it('reconhece mês passado, corrente e futuro no ano corrente', () => {
    expect(mesJaEncerrado(8, 2026, HOJE)).toBe(true);
    expect(mesJaEncerrado(9, 2026, HOJE)).toBe(false);
    expect(mesJaEncerrado(10, 2026, HOJE)).toBe(false);
  });

  it('compara o ano antes do mês', () => {
    // Dezembro de 2025 já passou, mesmo sendo mês "maior" que setembro.
    expect(mesJaEncerrado(12, 2025, HOJE)).toBe(true);
    expect(mesJaEncerrado(1, 2027, HOJE)).toBe(false);
  });
});

describe('resolverNumerosDoMes — mês corrente', () => {
  // A regra que o usuário pediu com todas as letras: o mês atual continua
  // como está hoje. Fechamento manual gravado nele é ignorado.
  it('sempre usa as vendas, mesmo havendo fechamento manual gravado', () => {
    const apurado: ApuradoDasVendas = {
      faturamento: 2100,
      vendas: 3,
      produtos_vendidos: 5,
      atendimentos: 10,
    };
    const r = resolverNumerosDoMes(
      9,
      2026,
      apurado,
      manual({ mes: 9, faturamento: 38400, vendas: 62 }),
      HOJE,
    );

    expect(r.fonte).toBe('vendas');
    expect(r.faturamento).toBe(2100);
    expect(r.ehMesCorrenteOuFuturo).toBe(true);
    expect(r.divergencia).toBeNull();
  });

  it('calcula os derivados a partir das vendas', () => {
    const r = resolverNumerosDoMes(
      9,
      2026,
      { faturamento: 1000, vendas: 4, produtos_vendidos: 8, atendimentos: 20 },
      null,
      HOJE,
    );

    expect(r.ticket_medio).toBe(250);
    expect(r.conversao).toBe(20);
    expect(r.pa).toBe(0.4);
  });
});

describe('resolverNumerosDoMes — mês encerrado', () => {
  it('usa o fechamento manual quando ele existe', () => {
    const r = resolverNumerosDoMes(
      7,
      2026,
      semVendas,
      manual({ faturamento: 38400, vendas: 62, produtos_vendidos: 112, atendimentos: 180 }),
      HOJE,
    );

    expect(r.fonte).toBe('manual');
    expect(r.faturamento).toBe(38400);
    expect(r.ticket_medio).toBeCloseTo(619.35, 2);
    expect(r.conversao).toBeCloseTo(34.44, 2);
    expect(r.pa).toBeCloseTo(0.62, 2);
  });

  // A decisão confirmada: o manual é o número da planilha (mês inteiro), as
  // vendas lançadas são as três que ela digitou testando.
  it('o manual vence as vendas lançadas, mas denuncia a divergência', () => {
    const r = resolverNumerosDoMes(
      7,
      2026,
      { faturamento: 2100, vendas: 3, produtos_vendidos: 5, atendimentos: 0 },
      manual({ faturamento: 38400, vendas: 62 }),
      HOJE,
    );

    expect(r.fonte).toBe('manual');
    expect(r.faturamento).toBe(38400);
    expect(r.divergencia).toEqual({
      faturamentoManual: 38400,
      faturamentoDasVendas: 2100,
      vendasLancadas: 3,
    });
  });

  it('não acusa divergência quando os dois batem', () => {
    const r = resolverNumerosDoMes(
      7,
      2026,
      { faturamento: 38400, vendas: 62, produtos_vendidos: 112, atendimentos: 180 },
      manual({ faturamento: 38400, vendas: 62 }),
      HOJE,
    );

    expect(r.divergencia).toBeNull();
  });

  it('não acusa divergência quando não há venda lançada nenhuma', () => {
    const r = resolverNumerosDoMes(7, 2026, semVendas, manual({ faturamento: 38400 }), HOJE);
    expect(r.divergencia).toBeNull();
  });

  it('cai nas vendas quando não há fechamento manual', () => {
    const r = resolverNumerosDoMes(
      7,
      2026,
      { faturamento: 5000, vendas: 10, produtos_vendidos: 15, atendimentos: 40 },
      null,
      HOJE,
    );

    expect(r.fonte).toBe('vendas');
    expect(r.faturamento).toBe(5000);
  });

  // Uma linha salva sem nada digitado não pode zerar o mês na tela.
  it('ignora fechamento com todos os campos vazios', () => {
    const r = resolverNumerosDoMes(
      7,
      2026,
      { faturamento: 5000, vendas: 10, produtos_vendidos: 15, atendimentos: 40 },
      manual({ observacao: 'abri e fechei sem digitar' }),
      HOJE,
    );

    expect(r.fonte).toBe('vendas');
    expect(r.faturamento).toBe(5000);
  });

  it('marca como vazio o mês sem venda e sem fechamento', () => {
    expect(resolverNumerosDoMes(7, 2026, semVendas, null, HOJE).fonte).toBe('vazio');
  });
});

describe('resolverNumerosDoMes — derivados incalculáveis', () => {
  // "—" e não "0%": sem atendimento registrado a conversão não é zero, é
  // desconhecida. É a mesma distinção que lib/metrics.ts já faz nos insights.
  it('devolve null em vez de zero quando falta o denominador', () => {
    const r = resolverNumerosDoMes(
      7,
      2026,
      semVendas,
      manual({ faturamento: 38400, atendimentos: null, vendas: null }),
      HOJE,
    );

    expect(r.ticket_medio).toBeNull();
    expect(r.conversao).toBeNull();
    expect(r.pa).toBeNull();
  });

  // Quem anotou "ticket médio 620" sem saber o nº de vendas não chega lá por
  // divisão — por isso os dois campos de escape existem.
  it('respeita ticket e conversão digitados à mão', () => {
    const r = resolverNumerosDoMes(
      7,
      2026,
      semVendas,
      manual({ faturamento: 38400, ticket_medio: 620, conversao: 35 }),
      HOJE,
    );

    expect(r.ticket_medio).toBe(620);
    expect(r.conversao).toBe(35);
  });

  it('o valor digitado vence o calculado quando os dois existem', () => {
    const r = resolverNumerosDoMes(
      7,
      2026,
      semVendas,
      manual({ faturamento: 1000, vendas: 4, ticket_medio: 500 }),
      HOJE,
    );

    // 1000/4 daria 250; ela disse 500 e é isso que vale.
    expect(r.ticket_medio).toBe(500);
  });
});

describe('temAlgumValor', () => {
  it('observação sozinha não conta como fechamento preenchido', () => {
    expect(temAlgumValor(manual({ observacao: 'mês fraco' }))).toBe(false);
  });

  it('zero conta como valor — é "não houve", não "não sei"', () => {
    expect(temAlgumValor(manual({ faturamento: 0 }))).toBe(true);
  });
});

describe('motivoFechamentoInvalido', () => {
  it('aceita mês encerrado', () => {
    expect(motivoFechamentoInvalido(7, 2026, HOJE)).toBeNull();
    expect(motivoFechamentoInvalido(12, 2025, HOJE)).toBeNull();
  });

  it('recusa o mês corrente e o futuro, explicando o porquê', () => {
    expect(motivoFechamentoInvalido(9, 2026, HOJE)).toMatch(/já encerrou/i);
    expect(motivoFechamentoInvalido(10, 2026, HOJE)).toMatch(/já encerrou/i);
  });

  it('recusa mês e ano fora da faixa', () => {
    expect(motivoFechamentoInvalido(0, 2026, HOJE)).toBe('Mês inválido.');
    expect(motivoFechamentoInvalido(13, 2026, HOJE)).toBe('Mês inválido.');
    expect(motivoFechamentoInvalido(7, 1999, HOJE)).toBe('Ano inválido.');
  });
});
