import { describe, expect, it } from 'vitest';
import {
  ANOS_DE_LANCAMENTO_RETROATIVO,
  motivoDataDeVendaInvalida,
  nomeDoMes,
  recorteDoMes,
} from '@/lib/datas';

/**
 * A data de uma venda lançada à mão.
 *
 * A regra existe porque a Tania precisa cadastrar meses anteriores — o sistema
 * não pode começar a existir no dia em que ela instalou. O que se testa aqui é
 * o contorno: até onde pra trás vale, e o que continua barrado.
 */

const HOJE = '2026-09-01';

describe('data de venda retroativa', () => {
  it('aceita hoje', () => {
    expect(motivoDataDeVendaInvalida(HOJE, HOJE)).toBeNull();
  });

  // O pedido em si: lançar o histórico de meses passados.
  it('aceita meses anteriores', () => {
    expect(motivoDataDeVendaInvalida('2026-07-15', HOJE)).toBeNull();
    expect(motivoDataDeVendaInvalida('2025-12-24', HOJE)).toBeNull();
  });

  it('aceita o limite exato dos 3 anos', () => {
    expect(motivoDataDeVendaInvalida('2023-09-01', HOJE)).toBeNull();
  });

  // Ano digitado errado (2016 no lugar de 2026) entraria calado e sumiria do
  // relatório, porque nenhuma tela olha tão pra trás.
  it('recusa data antiga demais', () => {
    expect(motivoDataDeVendaInvalida('2016-09-01', HOJE)).toMatch(/últimos 3 anos/);
    expect(motivoDataDeVendaInvalida('2023-08-31', HOJE)).toMatch(/últimos 3 anos/);
  });

  // Venda futura é encomenda, e encomenda tem campo próprio (delivery_date).
  // Aceitar aqui inflaria a meta do mês com dinheiro que não entrou.
  it('recusa data futura', () => {
    expect(motivoDataDeVendaInvalida('2026-09-02', HOJE)).toMatch(/futura/);
    expect(motivoDataDeVendaInvalida('2027-01-01', HOJE)).toMatch(/futura/);
  });

  it('recusa dia que não existe no calendário', () => {
    expect(motivoDataDeVendaInvalida('2026-02-31', HOJE)).toBeTruthy();
    expect(motivoDataDeVendaInvalida('2026-13-01', HOJE)).toBeTruthy();
  });

  it('recusa o que nem parece data', () => {
    expect(motivoDataDeVendaInvalida('', HOJE)).toBeTruthy();
    expect(motivoDataDeVendaInvalida('01/09/2026', HOJE)).toBeTruthy();
    expect(motivoDataDeVendaInvalida('ontem', HOJE)).toBeTruthy();
  });

  // 29/02 existe em 2024 e não existe em 2025 — o validador tem que saber.
  it('entende ano bissexto', () => {
    expect(motivoDataDeVendaInvalida('2024-02-29', '2026-01-01')).toBeNull();
    expect(motivoDataDeVendaInvalida('2025-02-29', '2026-01-01')).toBeTruthy();
  });

  it('a janela retroativa é a constante exportada', () => {
    expect(ANOS_DE_LANCAMENTO_RETROATIVO).toBe(3);
  });
});

/**
 * O recorte de um mês do calendário.
 *
 * Existe porque o Raio-X do dashboard passou a aceitar mês passado: sem o
 * último dia, a consulta traria também tudo que veio depois. É aritmética de
 * calendário — o tipo de coisa que erra em silêncio e só aparece no número do
 * relatório.
 */
describe('recorteDoMes', () => {
  it('devolve o primeiro e o último dia de um mês de 31 dias', () => {
    expect(recorteDoMes(2026, 8)).toEqual({ inicio: '2026-08-01', fim: '2026-08-31' });
  });

  it('devolve o primeiro e o último dia de um mês de 30 dias', () => {
    expect(recorteDoMes(2026, 9)).toEqual({ inicio: '2026-09-01', fim: '2026-09-30' });
  });

  it('acerta fevereiro em ano comum', () => {
    expect(recorteDoMes(2026, 2)).toEqual({ inicio: '2026-02-01', fim: '2026-02-28' });
  });

  // O caso que uma constante 28 escrita à mão perderia: a venda do dia 29
  // sumiria do relatório sem aviso nenhum.
  it('acerta fevereiro em ano bissexto', () => {
    expect(recorteDoMes(2028, 2)).toEqual({ inicio: '2028-02-01', fim: '2028-02-29' });
  });

  it('acerta dezembro sem vazar para o ano seguinte', () => {
    expect(recorteDoMes(2026, 12)).toEqual({ inicio: '2026-12-01', fim: '2026-12-31' });
  });

  it('põe o zero à esquerda que o Postgres espera', () => {
    expect(recorteDoMes(2026, 1)).toEqual({ inicio: '2026-01-01', fim: '2026-01-31' });
  });

  // Devolver null é o que faz a rota cair no mês corrente em vez de montar uma
  // consulta com data inventada.
  it('recusa mês fora de 1-12', () => {
    expect(recorteDoMes(2026, 0)).toBeNull();
    expect(recorteDoMes(2026, 13)).toBeNull();
  });

  it('recusa ano absurdo e valor não numérico', () => {
    expect(recorteDoMes(20260, 8)).toBeNull();
    expect(recorteDoMes(1999, 8)).toBeNull();
    expect(recorteDoMes(NaN, 8)).toBeNull();
    expect(recorteDoMes(2026, NaN)).toBeNull();
  });
});

describe('nomeDoMes', () => {
  it('nomeia os meses pelo número do calendário', () => {
    expect(nomeDoMes(1)).toBe('Janeiro');
    expect(nomeDoMes(9)).toBe('Setembro');
    expect(nomeDoMes(12)).toBe('Dezembro');
  });

  it('devolve vazio fora da faixa, em vez de "undefined" na tela', () => {
    expect(nomeDoMes(0)).toBe('');
    expect(nomeDoMes(13)).toBe('');
  });
});
