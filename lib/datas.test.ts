import { describe, expect, it } from 'vitest';
import {
  ANOS_DE_LANCAMENTO_RETROATIVO,
  motivoDataDeVendaInvalida,
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
