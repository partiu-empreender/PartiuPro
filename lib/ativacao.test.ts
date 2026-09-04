import { describe, expect, it } from 'vitest';
import {
  diasDesde,
  passoDoFunil,
  resumirFunil,
  type SinaisDeUso,
} from '@/lib/ativacao';

const nada: SinaisDeUso = {
  temProduto: false,
  temCliente: false,
  temMeta: false,
  temAtendimento: false,
  temVenda: false,
};

const ONTEM = '2026-09-03T12:00:00Z';
const AGORA = new Date('2026-09-04T12:00:00Z').getTime();

describe('passoDoFunil', () => {
  // A distinção que o painel não sabia fazer: as duas alunas abaixo apareciam
  // com a mesma frase ("Nenhuma venda registrada") e pedem reações opostas.
  it('separa quem nunca entrou de quem entrou e travou', () => {
    expect(passoDoFunil(null, nada)).toBe('nunca_entrou');
    expect(passoDoFunil(ONTEM, nada)).toBe('entrou_sem_configurar');
  });

  it('qualquer sinal de configuração já sobe o degrau', () => {
    expect(passoDoFunil(ONTEM, { ...nada, temProduto: true })).toBe('configurou_sem_vender');
    expect(passoDoFunil(ONTEM, { ...nada, temCliente: true })).toBe('configurou_sem_vender');
    expect(passoDoFunil(ONTEM, { ...nada, temMeta: true })).toBe('configurou_sem_vender');
    expect(passoDoFunil(ONTEM, { ...nada, temAtendimento: true })).toBe('configurou_sem_vender');
  });

  it('venda vence tudo', () => {
    expect(passoDoFunil(ONTEM, { ...nada, temVenda: true })).toBe('vendeu');
  });

  // Sem o login (a API do auth falhou) a função não pode inventar que a pessoa
  // entrou — mas quem tem venda obviamente entrou, e isso ela sabe.
  it('sem login, ainda classifica quem deixou rastro', () => {
    expect(passoDoFunil(null, { ...nada, temVenda: true })).toBe('vendeu');
    expect(passoDoFunil(null, { ...nada, temProduto: true })).toBe('configurou_sem_vender');
  });
});

describe('resumirFunil', () => {
  it('conta cada degrau e quem esteve por perto nas últimas 24h', () => {
    const r = resumirFunil(
      [
        { passo: 'vendeu', ultimo_login: '2026-09-04T10:00:00Z' },
        { passo: 'entrou_sem_configurar', ultimo_login: '2026-09-04T08:00:00Z' },
        { passo: 'entrou_sem_configurar', ultimo_login: '2026-08-01T08:00:00Z' },
        { passo: 'configurou_sem_vender', ultimo_login: '2026-09-04T09:00:00Z' },
        { passo: 'nunca_entrou', ultimo_login: null },
      ],
      AGORA,
    );

    expect(r.total).toBe(5);
    expect(r.venderam).toBe(1);
    expect(r.entraramSemConfigurar).toBe(2);
    expect(r.configuraramSemVender).toBe(1);
    expect(r.nuncaEntraram).toBe(1);
    // Três logaram nas últimas 24h; o de agosto e o que nunca entrou ficam fora.
    expect(r.ativasEm24h).toBe(3);
  });

  it('aguenta lista vazia', () => {
    const r = resumirFunil([], AGORA);
    expect(r.total).toBe(0);
    expect(r.ativasEm24h).toBe(0);
  });
});

describe('diasDesde', () => {
  it('conta dias inteiros', () => {
    expect(diasDesde('2026-09-03T12:00:00Z', AGORA)).toBe(1);
    expect(diasDesde('2026-09-04T11:00:00Z', AGORA)).toBe(0);
  });

  // "Nunca" não é "faz muito tempo" — a tela escreve frases diferentes.
  it('devolve null pra quem nunca entrou, e pra data inválida', () => {
    expect(diasDesde(null, AGORA)).toBeNull();
    expect(diasDesde('nao e data', AGORA)).toBeNull();
  });
});
