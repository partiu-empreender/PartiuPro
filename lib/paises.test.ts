import { describe, expect, it } from 'vitest';
import { linkWhatsAppComPais, nomeDoPais, normalizarDDI, PAISES } from '@/lib/paises';

describe('normalizarDDI', () => {
  // O default não é conveniência: os cadastros que já existem não têm DDI
  // nenhum, e todos são brasileiros. Sem este fallback, cada um deles perderia
  // o link de WhatsApp.
  it('cai no Brasil quando não sabe', () => {
    expect(normalizarDDI(null)).toBe('55');
    expect(normalizarDDI('')).toBe('55');
    expect(normalizarDDI('999')).toBe('55');
    expect(normalizarDDI('abc')).toBe('55');
  });

  it('aceita os DDI da lista, com ou sem +', () => {
    expect(normalizarDDI('351')).toBe('351');
    expect(normalizarDDI('+351')).toBe('351');
    expect(normalizarDDI('1')).toBe('1');
  });
});

describe('linkWhatsAppComPais', () => {
  // Comportamento idêntico ao antigo `linkWhatsApp` para número brasileiro:
  // nenhum link existente pode mudar por causa desta mudança.
  it('mantém o link brasileiro igual ao de antes', () => {
    expect(linkWhatsAppComPais('21999998888', '55')).toBe('https://wa.me/5521999998888');
    expect(linkWhatsAppComPais('21999998888', null)).toBe('https://wa.me/5521999998888');
  });

  it('usa o DDI de outro país quando informado', () => {
    expect(linkWhatsAppComPais('912345678', '351')).toBe('https://wa.me/351912345678');
  });

  it('não inventa link para número curto demais', () => {
    expect(linkWhatsAppComPais('123', '55')).toBeNull();
    expect(linkWhatsAppComPais('', '55')).toBeNull();
    expect(linkWhatsAppComPais(null, '55')).toBeNull();
  });
});

describe('a lista de países', () => {
  it('começa pelo Brasil, que é o caso comum', () => {
    expect(PAISES[0]?.ddi).toBe('55');
  });

  // Um DDI repetido faria o seletor mostrar o mesmo país duas vezes e a
  // busca por nome devolver o errado.
  it('não tem DDI repetido', () => {
    const ddis = PAISES.map((p) => p.ddi);
    expect(new Set(ddis).size).toBe(ddis.length);
  });

  it('sabe o nome de cada um', () => {
    expect(nomeDoPais('55')).toBe('Brasil');
    expect(nomeDoPais('351')).toBe('Portugal');
    expect(nomeDoPais('000')).toBe('Brasil');
  });
});
