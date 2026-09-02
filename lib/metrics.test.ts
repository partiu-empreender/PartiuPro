import { describe, expect, it } from 'vitest';
import { calcularRelatorioMensal, FAIXAS_DE_PRECO } from '@/lib/metrics';

/**
 * As faixas de valor do Raio-X do Mês.
 *
 * O que se testa aqui é a unidade de análise: a faixa fala de PREÇO DE
 * PRODUTO, não de valor de transação. Era esse o defeito — a Tania via o
 * catálogo dela classificado errado porque uma venda de 3 cestas de R$ 150
 * entrava como uma venda de R$ 450.
 */

const item = (
  preco: number,
  quantidade = 1,
  tipo: 'produto' | 'adicional' = 'produto',
  nome = 'Cesta',
) => ({
  quantidade,
  produto_nome: nome,
  preco_unitario: preco,
  subtotal: preco * quantidade,
  tipo,
});

const venda = (itens: ReturnType<typeof item>[], frete = 0) => ({
  faturamento_total: itens.reduce((s, i) => s + i.subtotal, 0) + frete,
  venda_itens: itens,
});

// toLocaleString separa "R$" do número com espaço NÃO-QUEBRÁVEL (U+00A0), e
// não com o espaço comum que se digita aqui. Sem normalizar, a comparação
// falha exibindo duas strings visualmente idênticas — meia hora de confusão
// pra quem for mexer nestes testes depois.
const semNbsp = (texto: string) => texto.replace(/\u00a0/g, ' ');

/** Só as faixas que tiveram venda, no formato "rótulo: quantidade". */
const resumo = (faixas: { rotulo: string; quantidade: number }[]) =>
  faixas
    .filter((f) => f.quantidade > 0)
    .map((f) => `${semNbsp(f.rotulo)}: ${f.quantidade}`);

describe('faixas de preço', () => {
  // O caso exato que estava errado em produção.
  it('classifica pelo preço do produto, não pelo valor da venda', () => {
    const relatorio = calcularRelatorioMensal([venda([item(150, 3)])], 0, 0);

    // 3 cestas de R$ 150 são 3 produtos na faixa 100–200...
    expect(resumo(relatorio.faixas)).toEqual(['R$ 100,00 a R$ 200,00: 3']);

    // ...e NÃO uma venda de R$ 450 na faixa 300–500, que era o resultado antigo.
    const faixaAlta = relatorio.faixas.find((f) => f.min === 300);
    expect(faixaAlta?.quantidade).toBe(0);
  });

  it('a quantidade do item pesa na contagem', () => {
    const relatorio = calcularRelatorioMensal([venda([item(50, 4)])], 0, 0);
    expect(relatorio.faixas[0]?.quantidade).toBe(4);
    expect(relatorio.faixas[0]?.percentualVendas).toBe(100);
  });

  // O frete não é produto e não pode empurrar a venda pra faixa de cima.
  it('ignora o frete', () => {
    const relatorio = calcularRelatorioMensal([venda([item(180)], 40)], 0, 0);
    expect(resumo(relatorio.faixas)).toEqual(['R$ 100,00 a R$ 200,00: 1']);
  });

  // Um cartão de R$ 15 não é "venda abaixo de R$ 100": é complemento de uma
  // venda que já foi contada. Deixá-lo entrar incharia a faixa baixa.
  it('não conta adicionais', () => {
    const relatorio = calcularRelatorioMensal(
      [venda([item(250), item(15, 1, 'adicional', 'Cartão')])],
      0,
      0,
    );
    expect(resumo(relatorio.faixas)).toEqual(['R$ 200,00 a R$ 300,00: 1']);
  });

  // Fronteira fechada embaixo, aberta em cima: R$ 200 cai em 200–300 e em
  // lugar nenhum mais. Sem isso um produto no limite some ou conta duas vezes.
  it('põe o valor da fronteira na faixa de cima, uma vez só', () => {
    const relatorio = calcularRelatorioMensal([venda([item(200), item(100)])], 0, 0);
    expect(resumo(relatorio.faixas)).toEqual([
      'R$ 100,00 a R$ 200,00: 1',
      'R$ 200,00 a R$ 300,00: 1',
    ]);
  });

  it('a última faixa é aberta pra cima', () => {
    const relatorio = calcularRelatorioMensal([venda([item(1200)])], 0, 0);
    expect(resumo(relatorio.faixas)).toEqual(['Acima de R$ 500,00: 1']);
  });

  // As fronteiras não podem mudar com os dados — era o defeito do tercil.
  it('devolve sempre as mesmas faixas, independente do movimento do mês', () => {
    const magro = calcularRelatorioMensal([venda([item(80)])], 0, 0);
    const gordo = calcularRelatorioMensal(
      [venda([item(80)]), venda([item(700, 5)]), venda([item(310, 2)])],
      0,
      0,
    );
    expect(magro.faixas.map((f) => f.rotulo)).toEqual(gordo.faixas.map((f) => f.rotulo));
    expect(magro.faixas).toHaveLength(FAIXAS_DE_PRECO.length);
  });

  it('mês sem venda devolve lista vazia em vez de quebrar', () => {
    const relatorio = calcularRelatorioMensal([], 0, 0);
    expect(relatorio.faixas).toEqual([]);
    expect(relatorio.insights).toEqual([]);
  });

  it('os percentuais fecham em 100', () => {
    const relatorio = calcularRelatorioMensal(
      [venda([item(50), item(150, 2)]), venda([item(400)])],
      0,
      0,
    );
    const soma = relatorio.faixas.reduce((s, f) => s + f.percentualVendas, 0);
    expect(soma).toBeCloseTo(100, 1);
  });
});

describe('insights de catálogo', () => {
  it('aponta onde o catálogo mais gira', () => {
    const relatorio = calcularRelatorioMensal(
      [venda([item(120, 8)]), venda([item(450)])],
      10,
      0,
    );
    // 8 de 9 produtos na faixa 100–200 = 89%.
    expect(
      relatorio.insights.some(
        (i) => i.includes('89%') && semNbsp(i).includes('r$ 100,00 a r$ 200,00'),
      ),
    ).toBe(true);
  });

  it('avisa quando uma faixa intermediária ficou vazia', () => {
    // Vende barato e caro, nada no meio.
    const relatorio = calcularRelatorioMensal([venda([item(50)]), venda([item(450)])], 5, 0);
    expect(relatorio.insights.some((i) => i.includes('não vendeu nada na faixa'))).toBe(true);
  });
});

describe('o resto do relatório continua de pé', () => {
  it('ticket médio segue por transação, não por produto', () => {
    // Duas vendas: uma de R$ 300 (2 itens) e uma de R$ 100.
    const relatorio = calcularRelatorioMensal(
      [venda([item(150, 2)]), venda([item(100)])],
      0,
      0,
    );
    expect(relatorio.vendas_realizadas).toBe(2);
    expect(relatorio.produtos_vendidos).toBe(3);
    expect(relatorio.ticket_medio_mes).toBe(200);
  });

  it('a projeção de referência usa as vendas acima da média', () => {
    const relatorio = calcularRelatorioMensal(
      [venda([item(100)]), venda([item(100)]), venda([item(400)])],
      0,
      6000,
    );
    // Ticket médio = 200; a única venda acima é a de 400.
    expect(relatorio.projecao_ticket_referencia?.valorReferencia).toBe(400);
    expect(relatorio.projecao_ticket_referencia?.cestasNecessarias).toBe(15);
  });
});
