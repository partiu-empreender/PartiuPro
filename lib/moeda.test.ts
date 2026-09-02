import { describe, expect, it } from 'vitest';
import { aplicarMascaraMoeda, formatarMoeda, parsearMoeda } from '@/lib/moeda';

describe('parsearMoeda', () => {
  // O bug que originou o arquivo: a Tania digitava 100.000 e o sistema
  // gravava 99.700. Se este teste cair, o defeito voltou.
  it('lê cem mil em todas as formas que ela digita', () => {
    expect(parsearMoeda('100000')).toBe(100000);
    expect(parsearMoeda('100.000')).toBe(100000);
    expect(parsearMoeda('100.000,00')).toBe(100000);
    expect(parsearMoeda('R$ 100.000,00')).toBe(100000);
  });

  // Number('100.000') devolve 100 — a armadilha que este módulo existe pra
  // desarmar.
  it('trata ponto como milhar quando agrupa de três em três', () => {
    expect(parsearMoeda('1.234')).toBe(1234);
    expect(parsearMoeda('1.234.567')).toBe(1234567);
  });

  // Sem os três dígitos não é milhar: "100.5" é cem e cinquenta centavos.
  it('trata ponto como decimal quando não é agrupamento de milhar', () => {
    expect(parsearMoeda('100.5')).toBe(100.5);
    expect(parsearMoeda('100.50')).toBe(100.5);
  });

  it('usa a vírgula como decimal', () => {
    expect(parsearMoeda('1.500,75')).toBe(1500.75);
    expect(parsearMoeda('0,99')).toBe(0.99);
  });

  it('arredonda para centavos', () => {
    expect(parsearMoeda('10,999')).toBe(11);
  });

  it('aceita número pronto', () => {
    expect(parsearMoeda(2500)).toBe(2500);
  });

  // Devolver null e não 0: campo vazio não é meta zerada.
  it('devolve null pro que não é valor', () => {
    expect(parsearMoeda('')).toBeNull();
    expect(parsearMoeda(null)).toBeNull();
    expect(parsearMoeda(undefined)).toBeNull();
    expect(parsearMoeda('abc')).toBeNull();
    expect(parsearMoeda('-500')).toBeNull();
  });
});

describe('aplicarMascaraMoeda', () => {
  it('agrupa o milhar enquanto digita', () => {
    expect(aplicarMascaraMoeda('100000')).toBe('100.000');
    expect(aplicarMascaraMoeda('1234567')).toBe('1.234.567');
  });

  // Digitar 1, 10, 100... não pode virar "1,00" no meio do caminho: o cursor
  // pularia pra depois da vírgula e o número sairia errado.
  it('não inventa centavos', () => {
    expect(aplicarMascaraMoeda('1')).toBe('1');
    expect(aplicarMascaraMoeda('100')).toBe('100');
  });

  it('preserva a vírgula digitada e limita os centavos', () => {
    expect(aplicarMascaraMoeda('1000,')).toBe('1.000,');
    expect(aplicarMascaraMoeda('1000,5')).toBe('1.000,5');
    expect(aplicarMascaraMoeda('1000,567')).toBe('1.000,56');
  });

  it('ignora vírgula repetida', () => {
    expect(aplicarMascaraMoeda('10,,5')).toBe('10,5');
  });

  it('devolve vazio pro que não tem dígito', () => {
    expect(aplicarMascaraMoeda('')).toBe('');
    expect(aplicarMascaraMoeda('R$')).toBe('');
  });
});

describe('a máscara e o parse conversam', () => {
  // A garantia que importa: o que a tela mostra é o que o banco recebe.
  it('o texto mascarado volta a ser o número original', () => {
    for (const valor of [50, 199.9, 1500, 100000, 1234567.89]) {
      const digitado = aplicarMascaraMoeda(
        valor.toFixed(2).replace('.', ','),
      );
      expect(parsearMoeda(digitado)).toBe(valor);
    }
  });

  it('formatarMoeda produz texto que parsearMoeda relê', () => {
    expect(parsearMoeda(formatarMoeda(100000))).toBe(100000);
  });
});
